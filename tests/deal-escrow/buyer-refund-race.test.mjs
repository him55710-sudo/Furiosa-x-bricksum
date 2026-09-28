import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {openChain} from '../../src/deal-escrow/chain.mjs';
import {DealStore} from '../../src/deal-escrow/store.ts';
import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {hash,now} from '../../src/deal-escrow/domain.ts';
import {fixtureDelivery} from '../../src/deal-escrow/delivery.ts';
import {Transaction} from 'ethers';
import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';

async function lab(t){
  const chain=await openChain(),file=path.join(mkdtempSync(path.join(tmpdir(),'ade-refund-race-')),'state.sqlite');
  const c={chain,store:new DealStore(file)};c.engine=new DealEngine(c.store,chain);
  c.restart=()=>{c.store.close();c.store=new DealStore(file);c.engine=new DealEngine(c.store,chain);};
  t.after(async()=>{c.store.close();await chain.close();});
  const time=now();c.mid=randomUUID();c.id=randomUUID();
  c.engine.mandate({mandate_id:c.mid,company_id:'race-test',buyer_id:'research-agent',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1200});
  c.engine.propose({deal_id:c.id,buyer_id:'research-agent',seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:60,created_at:time,expires_at:time+600,supersedes_deal_id:null},c.mid);
  c.engine.agentAction('accept_deal',{deal_id:c.id});await c.engine.fund(c.id);
  c.buyerRefund=async()=>{
    await chain.provider.send('evm_increaseTime',[61]);await chain.provider.send('evm_mine',[]);
    const buyer=chain.contract.connect(await chain.provider.getSigner(chain.deployment.buyer));
    return (await buyer.refund(c.store.get(c.id).dealHash,hash('BUYER_DEADLINE_REFUND'))).wait();
  };
  return c;
}

for(const [kind,rows] of [['release',52],['refund',7]])test(`buyer wins while controller ${kind} is signed: preserve uncertainty, recover the exact revert and retain both attempts`,async t=>{
  const c=await lab(t),{chain}=c,broadcast=chain.broadcast;
  chain.broadcast=async()=>{throw new Error('RPC_OFFLINE');};
  await assert.rejects(c.engine.deliver(c.id,fixtureDelivery(rows)),/RPC_OFFLINE/);
  const signed=c.store.operation(c.id,kind),nonce=await chain.provider.getTransactionCount(chain.wallet.address);
  const buyerReceipt=await c.buyerRefund();
  await c.engine.recover();
  assert.equal(c.store.accounting(c.mid).reserved,180);
  assert.equal(c.store.operation(c.id,kind).status,'PENDING');
  c.restart();chain.broadcast=broadcast;
  await c.engine.recover();await c.engine.recover();
  assert.equal(c.store.get(c.id).state,'REFUNDED');
  assert.equal(c.store.accounting(c.mid).reserved,0);
  assert.equal(c.store.operation(c.id,'refund').txHash,buyerReceipt.hash);
  const archived=c.store.operation(c.id,'controller_'+kind);
  assert.equal(archived.txHash,signed.txHash);assert.equal(archived.status,'REVERTED');assert.equal(archived.receipt.status,0);
  assert.equal(await chain.provider.getTransactionCount(chain.wallet.address),nonce+1);
  assert.equal(c.store.events(c.id).filter(e=>e.event_type==='ESCROW_REFUNDED').length,1);
  const bundle=receipt(c.engine,c.id),verified=await verifyReceipt(bundle,chain);
  assert.equal(bundle.schema_version,4);assert.equal(bundle.controller_attempts.length,1);
  assert.equal(verified.verdict,'VALID',JSON.stringify(verified));
  assert.equal(c.store.controls().length,kind==='refund'?1:0);
  for(const mutate of [r=>r.controller_attempts=[],r=>r.controller_attempts[0].status='CONFIRMED',r=>r.controller_attempts[0].receipt.status=1,r=>r.evidence.controller_settlement.attestation.deal.price_minor=1,r=>r.schema_version=3]){
    const bad=structuredClone(bundle);mutate(bad);assert.equal((await verifyReceipt(bad,chain)).verdict,'INVALID');
  }
});

for(const [kind,rows] of [['release',52],['refund',7]])test(`buyer wins before controller ${kind} is signed: cancel only the unsigned intent without consuming a nonce`,async t=>{
  const c=await lab(t),{chain}=c,prepare=chain.prepare;
  chain.prepare=async()=>{throw new Error('STOP_BEFORE_SIGNATURE');};
  await assert.rejects(c.engine.deliver(c.id,fixtureDelivery(rows)),/STOP_BEFORE_SIGNATURE/);
  assert.equal(c.store.operation(c.id,kind).raw,undefined);
  const nonce=await chain.provider.getTransactionCount(chain.wallet.address),buyerReceipt=await c.buyerRefund();
  chain.prepare=prepare;c.restart();await c.engine.recover();
  assert.equal(c.store.operation(c.id,'refund').txHash,buyerReceipt.hash);
  assert.equal(c.store.operation(c.id,'controller_'+kind).status,'CANCELLED');
  assert.equal(await chain.provider.getTransactionCount(chain.wallet.address),nonce);
  const result=await verifyReceipt(receipt(c.engine,c.id),chain);assert.equal(result.verdict,'VALID',JSON.stringify(result));
});

test('an independently mined same-nonce cancellation and buyer refund are both reconstructed',async t=>{
  const c=await lab(t),{chain}=c,broadcast=chain.broadcast;
  chain.broadcast=async()=>{throw new Error('STOP_BEFORE_SEND');};
  await assert.rejects(c.engine.deliver(c.id,fixtureDelivery()),/STOP_BEFORE_SEND/);
  const original=c.store.operation(c.id,'release'),signed=Transaction.from(original.raw);
  await c.buyerRefund();
  const replacement=await chain.wallet.sendTransaction({to:chain.wallet.address,value:0n,nonce:signed.nonce,gasLimit:21000n});await replacement.wait();
  chain.broadcast=broadcast;await c.engine.recover();await c.engine.recover();
  const archived=c.store.operation(c.id,'controller_release');
  assert.equal(archived.status,'CANCELLED');assert.equal(archived.reason,'SIGNED_NONCE_REPLACED');
  assert.equal(archived.replacement.replacementTxHash,replacement.hash);
  assert.equal(c.store.accounting(c.mid).reserved,0);
  const bundle=receipt(c.engine,c.id),result=await verifyReceipt(bundle,chain);assert.equal(result.verdict,'VALID',JSON.stringify(result));
  const forged=structuredClone(bundle);forged.controller_attempts[0].replacement.nonce++;
  assert.equal((await verifyReceipt(forged,chain)).verdict,'INVALID');
});

test('delivery saved before settlement preparation survives a buyer refund without inventing a controller transaction',async t=>{
  const c=await lab(t),settle=c.engine.settle;
  c.engine.settle=async()=>{throw new Error('CRASH_AFTER_DELIVERY');};
  await assert.rejects(c.engine.deliver(c.id,fixtureDelivery()),/CRASH_AFTER_DELIVERY/);
  c.engine.settle=settle;await c.buyerRefund();c.restart();await c.engine.recover();
  const bundle=receipt(c.engine,c.id);assert.equal(bundle.schema_version,4);assert.deepEqual(bundle.controller_attempts,[]);
  assert.equal(bundle.evidence.validation.verified,true);assert.equal(bundle.evidence.controller_settlement.attestation,null);
  assert.equal((await verifyReceipt(bundle, c.chain)).verdict,'VALID');
});

test('a controller payout that won before the deadline remains paid after response loss; the buyer cannot refund it',async t=>{
  const c=await lab(t),{chain}=c,broadcast=chain.broadcast;
  chain.broadcast=async op=>{await broadcast(op);throw new Error('RESPONSE_LOST');};
  await assert.rejects(c.engine.deliver(c.id,fixtureDelivery()),/RESPONSE_LOST/);
  await chain.provider.send('evm_increaseTime',[61]);await chain.provider.send('evm_mine',[]);
  const buyer=chain.contract.connect(await chain.provider.getSigner(chain.deployment.buyer));
  await assert.rejects(buyer.refund.staticCall(c.store.get(c.id).dealHash,hash('BUYER_DEADLINE_REFUND')),/NOT_LOCKED|revert/);
  chain.broadcast=broadcast;c.restart();await c.engine.recover();
  assert.equal(c.store.get(c.id).state,'SETTLED');assert.equal(c.store.accounting(c.mid).spent,180);assert.equal(c.store.operation(c.id,'refund'),null);
  const bundle=receipt(c.engine,c.id);assert.equal(bundle.schema_version,2);assert.equal((await verifyReceipt(bundle,chain)).verdict,'VALID');
});
