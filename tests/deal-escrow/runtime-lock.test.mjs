import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {acquireRuntimeLock} from '../../src/deal-escrow/runtime-lock.mjs';

const moduleUrl=new URL('../../src/deal-escrow/runtime-lock.mjs',import.meta.url).href;
function child(dir){
  const script=`import {acquireRuntimeLock} from ${JSON.stringify(moduleUrl)};try{const lock=acquireRuntimeLock(process.argv[1]);console.log('LOCKED');process.on('SIGTERM',()=>{lock.release();process.exit(0);});setInterval(()=>{},1000);}catch(e){console.log(e.message);process.exit(2);}`;
  const processChild=spawn(process.execPath,['--input-type=module','--eval',script,dir],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const finished=new Promise(resolve=>processChild.once('exit',(code,signal)=>resolve({code,signal})));
  const ready=new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('CHILD_LOCK_TIMEOUT')),10000);processChild.stdout.on('data',data=>{output+=data;if(output.includes('\n')){clearTimeout(timer);resolve(output.trim());}});processChild.once('error',error=>{clearTimeout(timer);reject(error);});});
  return {process:processChild,ready,finished};
}
test('one writer across processes, rejected contender cannot steal or remove ownership, killed writer can recover',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ade-writer-')),children=[];
  t.after(async()=>{for(const item of children){if(item.process.exitCode===null&&!item.process.killed)item.process.kill('SIGKILL');await item.finished;}await rm(dir,{recursive:true,force:true});});
  const first=child(dir);children.push(first);assert.equal(await first.ready,'LOCKED');
  assert.throws(()=>acquireRuntimeLock(dir),/ADE_WRITER_ALREADY_RUNNING/);
  const second=child(dir);children.push(second);assert.equal(await second.ready,'ADE_WRITER_ALREADY_RUNNING');assert.equal((await second.finished).code,2);
  assert.throws(()=>acquireRuntimeLock(dir),/ADE_WRITER_ALREADY_RUNNING/);
  first.process.kill('SIGKILL');await first.finished;
  const recovered=acquireRuntimeLock(dir);assert.throws(()=>acquireRuntimeLock(dir),/ADE_WRITER_ALREADY_RUNNING/);recovered.release();recovered.release();
  const next=acquireRuntimeLock(dir);next.release();
});
