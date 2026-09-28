import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';import {spawn} from 'node:child_process';import {mkdtempSync,existsSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {acquireRuntimeLock} from '../../src/deal-escrow/runtime-lock.mjs';
test('an occupied port cannot claim readiness and startup failure releases its writer ownership',async()=>{
 const occupied=createServer();await new Promise(r=>occupied.listen(0,'127.0.0.1',r));const port=occupied.address().port,base=path.resolve(os.tmpdir()),directory=mkdtempSync(path.join(base,'ade-port-test-'));
 const env={...process.env,ADE_PORT:String(port),ADE_DATA_DIR:directory};delete env.ADE_NETWORK;delete env.ADE_DEVNET_RPC_URL;delete env.KILN_API_KEY;
 const child=spawn(process.execPath,['src/deal-escrow/server.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);
 const timer=setTimeout(()=>child.kill(),20000);
 try{const code=await new Promise(r=>child.once('exit',r));assert.equal(code,1,output);assert.match(output,/ADE_LISTEN_FAILED:EADDRINUSE/);assert.doesNotMatch(output,/Agent Deal Escrow: http/);assert.equal(existsSync(path.join(directory,'service.lock')),false);const lock=acquireRuntimeLock(directory);lock.release();}
 finally{clearTimeout(timer);if(child.exitCode===null)child.kill();await new Promise(r=>occupied.close(r));assert.equal(path.dirname(path.resolve(directory)),base);assert(path.basename(directory).startsWith('ade-port-test-'));rmSync(directory,{recursive:true,force:true});}
});
