import test from 'node:test';import assert from 'node:assert/strict';
import {referenceRows,researchRequirements,reference} from '../../src/deal-escrow/reference.ts';
import {validateDelivery} from '../../src/deal-escrow/delivery.ts';
import {policy,now,hash} from '../../src/deal-escrow/domain.ts';
import {marketOffers,resolveSelection,fixedSelection,reviewedSelection,contentReviewTask,procureResearch,deliverResearch} from '../../src/deal-escrow/research.ts';
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
  const clientFactory=()=>({models:async()=>({supported:false}),reviewOffers:async({offers})=>{calls++;return {tool:'review_offers',args:{reviews:offers.map((o,i)=>({offer_id:o.offer_id,fit:o.offer_id==='outlook-summary'?'mismatch':'match',evidence_ids:[`o${i}s0`],reason:'Controlled semantic review fixture.'}))},model:'SCRIPTED_TEST'};},extractDataset:async()=>({tool:'submit_dataset',args:{rows:referenceRows()},model:'SCRIPTED_TEST',request_id:'fixture'})});
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
test('offer selection separates accept, discount and rejection without nullable counter ambiguity',async()=>{
  for(const [name,args,decision] of [['choose_offer',{offer_id:'offer',reason:'Matches the requested quarters.'},'accept'],['request_discount',{offer_id:'offer',price_minor:180,reason:'Posted floor fits the human cap.'},'counter'],['reject_offers',{reason:'None meets the requested period.'},'reject']]){
    let offered;const client=new KilnClient({model:'test',key:'test',fetchImpl:async(_url,options)=>{offered=JSON.parse(options.body).tools.map(t=>t.function.name);return Response.json({model:'test',choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});}});
    const response=await client.selectOfferTools({offers:[{offer_id:'offer'}]});assert.equal(response.args.decision,decision);assert.equal(response.args.counter_price_minor,decision==='counter'?180:null);assert.deepEqual(offered,['choose_offer','request_discount','reject_offers']);
  }
  const client=new KilnClient({model:'test',key:'test',fetchImpl:async()=>Response.json({model:'test',choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'choose_offer',arguments:JSON.stringify({offer_id:'offer',reason:'Approve.',amount:999})}}]}}]})});await assert.rejects(client.selectOfferTools({offers:[{offer_id:'offer'}]}),/SCHEMA_FIELDS/);
});

test('content reviews cannot choose prices; policy ranks posted floors and excludes unclear or infeasible work',()=>{
 const [p]=marketOffers,m=mandate(),offers=[{...p,offer_id:'discount',price_minor:290,floor_price_minor:150},{...p,offer_id:'posted',price_minor:190,floor_price_minor:190},{...p,offer_id:'cheap-wrong',price_minor:100,floor_price_minor:100}];
 const reviews=offers.map((o,i)=>({offer_id:o.offer_id,fit:o.offer_id==='cheap-wrong'?'mismatch':'match',evidence_ids:[`o${i}s0`],reason:'Controlled content judgment.'}));
 const choose=(rs=reviews,os=offers)=>reviewedSelection(m,os,{reviews:rs});
 assert.equal(choose().offer_id,'discount');assert.equal(choose().counter_price_minor,150);
 assert.equal(choose(reviews.map(r=>({...r,fit:r.offer_id==='discount'?'unclear':r.fit}))).offer_id,'posted');
 assert.equal(choose(reviews,offers.map(o=>({...o,deadline:o.offer_id==='discount'?181:o.deadline}))).offer_id,'posted');
 assert.equal(choose(reviews.map(r=>({...r,fit:'unclear'}))).decision,'reject');
 for(const mutate of [a=>a.pop(),a=>a[1]={...a[0]},a=>a[0].offer_id='unknown',a=>a[0].evidence_ids=['o1s0'],a=>a[0].fit='approved',a=>a[0].price_minor=1]){const bad=structuredClone(reviews);mutate(bad);assert.throws(()=>choose(bad));}
 const tied=offers.slice(0,2).map((o,i)=>({...o,price_minor:150,floor_price_minor:150,deadline:120-i*10}));assert.equal(choose(reviews.slice(0,2),tied).offer_id,'posted');
});

test('model content-review payload excludes price ranking and requires one grounded review per offer',async()=>{
 let sent;const offer=marketOffers[0],args={reviews:[{offer_id:offer.offer_id,fit:'match',evidence_ids:['o0s0'],reason:'The promised period and actual cash expenditure match.'}]};
 const client=new KilnClient({model:'test',key:'test',fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({model:'test',choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'review_offers',arguments:JSON.stringify(args)}}]}}]});}});
 assert.equal((await client.reviewOffers({human_task:'Historical quarterly facility cash outflows',offers:[offer]})).tool,'review_offers');
 assert.deepEqual(sent.tools.map(t=>t.function.name),['review_offers']);assert.deepEqual(Object.keys(JSON.parse(sent.messages[1].content).offers[0]),['offer_id','sentences']);
 args.reviews[0].evidence_ids=['missing'];await assert.rejects(client.reviewOffers({human_task:'Task',offers:[offer]}),/OFFER_REVIEW_EVIDENCE/);
});

test('content review receives the runtime calendar and keeps normalized and original signed fields distinct',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-09-29T01:02:03Z'));const task=contentReviewTask(mandate());
 assert.equal(task.as_of_utc,'2026-09-29');assert.deepEqual(task.periods,['2025-Q1','2025-Q2','2025-Q3','2025-Q4']);assert.match(task.representations.capex,/Positive/);assert.match(task.representations.source_value,/separate field/);
});
