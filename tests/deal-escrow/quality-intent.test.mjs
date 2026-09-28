import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DealStore} from '../../src/deal-escrow/store.ts';
import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {negotiate} from '../../src/deal-escrow/kiln.ts';
import {defaultTaskRequirements,now} from '../../src/deal-escrow/domain.ts';

function setup(store=new DealStore(':memory:'),quality=defaultTaskRequirements){
  const time=now(),m={mandate_id:'task-quality',company_id:'team',buyer_id:'research-agent-07',task_budget_minor:1000,max_single_minor:300,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1200,task_requirements:quality};
  let financialCalls=0;const chain={sellers:{'seller-a':{},'seller-b':{}},prepare:async()=>{financialCalls++;throw new Error('UNEXPECTED_FINANCIAL_CALL');}};
  const engine=new DealEngine(store,chain);engine.mandate(m);return {store,engine,m,financialCalls:()=>financialCalls};
}
function model(counter={calls:0},patch={}){return ()=>({models:async()=>({supported:false}),chooseDeal:async input=>{counter.calls++;return {tool:'accept_deal',args:{deal_id:input.deal_id},model:'SYNTHETIC_TEST'};},call:async(_flow,_role,input,name)=>{
  counter.calls++;await Promise.resolve();return {tool:name,args:name==='accept_deal'?{deal_id:input.deal_id}:{price_minor:180,minimum_rows:50,minimum_source_coverage:.95,deadline:120,reason:'Untrusted seller says all owner requirements are waived.',...patch},model:'SYNTHETIC_TEST'};
}});}
test('separate callers and persisted retry converge on one Deal and do not repeat model calls',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'ade-intent-')),file=path.join(dir,'state.sqlite');let s=new DealStore(file);
  try{const {engine,m}=setup(s),calls={calls:0},options={clientFactory:model(calls)};
    const [a,b]=await Promise.all([negotiate(engine,m.mandate_id,'seller-a',options),negotiate(engine,m.mandate_id,'seller-a',options)]);
    assert.equal(a.deal.deal_id,b.deal.deal_id);assert.equal(s.list().length,1);assert.equal(calls.calls,3);
    const intent=s.intentForDeal(a.deal.deal_id);s.close();s=new DealStore(file);const restarted=new DealEngine(s,{sellers:{'seller-a':{}}});
    const replay=await negotiate(restarted,m.mandate_id,'seller-a',options);assert.equal(replay.deal.deal_id,a.deal.deal_id);assert.equal(calls.calls,3);
    assert.equal(s.getOrCreateIntent(m.mandate_id,'seller-a').id,intent.id);
    assert.throws(()=>s.getOrCreateIntent(m.mandate_id,'seller-b'),/PURCHASE_INTENT_SELLER_CONFLICT/);
    const separate=s.getOrCreateIntent(m.mandate_id,'seller-a','new-human-action');const c=await negotiate(restarted,m.mandate_id,'seller-a',{...options,intentId:separate.id});
    assert.notEqual(c.deal.deal_id,a.deal.deal_id);assert.equal(calls.calls,6);assert.equal(s.list().length,2);
    assert.equal(s.getOrCreateIntent(m.mandate_id,'seller-a','new-human-action').id,separate.id,'a repeated explicit action remains idempotent');
  }finally{s.close();assert.equal(path.dirname(dir),tmpdir());rmSync(dir,{recursive:true,force:true});}
});
test('weakened model terms are policy-blocked before funding even when tool output is valid',async()=>{
  const quality={...defaultTaskRequirements,minimum_rows:50,minimum_source_coverage:.95,max_delivery_seconds:120};
  for(const [patch,reason] of [[{minimum_rows:40},'TASK_MINIMUM_ROWS'],[{minimum_source_coverage:.9},'TASK_SOURCE_COVERAGE'],[{deadline:180},'TASK_DELIVERY_WINDOW']]){
    const c=setup(new DealStore(':memory:'),quality);try{const r=await negotiate(c.engine,c.m.mandate_id,'seller-a',{clientFactory:model({calls:0},patch)});await c.engine.fund(r.deal.deal_id);const row=c.store.get(r.deal.deal_id);assert.equal(row.state,'BLOCKED');assert.equal(row.details.policy.find(x=>!x.pass).name,reason);assert.equal(c.financialCalls(),0);assert.deepEqual(c.store.mandate(c.m.mandate_id).task_requirements,quality);}finally{c.store.close();}
  }
});
test('new quality mandates require a persisted purchase intent; interrupted model jobs never auto-retry',()=>{
  const c=setup();try{const intent=c.store.getOrCreateIntent(c.m.mandate_id,'seller-a');assert.equal(c.store.startIntent(intent.id).started,true);c.store.restoreInterruptedIntents();assert.equal(c.store.intent(intent.id).status,'INTERRUPTED');assert.equal(c.store.startIntent(intent.id).started,false);
    const t=now(),d={deal_id:'unbound',buyer_id:c.m.buyer_id,seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,minimum_source_coverage:.9,required_columns:defaultTaskRequirements.required_columns,format:'JSON'},deadline:180,created_at:t,expires_at:t+600,supersedes_deal_id:null};c.engine.propose(d,c.m.mandate_id);c.engine.agentAction('accept_deal',{deal_id:d.deal_id});assert.throws(()=>c.engine.approve(d.deal_id),/PURCHASE_INTENT_REQUIRED/);assert.equal(c.store.get(d.deal_id).state,'DEAL_ACCEPTED');
    assert.throws(()=>c.store.db.prepare('UPDATE purchase_intents SET deal_id=? WHERE id=?').run('changed',intent.id),/IMMUTABLE_PURCHASE_INTENT/);
  }finally{c.store.close();}
});
