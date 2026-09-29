import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveNegotiation,defaultSellerPolicies} from '../../src/accord/live-negotiation.mjs';
const secret='unit-test-only-private-signing-config';
test('server-configured seller floors generalize without exposing them to the buyer',async()=>{
 const seen=[],policies=structuredClone(defaultSellerPolicies);policies.atlas.minimum_price=67;
 const engine=createLiveNegotiation({secret,model:'qwen3-32b',sellerPolicies:policies,clientFactory:onRecord=>({
  payload:(_s,input)=>({input}),async request(flow,{input},validate){seen.push(input);const q={action:'offer',price:input.private_policy.minimum_price??71,rows:4,sources:2,deliveryMinutes:8,message:'These terms meet the requested scope.'};validate('send_negotiation_message',q);onRecord({result:'VALID_TOOL_PROPOSAL'});return {args:q,model:'qwen3-32b',request_id:'UNIT_FIXTURE'};}
 })});
 policies.atlas.minimum_price=999;
 let session=await engine.execute({action:'start',input:{title:'Variable mandate',brief:'Four source-linked rows.',budget:173,perDeal:91,rows:4,sources:2,deliveryMinutes:20,sourceHash:'0x'+'12'.repeat(32)}});
 for(const action of ['offer','counter','respond','agree'])session=await engine.execute({action,session,seller:'atlas'});
 assert.equal(session.state.agreement.terms.price,67);assert.equal(seen[0].private_policy.minimum_price,67);
 assert.doesNotMatch(JSON.stringify(seen[1]),/minimum_price|minimum_delivery_minutes|maximum_sources/);
 assert.equal(defaultSellerPolicies.atlas.minimum_price,20);
});
test('invalid operator policy configuration fails before any model request',()=>{
 for(const value of [0,-1,1.5,NaN,1000001]){const p=structuredClone(defaultSellerPolicies);p.atlas.minimum_price=value;assert.throws(()=>createLiveNegotiation({secret,sellerPolicies:p}),/LIVE_POLICY_CONFIG/);}
 assert.throws(()=>createLiveNegotiation({secret,sellerPolicies:{atlas:defaultSellerPolicies.atlas}}),/LIVE_POLICY_CONFIG/);
});
