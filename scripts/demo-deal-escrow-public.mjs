// Durable public-testnet orchestration. Re-running resumes the same identities,
// purchase intents and signed transactions; it never invents another purchase.
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openChain} from '../src/deal-escrow/chain.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';
import {DealEngine} from '../src/deal-escrow/engine.ts';
import {now,defaultTaskRequirements} from '../src/deal-escrow/domain.ts';
import {negotiate} from '../src/deal-escrow/kiln.ts';
import {fixtureDelivery} from '../src/deal-escrow/delivery.ts';
import {receipt,verifyReceipt,efficiency} from '../src/deal-escrow/audit.ts';

process.env.SEPOLIA_RPC_URL??='https://ethereum-sepolia-rpc.publicnode.com';
const directory='data/private/deal-escrow/sepolia',journalFile=`${directory}/public-demo.json`;
const read=file=>JSON.parse(readFileSync(file,'utf8'));
function save(file,value){mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});writeFileSync(`${file}.tmp`,JSON.stringify(value,null,2)+'\n');renameSync(`${file}.tmp`,file);}
let journal=existsSync(journalFile)?read(journalFile):{schema_version:1,run:randomUUID(),created_at:new Date().toISOString(),status:'RUNNING',scenarios:{}};
save(journalFile,journal);
const out=`artifacts/deal-escrow/runs/${journal.run}`;
mkdirSync(out,{recursive:true});
const chain=await openChain({directory,publicNetwork:true});
const store=new DealStore(`${directory}/state.sqlite`),engine=new DealEngine(store,chain);
save(`${out}/deployment.json`,chain.deployment);
function log(stage,detail={}){console.log(JSON.stringify({at:new Date().toISOString(),stage,...detail}));}
function persist(){save(journalFile,journal);}
function task(name,{past=false,allowed=['seller-a','seller-b']}={}){
  if(journal.scenarios[name])return journal.scenarios[name];
  const t=now(),id=randomUUID();
  // These are explicit scripted demo approvals; a real person uses the UI.
  engine.mandate({mandate_id:id,company_id:`public-demo-${journal.run}`,buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:allowed,category:'RESEARCH_DATA',status:'ACTIVE',created_at:past?t-100:t,expires_at:past?t-1:t+3600,task_requirements:structuredClone(defaultTaskRequirements)});
  journal.scenarios[name]={mandate_id:id};persist();return journal.scenarios[name];
}
async function negotiated(name,seller){
  const s=task(name);
  if(!s.intent_id){const intent=store.getOrCreateIntent(s.mandate_id,seller);s.intent_id=intent.id;s.deal_id=intent.deal_id;persist();}
  const intent=store.intent(s.intent_id),existing=store.list().find(r=>r.deal.deal_id===s.deal_id);
  if(!existing){if(intent.status!=='READY')throw new Error(`NEGOTIATION_REQUIRES_REVIEW:${name}:${intent.status}`);await negotiate(engine,s.mandate_id,seller,{intentId:s.intent_id});}
  const r=store.get(s.deal_id);
  if(['NEGOTIATING','DEAL_PROPOSED'].includes(r.state))throw new Error(`NEGOTIATION_INCOMPLETE:${name}`);
  log('NEGOTIATED',{scenario:name,deal_id:s.deal_id,price_minor:r.deal.price_minor,minimum_rows:r.deal.requirements.minimum_rows,delivery_seconds:r.deal.deadline});return s.deal_id;
}
async function observe(id,kind,start){
  let initialError;
  if(start)try{await start();}catch(e){initialError=e.message;}
  const end=Date.now()+240000;
  while(Date.now()<end){
    const op=store.operation(id,kind);
    if(op?.status==='CONFIRMED')return;
    if(op?.status!=='PENDING')throw new Error(`OPERATION_STOPPED:${kind}:${op?.status??store.get(id).state}:${initialError??''}`);
    log('AWAITING_CANONICAL_CONFIRMATION',{deal_id:id,kind,tx_hash:op.txHash??null});
    await new Promise(resolve=>setTimeout(resolve,4000));
    await engine.recover();
  }
  throw new Error(`OBSERVATION_TIMEOUT_RESUME_SAME_RUN:${id}:${kind}`);
}
async function transact(name,seller,rows,expected){
  const id=await negotiated(name,seller);let r=store.get(id);
  if(!store.operation(id,'fund'))await observe(id,'fund',()=>engine.fund(id));
  else if(store.operation(id,'fund').status!=='CONFIRMED')await observe(id,'fund');
  r=store.get(id);
  const kind=expected==='SETTLED'?'release':'refund';
  if(r.state==='ESCROW_FUNDED')await observe(id,kind,()=>engine.deliver(id,fixtureDelivery(rows)));
  else if(r.state!==expected)await observe(id,kind);
  r=store.get(id);if(r.state!==expected)throw new Error(`UNEXPECTED_OUTCOME:${name}:${r.state}`);
  log(expected,{deal_id:id,tx_hash:store.operation(id,kind).txHash});
}
function derived(name,base,{price,expired=false,revoked=false,seller}={}){
  const s=task(name,{past:expired});
  if(!s.deal_id){const intent=store.getOrCreateIntent(s.mandate_id,seller??base.seller_id);s.deal_id=intent.deal_id;persist();}
  if(!store.list().some(r=>r.deal.deal_id===s.deal_id)){
    const t=now();engine.propose({...base,deal_id:s.deal_id,seller_id:seller??base.seller_id,price_minor:price??base.price_minor,created_at:expired?t-90:t,expires_at:expired?t-2:t+600,supersedes_deal_id:null},s.mandate_id);
    engine.agentAction('accept_deal',{deal_id:s.deal_id});store.updateIntent(store.intentForDeal(s.deal_id).id,{status:'COMPLETED'});
    store.event(s.deal_id,'DEMO_ADVERSARIAL_PROPOSAL',{scenario:name,source:'scripted boundary stimulus; no additional LLM call'});
    if(revoked)store.transaction(()=>store.revoke(s.mandate_id));
  }
  return s.deal_id;
}
try {
  if(journal.status==='PASS'){
    const recorded=read(`${out}/report.json`),verdicts=[];
    for(const item of recorded.results)verdicts.push(await verifyReceipt(read(`${out}/${item.id}.json`),chain));
    if(verdicts.some(r=>r.verdict!=='VALID'))throw new Error('RECORDED_AUDIT_RECHECK_FAILED');
    log('RECHECKED_EXISTING_RUN',{run:journal.run,transactions_sent:0,kiln_calls:0,receipt_bytes_changed:false});
  }else{
  if(journal.status!=='PASS'){
    await engine.recover();
    await transact('success','seller-a',52,'SETTLED');
    await transact('refund','seller-b',7,'REFUNDED');
    const a=store.get(journal.scenarios.success.deal_id).deal,b=store.get(journal.scenarios.refund.deal_id).deal;
    for(const [name,base,options,state,reason] of [
      ['preview-denied',b,{},'PREVIEW_REQUIRED','PREVIEW_REQUIRED'],
      ['budget-denied',a,{price:250},'BLOCKED','MAX_SINGLE'],
      ['expired-denied',a,{expired:true},'EXPIRED','MANDATE_NOT_EXPIRED'],
      ['human-stop',a,{revoked:true},'BLOCKED','MANDATE_ACTIVE'],
    ]){
      const id=derived(name,base,options);
      if(!store.events(id).some(e=>e.event_type==='TRANSACTION_BLOCKED'))await engine.fund(id);
      const r=store.get(id),blocked=store.events(id).find(e=>e.event_type==='TRANSACTION_BLOCKED');
      if(r.state!==state||blocked?.structured_payload.reason!==reason||store.operation(id,'fund'))throw new Error(`BOUNDARY_NOT_ENFORCED:${name}`);
      log('BLOCKED',{scenario:name,deal_id:id,reason,no_signed_funding:true});
    }
  }
  const results=[];
  for(const [scenario,s] of Object.entries(journal.scenarios)){
    const r=receipt(engine,s.deal_id),verification=await verifyReceipt(r,chain);
    save(`${out}/${s.deal_id}.json`,r);
    results.push({scenario,id:s.deal_id,state:r.state,verification,transactions:r.transactions});
  }
  if(results.length!==6||results.some(r=>r.verification.verdict!=='VALID'))throw new Error('AUDIT_NOT_VALID');
  const report={schema_version:2,run:journal.run,created_at:journal.created_at,completed_at:new Date().toISOString(),status:'PASS',directory,evidence_directory:out,network:chain.deployment,results,efficiency:efficiency(results.flatMap(r=>store.usage(r.id))),scenario_note:'Two distinct scripted company-approved task mandates. Amounts are native test assets, not USD. Synthetic CAPEX fixtures; structural validation only. Public demo uses two canonical confirmations; independent finalized verification is separate.'};
  save(`${out}/report.json`,report);save('artifacts/deal-escrow/latest-demo.json',report);save('artifacts/deal-escrow/sepolia/latest.json',report);
  journal.status='PASS';persist();log('PASS',{report:`${out}/report.json`,tokens:report.efficiency});
  }
}catch(e){journal.last_error=e.message;journal.updated_at=new Date().toISOString();persist();log('STOPPED_RESUMABLE',{reason:e.message,journal:journalFile});process.exitCode=1;}
finally {store.close();await chain.close();}
