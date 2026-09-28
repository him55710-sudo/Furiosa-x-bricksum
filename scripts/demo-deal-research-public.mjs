import {existsSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {openChain} from '../src/deal-escrow/chain.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';import {DealEngine} from '../src/deal-escrow/engine.ts';
import {KilnClient} from '../src/deal-escrow/kiln.ts';
import {researchTask,marketOffers,resolveSelection} from '../src/deal-escrow/research.ts';
import {reference,referenceDigest,researchRequirements,sourcePacket} from '../src/deal-escrow/reference.ts';
import {now} from '../src/deal-escrow/domain.ts';import {receipt,verifyReceipt,efficiency} from '../src/deal-escrow/audit.ts';
import {readJson,saveJson,onceInference,observeOperation} from '../src/deal-escrow/public-run.mjs';

process.env.SEPOLIA_RPC_URL??='https://ethereum-sepolia-rpc.publicnode.com';
const directory='data/private/deal-escrow/source-sepolia',journalFile=`${directory}/run.json`;
if(!existsSync(`${directory}/identities.json`))throw new Error('PROVISION_TEST_IDENTITIES_FIRST');
const journal=existsSync(journalFile)?readJson(journalFile):{run:randomUUID(),status:'RUNNING',started_at:new Date().toISOString(),scenarios:{}};
const out=`artifacts/deal-escrow/source-sepolia/${journal.run}`,persist=()=>saveJson(journalFile,journal);
persist();const chain=await openChain({directory,publicNetwork:true}).catch(error=>{journal.last_error=error.shortMessage??error.code??'CHAIN_OPEN_FAILED';persist();console.error(JSON.stringify({stage:'CHAIN_OPEN_STOPPED',reason:journal.last_error}));process.exit(1);});
const store=new DealStore(`${directory}/state.sqlite`),engine=new DealEngine(store,chain);
const log=(stage,detail={})=>console.log(JSON.stringify({at:new Date().toISOString(),stage,...detail}));
const observe=(id,kind,start)=>observeOperation(engine,id,kind,start,{onWait:detail=>log('WAITING_FOR_CONFIRMATIONS',detail)});
const scenario=(name)=>{if(!journal.scenarios[name]){journal.scenarios[name]={mandate_id:randomUUID(),model_record_id:randomUUID()};persist();}return journal.scenarios[name];};
function mandate(name){
  const s=scenario(name);
  try{return store.mandate(s.mandate_id);}catch(error){if(error.message!=='MANDATE_NOT_FOUND')throw error;}
  const t=now();return engine.mandate({mandate_id:s.mandate_id,company_id:`source-public-${journal.run}`,buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+7200,task_requirements:structuredClone(researchRequirements)});
}
function createDeal(name,base,seller='seller-b',price=base.price_minor){
  const m=mandate(name),s=scenario(name);
  if(!s.deal_id){s.deal_id=store.getOrCreateIntent(m.mandate_id,seller).deal_id;persist();}
  if(!store.list().some(r=>r.deal.deal_id===s.deal_id)){
    const t=now(),deal={...base,deal_id:s.deal_id,buyer_id:m.buyer_id,seller_id:seller,price_minor:price,created_at:t,expires_at:Math.min(t+1800,m.expires_at),supersedes_deal_id:null};
    engine.propose(deal,m.mandate_id);engine.agentAction('accept_deal',{deal_id:deal.deal_id});store.updateIntent(store.intentForDeal(deal.deal_id).id,{status:'COMPLETED'});
    store.event(deal.deal_id,'DEMO_ADVERSARIAL_PROPOSAL',{scenario:name,source:'Explicit fault injection based on actual negotiated terms; not an additional model decision.'});
  }
  return s.deal_id;
}
async function funded(id){const op=store.operation(id,'fund');if(op?.status==='CONFIRMED')return;await observe(id,'fund',op?undefined:()=>engine.fund(id));}
async function delivered(id,raw,expected){
  let r=store.get(id);if(r.state===expected)return;
  const kind=expected==='SETTLED'?'release':'refund';
  if(r.state==='ESCROW_FUNDED')await observe(id,kind,()=>engine.deliver(id,raw));else await observe(id,kind);
  if(store.get(id).state!==expected)throw new Error('UNEXPECTED_SETTLEMENT_OUTCOME');
}
try{
  if(chain.deployment.controller===chain.deployment.buyer)throw new Error('BUYER_MUST_BE_SEPARATE');
  saveJson(`${out}/trusted-deployment.json`,chain.deployment);
  if(journal.status==='PASS'){
    const previous=readJson(`${out}/report.json`);
    for(const item of previous.results)if((await verifyReceipt(readJson(`${out}/${item.id}.json`),chain)).verdict!=='VALID')throw new Error('EXISTING_AUDIT_FAILED');
    log('RECHECKED_EXISTING_RUN',{run:journal.run,new_transactions:0,new_kiln_calls:0});
  }else{
    if(!journal.source_check){
      const response=await fetch(reference.source.url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('ISSUER_DOCUMENT_UNAVAILABLE');
      const bytes=Buffer.from(await response.arrayBuffer()),digest=createHash('sha256').update(bytes).digest('hex');
      if(digest!==reference.source.sha256)throw new Error('ISSUER_DOCUMENT_VERSION_CHANGED');
      journal.source_check={url:reference.source.url,sha256:digest,bytes:bytes.length,checked_at:new Date().toISOString(),reference_digest:referenceDigest,human_review:reference.annotation.human_review};persist();
    }
    await engine.recover();
    const m=mandate('source-success'),s=scenario('source-success');
    const client=new KilnClient({onRecord:r=>store.telemetry(s.model_record_id,r)});
    if(!s.deal_id){
      const offers=marketOffers.map(o=>o.offer_id==='primary-reports'?{...o,deadline:180}:o);
      const {publicOffers}=await import('../src/deal-escrow/research.ts');
      const decision=await onceInference(`${directory}/inference.json`,'buyer-comparison',async()=>{await client.models();return client.selectOffer({human_task:researchTask,mandate:m,offers:publicOffers(offers)});});
      const selected=resolveSelection(m,offers,decision.args);if(!selected.accepted)throw new Error(`MODEL_PROPOSAL_STOPPED:${selected.reason}`);
      s.deal_id=store.getOrCreateIntent(m.mandate_id,selected.offer.seller_id).deal_id;s.deal={...selected.deal,deal_id:s.deal_id};s.decision=decision;s.offers=publicOffers(offers);persist();
    }
    if(!store.list().some(r=>r.deal.deal_id===s.deal_id)){
      engine.propose(s.deal,m.mandate_id);store.details(s.deal_id,{negotiation:[{actor:'Buyer Agent',...s.decision}],research:{task:researchTask,offers:s.offers,reference_dataset_id:reference.id,seller_response:'Published floor-price policy; seller response is code, not a separate LLM call.'}});
      store.event(s.deal_id,'NEGOTIATION_EVIDENCE',{decision:s.decision,offers:s.offers,task:researchTask},'system','kiln-source-public');
      engine.agentAction('accept_deal',{deal_id:s.deal_id});store.updateIntent(store.intentForDeal(s.deal_id).id,{status:'COMPLETED'});
    }
    log('SOURCE_DEAL',{deal_id:s.deal_id,price_minor:s.deal.price_minor,buyer:chain.deployment.buyer});
    await funded(s.deal_id);
    const extracted=await onceInference(`${directory}/inference.json`,'seller-source-extraction',()=>client.extractDataset({human_task:researchTask,source_document:sourcePacket}));
    const raw=JSON.stringify(extracted.args.rows);
    store.details(s.deal_id,{extracted_delivery:{raw,model:extracted.model,request_id:extracted.request_id},source_check:journal.source_check});
    store.db.prepare('UPDATE telemetry SET deal_id=? WHERE deal_id=?').run(s.deal_id,s.model_record_id);
    await delivered(s.deal_id,raw,'SETTLED');
    log('SOURCE_DELIVERY_SETTLED',{deal_id:s.deal_id,rows:extracted.args.rows.length,tx_hash:store.operation(s.deal_id,'release').txHash});

    const badId=createDeal('wrong-metric-refund',s.deal),badRows=structuredClone(extracted.args.rows);
    const quarter=badRows.find(r=>r.quarter==='2025-Q1');if(!quarter)throw new Error('EXPECTED_QUARTER_MISSING');quarter.capex=3441;quarter.source_value=-3441;
    if(!store.get(badId).details.fault_injection)store.details(badId,{fault_injection:{source_deal:s.deal_id,kind:'Swap facility-investment value for total investing activities; preserve four rows and provenance fields.',model_generated_mistake:false}});
    await funded(badId);await delivered(badId,JSON.stringify(badRows),'REFUNDED');
    log('WRONG_METRIC_REFUNDED',{deal_id:badId,tx_hash:store.operation(badId,'refund').txHash});

    for(const [name,seller,price,expected,reason] of [
      ['preview-denied','seller-b',s.deal.price_minor,'PREVIEW_REQUIRED','PREVIEW_REQUIRED'],
      ['budget-denied','seller-a',250,'BLOCKED','MAX_SINGLE'],
      ['human-stop','seller-a',s.deal.price_minor,'BLOCKED','MANDATE_ACTIVE'],
    ]){
      const id=createDeal(name,s.deal,seller,price);
      if(name==='human-stop'&&store.mandate(scenario(name).mandate_id).status==='ACTIVE')store.transaction(()=>store.revoke(scenario(name).mandate_id));
      if(!store.events(id).some(e=>e.event_type==='TRANSACTION_BLOCKED'))await engine.fund(id);
      if(store.get(id).state!==expected||store.operation(id,'fund')||!store.events(id).some(e=>e.event_type==='TRANSACTION_BLOCKED'&&e.structured_payload.reason===reason))throw new Error('BOUNDARY_NOT_ENFORCED');
      log('RECORDED_STOP',{scenario:name,deal_id:id,reason,signed_funding:0});
    }
    const results=[];
    for(const [name,item] of Object.entries(journal.scenarios)){
      const evidence=receipt(engine,item.deal_id),verification=await verifyReceipt(evidence,chain);if(verification.verdict!=='VALID')throw new Error(`AUDIT_NOT_VALID:${name}`);
      saveJson(`${out}/${item.deal_id}.json`,evidence);results.push({scenario:name,id:item.deal_id,state:evidence.state,verification,transactions:evidence.transactions});
    }
    const report={schema_version:1,run:journal.run,status:'PASS',started_at:journal.started_at,completed_at:new Date().toISOString(),evidence_directory:out,network:chain.deployment,source_check:journal.source_check,task:researchTask,results,efficiency:efficiency(results.flatMap(r=>store.usage(r.id))),notes:['Actual issuer document hash re-fetched and matched; model extracts from a curated source table packet.','Fixed reference-value validation, not generic PDF verification; human review remains pending.','Wrong-metric delivery and boundary cases are explicit fault injections.','Scripted demo mandates; independent buyer address; operator supplies free test assets.','Two canonical confirmations for application progression; finalized independent RPC verification is separate.']};
    saveJson(`${out}/report.json`,report);saveJson('artifacts/deal-escrow/source-sepolia/latest.json',report);journal.status='PASS';persist();
    log('PASS',{report:`${out}/report.json`,tokens:report.efficiency});
  }
}catch(error){journal.last_error=error.message;persist();log('STOPPED_RESUMABLE',{reason:error.message});process.exitCode=1;}
finally{store.close();await chain.close();}
