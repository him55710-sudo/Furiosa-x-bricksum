import test from 'node:test';
import assert from 'node:assert/strict';
import {findBuyerRefundEvent} from '../../src/deal-escrow/buyer-refund.mjs';

const hex=n=>'0x'+n.toString(16).padStart(64,'0');
function fixture(){
  const dealHash=hex(100),fund={hash:hex(200),blockNumber:5,blockHash:hex(5)},ranges=[],progress=[];
  const blocks=new Map(),provider={getBlock:async tag=>{const n=tag==='latest'?20:tag;return {number:n,hash:blocks.get(n)??hex(n)};}};
  const event={transactionHash:hex(300),blockNumber:18,blockHash:hex(18)},contract={filters:{Refunded:hash=>({hash})},queryFilter:async(filter,from,to)=>{assert.equal(filter.hash,dealHash);ranges.push([from,to]);return from<=18&&to>=18?[event]:[];}};
  return {dealHash,fund,ranges,progress,blocks,provider,contract,event,options:{blockSpan:4,maxPages:4,onProgress:cursor=>progress.push(cursor)}};
}

test('refund history pages respect RPC bounds and resume the failed page without skipping blocks',async()=>{
  const f=fixture(),search=options=>findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,...options});
  await assert.rejects(search({maxPages:1}),/BUYER_REFUND_SEARCH_PENDING/);
  assert.deepEqual(f.ranges,[[5,8]]);const cursor=f.progress.at(-1);
  const query=f.contract.queryFilter;f.contract.queryFilter=async()=>{throw new Error('RPC_RATE_LIMITED');};
  await assert.rejects(search({cursor}),/RPC_RATE_LIMITED/);
  assert.equal(f.progress.length,1);
  f.contract.queryFilter=query;
  assert.deepEqual(await search({cursor}),f.event);
  assert.deepEqual(f.ranges,[[5,8],[9,12],[13,16],[17,20]]);
  assert.ok(f.ranges.every(([from,to])=>to-from+1<=4));
});

test('a reorged checkpoint restarts the read search at funding rather than trusting an old empty range',async()=>{
  const f=fixture();await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,maxPages:1}),/SEARCH_PENDING/);
  const cursor=f.progress.at(-1);f.blocks.set(8,hex(808));f.ranges.length=0;
  assert.deepEqual(await findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,cursor}),f.event);
  assert.equal(f.progress[1],null);assert.equal(f.ranges[0][0],5);
});

test('a reorg during an empty-page observation discards progress and never marks that page scanned',async()=>{
  const f=fixture();await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,maxPages:1}),/SEARCH_PENDING/);
  const cursor=f.progress.at(-1),query=f.contract.queryFilter;
  f.contract.queryFilter=async(...args)=>{const result=await query(...args);f.blocks.set(8,hex(808));return result;};
  await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,cursor}),/CHAIN_REORG_DETECTED/);
  assert.deepEqual(f.progress,[cursor,null]);
});

test('foreign cursors, duplicate logs and out-of-range logs cannot produce a refund observation',async()=>{
  const f=fixture();await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,maxPages:1}),/SEARCH_PENDING/);
  const cursor=f.progress.at(-1);
  await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,{...f.options,cursor:{...cursor,deal_hash:hex(999)}}),/BUYER_REFUND_CURSOR_INVALID/);
  f.contract.queryFilter=async()=>[f.event,f.event];
  await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,f.options),/BUYER_REFUND_EVENT_AMBIGUOUS/);
  f.contract.queryFilter=async()=>[f.event];
  await assert.rejects(findBuyerRefundEvent(f,f.dealHash,f.fund,f.options),/BUYER_REFUND_EVENT_RANGE_MISMATCH/);
});
