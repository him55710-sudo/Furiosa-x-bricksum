import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {sqliteLiveStore} from '../../src/accord/live-store.mjs';
import {createLiveService} from '../../src/accord/live-service.mjs';
import {createLiveNegotiation} from '../../src/accord/live-negotiation.mjs';

const owner=randomUUID(),request={title:'CAPEX request',brief:'Four referenced records.',budget:40,perDeal:30,rows:4,sources:4,deliveryMinutes:10,sourceHash:'0x'+'ab'.repeat(32)};
function fixture(t,{callBudget=60}={}){
 const file=path.join(mkdtempSync(path.join(os.tmpdir(),'accord-live-')),'live.sqlite');
 const store=sqliteLiveStore(file);t.after(()=>store.close());let count=0,release,fail=false,delay=false;
 const negotiation=createLiveNegotiation({secret:'test-only-private-policy-service-secret',model:'qwen3-32b',clientFactory:onRecord=>({payload:(_system,input)=>({input}),async request(_flow,payload,validate){
  count++;if(delay)await new Promise(r=>{release=r;});if(fail){onRecord({model:'qwen3-32b',request_id:'failed-test-'+count,total_tokens:1200,private_policy:'must not be exported'});throw Error('KILN_NETWORK_ERROR');}
  const q={action:'offer',price:payload.input.private_policy.minimum_price??18,rows:4,sources:4,deliveryMinutes:8,message:'Referenced coverage with the requested delivery.'};
  validate('',q);return {args:q,model:'qwen3-32b',request_id:'test-'+count};
 }})});
 const service=createLiveService({store,negotiation,callBudget});
 return {service,file,negotiation,get count(){return count;},release:()=>release(),delay:()=>{delay=true;},fail:()=>{fail=true;}};
}
const start=s=>s.execute(owner,{action:'start',operationId:randomUUID(),request});
const act=(s,state,action,extras={})=>s.execute(owner,{id:state.session.id,revision:state.revision,action,operationId:randomUUID(),seller:'atlas',...extras});

test('durable live service charges failures, handles retry once and rejects stale/foreign sessions',async t=>{
 const f=fixture(t,{callBudget:2});let s=await start(f.service);
 const operationId=randomUUID(),command={id:s.session.id,revision:s.revision,action:'offer',operationId,seller:'atlas'};
 s=await f.service.execute(owner,command);assert.equal(s.session.messages.length,1);
 const again=await f.service.execute(owner,command);assert.equal(again.session.messages.length,1);assert.equal(f.count,1);
 await assert.rejects(f.service.execute(randomUUID(),{...command,operationId:randomUUID()}),/NOT_FOUND/);
 await assert.rejects(f.service.execute(owner,{...command,operationId:randomUUID()}),/REVISION_CHANGED/);
 f.fail();s=await act(f.service,s,'counter');assert.equal(s.error,'KILN_NETWORK_ERROR');assert.equal(s.attempts,2);
 assert.equal(s.attemptLog.length,2);assert.equal(s.attemptLog[1].result,'KILN_NETWORK_ERROR');
 assert.equal(s.attemptLog[1].usage.request_id,'failed-test-2');assert.equal(s.attemptLog[1].usage.total_tokens,1200);assert.doesNotMatch(JSON.stringify(s.attemptLog),/private_policy|must not be exported/);
 await assert.rejects(act(f.service,s,'counter'),/SERVICE_CALL_LIMIT/);
 const reopened=sqliteLiveStore(f.file);t.after(()=>reopened.close());const other=createLiveService({store:reopened,negotiation:f.negotiation,callBudget:2});
 assert.equal((await other.state(owner,s.session.id)).attempts,2);assert.equal((await other.state(owner)).remainingCalls,0);
});

test('Stop supersedes concurrent inference and persisted old revisions cannot revive it',async t=>{
 const f=fixture(t);let s=await start(f.service);f.delay();
 const pending=act(f.service,s,'offer');
 while(f.count===0)await new Promise(r=>setTimeout(r,2));
 const duplicate=await act(f.service,s,'stop');assert.equal(duplicate.session.stopped,true);
 f.release();const finished=await pending;assert.equal(finished.session.stopped,true);assert.equal(finished.session.messages.length,0);
 assert.equal(finished.attemptLog[0].result,'STOPPED');assert.ok(finished.attemptLog[0].completedAt);
 await assert.rejects(act(f.service,s,'offer'),/AUTHORITY_REVOKED/);
});

test('concurrent service instances share a call cap and authorization binds exactly one task',async t=>{
 const f=fixture(t);let s=await start(f.service);
 for(const action of ['offer','counter','respond','agree'])s=await act(f.service,s,action);
 assert.equal(s.session.agreement.terms.price,20);
 const taskId=randomUUID();s=await act(f.service,s,'authorize',{taskId});assert.equal(s.authorization.taskId,taskId);
 await assert.rejects(act(f.service,s,'authorize',{taskId:randomUUID()}),/ALREADY_USED/);
 await assert.rejects(act(f.service,s,'stop'),/ALREADY_AUTHORIZED/);
 const otherStore=sqliteLiveStore(f.file);t.after(()=>otherStore.close());
 const other=createLiveService({store:otherStore,negotiation:f.negotiation,callBudget:4});
 let a=await start(other),b=await start(other);
 const results=await Promise.allSettled([act(other,a,'offer'),act(other,b,'offer')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.count,4);
});
