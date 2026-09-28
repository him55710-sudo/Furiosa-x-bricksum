import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fork,spawn} from 'node:child_process';
import {Wallet,Contract,JsonRpcProvider,FetchRequest} from 'ethers';
import {openSepoliaPurchaseChain} from '../src/purchase-public-chain.mjs';
import {CONSENT_TYPES,hash} from '../shared/purchase.mjs';

const directory=path.resolve('data/private/purchase-sepolia'),journal=path.join(directory,'verification.json');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const {chain,close}=await openSepoliaPurchaseChain(directory);
assert.equal(chain.deployment.chainId,11155111);
const identities=await json(path.join(directory,'identities.json')),owner=new Wallet(identities.owner,chain.provider);
const verifyUrl=process.env.PURCHASE_VERIFY_RPC_URL;
if(!verifyUrl||new URL(verifyUrl).hostname===new URL(chain.deployment.rpcUrl).hostname)throw new Error('DISTINCT_VERIFIER_RPC_REQUIRED');
const verifyRequest=new FetchRequest(verifyUrl);verifyRequest.timeout=12000;
const independent=new JsonRpcProvider(verifyRequest,undefined,{cacheTimeout:-1});
assert.equal((await independent.getNetwork()).chainId,11155111n);
let report;try{report=await json(journal);}catch(e){if(e.code!=='ENOENT')throw e;report={schemaVersion:1,status:'RUNNING',startedAt:new Date().toISOString(),output:path.resolve('artifacts/purchase-sepolia/runs',new Date().toISOString().replace(/[:.]/g,'-')),cases:{},checks:[],observations:[],network:'Ethereum Sepolia',chainId:11155111,vault:chain.deployment.vault,owner:owner.address};}
assert.equal(report.vault,chain.deployment.vault);assert.equal(report.owner,owner.address);
await mkdir(report.output,{recursive:true});
const save=async()=>{await writeFile(journal+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(journal+'.tmp',journal);await writeFile(path.join(report.output,'report.json'),JSON.stringify(report,null,2)+'\n');};
const evidence=async(name,data)=>writeFile(path.join(report.output,name),JSON.stringify(data,null,2)+'\n');
const record=async(name,data={})=>{report.checks=report.checks.filter(x=>x.name!==name);report.checks.push({name,ok:true,...data});await save();console.log('PASS '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=Number(process.env.PURCHASE_PUBLIC_PORT??3600),origin=`http://127.0.0.1:${port}`;
let server,cookie;
async function api(route,body){const response=await fetch(origin+'/api/purchase'+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});const data=await response.json();if(!response.ok)throw new Error(data.error??'HTTP_FAILED');return {data,response};}
async function boot(){
  server=fork(new URL('../src/purchase-server.mjs',import.meta.url),[],{windowsHide:true,env:{...process.env,PURCHASE_NETWORK:'sepolia',PURCHASE_PORT:String(port),PURCHASE_SELLER_PORT:String(port+1),PURCHASE_DATA_DIR:directory},stdio:['ignore','pipe','pipe','ipc']});
  server.stdout.on('data',b=>{if(String(b).includes('Purchase recovery console ready'))console.log('PUBLIC_SERVER_READY '+server.pid);});server.stderr.on('data',()=>{});
  const until=Date.now()+30000;let ready=false;while(Date.now()<until){if(server.exitCode!==null)throw new Error('PUBLIC_SERVER_EXITED');try{ready=(await api('/health')).data.status==='READY';}catch{}if(ready)break;await sleep(300);}assert.ok(ready,'Public server observation timed out; inspect the existing process before retrying.');
  const challenge=(await api('/auth/challenge',{address:owner.address})).data;
  cookie=(await api('/auth/login',{nonce:challenge.nonce,signature:await owner.signMessage(challenge.message)})).response.headers.get('set-cookie').split(';')[0];
  report.runtime=(await json(path.join(directory,'worker-config.json'))).runtime;await save();
}
async function halt(){if(!server||server.exitCode!==null)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('SERVER_SHUTDOWN_OBSERVATION_TIMEOUT')),20000);server.once('exit',()=>{clearTimeout(timer);resolve();});server.send({type:'shutdown'});});cookie=null;}
async function dashboard(){return (await api('/dashboard')).data;}
async function purchase(id){return (await dashboard()).purchases.find(p=>p.id===id);}
async function idle(){const until=Date.now()+150000;while(Date.now()<until){const d=await dashboard();if(!d.worker.active)return;await sleep(800);}throw new Error('WORKER_OBSERVATION_TIMEOUT');}
async function ensure(name){
  if(!report.cases[name]){const d=(await api('/draft',{durationMinutes:120})).data;report.cases[name]={id:d.purchase.id};await save();}
  const id=report.cases[name].id,p=await purchase(id);
  if(!p.approval)await api(`/${id}/approve`,{signature:await owner.signTypedData(chain.domain,CONSENT_TYPES,p.consent)});
  return id;
}
async function run(id,scenario){await api(`/${id}/run`,{scenario});await idle();return purchase(id);}
async function exportBundle(id,name){const b=(await api(`/${id}/evidence`)).data;await evidence(name,b);return b;}
async function attack(name,quote){
  if(report.cases[name].attack)return;
  const sent=await chain.vault.pay(quote.quote,quote.signature,hash('Explicit testnet bypass attempt'),{gasLimit:500000});report.cases[name].attack={hash:sent.hash};await save();
  let receipt;try{receipt=await sent.wait(1,120000);}catch(e){receipt=e.receipt;if(!receipt)throw e;}
  assert.equal(receipt.status,0);Object.assign(report.cases[name].attack,{status:0,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash});await save();
}
async function finality(target){
  while(true){const block=await independent.getBlock('finalized');if(block&&block.number>=target){report.finalizedBlock={number:block.number,hash:block.hash,verifiedAt:new Date().toISOString(),rpcHost:new URL(verifyUrl).hostname};await save();return;}
    console.log(`WAIT_FINALITY observed=${block?.number??'unavailable'} target=${target}`);await sleep(30000);
  }
}
async function cli(bundle,name){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/verify-purchase.mjs',path.join(report.output,bundle),'artifacts/purchase-sepolia/deployment.json',verifyUrl,path.join(report.output,name)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',b=>text+=b);child.stderr.on('data',()=>{});child.once('error',reject);child.once('exit',code=>{let result;try{result=JSON.parse(text);}catch{return reject(new Error('VERIFIER_PROCESS_FAILED'));}if(code!==0)return reject(new Error('VERIFIER_'+result.status+'_'+result.reason));resolve(result);});});}
try{
  await boot();
  const normal=await ensure('normal');let p=await purchase(normal);
  if(!p.tx)p=await run(normal,'drop-response');
  assert.ok(p.tx);report.paymentTx=p.tx.hash;await save();
  // Wait only for inclusion before running the other boundary probes. Finality is checked below.
  let included=await chain.provider.getTransactionReceipt(p.tx.hash);while(!included){await sleep(5000);included=await chain.provider.getTransactionReceipt(p.tx.hash);}assert.equal(included.status,1);report.paymentBlock=included.blockNumber;
  for(const [name,reason] of [['over-budget','BUDGET_EXCEEDED'],['unlisted','MERCHANT_NOT_ALLOWED'],['expired','DEADLINE_EXPIRED']]){
    const id=await ensure(name);const stopped=await run(id,name);assert.equal(stopped.reason,reason);assert.equal(stopped.modelCalls,0);assert.equal((await chain.state(owner.address,id)).spent,'0');
    await exportBundle(id,name+'.json');await attack(name,stopped.quote);await record('STOP_'+name.toUpperCase(),{id,reason,modelCalls:0,paymentCount:0,attack:report.cases[name].attack});
  }
  if(!report.cases.normal.attack){const q=await(await fetch(`http://127.0.0.1:${port+1}/quote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:p.consent,signature:p.signature,scenario:'normal'})})).json();await attack('normal',q);}
  await record('NEW_OFFER_SECOND_PAYMENT_REJECTED',report.cases.normal.attack);
  const revoked=await ensure('revoked');
  if(await chain.provider.getBalance(owner.address)<10n**14n){const sent=await chain.signer.sendTransaction({to:owner.address,value:10n**15n});await sent.wait();}
  await halt();let offline=false;try{await fetch(origin+'/api/purchase/health',{signal:AbortSignal.timeout(1500)});}catch{offline=true;}assert.ok(offline);
  const direct=new Contract(chain.deployment.vault,chain.artifact.abi,owner);
  if(!report.revocation){const sent=await direct.revokeDirect(revoked);report.revocation={hash:sent.hash};await save();}
  let revokedReceipt=await chain.provider.getTransactionReceipt(report.revocation.hash);while(!revokedReceipt){await sleep(5000);revokedReceipt=await chain.provider.getTransactionReceipt(report.revocation.hash);}assert.equal(revokedReceipt.status,1);report.revocation.blockNumber=revokedReceipt.blockNumber;
  await record('OWNER_DIRECT_REVOKE_WITH_ENTIRE_APP_STOPPED',{applicationPid:server.pid,applicationExitCode:server.exitCode,transactionHash:revokedReceipt.hash,blockNumber:revokedReceipt.blockNumber});
  const target=Math.max(report.paymentBlock,revokedReceipt.blockNumber,...Object.values(report.cases).map(c=>c.attack?.blockNumber??0));await finality(target);
  await boot();p=await purchase(normal);
  if(!p.faultInjected)p=await run(normal,'drop-response');
  assert.equal(p.payment,'SETTLED');assert.equal(p.delivery,'PENDING');assert.equal(p.modelCalls,1);await exportBundle(normal,'paid-response-lost.json');
  const restarted=(await api('/worker/restart',{})).data;assert.notEqual(restarted.previous.pid,restarted.current.pid);
  const done=await run(normal,'normal');assert.equal(done.workflow,'COMPLETE',done.reason);assert.equal(done.receipt.hash,report.paymentTx);assert.equal(done.modelCalls,2);assert.equal((await chain.state(owner.address,normal)).spent,'600');
  await exportBundle(normal,'recovered.json');await record('REAL_KILN_RESPONSE_LOSS_RESTART_RECOVERY',{paymentTx:done.receipt.hash,previousPid:restarted.previous.pid,currentPid:restarted.current.pid,attempts:done.attempts.length,paymentCount:1,usage:done.usage.map(u=>({flow:u.flow,model:u.model,requestId:u.requestId,promptTokens:u.promptTokens,completionTokens:u.completionTokens,totalTokens:u.totalTokens,latencyMs:u.latencyMs}))});
  const cached=await run(normal,'normal');assert.equal(cached.modelCalls,2);assert.equal(cached.receipt.hash,done.receipt.hash);await record('CACHE_NO_ADDITIONAL_PAYMENT_OR_MODEL');
  const stop=await run(revoked,'normal');assert.equal(stop.reason,'USER_STOPPED');assert.equal(stop.modelCalls,0);await exportBundle(revoked,'owner-revoked.json');
  await halt();const result=await cli('recovered.json','independent-verifier.json');assert.equal(result.status,'VALID');assert.equal(result.delivery,'SIGNED_CONTENT_MATCH');
  await record('INDEPENDENT_RPC_AND_PROCESS_WITH_ENTIRE_APP_STOPPED',{applicationPid:server.pid,applicationExitCode:server.exitCode,rpcHost:new URL(verifyUrl).hostname,scope:result.scope,transactionHash:result.txHash});
  report.status='PASS';report.completedAt=new Date().toISOString();await save();console.log('PUBLIC_TESTNET_PASS '+path.relative(process.cwd(),report.output));
}catch(e){report.status='INTERRUPTED';report.error=e.code??e.message;await save();console.error('PUBLIC_TESTNET_INTERRUPTED '+report.error);process.exitCode=1;}
finally{await halt();await close();independent.destroy();}
