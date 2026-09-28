import test from 'node:test';
import assert from 'node:assert/strict';
import {toQuantity} from 'ethers';
import {findMinedNonce} from '../../src/deal-escrow/nonce-transaction.mjs';

const hex=n=>'0x'+n.toString(16).padStart(64,'0'),sender='0x'+'12'.repeat(20);
function fixture(mined=7654321,height=16777216){
  const transaction={hash:hex(99999999),from:sender,nonce:'0x7',blockHash:hex(mined),blockNumber:toQuantity(mined)};
  const blocks=[],counts=[],provider={
    getTransactionCount:async(address,n)=>{assert.equal(address,sender);counts.push(n);return n<mined?7:8;},
    send:async(method,args)=>{assert.equal(method,'eth_getBlockByNumber');assert.equal(args[1],true);const n=Number(BigInt(args[0]));blocks.push(n);return {number:args[0],hash:hex(n),transactions:n===mined?[transaction]:[]};},
    getBlock:async n=>({number:n,hash:hex(n)})
  };
  return {provider,transaction,blocks,counts,options:{sender,nonce:7,fromBlock:5,basis:{number:height,hash:hex(height)}}};
}

test('locate first, middle and final nonce consumption across 16 million blocks with bounded reads',async()=>{
  for(const mined of [1,7654321,16777216]){
    const f=fixture(mined),found=await findMinedNonce(f.provider,f.options);
    assert.equal(found.transaction.hash,f.transaction.hash);assert.equal(found.blockNumber,mined);
    assert.ok(found.nonceReads<=27);assert.deepEqual(f.blocks,[mined]);
  }
});
test('a hint after the replacement falls back to the earlier history',async()=>{
  const f=fixture(20,100);f.options.fromBlock=80;
  assert.equal((await findMinedNonce(f.provider,f.options)).blockNumber,20);
});
test('unconsumed nonce at the finality boundary never queries or recognizes an unconfirmed transaction',async()=>{
  const f=fixture(101,100);assert.equal(await findMinedNonce(f.provider,f.options),null);assert.deepEqual(f.blocks,[]);
});
test('missing, ambiguous, wrong-nonce and wrong-block candidates cannot corroborate a consumed nonce',async()=>{
  for(const change of [tx=>[],tx=>[tx,tx],tx=>[{...tx,nonce:'0x8'}],tx=>[{...tx,from:'0x'+'34'.repeat(20)}],tx=>[{...tx,blockHash:hex(999)}],tx=>[{...tx,blockNumber:'0x1'}]]){
    const f=fixture(20,100),send=f.provider.send;f.provider.send=async(...args)=>({...await send(...args),transactions:change(f.transaction)});
    await assert.rejects(findMinedNonce(f.provider,f.options),/NONCE_TRANSACTION_/);
  }
});
test('candidate-block or pinned-boundary reorg rejects the located transaction',async()=>{
  for(const reorged of [20,100]){
    const f=fixture(20,100);f.provider.getBlock=async n=>({number:n,hash:hex(n===reorged?n+1000:n)});
    await assert.rejects(findMinedNonce(f.provider,f.options),/CHAIN_REORG_DETECTED/);
  }
});
test('unavailable or malformed historical state and invalid inputs fail closed',async()=>{
  const f=fixture(20,100);
  f.provider.getTransactionCount=async()=>{throw new Error('PRUNED_HISTORY');};
  await assert.rejects(findMinedNonce(f.provider,f.options),/PRUNED_HISTORY/);
  f.provider.getTransactionCount=async()=>NaN;
  await assert.rejects(findMinedNonce(f.provider,f.options),/INVALID_HISTORICAL_NONCE/);
  await assert.rejects(findMinedNonce(f.provider,{...f.options,nonce:-1}),/INVALID_NONCE_SEARCH/);
});
