// One source-backed Sepolia run, with durable purchase/transaction identities.
// Approvals and adversarial mutations are scripted test stimuli, not human interviews.
import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {Wallet,Contract,JsonRpcProvider,keccak256,parseEther,Transaction} from 'ethers';
import {acquireRuntimeLock} from '../src/deal-escrow/runtime-lock.mjs';
import {openChain} from '../src/deal-escrow/chain.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';import {DealEngine} from '../src/deal-escrow/engine.ts';
import {now} from '../src/deal-escrow/domain.ts';
import {sourceRequirements,sourceDescriptor,citedSourceRows,sourceDocument} from '../src/deal-escrow/source-document.ts';
import {procureResearch,deliverResearch,documentOffers,dealFromOffer,researchRequest} from '../src/deal-escrow/research.ts';
import {receipt,verifyReceipt} from '../src/deal-escrow/audit.ts';

const directory=path.resolve('data/private/deal-escrow/research-sepolia-v1'),out=path.resolve('artifacts/deal-escrow/research/sepolia-source-v1'),sourceDir='data/private/deal-escrow/sepolia',documentId='lges-2026q2-pdf';
for(const d of [directory,out])mkdirSync(d,{recursive:true});
const read=f=>JSON.parse(readFileSync(f,'utf8')),save=(f,v)=>{writeFileSync(f+'.tmp',JSON.stringify(v,null,2));renameSync(f+'.tmp',f);},journalFile=path.join(directory,'run.json');
const journal=existsSync(journalFile)?read(journalFile):{run:randomUUID(),status:'RUNNING',created_at:new Date().toISOString(),scenarios:{}};
const persist=()=>save(journalFile,journal),log=(stage,detail={})=>console.log(JSON.stringify({at:new Date().toISOString(),stage,...detail}));
persist();
if(journal.status==='PASS'){log('ALREADY_COMPLETE',{report:path.join(out,'report.json'),new_model_calls:0,new_transactions:0});process.exit(0);}
// The funded controller belongs to this task's earlier public demo. Hold its
// existing runtime lock while the separate research directory uses that key.
const ownerLock=acquireRuntimeLock(sourceDir),keyFile=path.join(directory,'identities.json');
let chain,store,app,independent;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 if(!existsSync(keyFile)){
  const prior=read(path.join(sourceDir,'identities.json'));
  const identities=Object.fromEntries(['buyer','seller-a','seller-b'].map(id=>[id,Wallet.createRandom().privateKey]));identities.controller=prior.controller;
  writeFileSync(keyFile,JSON.stringify(identities),{flag:'wx',mode:0o600});
 }
 const identities=read(keyFile);writeFileSync(path.join(directory,'buyer-key.json'),JSON.stringify({private_key:identities.buyer}),{mode:0o600});
 process.env.SEPOLIA_RPC_URL='https://ethereum-sepolia-rpc.publicnode.com';
 sourceDocument(documentId);
 chain=await openChain({directory,publicNetwork:true});store=new DealStore(path.join(directory,'state.sqlite'));const engine=new DealEngine(store,chain);
 assert.notEqual(chain.deployment.buyer,chain.deployment.controller);save(path.join(out,'deployment.json'),chain.deployment);save(path.join(out,'source-document.json'),sourceDescriptor(documentId));
 log('DEPLOYMENT_READY',{contract:chain.deployment.contract,buyer:chain.deployment.buyer,controller:chain.deployment.controller});
 if(process.argv.includes('--retry-failed-model')&&journal.scenarios.normal){
  const previous=researchRequest(engine,journal.scenarios.normal.mandate_id);
  if(previous?.status==='FAILED'){
   assert(!store.list().some(r=>r.mandateId===previous.mandate_id&&store.operation(r.deal.deal_id,'fund')),'FUNDED_TASK_CANNOT_BE_REPLACED');
   journal.failed_model_attempts??=[];assert(journal.failed_model_attempts.length<2,'REVIEW_RETRY_CAP');
   journal.failed_model_attempts.push({request:previous,calls:store.usage('market.'+previous.mandate_id)});delete journal.scenarios.normal;persist();log('EXPLICIT_NEW_UNFUNDED_REVIEW_ATTEMPT');
  }
 }
 if(process.argv.includes('--isolate-unfunded-fault')&&journal.scenarios['wrong-row']){
  const previous=journal.scenarios['wrong-row'];assert(!store.operation(previous.deal_id,'fund'),'FUNDED_SCENARIO_CANNOT_BE_REPLACED');
  journal.abandoned_unfunded_scenarios??=[];journal.abandoned_unfunded_scenarios.push({...previous,state:store.get(previous.deal_id).state,reason:'Earlier expiry attempt had already activated a preview control. Preserve this stop; start the causality demonstration under a separately approved test company scope.'});delete journal.scenarios['wrong-row'];persist();
 }
 // Separate buyer pays its own eventual refund gas. Persist the exact signed transfer.
 const gasFile=path.join(directory,'buyer-gas.intent.json');let gas=existsSync(gasFile)?read(gasFile):null;
 if(!gas){const tx=await chain.wallet.populateTransaction({to:chain.deployment.buyer,value:parseEther('0.00035')}),raw=await chain.wallet.signTransaction(tx);gas={raw,hash:keccak256(raw)};writeFileSync(gasFile,JSON.stringify(gas),{flag:'wx',mode:0o600});}
 const gasTx=Transaction.from(gas.raw);assert.equal(gasTx.to,chain.deployment.buyer);assert.equal(gasTx.chainId,11155111n);assert.equal(gasTx.value,parseEther('0.00035'));
 if(!await chain.provider.getTransaction(gas.hash))await chain.provider.broadcastTransaction(gas.raw);
 const gasReceipt=await chain.provider.waitForTransaction(gas.hash,2,45000);assert.equal(gasReceipt?.status,1);journal.buyer_gas_tx=gas.hash;persist();
 const requirements=sourceRequirements(documentId),rows=citedSourceRows(documentId),offers=documentOffers(documentId).map(o=>o.offer_id==='primary-reports'?{...o,deadline:180}:o),offer=offers[0];
 function task(name){
  if(journal.scenarios[name])return journal.scenarios[name];
  const t=now(),m=engine.mandate({mandate_id:randomUUID(),company_id:'source-public-'+journal.run+(name==='normal'?'-normal':'-fault-recovery'),buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+7200,task_requirements:{...requirements,max_delivery_seconds:180}});
  journal.scenarios[name]={mandate_id:m.mandate_id};persist();return journal.scenarios[name];
 }
 async function installed(name,{model=false,deadline=offer.deadline}={}){
  const s=task(name),m=store.mandate(s.mandate_id);
  if(model&&!s.deal_id){const purchase=await procureResearch(engine,m.mandate_id,{offers});assert.equal(purchase.status,'READY',JSON.stringify({status:purchase.status,reason:purchase.reason}));s.deal_id=purchase.deal_id;persist();}
  if(!model&&!s.deal_id){const intent=store.getOrCreateIntent(m.mandate_id,offer.seller_id);s.deal_id=intent.deal_id;persist();}
  if(!store.list().some(r=>r.deal.deal_id===s.deal_id)){
   const intent=store.intentForDeal(s.deal_id),deal=dealFromOffer(m,{...offer,deadline},s.deal_id,180);engine.propose(deal,m.mandate_id);store.details(s.deal_id,{purchase_intent_id:intent.id,scenario_source:'Scripted control/fault demonstration; no additional model call'});engine.agentAction('accept_deal',{deal_id:s.deal_id});store.updateIntent(intent.id,{status:'COMPLETED'});
  }
  return s.deal_id;
 }
 async function recoverUntil(id,states){
  for(let i=0;i<20;i++){if(states.includes(store.get(id).state))return;await pause(3000);await engine.recover();}
  throw new Error('TRANSACTION_STILL_PENDING:'+id+':'+store.get(id).state);
 }
 async function attempt(id,kind,action){try{await action();}catch(e){if(store.operation(id,kind)?.status!=='PENDING')throw e;log('WAITING_FOR_CANONICAL_CONFIRMATION',{deal_id:id,kind,tx_hash:store.operation(id,kind).txHash});}}
 async function fund(id){assert.notEqual(store.get(id).state,'PREVIEW_REQUIRED','An existing control needs its explicit sample before funding');if(['DEAL_ACCEPTED','POLICY_APPROVED','PREVIEW_VERIFIED'].includes(store.get(id).state))await attempt(id,'fund',()=>engine.fund(id));await recoverUntil(id,['ESCROW_FUNDED','SETTLED','REFUNDED']);}
 async function exportDeal(name,id){const r=receipt(engine,id),verification=await verifyReceipt(r,chain);assert.equal(verification.verdict,'VALID');save(path.join(out,name+'-receipt.json'),r);save(path.join(out,name+'-verification.json'),verification);log(name.toUpperCase(),{deal_id:id,state:r.state});return r;}
 await engine.recover();
 if(process.argv.includes('--retry-expired-normal')&&journal.scenarios.normal?.deal_id){
  const previous=journal.scenarios.normal,id=previous.deal_id;
  for(let i=0;i<20&&!['REFUNDED','SETTLED'].includes(store.get(id).state);i++){await engine.recover();const current=store.get(id);if(current.state==='ESCROW_FUNDED'&&now()>=current.details.escrow.deadline)await attempt(id,'refund',()=>engine.expire(id));if(['REFUNDED','SETTLED'].includes(store.get(id).state))break;await pause(3000);}
  if(store.get(id).state==='REFUNDED'){
   const prior=receipt(engine,id),failedChecks=prior.evidence.validation?.checks.filter(c=>!c.pass)??[];assert(prior.evidence.settlement_reason==='DELIVERY_DEADLINE_EXPIRED'||failedChecks.length===1&&failedChecks[0].name==='DELIVERY_DEADLINE');
   const verification=await verifyReceipt(prior,chain);assert.equal(verification.verdict,'VALID');save(path.join(out,'expired-normal-attempt-'+id+'.json'),prior);
   journal.expired_attempts??=[];assert(journal.expired_attempts.length<2,'EXPIRED_RETRY_CAP');journal.expired_attempts.push({deal_id:id,reason:'Demo orchestration stopped at one confirmation; original transaction recovered and deadline refund verified',verification,calls:prior.kiln});delete journal.scenarios.normal;persist();log('EXPLICIT_NEW_TASK_AFTER_CONFIRMED_EXPIRY_REFUND');
  }
 }
 const good=await installed('normal',{model:true});await fund(good);if(store.get(good).state==='ESCROW_FUNDED')await attempt(good,'release',()=>deliverResearch(engine,good));await recoverUntil(good,['SETTLED','REFUNDED']);assert.equal(store.get(good).state,'SETTLED');await exportDeal('normal',good);
 const bad=await installed('wrong-row');await fund(bad);
 if(store.get(bad).state==='ESCROW_FUNDED'){
  const badRows=structuredClone(rows),cell=sourceDocument(documentId).rows.find(r=>r.label.includes('Investing')).cells.find(c=>c.period==='2025-Q1');Object.assign(badRows[0],{capex:-cell.value,source_value:cell.value,source_cell_id:cell.id});
  journal.fault={kind:'Controlled wrong-row citation and amount injection',original:rows[0].capex,mutated:badRows[0].capex};persist();await attempt(bad,'refund',()=>engine.deliver(bad,JSON.stringify(badRows)));
 }
 await recoverUntil(bad,['REFUNDED','SETTLED']);assert.equal(store.get(bad).state,'REFUNDED');await exportDeal('wrong-row',bad);
 const repaired=await installed('partial-sample');
 if(store.get(repaired).state==='PREVIEW_REQUIRED'){
  const badSample=structuredClone(rows.slice(0,1));badSample[0].capex++;
  engine.preview(repaired,JSON.stringify(badSample));await engine.fund(repaired);assert.equal(store.operation(repaired,'fund'),null);journal.bad_sample_funding_blocked=true;persist();
  engine.preview(repaired,JSON.stringify(rows.slice(0,1)));assert.equal(store.get(repaired).state,'PREVIEW_VERIFIED');
 }
 await fund(repaired);if(store.get(repaired).state==='ESCROW_FUNDED')await attempt(repaired,'release',()=>deliverResearch(engine,repaired));await recoverUntil(repaired,['SETTLED','REFUNDED']);assert.equal(store.get(repaired).state,'SETTLED');const repairedReceipt=await exportDeal('partial-sample',repaired);assert.equal(repairedReceipt.control?.origin_deal_id,bad,'SAMPLE_CONTROL_MUST_FOLLOW_THIS_WRONG_ROW');
 const expiry=await installed('app-off',{deadline:90});
 if(store.get(expiry).state==='PREVIEW_REQUIRED')engine.preview(expiry,JSON.stringify(rows.slice(0,1)));
 const deployment=chain.deployment;store.close();store=null;await chain.close();chain=null;
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const origin=`http://127.0.0.1:${port}`,env={...process.env,ADE_DATA_DIR:directory,ADE_NETWORK:'sepolia',ADE_PORT:String(port)};delete env.ADE_DEVNET_RPC_URL;delete env.KILN_API_KEY;
 if(!journal.app_stop){
  app=spawn(process.execPath,['src/deal-escrow/server.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});app.output='';app.stdout.on('data',b=>app.output+=b);app.stderr.on('data',b=>app.output+=b);app.closed=new Promise(r=>app.once('exit',(code,signal)=>r({code,signal})));
  for(let i=0;i<100&&!app.output.includes('Agent Deal Escrow:');i++){if(app.exitCode!==null)throw new Error('PUBLIC_APP_START_FAILED');await pause(200);}
  if(!app.output.includes('Agent Deal Escrow:'))throw new Error('PUBLIC_APP_START_TIMEOUT');
  const browserFile=path.join(out,'browser-verification.json');log('PUBLIC_APP_READY_FOR_BROWSER',{origin,pid:app.pid,verification_file:browserFile});
  let browser;for(let i=0;i<90;i++){if(existsSync(browserFile)){const result=read(browserFile);if(result.application_pid===app.pid&&result.origin===origin&&result.status==='PASS'){browser=result;break;}}if(app.exitCode!==null)throw new Error('PUBLIC_APP_EXITED');await pause(2000);}assert(browser,'PUBLIC_APP_BROWSER_VERIFICATION_REQUIRED');log('PUBLIC_APP_BROWSER_VERIFIED');
  const state=await(await fetch(origin+'/api/state')).json(),response=await fetch(origin+`/api/deals/${expiry}/fund`,{method:'POST',headers:{'Content-Type':'application/json','X-ADE-Token':state.token,Origin:origin},body:'{}'}),fundResponse=await response.json();assert(response.status===200||fundResponse.error==='CHAIN_FINALITY_PENDING',JSON.stringify(fundResponse));
  let funded;for(let i=0;i<30;i++){const current=await(await fetch(origin+'/api/state')).json();funded=current.deals.find(r=>r.deal.deal_id===expiry);if(funded.state==='ESCROW_FUNDED')break;await pause(2000);}assert.equal(funded.state,'ESCROW_FUNDED');
  const audit=await(await fetch(origin+'/api/audit/'+expiry)).json();save(path.join(out,'app-off-funded-receipt.json'),audit);
  const packet={chain_id:11155111,rpc_url:'https://sepolia.gateway.tenderly.co',contract:deployment.contract,controller:deployment.controller,buyer:deployment.buyer,runtime_hash:deployment.runtimeHash,deal_hash:audit.deal_hash,amount_wei:audit.evidence.escrow.amount,fund_tx:audit.transactions.fund.tx_hash,deadline:audit.evidence.escrow.deadline};save(path.join(out,'public-packet.json'),packet);
  app.kill('SIGTERM');const stopped=await app.closed;let unavailable=false;try{await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});}catch{unavailable=true;}assert(unavailable);
  journal.app_stop={application_pid:app.pid,exit:stopped,http_unavailable:true,at:new Date().toISOString()};persist();log('APP_STOPPED',{buyer:packet.buyer,deadline:packet.deadline});
 }
 const packet=read(path.join(out,'public-packet.json'));independent=new JsonRpcProvider(packet.rpc_url,undefined,{cacheTimeout:-1});
 for(let i=0;(await independent.getBlock('latest')).timestamp<packet.deadline;i++){if(i>60)throw new Error('DEADLINE_WAIT_PENDING');if(i%6===0)log('WAITING_FOR_PUBLIC_DEADLINE');await pause(5000);}
 execFileSync(process.execPath,['scripts/deal-escrow-buyer-refund.mjs',path.join(out,'public-packet.json'),path.join(directory,'buyer-key.json'),path.join(out,'buyer-refund.json')],{windowsHide:true,timeout:120000,stdio:'pipe'});
 execFileSync(process.execPath,['scripts/deal-escrow-independent-verify.mjs',path.join(out,'public-packet.json'),path.join(out,'buyer-refund.json'),path.join(out,'independent-refund-verification.json')],{windowsHide:true,timeout:30000,stdio:'pipe'});
 const results=['normal','wrong-row','partial-sample'].map(name=>({scenario:name,receipt_file:name+'-receipt.json',state:read(path.join(out,name+'-receipt.json')).state,verification:read(path.join(out,name+'-verification.json')).verdict}));
 const normal=read(path.join(out,'normal-receipt.json')),report={status:'PASS',created_at:new Date().toISOString(),run:journal.run,network:deployment,source_document:sourceDescriptor(documentId),results,model_calls:normal.kiln,extraction:'Deterministic PDF cells; no extraction model call',fault:journal.fault,bad_sample_funding_blocked:journal.bad_sample_funding_blocked,preview_rows:1,final_delivery_rows:4,app_stop:journal.app_stop,independent_refund:read(path.join(out,'independent-refund-verification.json')),scope:'Actual Sepolia test assets, one real AI content-review call, simulated supplier and scripted human approvals. Controller trust and real participant validation remain. Two confirmations; finalized verification is separate.'};
 const developmentAttempts={failed_model_attempts:journal.failed_model_attempts??[],expired_attempts:journal.expired_attempts??[],abandoned_unfunded_scenarios:journal.abandoned_unfunded_scenarios??[],last_resumed_error:journal.last_error??null,scope:'Prior failed or interrupted development attempts retained; these are not first-attempt success statistics.'};
 const allCalls=[...normal.kiln,...developmentAttempts.failed_model_attempts.flatMap(a=>a.calls??[]),...developmentAttempts.expired_attempts.flatMap(a=>a.calls??[])];
 report.development_attempts_file='development-attempts.json';report.total_model_calls_across_attempts=allCalls.length;report.total_model_tokens_across_attempts=allCalls.reduce((n,c)=>n+(c.total_tokens??0),0);report.control_origin_deal_id=repairedReceipt.control.origin_deal_id;
 save(path.join(out,'development-attempts.json'),developmentAttempts);save(path.join(out,'report.json'),report);save('artifacts/deal-escrow/research/latest-public-source.json',{out,report:path.join(out,'report.json')});journal.status='PASS';persist();log('PASS',{out,contract:deployment.contract});
}catch(e){journal.last_error=e.message;journal.updated_at=new Date().toISOString();persist();log('STOPPED_RESUMABLE',{reason:e.message});process.exitCode=1;}
finally{if(app&&app.exitCode===null){app.kill('SIGTERM');await app.closed;}store?.close();if(chain)await chain.close();independent?.destroy();ownerLock.release();}
