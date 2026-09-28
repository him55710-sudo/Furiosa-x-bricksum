import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {createServer} from 'node:net';
test('production application entrypoint starts without Kiln credentials and serves health, state and study APIs',async()=>{
  const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
  const env={...process.env,ADE_DATA_DIR:mkdtempSync(path.join(tmpdir(),'ade-startup-')),ADE_PORT:String(port)};for(const key of ['ADE_NETWORK','ADE_DEVNET_RPC_URL','KILN_API_KEY','KILN_MODEL'])delete env[key];
  const app=spawn(process.execPath,['src/deal-escrow/server.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';app.stdout.on('data',b=>output+=b);app.stderr.on('data',b=>output+=b);const closed=new Promise(r=>app.once('exit',r));
  try{
    const end=Date.now()+20000;while(!output.includes('Agent Deal Escrow:')){assert.equal(app.exitCode,null,output);assert.ok(Date.now()<end,'Server did not become ready');await new Promise(r=>setTimeout(r,100));}
    const origin=`http://127.0.0.1:${port}`,health=await fetch(origin+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
    const state=await(await fetch(origin+'/api/state')).json();assert.equal(state.network,'local-devnet');assert.equal(state.deals.length,0);
    const study=await(await fetch(origin+'/api/study')).json();assert.equal(study.questions.length,7);assert.equal(study.counts.self_reported_humans,0);
    const noAuth=await fetch(origin+'/api/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(noAuth.status,403);
  }finally{if(app.exitCode===null){app.kill('SIGTERM');await closed;}}
});
