import test from 'node:test';
import assert from 'node:assert/strict';
import {getBytes,verifyMessage} from 'ethers';
import {createLiveNegotiation} from '../../src/accord/live-negotiation.mjs';

test('live negotiation keeps seller policies out of buyer inputs and binds bilateral signatures to agreed terms',async()=>{
 let clock=1000;const inputs=[];
 const service=createLiveNegotiation({secret:'test-only-signing-secret-not-a-real-credential',model:'qwen3-32b',now:()=>clock,clientFactory:onRecord=>({
  payload:(system,input,tools)=>({system,input,tools}),
  async request(flow,payload,validate){
   inputs.push({flow,payload});const p=payload.input.private_policy;
   const price=p.minimum_price?(payload.input.conversation.length?p.minimum_price:p.minimum_price+2):18;
   const quote={action:'offer',price,rows:4,sources:4,deliveryMinutes:8,message:'These terms preserve the requested source coverage.'};
   validate('send_negotiation_message',quote);onRecord({model:'qwen3-32b',request_id:'fixture-'+inputs.length,total_tokens:123});
   return {model:'qwen3-32b',request_id:'fixture-'+inputs.length,args:quote};
  }
 })});
 const input={title:'CAPEX data',brief:'Four referenced quarterly observations.',budget:40,perDeal:30,rows:4,sources:4,deliveryMinutes:10,sourceHash:'0x'+'ab'.repeat(32)};
 let session=await service.execute({action:'start',input});
 session=await service.execute({action:'offer',session,seller:'atlas'});
 assert.equal(session.state.messages[0].quote.price,22);
 session=await service.execute({action:'counter',session,seller:'atlas'});
 assert.equal(session.state.messages.at(-1).quote.price,18);
 const buyer=inputs.find(i=>i.flow.endsWith('Buyer')).payload.input;
 assert.equal(buyer.private_policy.minimum_price,undefined);assert.doesNotMatch(JSON.stringify(buyer),/minimum_price|minimum_delivery_minutes|maximum_sources/);
 session=await service.execute({action:'respond',session,seller:'atlas'});assert.equal(session.state.messages.at(-1).quote.price,20);
 session=await service.execute({action:'agree',session,seller:'atlas'});const a=session.state.agreement;
 assert.equal(a.terms.price,20);assert.notEqual(a.buyer,a.seller);assert.equal(verifyMessage(getBytes(a.hash),a.buyerSignature),a.buyer);assert.equal(verifyMessage(getBytes(a.hash),a.sellerSignature),a.seller);
 assert.equal(session.state.calls,3);assert.doesNotMatch(JSON.stringify(session),/minimum_price|minimum_delivery_minutes|maximum_sources|test-only-signing-secret/);
 assert.equal(session.state.messages[1].requestId,'fixture-2');assert.equal(session.state.messages[1].inputScope.startsWith('Public request'),true);
 const edited=structuredClone(session);edited.state.agreement.terms.price=25;await assert.rejects(service.execute({action:'counter',session:edited,seller:'atlas'}),/SESSION_CHANGED/);
 await assert.rejects(service.execute({action:'counter',session,seller:'atlas'}),/AGREEMENT_LOCKED/);
 clock=session.state.expiresAt+1;await assert.rejects(service.execute({action:'stop',session}),/SESSION_EXPIRED/);
});

test('live signing refuses an over-authority seller offer and a tampered mandate',async()=>{
 const service=createLiveNegotiation({secret:'test-only-signing-secret-not-a-real-credential',model:'qwen3-32b',clientFactory:onRecord=>({payload:(_system,input)=>({input}),request:async(_flow,payload,validate)=>{
  const q={action:'offer',price:35,rows:4,sources:4,deliveryMinutes:8,message:'Fast delivery with referenced results.'};validate('send_negotiation_message',q);return {args:q,model:'qwen3-32b',request_id:'fixture'};
 }})});
 let session=await service.execute({action:'start',input:{title:'CAPEX data',brief:'Four referenced observations.',budget:40,perDeal:30,rows:4,sources:4,deliveryMinutes:10,sourceHash:'0x'+'cd'.repeat(32)}});
 session=await service.execute({action:'offer',session,seller:'nexus'});assert.equal(session.state.agreement,null);
 await assert.rejects(service.execute({action:'counter',session,seller:'nexus'}),/BUYER_AUTHORITY/);
 const changed=structuredClone(session);changed.state.request.perDeal=40;await assert.rejects(service.execute({action:'counter',session:changed,seller:'nexus'}),/SESSION_CHANGED/);
});
