import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';
import {DealStore} from '../../src/deal-escrow/store.ts';import {DealEngine} from '../../src/deal-escrow/engine.ts';import {openChain} from '../../src/deal-escrow/chain.mjs';import {fixtureDelivery} from '../../src/deal-escrow/delivery.ts';import {now,hash} from '../../src/deal-escrow/domain.ts';
// Recorded real Kiln + real local EVM run. Offline tamper checks do not impersonate RPC verification.
const report=JSON.parse(readFileSync('artifacts/deal-escrow/runs/a19c9740-e56d-4de3-acdb-e4a2fd4d24c9/report.json','utf8')),r=JSON.parse(readFileSync(`${report.evidence_directory}/${report.results.find(r=>r.state==='SETTLED').id}.json`,'utf8'));
test('historical receipt reconstructs original checks and explicitly reports current quality shortfall',async()=>{const v=await verifyReceipt(r);assert.equal(v.verdict,'STRUCTURALLY_VALID');assert.equal(v.delivery_quality[0].recorded_validator,'delivery-v1');assert.equal(v.delivery_quality[0].current_checks_pass,false);});
test('receipt detects altered amount, delivery, event history and attestation as INVALID',async()=>{for(const change of [r=>r.deal.price_minor++,r=>r.evidence.delivery='[]',r=>r.evidence.validation.row_count=999,r=>r.events[0].actor_id='intruder',r=>r.evidence.attestation.reason='made up']){const altered=structuredClone(r);change(altered);assert.equal((await verifyReceipt(altered)).verdict,'INVALID');}});
test('missing settlement material and unavailable RPC are INCOMPLETE, not fabricated corruption',async()=>{
  const missing=structuredClone(r);delete missing.transactions.release;assert.equal((await verifyReceipt(missing)).verdict,'INCOMPLETE');
  const v=await verifyReceipt(r,{deployment:r.network,provider:{getTransactionReceipt:async()=>{throw new Error('offline');}}});assert.equal(v.verdict,'INCOMPLETE');assert.equal(v.reason,'RPC_UNAVAILABLE');
});
test('receipt binds event identity even if an attacker recomputes all event hashes',async()=>{
  const altered=structuredClone(r);let previous=null;for(const e of altered.events){e.deal_id='unrelated-deal';e.previous_event_hash=previous;const {event_hash,...body}=e;e.event_hash=hash(body);previous=e.event_hash;}
  assert.equal((await verifyReceipt(altered)).reason,'EVENT_DEAL_MISMATCH');
});
test('canonical-block disagreement or insufficient configured confirmations is INCOMPLETE',async()=>{
  const first=r.transactions.fund.receipt;
  for(const mode of ['reorg','confirmations']){
    const chain={deployment:r.network,finalityPolicy:{mode:'confirmations',confirmations:2},provider:{getTransactionReceipt:async()=>({...first,hash:first.transactionHash}),getBlock:async tag=>tag==='latest'?{number:first.blockNumber,hash:first.blockHash}:{number:first.blockNumber,hash:mode==='reorg'?'0xchanged':first.blockHash}}};
    const v=await verifyReceipt(r,chain);assert.equal(v.verdict,'INCOMPLETE');assert.equal(v.reason,mode==='reorg'?'CHAIN_REORG_DETECTED':'CHAIN_FINALITY_PENDING');
  }
});

test('control source refunds, preview contents and durable transaction claims are independently checked',async()=>{
  const chain=await openChain(),store=new DealStore(':memory:'),engine=new DealEngine(store,chain),company=randomUUID();
  function create(seller='seller-b'){
    const t=now(),m={mandate_id:randomUUID(),company_id:company,buyer_id:'research-agent',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+1200};engine.mandate(m);
    const d={deal_id:randomUUID(),buyer_id:m.buyer_id,seller_id:seller,price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:t,expires_at:t+600,supersedes_deal_id:null};engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});return d.deal_id;
  }
  try{
    const origin=create();await engine.fund(origin);await engine.deliver(origin,fixtureDelivery(7));
    const id=create();assert.equal(store.get(id).state,'PREVIEW_REQUIRED');
    const previewRows=JSON.parse(fixtureDelivery(10));engine.preview(id,JSON.stringify(Array(5).fill(previewRows[0])));assert.equal(store.get(id).state,'PREVIEW_REQUIRED');
    engine.preview(id,fixtureDelivery(10));await engine.fund(id);await engine.deliver(id,fixtureDelivery());
    const bundle=receipt(engine,id),valid=await verifyReceipt(bundle,chain);assert.equal(valid.verdict,'VALID',JSON.stringify(valid));assert.equal(bundle.control_source.deal.deal_id,origin);assert.equal(bundle.transactions.release.claim.kind,'release');assert.equal(JSON.stringify(bundle).includes('"raw":"0x'),false);
    for(const [change,expected] of [
      [b=>delete b.control_source,'INCOMPLETE'],
      [b=>b.control.company_id='other-company','INVALID'],
      [b=>b.control.validation_hash=hash('forged'),'INVALID'],
      [b=>b.evidence.preview.raw='[]','INVALID'],
      [b=>b.evidence.preview.deal_hash=hash('another-deal'),'INVALID'],
      [b=>b.transactions.release.claim.kind='fund','INVALID'],
      [b=>b.transactions.fund.claim.amount_wei='1','INVALID'],
      [b=>b.transactions.release.receipt.logs[0].data='0x00','INVALID'],
      [b=>b.state='DEAL_PROPOSED','INVALID'],
      [b=>b.transactions.unknown=b.transactions.release,'INVALID'],
      [b=>delete b.transactions.release.claim,'INCOMPLETE'],
      [b=>b.control_source=b,'INVALID'],
    ]){const altered=structuredClone(bundle);change(altered);const result=await verifyReceipt(altered);assert.equal(result.verdict,expected,JSON.stringify(result));}
    const pending=structuredClone(bundle);pending.transactions.release.status='PENDING';assert.equal((await verifyReceipt(pending)).verdict,'INVALID');
    const actualPending=create('seller-a');const originalBroadcast=chain.broadcast;chain.broadcast=async()=>{throw new Error('test unavailable');};await assert.rejects(engine.fund(actualPending));chain.broadcast=originalBroadcast;assert.equal((await verifyReceipt(receipt(engine,actualPending))).verdict,'INCOMPLETE');
  }finally{store.close();await chain.close();}
});

test('policy evidence remains reconstructable when the clock advances between adjacent calls',async()=>{
 const chain=await openChain(),store=new DealStore(':memory:');let tick=now();const engine=new DealEngine(store,chain,()=>tick++),t=now();
 const m=engine.mandate({mandate_id:randomUUID(),company_id:'clock-boundary',buyer_id:'buyer',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+1800});
 const d={deal_id:randomUUID(),buyer_id:'buyer',seller_id:'seller-a',price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:t,expires_at:t+900,supersedes_deal_id:null};
 try{engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});await engine.fund(d.deal_id);await engine.deliver(d.deal_id,fixtureDelivery());
  const r=receipt(engine,d.deal_id);for(const e of r.events.filter(e=>['POLICY_CHECKED','FINAL_AUTHORIZATION'].includes(e.event_type)))assert.equal(e.structured_payload.checks.find(c=>c.name==='MANDATE_NOT_EXPIRED').actual,e.structured_payload.time);
  assert.equal((await verifyReceipt(r,chain)).verdict,'VALID');
 }finally{store.close();await chain.close();}
});
