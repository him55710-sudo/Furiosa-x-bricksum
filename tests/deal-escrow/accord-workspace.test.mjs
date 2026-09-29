import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {createWorkspace} from '../../src/accord/workspace.mjs';
import {workspaceApp} from '../../src/accord/http.mjs';
import {openChain} from '../../src/deal-escrow/chain.mjs';
import {assertPublicJson} from '../../src/deal-escrow/public-files.mjs';
import {parseSource,normalizeRows,csv} from '../../web/spending/workspace-model.mjs';
import {renderWorkspace} from '../../web/spending/workspace-view.mjs';

test('CSV imports preserve quoted content, normalize values and escape spreadsheet formulas',()=>{
 const rows=parseSource('company,quarter,capex,currency,source_url\r\n"  Acme, Inc  ",2025-q1,"1,200",usd,https://example.com/report');
 assert.deepEqual(normalizeRows(rows)[0],{company:'Acme, Inc',quarter:'2025-Q1',capex:1200,currency:'USD',source_url:'https://example.com/report'});
 for(const value of ['',null,[],{}])assert.throws(()=>parseSource(JSON.stringify([{...rows[0],capex:value}])));
 assert.throws(()=>parseSource('company,quarter,capex,currency,source_url\nAcme,2025-Q1,1,USD'));
 assert.throws(()=>parseSource('company,quarter,capex,currency,source_url\n"Acme,2025-Q1,1,USD,https://example.com'));
 assert.ok(csv([{...rows[0],company:'=HYPERLINK("x")'}]).includes('"\'=HYPERLINK(""x"")"'));
});

test('English workspace carries user decisions through real local escrow, recovery and persisted work',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'accord-workspace-'));
 let workspace,failKind=null,chainOptions;
 async function chainFactory(options){chainOptions=options;const chain=await openChain(options),broadcast=chain.broadcast;chain.broadcast=async op=>{const result=await broadcast(op);const kind=chain.contract.interface.parseTransaction({data:(await chain.provider.getTransaction(result.transactionHash)).data}).name;if(failKind===kind){failKind=null;throw Error('Simulated lost response after mining.');}return result;};return chain;}
 t.after(async()=>{await workspace?.close();assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'accord-workspace-'));rmSync(directory,{recursive:true,force:true});});
 workspace=await createWorkspace({directory,chainFactory});
 assert.equal(chainOptions.publicNetwork,false);assert.equal(chainOptions.devnetRpc,null);assert.equal(workspace.network().chainId,31338);
 const sample=workspace.sample();let job;
 const act=async(action,data={})=>job=await workspace.act(job.id,action,{revision:job.revision,...data});
 const prepare=async(spec=sample)=>{job=await workspace.create(spec);await act('quotes');await act('select',{seller:'seller-a'});};
 await t.test('invalid typed input is rejected before creating a task',async()=>{
  const rows=JSON.parse(sample.sourceText);rows[0].capex='';await assert.rejects(workspace.create({...sample,sourceText:JSON.stringify(rows)}));
  rows[0].capex=-1;await assert.rejects(workspace.create({...sample,sourceText:JSON.stringify(rows)}));
  assert.equal(workspace.list().length,0);
 });
 await t.test('spending limit blocks funds; human counteroffer changes the agreement',async()=>{
  await prepare({...sample,perDeal:20});await act('fund');assert.equal(job.status,'BLOCKED');assert.equal(job.dealId,undefined);
  await act('edit',{...sample});await act('quotes');await act('select',{seller:'seller-a'});
  await act('counter',{price:1});assert.match(job.events.at(-1).title,/declined/);
  await act('counter',{price:20});assert.equal(job.offers[0].price,20);
  await assert.rejects(workspace.act(job.id,'fund',{revision:0}),/another tab/);
 });
 await t.test('lost funding response retries one durable deal and one mined transaction',async()=>{
  failKind='fund';await assert.rejects(act('fund'),/lost response/);job=workspace.get(job.id);
  assert.equal(job.status,'FUNDING');const id=job.dealId,tx=job.transactions[0].hash;
  await act('fund');assert.equal(job.status,'LOCKED');assert.equal(job.dealId,id);assert.equal(job.transactions[0].hash,tx);assert.equal(job.transactions.length,1);assert.equal(job.transactions[0].status,'CONFIRMED');
 });
 await t.test('actual worker output matches the input; invalid delivery and overcharge cannot pay',async()=>{
  await act('stop');assert.equal(job.authorityRevoked,true);assert.equal(job.status,'LOCKED');
  await act('run');assert.equal(job.status,'REVIEW');assert.equal(job.invoice,25);assert.ok(job.events.some(e=>e.title==='Sample overcharge blocked'));assert.equal(job.validation.verified,true);assert.deepEqual(job.output,normalizeRows(job.source));
  await act('invoice',{amount:25});await assert.rejects(act('settle'),/exactly match/);assert.equal(job.transactions.length,1);
  await act('invoice',{amount:20});const good=JSON.stringify(job.output);const bad=structuredClone(job.output);bad[0].capex+=1;
  await act('delivery',{raw:JSON.stringify(bad)});assert.equal(job.validation.verified,false);await assert.rejects(act('settle'),/every check/);
  const wrongUnit=JSON.parse(good);wrongUnit[0].unit='million';await act('delivery',{raw:JSON.stringify(wrongUnit)});assert.equal(job.validation.verified,false);assert.match(csv(JSON.parse(good)),/unit,source_page/);
  await act('delivery',{raw:'[null]'});assert.equal(job.validation.verified,false);await assert.rejects(act('settle'),/every check/);
  await act('delivery',{raw:good});assert.equal(job.validation.verified,true);
 });
 await t.test('payment response recovery pays once and produces a verifiable receipt',async()=>{
  failKind='release';await assert.rejects(act('settle'),/lost response/);job=workspace.get(job.id);assert.equal(job.status,'SETTLING');const tx=job.transactions.find(x=>x.kind==='release').hash;
  await act('settle');assert.equal(job.status,'COMPLETED');assert.equal(job.transactions.find(x=>x.kind==='release').hash,tx);
  await assert.rejects(act('settle'),/stage/);assert.equal(job.transactions.filter(x=>x.kind==='release').length,1);
  const verification=await workspace.verify(job.id);assert.equal(verification.verdict,'VALID',JSON.stringify(verification));
  assertPublicJson(workspace.export(job.id));assert.equal(workspace.export(job.id).receipt.transactions.release.claim.value_wei,'0');
 });
 const completedId=job.id;
 await t.test('English views expose real actions and escape imported data',()=>{
  const state={job:null,tasks:workspace.list(),network:workspace.network(),route:'workspace',present:false,draft:sample,sourceText:sample.sourceText,sourceName:sample.sourceName};
  for(const route of ['workspace','agents','evidence']){const html=renderWorkspace({...state,route});assert.doesNotMatch(html,/[\uac00-\ud7af]/);assert.ok(html.includes('data-action="tasks"'));}
  const html=renderWorkspace({...state,job:{...job,title:'<img src=x onerror=alert(1)>'},present:true});assert.ok(html.includes('&lt;img'));assert.ok(html.includes('Verify on local chain'));assert.ok(html.includes('DEMO ASSIST'));
  const client=readFileSync('web/spending/app.mjs','utf8');assert.doesNotMatch(client,/setInterval|autoplay|requestAnimationFrame/);assert.match(client,/hash===\x27demo\x27/);
 });
 await t.test('refund rejection has a bound attestation and retries its original transaction',async()=>{
  await prepare();await act('counter',{price:20});await act('fund');failKind='refund';await assert.rejects(act('refund'),/lost response/);job=workspace.get(job.id);assert.equal(job.status,'REFUNDING');const tx=job.transactions.find(x=>x.kind==='refund').hash;
  await act('refund');assert.equal(job.status,'REFUNDED');assert.equal(job.transactions.find(x=>x.kind==='refund').hash,tx);
  const verification=await workspace.verify(job.id);assert.equal(verification.verdict,'VALID',JSON.stringify(verification));
 });
 await t.test('tasks and local chain receipts survive a service restart',async()=>{
  await workspace.close();workspace=null;workspace=await createWorkspace({directory});
  assert.equal(workspace.get(completedId).status,'COMPLETED');assert.equal(workspace.get(job.id).status,'REFUNDED');assert.equal((await workspace.verify(completedId)).verdict,'VALID');
 });
 await t.test('stopped unfunded authority cannot be revived by editing or funding',async()=>{
  await prepare();await act('stop');assert.equal(job.authorityRevoked,true);
  await assert.rejects(act('fund'),/authority revoked/);await assert.rejects(act('edit',sample),/authority revoked/);assert.equal(job.dealId,undefined);
 });
 await t.test('HTTP API enforces local origin and session, serves only listed files',async()=>{
  let handler;const server=createServer((req,res)=>handler(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,base=`http://127.0.0.1:${port}`;handler=workspaceApp({workspace,port,root:path.resolve('web/spending'),files:['index.html','app.mjs','workspace.css','workspace-model.mjs','workspace-view.mjs']});
  try{
   const bootstrap=await(await fetch(base+'/api/workspace')).json();assert.ok(bootstrap.token);assert.equal(bootstrap.network.mode,'LOCAL_EXECUTION');
   assert.equal((await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample)})).status,403);
   assert.equal((await fetch(base+'/api/workspace',{headers:{Origin:'https://foreign.example'}})).status,403);
   const created=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-ADE-Token':bootstrap.token},body:JSON.stringify(sample)});assert.equal(created.status,201);
   const html=await(await fetch(base+'/')).text();assert.match(html,/lang="en"/);assert.match(html,/workspace.css/);
   assert.equal((await fetch(base+'/private.json')).status,404);
   const receiptResponse=await fetch(base+`/api/tasks/${completedId}/receipt`);assert.equal(receiptResponse.status,200);assertPublicJson(await receiptResponse.json());
  }finally{await new Promise(resolve=>server.close(resolve));}
 });
});
