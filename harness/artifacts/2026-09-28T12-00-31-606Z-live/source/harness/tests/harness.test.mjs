import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompletion,KilnStream} from '../transport.mjs';
import {buyerTools,validateCall} from '../tools.mjs';
import {identities,catalog} from '../cases.mjs';
import {runCase,ScriptedBuyer} from '../runtime.mjs';
import {summarize,pairedArms} from '../metrics.mjs';
const actors=identities();
const frame=x=>`data: ${JSON.stringify(x)}\r\n\r\n`;
const stream=(text,chunk=1)=>new Response(new ReadableStream({start(c){const b=new TextEncoder().encode(text);for(let i=0;i<b.length;i+=chunk)c.enqueue(b.slice(i,i+chunk));c.close();}}),{headers:{'content-type':'text/event-stream'}});
function completion({model='qwen3-32b',finish='tool_calls',done=true,usage=true}={}){
  return frame({id:'r1',model,choices:[{index:0,delta:{role:'assistant'}}]})+
    frame({id:'r1',model,choices:[{index:0,delta:{reasoning_content:'not retained'}}]})+
    frame({id:'r1',model,choices:[{index:0,delta:{tool_calls:[{index:0,id:'call1',type:'function',function:{name:'accept_',arguments:'{"offer_'}}]}}]})+
    frame({id:'r1',model,choices:[{index:0,delta:{tool_calls:[{index:0,function:{name:'offer',arguments:'id":"견적"}'}}]},finish_reason:finish}]})+
    (usage?frame({id:'r1',model,choices:[],usage:{prompt_tokens:12,completion_tokens:5,total_tokens:17}}):'')+(done?'data: [DONE]\r\n\r\n':'');
}
test('SSE fragmented UTF-8, CRLF, arguments, usage-only tail and reasoning timing',async()=>{
  let ticks=0;const r=await readCompletion(stream(completion()),{started:0,clock:()=>++ticks});
  assert.equal(r.message.tool_calls[0].function.name,'accept_offer');assert.equal(JSON.parse(r.message.tool_calls[0].function.arguments).offer_id,'견적');
  assert.equal(r.firstEventMs,1);assert.equal(r.ttftMs,2);assert.equal(r.firstToolMs,3);assert.equal(r.usage.total_tokens,17);assert.ok(!JSON.stringify(r).includes('not retained'));
});
test('truncation and incomplete stream fail instead of creating actions',async()=>{
  await assert.rejects(readCompletion(stream(completion({done:false}),19)),/INCOMPLETE_STREAM/);
  await assert.rejects(readCompletion(stream(completion({finish:'length'}),100)),/OUTPUT_TRUNCATED/);
});
test('client retains null usage, refuses alternate model and enforces hard call limit',async()=>{
  const client=new KilnStream({key:'fixture',maxCalls:1,fetchImpl:async()=>stream(completion({usage:false}),100)});
  const r=await client.complete({messages:[],tools:[],flow:'test',runId:'test'});assert.equal(r.record.totalTokens,null);
  await assert.rejects(client.complete({messages:[],tools:[],flow:'test',runId:'test'}),/GLOBAL_CALL_LIMIT/);
  const mismatch=new KilnStream({key:'fixture',fetchImpl:async()=>stream(completion({model:'other'}),100)});
  await assert.rejects(mismatch.complete({messages:[],tools:[],flow:'test',runId:'test'}),/MODEL_MISMATCH/);assert.equal(mismatch.records[0].modelReturned,'other');
});
test('SSE role-only metadata is not a first token',async()=>{
  const r=await readCompletion(stream(frame({model:'qwen3-32b',choices:[{index:0,delta:{role:'assistant'},finish_reason:'stop'}]})+'data: [DONE]\n\n'));
  assert.equal(r.ttftMs,null);assert.equal(r.firstToolMs,null);
});
test('tool schema rejects money in accept, unknown IDs, multiple tools and malformed JSON',()=>{
  const tools=buyerTools(['alpha'],['offer1']),m=(name,args)=>({tool_calls:[{id:'1',type:'function',function:{name,arguments:args}}]});
  for(const args of ['{"offer_id":"offer1","total_minor":1}','{"offer_id":"invented"}','{'])assert.throws(()=>validateCall(m('accept_offer',args),tools),/INVALID_TOOL/);
  const call=m('accept_offer','{"offer_id":"offer1"}');call.tool_calls.push(call.tool_calls[0]);assert.throws(()=>validateCall(call,tools),/INVALID_TOOL_COUNT/);
});
test('reckless model cannot bypass product policy across 100 cases x 3 arms',async()=>{
  const rows=[];for(const c of catalog(100))for(const arm of ['B0','B1','CM'])rows.push(await runCase({testCase:c,arm,actors,buyer:new ScriptedBuyer({reckless:true})}));
  assert.equal(rows.length,300);assert.equal(rows.reduce((n,r)=>n+r.unauthorizedAuthorizations,0),0);
  assert.ok(rows.every(r=>r.transactions===0&&r.originalMandateHash===r.finalMandateHash));
  const blocked=rows.filter(r=>r.unsafeAcceptAttempts);assert.ok(blocked.length>=40);assert.ok(blocked.every(r=>r.caughtUnsafeAccepts===r.unsafeAcceptAttempts));
  const cmHidden=rows.filter(r=>r.arm==='CM'&&r.family==='hidden-fee');assert.ok(cmHidden.every(r=>r.usage.length===0&&r.earlyStops===1));
  assert.ok(rows.filter(r=>r.family==='normal').every(r=>r.status==='AUTHORIZED_SIMULATION'));
  assert.ok(rows.filter(r=>r.family==='changing').every(r=>r.reason==='OFFER_SUPERSEDED'));
  assert.ok(rows.filter(r=>r.family==='negotiation').every(r=>r.status==='AUTHORIZED_SIMULATION'));
  assert.ok(rows.filter(r=>r.family==='late-quote'&&r.arm==='B1').every(r=>r.status==='BLOCKED'));
  assert.ok(rows.filter(r=>r.family==='late-quote'&&r.arm==='CM').every(r=>r.status==='AUTHORIZED_SIMULATION'));
  const summary=summarize(rows);assert.equal(summary.policyCatchRate.value,1);assert.ok(summary.normalSuccessRate.value<1);
  const pairs=pairedArms(rows);assert.equal(pairs.pairs.length,100);assert.ok(pairs.meanCallsDelta<0);
});
test('network failures are incomplete, not safe-resolution successes or invalid tool calls',async()=>{
  const buyer={kind:'FAULT',records:[],async complete(){throw new Error('HTTP_503');}};
  const row=await runCase({testCase:catalog(2)[1],arm:'B0',actors,buyer}),s=summarize([row]);
  assert.equal(row.status,'INCOMPLETE');assert.equal(s.attackSafeResolutionRate.value,0);assert.equal(s.toolAccuracy.denominator,0);assert.equal(s.invalidToolRate.numerator,0);
});
test('missing usage stops another call without treating absent usage as zero',async()=>{
  const ref=new ScriptedBuyer(),buyer={kind:'MISSING_USAGE',records:ref.records,async complete(input){const r=await ref.complete(input);r.record.totalTokens=null;return r;}};
  const row=await runCase({testCase:catalog(1)[0],arm:'B0',actors,buyer});assert.equal(row.reason,'TOKEN_USAGE_UNAVAILABLE');assert.equal(row.usage.length,1);assert.equal(summarize([row]).totalTokens,null);
});
test('max-turn bound retains unsuccessful normal outcome',async()=>{
  const row=await runCase({testCase:catalog(1)[0],arm:'B0',actors,buyer:new ScriptedBuyer(),maxTurns:1});assert.equal(row.reason,'MAX_TURNS');assert.equal(summarize([row]).normalSuccessRate.value,0);
});
test('rate limiter permits a burst but queues the next request; exhausted retries open the circuit',async()=>{
  const paced=new KilnStream({key:'fixture',burst:2,windowMs:40});const start=Date.now();const times=await Promise.all([1,2,3].map(async()=>{await paced.schedule();return Date.now()-start;}));assert.ok(times[2]>=30);
  let calls=0;const limited=new KilnStream({key:'fixture',maxRetries:0,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429,headers:{'retry-after':'65'}});}});
  await assert.rejects(limited.complete({messages:[],tools:[],flow:'test',runId:'429'}),/PROVIDER_CIRCUIT_OPEN/);
  await assert.rejects(limited.complete({messages:[],tools:[],flow:'test',runId:'429-again'}),/PROVIDER_CIRCUIT_OPEN/);
  assert.equal(calls,1);assert.equal(limited.records[0].retryAfterMs,65000);assert.equal(limited.records[0].totalTokens,null);
});
test('quota exhaustion stops globally without retrying',async()=>{
  const client=new KilnStream({key:'fixture',fetchImpl:async()=>new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429})});
  await assert.rejects(client.complete({messages:[],tools:[],flow:'test',runId:'quota'}),/PROVIDER_QUOTA_EXHAUSTED/);assert.equal(client.calls,1);assert.equal(client.stopReason,'PROVIDER_QUOTA_EXHAUSTED');
});
test('an absent offer does not create a fictitious acceptable offer ID',()=>{
  assert.deepEqual(buyerTools(['alpha'],[]).map(t=>t.function.name),['request_offer','reject_offer']);
});
