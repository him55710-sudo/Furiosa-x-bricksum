import test from 'node:test';
import assert from 'node:assert/strict';
import {liveSessionExpired,leaveLiveSession,runLiveSessionRequest} from '../../web/spending/live-session.mjs';
import {renderPurchase} from '../../web/spending/product-view.mjs';
import {liveView} from '../../web/spending/live-view.mjs';
const current=()=>({session:{id:'expired-session',expiresAt:Date.now()-1,createdAt:Date.now()-1200001,model:'qwen3-32b',request:{title:'Saved task',budget:40,perDeal:30,deliveryMinutes:10},messages:[],stopped:false},attempts:0});

test('expired saved sessions can be left without a rejected STOP; saved evidence stays unchanged',async()=>{
 const saved=current(),before=structuredClone(saved);let calls=0;
 await leaveLiveSession(saved,async()=>{calls++;throw Error('LIVE_SESSION_EXPIRED');});
 assert.equal(calls,0);assert.deepEqual(saved,before);
 assert.equal(liveSessionExpired({session:{expiresAt:100}},100),true);
 assert.equal(liveSessionExpired({session:{expiresAt:100}},99),false);
});
test('new negotiation handles expiry racing with STOP but does not swallow other failures',async()=>{
 const active={session:{expiresAt:Date.now()+60000}};let calls=0;
 await leaveLiveSession(active,async()=>{calls++;throw Error('LIVE_SESSION_EXPIRED');});
 assert.equal(calls,1);
 await assert.rejects(leaveLiveSession(active,async()=>{throw Error('NETWORK_FAILURE');}),/NETWORK_FAILURE/);
});
test('expired actions never run or replay; server expiry is remembered without changing signed state',async()=>{
 const saved=current();let calls=0;
 await assert.rejects(runLiveSessionRequest(saved,async()=>{calls++;}),{code:'LIVE_SESSION_EXPIRED'});
 assert.equal(calls,0);
 const active={session:{expiresAt:Date.now()+60000}},before=structuredClone(active.session);
 await assert.rejects(runLiveSessionRequest(active,async()=>{calls++;throw Error('LIVE_SESSION_EXPIRED');}),/Start a new negotiation/);
 assert.equal(active.expired,true);assert.deepEqual(active.session,before);assert.equal(calls,1);
 await assert.rejects(runLiveSessionRequest(active,async()=>{calls++;}),{code:'LIVE_SESSION_EXPIRED'});
 assert.equal(calls,1);
});
test('both Live screens expose recovery and retain inspectable history without offering expired commitments',()=>{
 const live={available:true,current:current()};
 for(const html of [renderPurchase({mode:'live',live,story:{}}),liveView({live})]){
  assert.match(html,/Live session expired/);assert.match(html,/Start a new negotiation/);
  assert.doesNotMatch(html,/data-action="(?:story-live-offer|story-live-agree|live-offer|live-fund)"/);
  assert.doesNotMatch(html,/<form id="(?:purchase-message-form|deal-room-message-form)"/);
 }
});
test('expired negotiation never prevents working with an already funded purchase',()=>{
 const live={available:true,current:current()};
 const html=renderPurchase({mode:'live',live,story:{},job:{id:'task',liveSessionId:'expired-session',dealId:'deal',budget:40,perDeal:30,status:'LOCKED',transactions:[{kind:'fund',status:'CONFIRMED'}]}});
 assert.doesNotMatch(html,/Live session expired/);assert.match(html,/story-live-execute/);
});
