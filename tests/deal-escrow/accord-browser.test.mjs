import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {buildHostedSite} from '../../scripts/build-accord-vercel.mjs';
import {IDBFactory,IDBKeyRange} from 'fake-indexeddb';
import {browserStore} from '../../web/spending/browser-store.mjs';
import {createBrowserWorkspace} from '../../web/spending/browser-workspace.mjs';
import {openBrowserChain} from '../../web/spending/browser-chain.mjs';
import {assertPublicJson} from '../../src/deal-escrow/public-files.mjs';

test('deployed browser bundle executes and persists real EVM work without a backend',async t=>{
 const original={self:globalThis.self,indexedDB:globalThis.indexedDB,IDBKeyRange:globalThis.IDBKeyRange};
 globalThis.self=globalThis;globalThis.indexedDB=new IDBFactory();globalThis.IDBKeyRange=IDBKeyRange;
 const context={atob,btoa,fetch:(url,options)=>{assert.ok(String(url).startsWith('data:'),'WASM must be embedded, not fetched externally');return fetch(url,options);},console,indexedDB:globalThis.indexedDB,IDBKeyRange,crypto,TextEncoder,TextDecoder,URL,AbortController,WebAssembly,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,DataView,Buffer:undefined,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,performance};context.self=context;context.window=context;
 vm.runInNewContext(readFileSync('node_modules/ganache/dist/web/ganache.min.js','utf8'),context,{filename:'ganache-browser-bundle.js'});
 const Ganache=context.Ganache;
 let queue=Promise.resolve(),failAfter=null;
 const locks={request:(_name,fn)=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}};
 const storage=browserStore(globalThis.indexedDB);
 const chainFactory=async(state,save)=>{const chain=await openBrowserChain(state,save,{ganacheLoader:async()=>Ganache});const transact=chain.transact;chain.transact=async(job,kind)=>{const result=await transact(job,kind);if(failAfter===kind){failAfter=null;throw Error('Interrupted after confirmation.');}return result;};return chain;};
 let workspace=createBrowserWorkspace({storage,locks,chainFactory});
 t.after(async()=>{await workspace.close();Object.assign(globalThis,original);});
 const request=(url,body)=>workspace.request(url,body);
 let job;
 const act=async(action,body={})=>job=await request(`/api/tasks/${job.id}/${action}`,{revision:job.revision,...body});
 const prepare=async(demoMode=true)=>{job=await request('/api/tasks',{...await request('/api/sample'),demoMode});await act('quotes');if(demoMode){assert.equal(job.status,'BLOCKED');assert.equal(job.dealId,undefined);assert.ok(job.events.some(e=>e.title==='Sample offer blocked'));await act('fund');assert.equal(job.status,'BLOCKED');assert.equal(job.dealId,undefined);}else{assert.equal(job.status,'QUOTED');assert.equal(job.selected,null);}await act('select',{seller:'seller-a'});await act('counter',{price:20});};
 await t.test('usable task creation and input validation work before the EVM loads',async()=>{
  const state=await request('/api/workspace');assert.equal(state.network.mode,'BROWSER_EVM');assert.equal(state.network.contract,null);
  const sample=await request('/api/sample');await assert.rejects(request('/api/tasks',{...sample,perDeal:301}),/limit/);
  await prepare();assert.equal(job.offers[0].price,20);assert.equal((await storage.load()).chain,null);
 });
 await t.test('browser EVM funds exactly once and survives an interrupted response',async()=>{
  failAfter='fund';await assert.rejects(act('fund'),/Interrupted/);job=await request(`/api/tasks/${job.id}`);assert.equal(job.status,'FUNDING');const tx=job.transactions[0].hash;
  await act('fund');assert.equal(job.status,'LOCKED');assert.equal(job.transactions[0].hash,tx);assert.equal(job.transactions.length,1);
  assert.equal((await request('/api/workspace')).network.chainId,31338);
 });
 await t.test('source alterations and invoice mismatch block a payment',async()=>{
  await act('run');assert.equal(job.validation.verified,true);assert.equal(job.budget,40);assert.equal(job.invoice,25);assert.ok(job.invoice<job.perDeal&&job.invoice<job.budget);await assert.rejects(act('settle'),/exactly match/);assert.equal(job.transactions.length,1);assert.ok(job.events.some(e=>e.title==='Sample overcharge blocked'));await act('invoice',{amount:20});const output=JSON.stringify(job.output);
  const bad=JSON.parse(output);bad[0].unit='million';await act('delivery',{raw:JSON.stringify(bad)});await assert.rejects(act('settle'),/every check/);
  await act('delivery',{raw:'[null]'});assert.equal(job.validation.verified,false);
  await act('delivery',{raw:output});await act('invoice',{amount:25});await assert.rejects(act('settle'),/exactly match/);
  await act('invoice',{amount:20});
 });
 await t.test('payment recovers without a duplicate and its receipt verifies',async()=>{
  failAfter='release';await assert.rejects(act('settle'),/Interrupted/);job=await request(`/api/tasks/${job.id}`);assert.equal(job.status,'SETTLING');
  const tx=job.transactions.find(x=>x.kind==='release').hash;await act('settle');assert.equal(job.status,'COMPLETED');assert.equal(job.transactions.find(x=>x.kind==='release').hash,tx);
  const result=await request(`/api/tasks/${job.id}/verify`);assert.equal(result.verdict,'VALID',JSON.stringify(result));
  const exported=await request(`/api/tasks/${job.id}/receipt`);assertPublicJson(exported);assert.doesNotMatch(JSON.stringify(exported),/"(?:seed|raw|privateKey|mnemonic)":/);assert.equal(exported.receipt.transactions.release.status,'CONFIRMED');
  await assert.rejects(act('settle'),/stage/);
 });
 const paidId=job.id;
 await t.test('IndexedDB reload keeps tasks, chain, receipts and private data isolated',async()=>{
  await workspace.close();workspace=createBrowserWorkspace({storage:browserStore(globalThis.indexedDB),locks,chainFactory});
  assert.equal((await request(`/api/tasks/${paidId}`)).status,'COMPLETED');assert.equal((await request(`/api/tasks/${paidId}/verify`)).verdict,'VALID');
  assert.equal((await request('/api/workspace')).tasks.length,1);
 });
 await t.test('an explicit rejection executes a verifiable browser-chain refund',async()=>{
  await prepare(false);await act('fund');await act('run');assert.equal(job.invoice,job.agreedPrice);assert.ok(!job.events.some(e=>e.title==='Sample overcharge blocked'));failAfter='refund';await assert.rejects(act('refund'),/Interrupted/);job=await request(`/api/tasks/${job.id}`);await act('refund');assert.equal(job.status,'REFUNDED');
  const result=await request(`/api/tasks/${job.id}/verify`);assert.equal(result.verdict,'VALID',JSON.stringify(result));
 });
 await t.test('concurrent tabs reject stale decisions and above-limit offers sign nothing',async()=>{
  await prepare();const oldRevision=job.revision;await act('counter',{price:220});await act('fund');assert.equal(job.status,'BLOCKED');assert.equal(job.dealId,undefined);
  await assert.rejects(request(`/api/tasks/${job.id}/fund`,{revision:oldRevision}),/another tab/);
  await act('edit',{...(await request('/api/sample')),title:'Corrected task'});assert.equal(job.status,'DRAFT');
 });
});

test('hosted release builds in isolation without a prebuilt dist or historical test report',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'accord-build-'));t.after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'accord-build-'));rmSync(directory,{recursive:true,force:true});});
 const out=path.join(directory,'release');
 const manifest=await buildHostedSite(process.cwd(),{outDir:out,stagingDir:path.join(directory,'stage'),testSummary:{status:'BUILD_FIXTURE',tests:0,passed:0}});
 assert.equal(manifest.mode,'BROWSER_EVM');assert.ok(manifest.files.some(f=>f.path==='vendor/ganache-7.9.2.min.js'));
 assert.ok(manifest.files.every(f=>/^(index.html|favicon.svg|vercel.json|assets\/|vendor\/|evidence\/)/.test(f.path)));
 const config=JSON.parse(readFileSync(path.join(out,'vercel.json')));assert.equal(config.buildCommand,null);const proof=JSON.parse(readFileSync(path.join(out,'evidence/dealtrace-summary.json')));assert.deepEqual([proof.budget,proof.agreement,proof.rejectedInvoice,proof.calls,proof.tokens],[40,20,25,5,7890]);assert.equal(proof.verification.checks,47);assert.equal(proof.transactions.find(t=>t.label==='overbill-blocked').status,0);assert.ok(config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value.includes("'wasm-unsafe-eval'"));
});
