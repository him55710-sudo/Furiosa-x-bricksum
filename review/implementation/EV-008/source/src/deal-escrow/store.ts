import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ensure,hash,validateDeal,validateMandate,transition,freeze} from './domain.ts';
import type {Deal,Mandate,State} from './domain.ts';

export class DealStore {
  db:DatabaseSync;
  constructor(file='data/private/deal-escrow/state.sqlite'){
    if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS mandates(id TEXT PRIMARY KEY,body TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TRIGGER IF NOT EXISTS immutable_mandate BEFORE UPDATE OF body ON mandates BEGIN SELECT RAISE(ABORT,'IMMUTABLE_MANDATE');END;
      CREATE TABLE IF NOT EXISTS deals(id TEXT PRIMARY KEY,mandate_id TEXT NOT NULL REFERENCES mandates(id),body TEXT NOT NULL,hash TEXT UNIQUE NOT NULL,state TEXT NOT NULL,details TEXT NOT NULL DEFAULT '{}');
      CREATE TRIGGER IF NOT EXISTS immutable_deal BEFORE UPDATE OF body,hash,mandate_id ON deals BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DEAL');END;
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,deal_id TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS controls(company TEXT NOT NULL,seller TEXT NOT NULL,origin TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(company,seller));
      CREATE TRIGGER IF NOT EXISTS no_control_delete BEFORE DELETE ON controls BEGIN SELECT RAISE(ABORT,'MONOTONIC_CONTROL');END;
      CREATE TRIGGER IF NOT EXISTS no_control_update BEFORE UPDATE ON controls BEGIN SELECT RAISE(ABORT,'MONOTONIC_CONTROL');END;
      CREATE TABLE IF NOT EXISTS operations(deal_id TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(deal_id,kind));
      CREATE TABLE IF NOT EXISTS telemetry(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS purchase_intents(id TEXT PRIMARY KEY,mandate_id TEXT NOT NULL REFERENCES mandates(id),dedup_key TEXT NOT NULL,seller_id TEXT NOT NULL,deal_id TEXT UNIQUE NOT NULL,body TEXT NOT NULL,UNIQUE(mandate_id,dedup_key));
      CREATE TRIGGER IF NOT EXISTS immutable_intent BEFORE UPDATE OF id,mandate_id,dedup_key,seller_id,deal_id ON purchase_intents BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PURCHASE_INTENT');END;
    `);
  }
  transaction<T>(fn:()=>T):T {this.db.exec('BEGIN IMMEDIATE');try{const v=fn();ensure(!(v as any)?.then,'ASYNC_TRANSACTION');this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  mandate(id:string):Mandate {const row=this.db.prepare('SELECT * FROM mandates WHERE id=?').get(id) as any;ensure(row,'MANDATE_NOT_FOUND');return {...JSON.parse(row.body),status:row.revoked?'REVOKED':'ACTIVE'};}
  createMandate(input:Mandate){const m=validateMandate(input);ensure(m.status==='ACTIVE','MANDATE_NOT_ACTIVE');this.db.prepare('INSERT INTO mandates(id,body) VALUES(?,?)').run(m.mandate_id,JSON.stringify(m));this.event(m.mandate_id,'MANDATE_CREATED',m,'human',m.company_id);return m;}
  revoke(id:string){this.mandate(id);this.db.prepare('UPDATE mandates SET revoked=1 WHERE id=?').run(id);this.event(id,'MANDATE_REVOKED',{},'human','company-admin');}
  createDeal(input:Deal,mandateId:string){const d=validateDeal(input),m=this.mandate(mandateId);ensure(d.buyer_id===m.buyer_id,'BUYER_ALLOWED');
    if(d.supersedes_deal_id){const prev=this.get(d.supersedes_deal_id);ensure(prev.mandateId===mandateId,'SUPERSESSION_SCOPE');}
    this.db.prepare('INSERT INTO deals(id,mandate_id,body,hash,state) VALUES(?,?,?,?,?)').run(d.deal_id,mandateId,JSON.stringify(d),hash(d),'NEGOTIATING');
    this.event(d.deal_id,'NEGOTIATION_STARTED',{mandate_id:mandateId},'system','deal-engine');this.move(d.deal_id,'DEAL_PROPOSED');this.event(d.deal_id,'DEAL_PROPOSED',{deal:d,deal_hash:hash(d)},'agent',d.buyer_id);return this.get(d.deal_id);
  }
  get(id:string){const row=this.db.prepare('SELECT * FROM deals WHERE id=?').get(id) as any;ensure(row,'DEAL_NOT_FOUND');return {deal:freeze(validateDeal(JSON.parse(row.body))),dealHash:row.hash as string,mandateId:row.mandate_id as string,state:row.state as State,details:JSON.parse(row.details)};}
  list(){return (this.db.prepare('SELECT id FROM deals ORDER BY rowid DESC').all() as any[]).map(x=>this.get(x.id));}
  move(id:string,to:State){const row=this.get(id);transition(row.state,to);const r=this.db.prepare('UPDATE deals SET state=? WHERE id=? AND state=?').run(to,id,row.state);ensure(r.changes===1,'STATE_CONFLICT');}
  details(id:string,patch:Record<string,unknown>){const row=this.get(id);this.db.prepare('UPDATE deals SET details=? WHERE id=?').run(JSON.stringify({...row.details,...patch}),id);}
  event(dealId:string,eventType:string,payload:unknown,actorType='system',actorId='deal-engine'){
    const previous=this.events(dealId).at(-1);const event={event_id:randomUUID(),deal_id:dealId,event_type:eventType,timestamp:new Date().toISOString(),actor_type:actorType,actor_id:actorId,structured_payload:payload,previous_event_hash:previous?.event_hash??null};
    const body={...event,event_hash:hash(event)};this.db.prepare('INSERT INTO events(deal_id,body) VALUES(?,?)').run(dealId,JSON.stringify(body));return body;
  }
  events(dealId:string):any[]{return (this.db.prepare('SELECT body FROM events WHERE deal_id=? ORDER BY seq').all(dealId) as any[]).map(x=>JSON.parse(x.body));}
  control(company:string,seller:string){const row=this.db.prepare('SELECT body FROM controls WHERE company=? AND seller=?').get(company,seller) as any;return row?JSON.parse(row.body):null;}
  activate(company:string,seller:string,origin:string,validation:any){
    const row=this.get(origin);ensure(row.state==='REFUNDED'&&row.deal.seller_id===seller&&this.mandate(row.mandateId).company_id===company,'UNTRUSTED_CONTROL_ORIGIN');
    ensure(validation.verified===false&&validation.failure_reason_code==='DELIVERY_REQUIREMENT_FAILED'&&hash(validation)===hash(row.details.validation),'UNTRUSTED_FAILURE');
    const control={rule:'REQUIRE_PREVIEW',company_id:company,seller_id:seller,origin_deal_id:origin,failure_reason_code:validation.failure_reason_code,validation_hash:hash(validation),status:'ACTIVE',created_at:new Date().toISOString()};
    const r=this.db.prepare('INSERT OR IGNORE INTO controls VALUES(?,?,?,?)').run(company,seller,origin,JSON.stringify(control));if(r.changes)this.event(origin,'CONTROL_MEMORY_ADDED',control,'system','trusted-failure-mapper');return this.control(company,seller);
  }
  controls(){return (this.db.prepare('SELECT body FROM controls').all() as any[]).map(x=>JSON.parse(x.body));}
  accounting(mandateId:string,exclude?:string){let spent=0,reserved=0;for(const row of this.list()){if(row.mandateId!==mandateId||row.deal.deal_id===exclude)continue;
    if(row.state==='SETTLED')spent+=row.deal.price_minor;
    else if(['POLICY_APPROVED','ESCROW_FUNDED','DELIVERY_SUBMITTED','DELIVERY_VERIFIED'].includes(row.state)||this.operation(row.deal.deal_id,'fund')?.status==='PENDING')reserved+=row.deal.price_minor;
  }return {spent,reserved};}
  operation(id:string,kind:string){const r=this.db.prepare('SELECT body FROM operations WHERE deal_id=? AND kind=?').get(id,kind) as any;return r?JSON.parse(r.body):null;}
  saveOperation(id:string,kind:string,body:any){this.db.prepare('INSERT INTO operations VALUES(?,?,?) ON CONFLICT(deal_id,kind) DO UPDATE SET body=excluded.body').run(id,kind,JSON.stringify(body));}
  telemetry(id:string,body:any){this.db.prepare('INSERT INTO telemetry VALUES(?,?,?)').run(randomUUID(),id,JSON.stringify(body));}
  usage(id?:string){const rows=id?this.db.prepare('SELECT body FROM telemetry WHERE deal_id=?').all(id):this.db.prepare('SELECT body FROM telemetry').all();return (rows as any[]).map(x=>JSON.parse(x.body));}
  intent(id:string){const row=this.db.prepare('SELECT * FROM purchase_intents WHERE id=?').get(id) as any;return row?{...JSON.parse(row.body),id:row.id,mandate_id:row.mandate_id,seller_id:row.seller_id,deal_id:row.deal_id}:null;}
  intents(){return (this.db.prepare('SELECT id FROM purchase_intents ORDER BY rowid DESC').all() as any[]).map(row=>this.intent(row.id));}
  intentForDeal(id:string){const row=this.db.prepare('SELECT id FROM purchase_intents WHERE deal_id=?').get(id) as any;return row?this.intent(row.id):null;}
  getOrCreateIntent(mandateId:string,sellerId:string,key='primary'){
    return this.transaction(()=>{const m=this.mandate(mandateId);ensure(m.status==='ACTIVE','MANDATE_NOT_ACTIVE');ensure(typeof key==='string'&&key.length>0&&key.length<=160,'INVALID_INTENT_KEY');
      const existing=this.db.prepare('SELECT id FROM purchase_intents WHERE mandate_id=? AND dedup_key=?').get(mandateId,key) as any;
      if(existing){const intent=this.intent(existing.id);ensure(intent.seller_id===sellerId,'PURCHASE_INTENT_SELLER_CONFLICT');return intent;}
      const id=randomUUID(),dealId=randomUUID(),body={status:'READY',created_at:new Date().toISOString(),explicit_new_purchase:key.startsWith('new-'),retry_of:key.startsWith('retry-')?key.slice(6):null};
      this.db.prepare('INSERT INTO purchase_intents VALUES(?,?,?,?,?,?)').run(id,mandateId,key,sellerId,dealId,JSON.stringify(body));this.event(mandateId,'PURCHASE_INTENT_CREATED',{intent_id:id,seller_id:sellerId,deal_id:dealId,...body},'human',m.company_id);return this.intent(id);
    });
  }
  updateIntent(id:string,patch:Record<string,unknown>){const intent=this.intent(id);ensure(intent,'PURCHASE_INTENT_NOT_FOUND');const {id:_,mandate_id,seller_id,deal_id,...body}=intent;this.db.prepare('UPDATE purchase_intents SET body=? WHERE id=?').run(JSON.stringify({...body,...patch}),id);return this.intent(id);}
  startIntent(id:string){return this.transaction(()=>{const intent=this.intent(id);ensure(intent,'PURCHASE_INTENT_NOT_FOUND');if(intent.status!=='READY')return {intent,started:false};return {intent:this.updateIntent(id,{status:'RUNNING',started_at:new Date().toISOString()}),started:true};});}
  restoreInterruptedIntents(){return this.transaction(()=>{for(const intent of this.intents())if(intent.status==='RUNNING')this.updateIntent(intent.id,{status:'INTERRUPTED',error:'NEGOTIATION_INTERRUPTED',completed_at:new Date().toISOString()});});}
  ensureIntentFunding(id:string){
    const r=this.get(id),intent=this.intentForDeal(id);if(!intent){ensure(!this.mandate(r.mandateId).task_requirements,'PURCHASE_INTENT_REQUIRED');return;}
    ensure(intent.mandate_id===r.mandateId&&intent.seller_id===r.deal.seller_id,'PURCHASE_INTENT_SCOPE');ensure(!intent.funding_claim||intent.funding_claim===id,'PURCHASE_INTENT_ALREADY_CLAIMED');
    if(!intent.funding_claim){this.updateIntent(intent.id,{funding_claim:id});this.event(id,'PURCHASE_INTENT_CLAIMED',{intent_id:intent.id},'system','intent-guard');}
  }
  close(){this.db.close();}
}
