import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveKilnClient} from '../../src/accord/live-kiln.mjs';

const answer=()=>({model:'qwen3-32b',id:'test-request',usage:{total_tokens:24},choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'send_negotiation_message',arguments:'{"price":20}'}}]}}]});
const payload=c=>c.payload('Private policy',{brief:'Public brief'},[{name:'send_negotiation_message',parameters:{type:'object'}}]);
test('Live transport constrains destination and preserves actual response telemetry',async()=>{
 const records=[];
 const c=new LiveKilnClient({model:'qwen3-32b',key:'test-only',onRecord:r=>records.push(r),fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.bricksum.com/v1/chat/completions');assert.equal(options.redirect,'error');
  assert.equal(JSON.parse(options.body).max_tokens,1200);return Response.json(answer());
 }});
 const r=await c.request('seller',payload(c),(tool,args)=>{assert.equal(args.price,20);});
 assert.equal(r.request_id,'test-request');assert.equal(records[0].total_tokens,24);assert.equal(records[0].result,'VALID_TOOL_PROPOSAL');
 assert.doesNotMatch(JSON.stringify(records),/test-only|Private policy/);
});
test('Live transport fails closed on truncation, model substitution, malformed tools and oversized responses',async()=>{
 for(const [code,mutate] of [
  ['KILN_OUTPUT_TRUNCATED',b=>b.choices[0].finish_reason='length'],
  ['KILN_MODEL_MISMATCH',b=>b.model='other-model'],
  ['KILN_REQUEST_ID_MISSING',b=>b.id=''],
  ['KILN_INVALID_TOOL',b=>b.choices[0].message.tool_calls[0].function.name='transfer_funds'],
  ['KILN_INVALID_RESPONSE',b=>b.choices[0].message.tool_calls[0].function.arguments='{'],
 ]){
  const b=answer();mutate(b);const records=[];
  const c=new LiveKilnClient({model:'qwen3-32b',key:'test-only',onRecord:r=>records.push(r),fetchImpl:async()=>Response.json(b)});
  await assert.rejects(c.request('seller',payload(c),()=>assert.fail('Invalid output reached validator')),new RegExp(code));assert.equal(records[0].result,code);
 }
 const c=new LiveKilnClient({model:'qwen3-32b',key:'test-only',fetchImpl:async()=>new Response('x'.repeat(2000001))});
 await assert.rejects(c.request('seller',payload(c),()=>{}),/KILN_RESPONSE_TOO_LARGE/);
});
