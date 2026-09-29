import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Transaction} from 'ethers';
import {DealStore} from '../../src/deal-escrow/store.ts';
import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {openChain,finalityConfiguration} from '../../src/deal-escrow/chain.mjs';
import {fixtureDelivery} from '../../src/deal-escrow/delivery.ts';
import {now} from '../../src/deal-escrow/domain.ts';

async function lab(t,options={}){
  const chain=await openChain(options),store=new DealStore(':memory:'),engine=new DealEngine(store,chain);
  t.after(async()=>{store.close();await chain.close();});
  function setup(patch={}){
    const time=now(),m={mandate_id:randomUUID(),company_id:randomUUID(),buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1200};
    engine.mandate(m);
    const d={deal_id:randomUUID(),buyer_id:m.buyer_id,seller_id:'seller-a',price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:60,created_at:time,expires_at:time+600,supersedes_deal_id:null,...patch};
    engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});return {id:d.deal_id,m,d};
  }
  return {chain,store,engine,setup};
}

test('mined failed funding releases its reservation and recovery is idempotent',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup({expires_at:now()+5}),send=chain.broadcast;
  chain.broadcast=async op=>{await chain.provider.send('evm_increaseTime',[6]);await chain.provider.send('evm_mine',[]);return send(op);};
  await assert.rejects(engine.fund(x.id),/CHAIN_REVERTED/);
  assert.equal(store.operation(x.id,'fund').status,'REVERTED');assert.equal(store.operation(x.id,'fund').receipt.status,0);
  assert.equal(store.get(x.id).state,'BLOCKED');assert.deepEqual(store.accounting(x.m.mandate_id),{spent:0,reserved:0});
  assert.equal((await chain.inspect(store.get(x.id).dealHash)).status,0);
  chain.broadcast=send;await engine.recover();await engine.recover();await engine.fund(x.id);
  assert.equal(store.events(x.id).filter(e=>e.event_type==='ESCROW_TRANSACTION_REVERTED').length,1);
});

test('a release mined after its deadline refunds only after the exact revert is confirmed',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup();await engine.fund(x.id);
  const send=chain.broadcast;let cut=true;
  chain.broadcast=async op=>{if(cut){cut=false;await chain.provider.send('evm_increaseTime',[61]);await chain.provider.send('evm_mine',[]);}return send(op);};
  await engine.deliver(x.id,fixtureDelivery());
  assert.equal(store.operation(x.id,'release').status,'REVERTED');assert.equal(store.operation(x.id,'release').receipt.status,0);
  assert.equal(store.operation(x.id,'refund').status,'CONFIRMED');assert.equal(store.get(x.id).state,'REFUNDED');
  assert.equal((await chain.inspect(store.get(x.id).dealHash)).status,3);assert.deepEqual(store.accounting(x.m.mandate_id),{spent:0,reserved:0});
  await engine.recover();assert.equal(store.events(x.id).filter(e=>e.event_type==='ESCROW_REFUNDED').length,1);
});

test('an unknown raw transaction keeps its reservation and blocks another signed nonce',async t=>{
  const {chain,store,engine,setup}=await lab(t),a=setup(),b=setup(),send=chain.broadcast;
  chain.broadcast=async()=>{throw new Error('RPC_RESPONSE_UNAVAILABLE');};
  await assert.rejects(engine.fund(a.id),/RPC_RESPONSE/);const original=store.operation(a.id,'fund');
  await assert.rejects(engine.fund(b.id),/CHAIN_PREDECESSOR_UNRESOLVED/);
  assert.equal(store.operation(a.id,'fund').status,'PENDING');assert.equal(store.operation(b.id,'fund').raw,undefined);
  assert.equal(store.accounting(a.m.mandate_id).reserved,150);
  chain.broadcast=send;await engine.recover();await engine.recover();
  assert.equal(store.operation(a.id,'fund').txHash,original.txHash);assert.equal(store.get(a.id).state,'ESCROW_FUNDED');assert.equal(store.get(b.id).state,'ESCROW_FUNDED');
});

test('a finalized same-nonce unrelated replacement cancels funding without freeing ambiguous payments',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup(),send=chain.broadcast;
  chain.broadcast=async()=>{throw new Error('BEFORE_SEND');};await assert.rejects(engine.fund(x.id),/BEFORE_SEND/);chain.broadcast=send;
  const original=Transaction.from(store.operation(x.id,'fund').raw);
  const replacement=await chain.wallet.sendTransaction({to:chain.wallet.address,value:0n,nonce:original.nonce,gasLimit:21000n});await replacement.wait();
  await engine.recover();await engine.recover();
  const op=store.operation(x.id,'fund');assert.equal(op.status,'CANCELLED');assert.equal(op.replacement.replacementTxHash,replacement.hash);
  assert.ok(op.replacement.receipt.finality.confirmations>=1);assert.equal(op.replacement.escrow.status,0);
  assert.equal(store.get(x.id).state,'BLOCKED');assert.equal(store.accounting(x.m.mandate_id).reserved,0);
});

test('an equivalent mined replacement is reconciled using its actual receipt exactly once',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup(),send=chain.broadcast;
  chain.broadcast=async()=>{throw new Error('BEFORE_SEND');};await assert.rejects(engine.fund(x.id),/BEFORE_SEND/);chain.broadcast=send;
  const op=store.operation(x.id,'fund'),signed=Transaction.from(op.raw);
  const replacement=await chain.wallet.sendTransaction({to:signed.to,data:signed.data,value:signed.value,nonce:signed.nonce,gasLimit:signed.gasLimit+1n});await replacement.wait();
  assert.notEqual(replacement.hash,op.txHash);await engine.recover();await engine.recover();
  assert.equal(store.get(x.id).state,'ESCROW_FUNDED');assert.equal(store.operation(x.id,'fund').txHash,replacement.hash);assert.equal(store.operation(x.id,'fund').originalTxHash,op.txHash);
  assert.equal(store.events(x.id).filter(e=>e.event_type==='ESCROW_FUNDED').length,1);
});

test('insufficient confirmations keep funding pending until a canonical confirmation arrives',async t=>{
  const {chain,store,engine,setup}=await lab(t,{confirmations:2}),x=setup();
  await assert.rejects(engine.fund(x.id),/CHAIN_FINALITY_PENDING/);assert.equal(store.operation(x.id,'fund').status,'PENDING');assert.equal(store.accounting(x.m.mandate_id).reserved,150);
  const tx=store.operation(x.id,'fund').txHash;await chain.provider.send('evm_mine',[]);await engine.recover();
  assert.equal(store.operation(x.id,'fund').txHash,tx);assert.equal(store.operation(x.id,'fund').receipt.finality.requiredConfirmations,2);assert.equal(store.get(x.id).state,'ESCROW_FUNDED');
});

test('a disappeared canonical receipt quarantines the runtime without discarding budget exposure',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup();
  const snapshot=await chain.provider.send('evm_snapshot',[]);await engine.fund(x.id);await chain.provider.send('evm_revert',[snapshot]);await engine.recover();
  assert.equal(store.get(x.id).details.reconciliation_required.reason,'CHAIN_REORG_DETECTED');assert.equal(store.accounting(x.m.mandate_id).reserved,150);
  assert.equal(store.operation(x.id,'fund').status,'CONFIRMED');const other=setup();await assert.rejects(engine.fund(other.id),/CHAIN_RECONCILIATION_REQUIRED/);
  assert.equal(store.operation(other.id,'fund').raw,undefined);
});

test('recovery resumes a durable delivery saved before its settlement operation existed',async t=>{
  const {chain,store,engine,setup}=await lab(t),x=setup();await engine.fund(x.id);const settle=engine.settle;
  engine.settle=async()=>{throw new Error('CRASH_AFTER_DELIVERY');};await assert.rejects(engine.deliver(x.id,fixtureDelivery()),/CRASH_AFTER_DELIVERY/);engine.settle=settle;
  assert.equal(store.get(x.id).state,'DELIVERY_VERIFIED');assert.equal(store.operation(x.id,'release'),null);
  await engine.recover();await engine.recover();assert.equal(store.get(x.id).state,'SETTLED');assert.equal((await chain.inspect(store.get(x.id).dealHash)).status,2);
});

test('public finality defaults and unsafe configurations are explicit',()=>{
  assert.deepEqual(finalityConfiguration({publicNetwork:true,confirmations:2,finalityMode:'confirmations'}),{mode:'confirmations',confirmations:2});
  assert.throws(()=>finalityConfiguration({publicNetwork:true,confirmations:1}),/INVALID_FINALITY_POLICY/);
  assert.throws(()=>finalityConfiguration({confirmations:NaN}),/INVALID_FINALITY_POLICY/);
});
