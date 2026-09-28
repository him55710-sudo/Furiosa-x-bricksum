import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DealStore} from '../../src/deal-escrow/store.ts';
import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {openChain} from '../../src/deal-escrow/chain.mjs';
import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';
import {fixtureDelivery} from '../../src/deal-escrow/delivery.ts';
import {now} from '../../src/deal-escrow/domain.ts';

function create(engine,time){
  const m=engine.mandate({mandate_id:randomUUID(),company_id:'clock-boundary',buyer_id:'buyer',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1800});
  const d={deal_id:randomUUID(),buyer_id:m.buyer_id,seller_id:'seller-a',price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:time,expires_at:time+900,supersedes_deal_id:null};
  engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});return d;
}
test('completed payment evidence uses the exact policy time even if adjacent clock calls cross a second',async()=>{
  const chain=await openChain(),store=new DealStore(':memory:'),start=now();let tick=start;
  const engine=new DealEngine(store,chain,()=>tick++);
  try{
    const d=create(engine,start);await engine.fund(d.deal_id);await engine.deliver(d.deal_id,fixtureDelivery());
    assert.equal(store.get(d.deal_id).state,'SETTLED');
    const bundle=receipt(engine,d.deal_id),verified=await verifyReceipt(bundle,chain);
    assert.equal(verified.verdict,'VALID',JSON.stringify(verified));
    const authorization=bundle.events.filter(e=>['POLICY_CHECKED','FINAL_AUTHORIZATION'].includes(e.event_type));assert.equal(authorization.length,2);
    for(const {structured_payload:p} of authorization)for(const name of ['MANDATE_NOT_EXPIRED','DEAL_NOT_EXPIRED'])assert.equal(p.checks.find(c=>c.name===name).actual,p.time);
  }finally{store.close();await chain.close();}
});
test('capturing authorization time does not skip a later expiry check before signing',async()=>{
  const chain=await openChain(),store=new DealStore(':memory:'),start=now(),engine=new DealEngine(store,chain,()=>start);
  try{
    const d=create(engine,start);let tick=d.expires_at-1;engine.clock=()=>tick++;
    await assert.rejects(engine.fund(d.deal_id),/DEAL_NOT_EXPIRED/);assert.equal(store.get(d.deal_id).state,'EXPIRED');
    const operation=store.operation(d.deal_id,'fund');assert.equal(operation.status,'CANCELLED');assert.equal(operation.raw,undefined);
    assert.equal((await verifyReceipt(receipt(engine,d.deal_id))).verdict,'STRUCTURALLY_VALID');
  }finally{store.close();await chain.close();}
});
