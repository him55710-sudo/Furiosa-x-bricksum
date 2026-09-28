import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {onceInference,saveJson,readJson,observeOperation} from '../../src/deal-escrow/public-run.mjs';
test('durable model result is reused while failed or interrupted calls cannot silently consume tokens again',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'ade-inference-')),file=path.join(dir,'calls.json');let calls=0;
  try{
    const call=async()=>{calls++;return {id:'one',rows:[1,2]};};
    assert.deepEqual(await onceInference(file,'success',call),await onceInference(file,'success',call));assert.equal(calls,1);
    await assert.rejects(onceInference(file,'failed',async()=>{calls++;throw new Error('response lost');}),/response lost/);
    await assert.rejects(onceInference(file,'failed',call),/INFERENCE_REQUIRES_REVIEW/);assert.equal(calls,2);
    saveJson(file,{...readJson(file),crashed:{state:'STARTED'}});
    await assert.rejects(onceInference(file,'crashed',call),/INFERENCE_REQUIRES_REVIEW/);assert.equal(calls,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('observation recovers the pending operation without invoking its start function twice',async()=>{
  let starts=0,recoveries=0,op;
  const engine={store:{operation:()=>op,get:()=>({state:'ESCROW_FUNDED'})},recover:async()=>{recoveries++;op={...op,status:'CONFIRMED'};}};
  const result=await observeOperation(engine,'one','fund',async()=>{starts++;op={status:'PENDING',txHash:'original'};throw new Error('lost response');},{timeoutMs:1000,pollMs:1});
  assert.equal(result.txHash,'original');assert.equal(starts,1);assert.equal(recoveries,1);
  await observeOperation(engine,'one','fund',undefined,{timeoutMs:1000,pollMs:1});assert.equal(recoveries,1);
});
