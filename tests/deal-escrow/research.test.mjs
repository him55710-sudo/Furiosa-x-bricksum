import test from 'node:test';import assert from 'node:assert/strict';
import {referenceRows,researchRequirements,reference} from '../../src/deal-escrow/reference.ts';
import {validateDelivery} from '../../src/deal-escrow/delivery.ts';
import {policy,now,hash} from '../../src/deal-escrow/domain.ts';
import {marketOffers,resolveSelection,fixedSelection,procureResearch,deliverResearch} from '../../src/deal-escrow/research.ts';
import {DealStore} from '../../src/deal-escrow/store.ts';import {DealEngine} from '../../src/deal-escrow/engine.ts';import {openChain} from '../../src/deal-escrow/chain.mjs';import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';import {KilnClient} from '../../src/deal-escrow/kiln.ts';
const mandate=(patch={})=>({mandate_id:'research-task',company_id:'research-team',buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:now(),expires_at:now()+1800,task_requirements:researchRequirements,...patch});

test('purchase units cannot be replaced by dataset currency or an explanation',async()=>{
  let payload;const args={decision:'counter',offer_id:'primary-reports',counter_price_minor:180,reason:'Deliberately wrong explanation: pay 180 KRW.'};
  const client=new KilnClient({model:'test-model',key:'test',fetchImpl:async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({model:'test-model',choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'select_offer',arguments:JSON.stringify(args)}}]}}]});}});
  const m=mandate(),result=await client.selectOffer({mandate:m,offers:marketOffers,payment_context:{asset:'KRW',minor_units_per_unit:1}}),input=JSON.parse(payload.messages[1].content);
  assert.equal(input.payment_context.asset,'DEMO');assert.equal(input.payment_context.minor_units_per_unit,100);
  const selected=resolveSelection(m,marketOffers,result.args);assert.equal(selected.accepted,true);assert.equal(selected.deal.currency_or_demo_asset,'DEMO');assert.equal(selected.deal.price_minor,180);
  args.currency='KRW';await assert.rejects(client.selectOffer({mandate:m,offers:marketOffers}),/UNKNOWN_FIELD|FIELDS/);
});
test('pinned actual observations reject plausible but wrong values, periods, units, documents and pages',()=>{
  const rows=referenceRows(),check=v=>validateDelivery(JSON.stringify(v),researchRequirements,10,20);assert.equal(check(rows).verified,true);assert.equal(rows.reduce((a,r)=>a+r.capex,0),reference.cross_check.annual_total_billion_krw);
  for(const mutate of [r=>r[0].capex=3441,r=>r[0].quarter='2026-Q1',r=>r[0].unit='million',r=>r[0].source_page=8,r=>r[0].source_sha256='0'.repeat(64),r=>r[0].source_value=3014,r=>r[0].source_label='Cash Flows from Investing Activities',r=>r[0]=null,r=>r[1]={...r[0]}]){const copy=structuredClone(rows);mutate(copy);const result=check(copy);assert.equal(result.verified,false);assert.doesNotThrow(()=>hash(result));}
  assert.throws(()=>validateDelivery(JSON.stringify(rows),researchRequirements,10,20,{version:'delivery-v2'}),/REFERENCE_VALIDATOR_REQUIRED/);
});
test('human reference profile cannot be removed by changing the Deal; counteroffer cannot overrule seller floor',()=>{
  const m=mandate(),decision=fixedSelection(m,marketOffers),selected=resolveSelection(m,marketOffers,decision);assert.equal(selected.accepted,true);assert.equal(selected.offer.offer_id,'primary-reports');assert.equal(selected.deal.price_minor,180);
  const bad=structuredClone(selected.deal);delete bad.requirements.reference_dataset_id;assert.equal(policy(m,bad).find(c=>c.name==='TASK_REFERENCE_DATASET').pass,false);
  assert.throws(()=>resolveSelection(m,marketOffers,{decision:'counter',offer_id:'primary-reports',counter_price_minor:179}),/SELLER_COUNTER_OUTSIDE_RANGE/);
  assert.equal(resolveSelection(m,marketOffers,{decision:'accept',offer_id:'primary-reports',counter_price_minor:null}).reason,'MAX_SINGLE');
});
test('real EVM pays source-matching rows, refunds a same-shape false value, and permits corrected preview',async()=>{
  const chain=await openChain(),store=new DealStore(':memory:'),engine=new DealEngine(store,chain);let calls=0;
  const clientFactory=()=>({models:async()=>({supported:false}),selectOffer:async()=>{calls++;return {tool:'select_offer',args:{decision:'counter',offer_id:'primary-reports',counter_price_minor:180,reason:'Historical quarters match; counter within the published floor.'},model:'SCRIPTED_TEST'};},extractDataset:async()=>({tool:'submit_dataset',args:{rows:referenceRows()},model:'SCRIPTED_TEST',request_id:'fixture'})});
  try{
    const m=engine.mandate(mandate());const [a,b]=await Promise.all([procureResearch(engine,m.mandate_id,{clientFactory}),procureResearch(engine,m.mandate_id,{clientFactory})]);assert.equal(a.deal_id,b.deal_id);assert.equal(calls,1);assert.equal(a.status,'READY');
    await engine.fund(a.deal_id);await deliverResearch(engine,a.deal_id,{clientFactory});assert.equal(store.get(a.deal_id).state,'SETTLED');assert.equal((await verifyReceipt(receipt(engine,a.deal_id),chain)).verdict,'VALID');
    const m2=engine.mandate(mandate({mandate_id:'bad-source-task'})),p=await procureResearch(engine,m2.mandate_id,{clientFactory});await engine.fund(p.deal_id);const bad=referenceRows();bad[0].capex=3441;await engine.deliver(p.deal_id,JSON.stringify(bad));assert.equal(store.get(p.deal_id).state,'REFUNDED');assert.equal((await verifyReceipt(receipt(engine,p.deal_id),chain)).verdict,'VALID');
    const m3=engine.mandate(mandate({mandate_id:'reformed-source-task'})),q=await procureResearch(engine,m3.mandate_id,{clientFactory});assert.equal(store.get(q.deal_id).state,'PREVIEW_VERIFIED');await engine.fund(q.deal_id);await deliverResearch(engine,q.deal_id,{clientFactory});assert.equal(store.get(q.deal_id).state,'SETTLED');assert.equal((await verifyReceipt(receipt(engine,q.deal_id),chain)).verdict,'VALID');
  }finally{store.close();await chain.close();}
});
test('final buyer really has acceptance and rejection tools; model may reject',async()=>{
  let names;const client=new KilnClient({model:'test',key:'test',fetchImpl:async(_url,options)=>{names=JSON.parse(options.body).tools.map(t=>t.function.name);return Response.json({model:'test',choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'reject_deal',arguments:'{"deal_id":"bad"}'}}]}}]});}});
  assert.equal((await client.chooseDeal({deal_id:'bad'})).tool,'reject_deal');assert.deepEqual(names,['accept_deal','reject_deal']);
});
