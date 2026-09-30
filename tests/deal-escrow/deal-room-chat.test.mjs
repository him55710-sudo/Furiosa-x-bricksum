import test from 'node:test';
import assert from 'node:assert/strict';
import {roomMessageTurn,roomComposer,sendRoomMessage} from '../../web/spending/live-chat.mjs';
import {liveView} from '../../web/spending/live-view.mjs';
const fixture=()=>({available:true,seller:'atlas',current:{attempts:0,session:{model:'qwen3-32b',request:{title:'Research',budget:40,perDeal:30},messages:[]}}});

test('Send starts a session if needed and forwards exact human guidance to inference',async()=>{
 let live={available:true},calls=[];
 await sendRoomMessage(()=>live,{start:async()=>{calls.push('start');live=fixture();},send:async(...args)=>calls.push(args)},'Please preserve coverage and negotiate the price.');
 assert.deepEqual(calls,['start',['live-offer','Please preserve coverage and negotiate the price.']]);
});
test('routing follows actual selected-seller conversation, including buyer and seller turns',()=>{
 const live=fixture();assert.equal(roomMessageTurn(live).action,'live-offer');
 live.current.session.messages.push({actor:'atlas',seller:'atlas'});assert.equal(roomMessageTurn(live).action,'live-counter');
 live.current.session.messages.push({actor:'buyer',seller:'atlas'});assert.equal(roomMessageTurn(live).action,'live-respond');
 live.seller='orbit';assert.equal(roomMessageTurn(live).action,'live-offer');assert.equal(roomMessageTurn(live).target,'Orbit');
});
test('stopped, locked, pending and exhausted sessions cannot send or auto-approve',async()=>{
 for(const change of [l=>l.current.session.stopped=true,l=>l.current.session.agreement={},l=>l.current.authorization={},l=>l.current.pending={},l=>l.current.attempts=8]){
  const live=fixture();change(live);let sent=false;
  await assert.rejects(sendRoomMessage(()=>live,{send:async()=>{sent=true;}},'Negotiate please'));
  assert.equal(sent,false);assert.match(roomComposer(live),/textarea[^>]*disabled/);
 }
});
test('large accessible composer appears before start and in the detailed room; guidance is escaped',()=>{
 assert.match(liveView({live:{available:true}}),/id="deal-room-message-form"/);
 const live=fixture();live.composer='<draft>';
 live.current.session.messages.push({seller:'atlas',actor:'atlas',sequence:1,input:{humanGuidance:'<script>bad</script>'},quote:{price:22,message:'Offer',rows:4,sources:4,deliveryMinutes:10}});
 const html=liveView({live});assert.match(html,/id="deal-room-message"/);assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(html,/&lt;draft&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.ok(html.indexOf('deal-room-message-form')<html.indexOf('live-action-bar'));
});
test('failed guidance remains visible and no fake model response is inserted',()=>{
 const live=fixture();live.current.attemptLog=[{seller:'atlas',guidance:'Please revise.',result:'KILN_NETWORK_ERROR'}];
 const html=liveView({live});assert.match(html,/Please revise\./);assert.match(html,/Request not accepted/);assert.doesNotMatch(html,/data-live-message=/);
});
test('empty or oversized messages never call inference',async()=>{
 for(const text of ['  ','x'.repeat(1201)])await assert.rejects(sendRoomMessage(fixture,{send:async()=>assert.fail('Unexpected inference')},text));
});
