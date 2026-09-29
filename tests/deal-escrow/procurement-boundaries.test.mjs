import test from 'node:test';
import assert from 'node:assert/strict';
import {runProcurement} from '../../src/dealtrace/procurement/run.mjs';
import {preflight,tokenCeiling} from '../../src/dealtrace/procurement/limits.mjs';
import {defaultRfq} from '../../src/dealtrace/procurement/protocol.mjs';
test('live-enabled procurement stops invalid authority before model calls or chain setup',async()=>{
 for(const [error,options] of [['SELLER_NOT_ALLOWED',{allowedSellerIds:['seller-a','seller-b','seller-c'],requestedSellerIds:['seller-x']}],['SELLER_NOT_ALLOWED',{allowedSellerIds:[]}],['BUDGET_EXCEEDED',{budget:4000,feeReserveMinor:2300}],['MANDATE_EXPIRED',{authorityExpiresAt:0}]]){
  const r=await runProcurement({approved:true,live:true,...options});
  assert.equal(r.status,'STOPPED');assert.equal(r.error,error);assert.equal(r.model_calls,0);assert.equal(r.network,undefined);assert.deepEqual(r.transactions,[]);assert.deepEqual(r.financial_intents,[]);
 }
});
test('prefilter uses pinned minimum cost and fails closed on malformed authority',()=>{
 const input={rfq:defaultRfq(),allowedSellerIds:['seller-a'],expiresAt:Date.now()+10000,feeReserveMinor:300};
 assert.equal(preflight(input).all_in_minimum_minor,2100);
 assert.throws(()=>preflight({...input,feeReserveMinor:-1}),/FEE_RESERVE_INVALID/);
 assert.throws(()=>preflight({...input,allowedSellerIds:null}),/SELLER_ALLOWLIST_REQUIRED/);
 for(const n of [0,799,5001,NaN,'1200'])assert.throws(()=>tokenCeiling(n));
});
