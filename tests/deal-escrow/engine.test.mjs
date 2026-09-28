import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {DealStore} from '../../src/deal-escrow/store.ts';import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {openChain,UNIT_WEI} from '../../src/deal-escrow/chain.mjs';import {fixtureDelivery,validateDelivery} from '../../src/deal-escrow/delivery.ts';import {now,hash} from '../../src/deal-escrow/domain.ts';
import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';
function setup(engine,seller='seller-a',patch={}){const t=now(),m={mandate_id:randomUUID(),company_id:seller==='seller-b'?'company':randomUUID(),buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+1200};engine.mandate(m);const d={deal_id:randomUUID(),buyer_id:m.buyer_id,seller_id:seller,price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:t,expires_at:t+600,supersedes_deal_id:null,...patch};engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});return {id:d.deal_id,m,d};}
test('delivery validator checks structure and timing, never semantic truth',()=>{const req={minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'};assert.equal(validateDelivery(fixtureDelivery(),req,1,2).verified,true);for(const raw of ['not json','{}',fixtureDelivery(7),JSON.stringify(Array(40).fill({company:'x'}))])assert.equal(validateDelivery(raw,req,1,2).verified,false);assert.equal(validateDelivery(fixtureDelivery(),req,2,2).verified,false);assert.equal(validateDelivery(fixtureDelivery(),req,1,2).semantic_truth_verified,false);});
test('real EVM lifecycle, financial invariants, seller-scoped monotonic memory and recovery',async t=>{
  const chain=await openChain(),store=new DealStore(':memory:'),e=new DealEngine(store,chain);
  try{
    await t.test('1 LLM cannot choose settlement amount or invoke financial tools',()=>{const {id}=setup(e);for(const name of ['transfer_money','release_escrow','refund_escrow','change_budget','remove_control'])assert.throws(()=>e.agentAction(name,{deal_id:id}));assert.throws(()=>e.agentAction('accept_deal',{deal_id:id,amount:1}));});
    await t.test('success locks exact accepted price then releases only after verified delivery',async()=>{const {id}=setup(e);await e.fund(id);assert.equal((await chain.inspect(store.get(id).dealHash)).amount,(150n*UNIT_WEI).toString());assert.equal(store.get(id).state,'ESCROW_FUNDED');await e.deliver(id,fixtureDelivery());assert.equal(store.get(id).state,'SETTLED');assert.equal(store.get(id).details.validation.row_count,52);});
    await t.test('6 same Deal cannot settle twice',async()=>{const {id}=setup(e);await e.fund(id);await e.deliver(id,fixtureDelivery());const tx=store.get(id).details.release_tx;await assert.rejects(e.deliver(id,fixtureDelivery()),/INVALID_STATE/);await assert.rejects(e.settle(id),/INVALID_STATE/);assert.equal(store.get(id).details.release_tx,tx);assert.equal(store.events(id).filter(x=>x.event_type==='ESCROW_RELEASED').length,1);});
    await t.test('10 failed delivery refunds; 7 refunded Deal never releases; 8/9 memory only restricts',async()=>{const {id,m}=setup(e,'seller-b');await e.fund(id);await e.deliver(id,fixtureDelivery(7));assert.equal(store.get(id).state,'REFUNDED');assert.equal((await chain.inspect(store.get(id).dealHash)).status,3);await assert.rejects(e.settle(id));assert.equal(store.control('company','seller-b').rule,'REQUIRE_PREVIEW');assert.equal(store.control('company','seller-a'),null);assert.throws(()=>store.db.exec('DELETE FROM controls'),/MONOTONIC/);assert.throws(()=>store.db.exec("UPDATE controls SET body='{}'"),/MONOTONIC/);assert.equal(store.mandate(m.mandate_id).task_budget_minor,300);
      const next=setup(e,'seller-b');assert.equal(store.get(next.id).state,'PREVIEW_REQUIRED');await e.fund(next.id);assert.equal(store.get(next.id).state,'PREVIEW_REQUIRED');assert.equal((await chain.inspect(store.get(next.id).dealHash)).status,0);e.preview(next.id,fixtureDelivery(10));await e.fund(next.id);assert.equal(store.get(next.id).state,'ESCROW_FUNDED');await e.deliver(next.id,fixtureDelivery());assert.equal(store.get(next.id).state,'SETTLED');});
    await t.test('5 revoked mandate cannot fund and final revoke causes refund',async()=>{let x=setup(e);store.revoke(x.m.mandate_id);await e.fund(x.id);assert.equal(store.get(x.id).state,'BLOCKED');x=setup(e);await e.fund(x.id);store.revoke(x.m.mandate_id);await e.deliver(x.id,fixtureDelivery());assert.equal(store.get(x.id).state,'REFUNDED');assert.equal(store.get(x.id).details.settlement_reason,'MANDATE_ACTIVE');});
    await t.test('4 expired Deal cannot fund or release; expired mandate cannot fund',async()=>{let x=setup(e);const clock=e.clock;e.clock=()=>x.d.expires_at;await e.fund(x.id);assert.equal(store.get(x.id).state,'EXPIRED');e.clock=clock;x=setup(e);await e.fund(x.id);e.clock=()=>x.d.expires_at;await e.deliver(x.id,fixtureDelivery());assert.equal(store.get(x.id).state,'REFUNDED');e.clock=clock;x=setup(e);e.clock=()=>x.m.expires_at;await e.fund(x.id);assert.equal(store.get(x.id).state,'EXPIRED');e.clock=clock;});
    await t.test('3 hash mismatch cannot settle even if the delivery passes',async()=>{const x=setup(e);await e.fund(x.id);const get=store.get.bind(store);store.get=id=>{const r=get(id);return id===x.id?{...r,dealHash:hash('wrong')}:r;};await assert.rejects(e.deliver(x.id,fixtureDelivery()));store.get=get;assert.equal((await chain.inspect(get(x.id).dealHash)).status,1);assert.notEqual(get(x.id).state,'SETTLED');});
    await t.test('task budget reserves concurrently and budget failure never funds',async()=>{const x=setup(e,'seller-a',{price_minor:180});const y={...x.d,deal_id:randomUUID()};e.propose(y,x.m.mandate_id);e.agentAction('accept_deal',{deal_id:y.deal_id});await Promise.all([e.fund(x.id),e.fund(y.deal_id)]);assert.equal(store.get(x.id).state,'ESCROW_FUNDED');assert.equal(store.get(y.deal_id).state,'BLOCKED');assert.equal((await chain.inspect(store.get(y.deal_id).dealHash)).status,0);});
    await t.test('funded Deal without any delivery refunds after its deadline',async()=>{const x=setup(e),clock=e.clock;await e.fund(x.id);e.clock=()=>store.get(x.id).details.escrow.deadline;await e.expire(x.id);e.clock=clock;assert.equal(store.get(x.id).state,'REFUNDED');assert.equal(store.get(x.id).details.settlement_reason,'DELIVERY_DEADLINE_EXPIRED');});
    await t.test('a newly activated seller gate is rechecked after policy approval',async()=>{const x=setup(e,'seller-b');e.preview(x.id,fixtureDelivery(10));assert.equal(e.approve(x.id),true);assert.equal(store.get(x.id).state,'POLICY_APPROVED');const normal=setup(e);assert.equal(e.approve(normal.id),true);const activate=store.control.bind(store);store.control=(company,seller)=>seller==='seller-a'?{rule:'REQUIRE_PREVIEW'}:activate(company,seller);await e.fund(normal.id);store.control=activate;assert.equal(store.get(normal.id).state,'PREVIEW_REQUIRED');assert.equal((await chain.inspect(store.get(normal.id).dealHash)).status,0);});
    await t.test('ambiguous broadcast persists signed intent and recovers same tx exactly once',async()=>{const x=setup(e);const broadcast=chain.broadcast;let cut=true;chain.broadcast=async op=>{const r=await broadcast(op);if(cut){cut=false;throw new Error('SIMULATED_RESPONSE_LOSS');}return r;};await assert.rejects(e.fund(x.id),/RESPONSE_LOSS/);const tx=store.operation(x.id,'fund').txHash;assert.equal(store.operation(x.id,'fund').status,'PENDING');chain.broadcast=broadcast;await e.recover();assert.equal(store.get(x.id).state,'ESCROW_FUNDED');assert.equal(store.get(x.id).details.fund_tx,tx);await e.fund(x.id);assert.equal(store.events(x.id).filter(x=>x.event_type==='ESCROW_FUNDED').length,1);});
  }finally{store.close();await chain.close();}
});

test('mined release revert after deadline safely refunds and survives interrupted reconciliation',async t=>{
  for(const interrupt of [false,true])await t.test(interrupt?'restart after lost failure receipt':'immediate confirmed revert',async()=>{
    const directory=mkdtempSync(path.join(tmpdir(),'ade-recovery-')),file=path.join(directory,'state.sqlite'),chain=await openChain();let store=new DealStore(file),e=new DealEngine(store,chain);
    try{
      const x=setup(e);await e.fund(x.id);
      const prepare=chain.prepare,revertedReceipt=chain.revertedReceipt;
      chain.prepare=async(...args)=>{const signed=await prepare(...args);if(args[0]==='release'){await chain.provider.send('evm_increaseTime',[181]);await chain.provider.send('evm_mine',[]);}return signed;};
      if(interrupt)chain.revertedReceipt=async()=>{throw new Error('RPC_UNAVAILABLE');};
      if(interrupt){await assert.rejects(e.deliver(x.id,fixtureDelivery()),/RPC_UNAVAILABLE/);assert.equal(store.operation(x.id,'release').status,'PENDING');assert.equal(store.operation(x.id,'refund'),null);store.close();store=new DealStore(file);e=new DealEngine(store,chain);chain.revertedReceipt=revertedReceipt;await e.recover();}
      else await e.deliver(x.id,fixtureDelivery());
      const failed=store.operation(x.id,'release');assert.equal(failed.status,'REVERTED');assert.equal(failed.receipt.status,0);assert.equal(store.get(x.id).state,'REFUNDED');assert.equal(store.get(x.id).details.settlement_reason,'ESCROW_RELEASE_REVERTED');assert.equal((await chain.inspect(store.get(x.id).dealHash)).status,3);
      assert.equal(store.events(x.id).filter(e=>e.event_type==='ESCROW_RELEASED').length,0);
      assert.equal((await verifyReceipt(receipt(e,x.id),chain)).verdict,'VALID');
      const altered=receipt(e,x.id);altered.transactions.release.receipt.status=1;assert.equal((await verifyReceipt(altered)).verdict,'INVALID');
      await e.recover();assert.equal(store.events(x.id).filter(e=>e.event_type==='ESCROW_REFUNDED').length,1);
    }finally{store.close();await chain.close();for(const name of readdirSync(directory))unlinkSync(path.join(directory,name));rmdirSync(directory);}
  });
});

test('a successful release with a lost response must never trigger a refund',async()=>{
  const chain=await openChain(),store=new DealStore(':memory:'),e=new DealEngine(store,chain);
  try{const x=setup(e);await e.fund(x.id);const broadcast=chain.broadcast;
    chain.broadcast=async op=>{await broadcast(op);throw new Error('RESPONSE_LOST');};
    await assert.rejects(e.deliver(x.id,fixtureDelivery()),/RESPONSE_LOST/);
    assert.equal(store.operation(x.id,'release').status,'PENDING');assert.equal(store.operation(x.id,'refund'),null);
    chain.broadcast=broadcast;await e.recover();assert.equal(store.get(x.id).state,'SETTLED');assert.equal(store.operation(x.id,'refund'),null);
  }finally{store.close();await chain.close();}
});


