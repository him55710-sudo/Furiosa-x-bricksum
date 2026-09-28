import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import {Wallet,Contract} from 'ethers';
import {connectPurchaseWorker} from '../src/purchase-chain.mjs';
import {CONSENT_TYPES,hash} from '../shared/purchase.mjs';

// Live, local-devnet integration run. Uses the configured real Kiln model.
// Public testnet requires its own funding/finality procedure; never silently switch networks.
const origin=process.env.PURCHASE_TEST_ORIGIN??'http://127.0.0.1:3500';
const directory=path.resolve(process.env.PURCHASE_DATA_DIR??'data/private/purchase-devnet');
const output=path.resolve('artifacts/purchase/runs',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(output,{recursive:true});
const {chain,config:workerConfig}=await connectPurchaseWorker(directory);
assert.equal(chain.deployment.chainId,31337,'This harness is local-devnet only.');
const owner=Wallet.createRandom(),stranger=Wallet.createRandom();
await writeFile(path.join(directory,'verification-owner.json'),JSON.stringify({address:owner.address,privateKey:owner.privateKey}),{mode:0o600});
const report={schemaVersion:1,startedAt:new Date().toISOString(),network:'LOCAL_DEVNET_TEST_ASSETS',runtime:workerConfig.runtime,checks:[],purchases:[],limitations:['Synthetic seller and TestCredit; not standard x402 or production payment.','HTTP listener pause is not a parent-process shutdown; local chain RPC stays available.','Model usage is API-reported; no NPU power measurement.']};
const record=(name,data={})=>{report.checks.push({name,ok:true,...data});console.log('PASS '+name);};
const save=async(name,data)=>writeFile(path.join(output,name),JSON.stringify(data,null,2)+'\n');
async function request(route,{method='GET',body,cookie,headers={},expected=200}={}){
  const response=await fetch(origin+'/api/purchase'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return {data,response};
}
async function login(wallet){const {data:c}=await request('/auth/challenge',{method:'POST',body:{address:wallet.address}});const {response}=await request('/auth/login',{method:'POST',body:{nonce:c.nonce,signature:await wallet.signMessage(c.message)}});return response.headers.get('set-cookie').split(';')[0];}
async function settle(cookie){const deadline=Date.now()+150000;while(Date.now()<deadline){const {data}=await request('/dashboard',{cookie});if(!data.worker.active)return data;await new Promise(r=>setTimeout(r,250));}throw new Error('WORKER_OBSERVATION_TIMEOUT');}
async function draft(cookie){const {data:d}=await request('/draft',{method:'POST',body:{},cookie});await request(`/${d.purchase.id}/approve`,{method:'POST',body:{signature:await owner.signTypedData(d.domain,CONSENT_TYPES,d.value)},cookie});return d.purchase.id;}
async function run(cookie,id,scenario){await request(`/${id}/run`,{method:'POST',body:{scenario},cookie,expected:202});const dashboard=await settle(cookie);return dashboard.purchases.find(p=>p.id===id);}
async function bundle(cookie,id,name){const {data}=await request(`/${id}/evidence`,{cookie});await save(name,data);report.purchases.push({id,file:name,workflow:data.purchase.workflow,payment:data.purchase.payment});return data;}
async function minedRevert(quote){let receipt;try{await(await chain.vault.pay(quote.quote,quote.signature,hash('explicit harness bypass attempt'),{gasLimit:500000})).wait();}catch(e){receipt=e.receipt;}assert.equal(receipt?.status,0);return {hash:receipt.hash,status:receipt.status,blockNumber:receipt.blockNumber};}
async function verifyCli(file,name){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/verify-purchase.mjs',path.join(output,file),'artifacts/purchase/deployment.json',chain.deployment.rpcUrl,path.join(output,name)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',reject);child.once('exit',code=>{if(code!==0)return reject(new Error('CLI_VERIFY_FAILED'));resolve(JSON.parse(stdout));});});}
try{
  await request('/dashboard',{expected:401});
  await request('/config',{headers:{Origin:'https://untrusted.invalid'},expected:403});
  const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(origin+'/api/purchase/config',{headers:{Host:'untrusted.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(hostStatus,403);
  record('HTTP_AUTH_ORIGIN_HOST');
  const cookie=await login(owner),otherCookie=await login(stranger);
  const id=await draft(cookie);
  for(const endpoint of ['events','evidence','document'])await request(`/${id}/${endpoint}`,{cookie:otherCookie,expected:403});
  await request(`/${id}/run`,{method:'POST',cookie:otherCookie,body:{},expected:403});
  record('OWNER_ISOLATION');
  const first=await run(cookie,id,'drop-response');assert.equal(first.payment,'SETTLED');assert.equal(first.delivery,'PENDING');assert.equal(first.modelCalls,1);
  await bundle(cookie,id,'paid-response-lost.json');
  const {data:restarted}=await request('/worker/restart',{method:'POST',body:{},cookie});assert.notEqual(restarted.previous.pid,restarted.current.pid);
  const recovered=await run(cookie,id,'normal');assert.equal(recovered.workflow,'COMPLETE',recovered.reason);assert.equal(recovered.receipt.hash,first.receipt.hash);assert.equal(recovered.attempts.length,2);assert.equal(recovered.modelCalls,2);
  assert.notEqual(recovered.attempts[0].pid,recovered.attempts[1].pid);
  assert.equal(recovered.attempts[0].sourceHash,workerConfig.runtime.hash);assert.equal(recovered.attempts[1].sourceHash,workerConfig.runtime.hash);
  record('REAL_KILN_RESPONSE_LOSS_PROCESS_RESTART_RECOVERY',{previousPid:restarted.previous.pid,currentPid:restarted.current.pid,txHash:recovered.receipt.hash,paymentCount:1,attempts:2,usage:recovered.usage.map(u=>({flow:u.flow,model:u.model,requestId:u.requestId,promptTokens:u.promptTokens,completionTokens:u.completionTokens,totalTokens:u.totalTokens,latencyMs:u.latencyMs}))});
  const complete=await bundle(cookie,id,'recovered.json');
  const cached=await run(cookie,id,'normal');assert.equal(cached.modelCalls,2);assert.equal(cached.receipt.hash,recovered.receipt.hash);record('CACHED_REPLAY_ZERO_EXTRA_MODEL_CALLS');
  const quote=await(await fetch(workerConfig.sellerUrl+'/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:complete.purchase.consent,signature:complete.purchase.signature,scenario:'normal'})})).json();
  // /quote accepts the signed consent, never grants new owner authority.
  assert.ok(quote.quote,JSON.stringify(quote));
  const attack=await minedRevert(quote);assert.equal((await chain.state(owner.address,id)).spent,'600');record('NEW_OFFER_SAME_PURCHASE_MINED_REVERT',attack);
  for(const [scenario,reason] of [['over-budget','BUDGET_EXCEEDED'],['unlisted','MERCHANT_NOT_ALLOWED'],['expired','DEADLINE_EXPIRED']]){
    const stoppedId=await draft(cookie),p=await run(cookie,stoppedId,scenario);assert.equal(p.reason,reason);assert.equal(p.modelCalls,0);assert.equal((await chain.state(owner.address,stoppedId)).spent,'0');
    const proof=await bundle(cookie,stoppedId,scenario+'.json');assert.ok(proof.events.some(e=>e.type==='EXECUTION_STOPPED'&&e.data.reason===reason));
    record('BOUNDARY_'+scenario.toUpperCase(),{purchaseId:stoppedId,reason,modelCalls:0,paymentCount:0,bypass:await minedRevert(proof.purchase.quote)});
  }
  const revokedId=await draft(cookie);
  await(await chain.signer.sendTransaction({to:owner.address,value:10n**16n})).wait();
  const direct=new Contract(chain.deployment.vault,chain.artifact.abi,owner.connect(chain.provider));
  await request(`/${id}/testing/pause-http`,{method:'POST',body:{},cookie});
  await new Promise(r=>setTimeout(r,400));
  let offline=false;try{await fetch(origin+'/api/purchase/health',{signal:AbortSignal.timeout(800)});}catch{offline=true;}assert.ok(offline);
  const revoked=await(await direct.revokeDirect(revokedId)).wait();assert.equal(revoked.status,1);
  record('OWNER_DIRECT_REVOKE_WITH_HTTP_OFFLINE',{purchaseId:revokedId,txHash:revoked.hash});
  const verified=await verifyCli('recovered.json','independent-verifier.json');assert.equal(verified.status,'VALID');assert.equal(verified.delivery,'SIGNED_CONTENT_MATCH');
  record('INDEPENDENT_PROCESS_VERIFIER_WITH_HTTP_OFFLINE',{scope:verified.scope,txHash:verified.txHash});
  const deadline=Date.now()+12000;while(Date.now()<deadline){try{await request('/health');break;}catch{await new Promise(r=>setTimeout(r,300));}}
  const rev=await run(cookie,revokedId,'normal');assert.equal(rev.reason,'USER_STOPPED');assert.equal(rev.modelCalls,0);await bundle(cookie,revokedId,'owner-revoked.json');
  const tampered=structuredClone(complete);tampered.purchase.consent.perTxCap='99999';const {data:bad}=await request('/verify',{method:'POST',body:tampered});assert.equal(bad.status,'INVALID');await save('tamper-verifier.json',bad);
  const missing=structuredClone(complete);delete missing.preEvidence;const {data:inc}=await request('/verify',{method:'POST',body:missing});assert.equal(inc.status,'INCOMPLETE');record('TAMPER_INVALID_MISSING_INCOMPLETE');
  report.status='PASS';
}catch(e){report.status='FAIL';report.failure=String(e.message).slice(0,1000);process.exitCode=1;console.error(report.failure);}
finally{report.finishedAt=new Date().toISOString();await save('report.json',report);chain.provider.destroy();console.log('Report: '+path.relative(process.cwd(),path.join(output,'report.json')));}
