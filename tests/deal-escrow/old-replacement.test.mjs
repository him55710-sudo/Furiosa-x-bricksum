import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Transaction} from 'ethers';
import {openChain} from '../../src/deal-escrow/chain.mjs';
import {DealStore} from '../../src/deal-escrow/store.ts';
import {DealEngine} from '../../src/deal-escrow/engine.ts';
import {now} from '../../src/deal-escrow/domain.ts';
import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';

for(const equivalent of [false,true])test(`reconcile a ${equivalent?'same-intent':'cancelling'} replacement more than 4096 blocks later`,async t=>{
  const chain=await openChain(),store=new DealStore(':memory:'),engine=new DealEngine(store,chain);
  t.after(async()=>{store.close();await chain.close();});
  const time=now(),mid=randomUUID(),id=randomUUID();
  engine.mandate({mandate_id:mid,company_id:'old-replacement-test',buyer_id:'research-agent',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1200});
  engine.propose({deal_id:id,buyer_id:'research-agent',seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:4,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:1,format:'JSON'},deadline:600,created_at:time,expires_at:time+1000,supersedes_deal_id:null},mid);
  engine.agentAction('accept_deal',{deal_id:id});
  const broadcast=chain.broadcast;chain.broadcast=async()=>{throw new Error('STOP_BEFORE_SEND');};
  await assert.rejects(engine.fund(id),/STOP_BEFORE_SEND/);chain.broadcast=broadcast;
  const original=store.operation(id,'fund'),signed=Transaction.from(original.raw);
  const replacement=await chain.wallet.sendTransaction(equivalent?{to:signed.to,data:signed.data,value:signed.value,nonce:signed.nonce,gasLimit:signed.gasLimit+1n}:{to:chain.wallet.address,value:0n,nonce:signed.nonce,gasLimit:21000n});
  await replacement.wait();await chain.provider.send('evm_mine',[{blocks:4096}]);
  const nonceBefore=await chain.provider.getTransactionCount(chain.wallet.address);
  const getCount=chain.provider.getTransactionCount.bind(chain.provider),getReceipt=chain.provider.getTransactionReceipt.bind(chain.provider),send=chain.provider.send.bind(chain.provider);
  // Pruned historical state is an observation failure, never a cancellation.
  chain.provider.getTransactionCount=async()=>{throw new Error('HISTORICAL_STATE_UNAVAILABLE');};
  await engine.recover();assert.equal(store.operation(id,'fund').status,'PENDING');assert.equal(store.accounting(mid).reserved,180);
  chain.provider.getTransactionCount=getCount;
  // A receipt for a different block cannot corroborate the located transaction.
  chain.provider.getTransactionReceipt=async hash=>{const r=await getReceipt(hash);return hash===replacement.hash?{...r,blockNumber:r.blockNumber+1}:r;};
  await engine.recover();assert.equal(store.operation(id,'fund').status,'PENDING');assert.equal(store.accounting(mid).reserved,180);
  chain.provider.getTransactionReceipt=getReceipt;
  let nonceReads=0,fullBlockReads=0;
  chain.provider.getTransactionCount=async(...args)=>{nonceReads++;return getCount(...args);};
  chain.provider.send=async(method,args)=>{if(method==='eth_getBlockByNumber'&&args[1]===true)fullBlockReads++;return send(method,args);};
  const results=await engine.recover();
  assert.ok(nonceReads<=16,`historical nonce reads: ${nonceReads}`);assert.equal(fullBlockReads,1);
  assert.equal(store.operation(id,'fund').status,equivalent?'CONFIRMED':'CANCELLED',JSON.stringify(results));
  assert.equal(store.get(id).state,equivalent?'ESCROW_FUNDED':'BLOCKED');
  assert.equal(store.operation(id,'fund').replacement.replacementTxHash,replacement.hash);
  assert.equal(store.accounting(mid).reserved,equivalent?180:0);
  assert.equal(await chain.provider.getTransactionCount(chain.wallet.address),nonceBefore);
  const verdict=await verifyReceipt(receipt(engine,id),chain);assert.equal(verdict.verdict,'VALID',JSON.stringify(verdict));
});
