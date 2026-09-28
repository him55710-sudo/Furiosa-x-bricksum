import {spawn} from 'node:child_process';import {createServer} from 'node:net';import path from 'node:path';import {existsSync,readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {JsonRpcProvider,Contract,id} from 'ethers';import {openChain} from '../src/deal-escrow/chain.mjs';import {DealStore} from '../src/deal-escrow/store.ts';import {DealEngine} from '../src/deal-escrow/engine.ts';import {now} from '../src/deal-escrow/domain.ts';import {researchRequirements} from '../src/deal-escrow/reference.ts';import {receipt,verifyReceipt} from '../src/deal-escrow/audit.ts';import {readJson,saveJson} from '../src/deal-escrow/public-run.mjs';
import {acquireRuntimeLock} from '../src/deal-escrow/runtime-lock.mjs';
process.env.SEPOLIA_RPC_URL='https://ethereum-sepolia-rpc.publicnode.com';
const runtime=path.resolve('data/private/deal-escrow/source-sepolia'),privateDir=path.resolve('data/private/deal-escrow/source-recovery'),journalFile=path.join(privateDir,'run.json');
const runLock=acquireRuntimeLock(privateDir);
const j=existsSync(journalFile)?readJson(journalFile):{run:randomUUID(),status:'RUNNING',started_at:new Date().toISOString(),mandate_id:randomUUID(),deal_id:randomUUID()};
const directory=`artifacts/deal-escrow/source-recovery/${j.run}`,persist=()=>saveJson(journalFile,j),log=(stage,extra={})=>console.log(JSON.stringify({stage,...extra}));persist();
const childEnv=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
function launch(args,env){const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env});child.output='';child.stdout.on('data',b=>child.output+=b);child.stderr.on('data',b=>child.output+=b);child.done=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));return child;}
async function until(test,{timeout=240000,interval=1000}={}){const end=Date.now()+timeout;while(!await test()){if(Date.now()>end)throw new Error('OBSERVATION_TIMEOUT_KEEP_SAME_RUN');await new Promise(r=>setTimeout(r,interval));}}
let app,provider;
try{
  if(j.status==='PASS'){log('EXISTING_RECOVERY_RUN',{run:j.run,new_transactions:0,new_model_calls:0});runLock.release();process.exit(0);}
  if(!j.intent_prepared){
    const chain=await openChain({directory:runtime,publicNetwork:true}),store=new DealStore(path.join(runtime,'state.sqlite')),engine=new DealEngine(store,chain);
    try{
      const t=now();try{store.mandate(j.mandate_id);}catch(e){if(e.message!=='MANDATE_NOT_FOUND')throw e;engine.mandate({mandate_id:j.mandate_id,company_id:'source-buyer-recovery-'+j.run,buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+3600,task_requirements:researchRequirements});}
      const old=store.list().find(r=>r.deal.deal_id===j.deal_id);
      if(old&&!store.intentForDeal(j.deal_id)){if(store.operation(j.deal_id,'fund'))throw new Error('LEGACY_SETUP_HAS_FINANCIAL_OPERATION');store.transaction(()=>{store.move(j.deal_id,'BLOCKED');store.event(j.deal_id,'TRANSACTION_BLOCKED',{reason:'DEMO_SETUP_MISSING_PURCHASE_INTENT'});});j.abandoned_setup_deal=j.deal_id;}
      const intent=store.getOrCreateIntent(j.mandate_id,'seller-a');j.deal_id=intent.deal_id;persist();
      if(!store.list().some(r=>r.deal.deal_id===j.deal_id)){
        const {version,max_delivery_seconds,...requirements}=researchRequirements;engine.propose({deal_id:j.deal_id,buyer_id:'research-agent-07',seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements,deadline:120,created_at:t,expires_at:Math.min(t+1800,store.mandate(j.mandate_id).expires_at),supersedes_deal_id:null},j.mandate_id);engine.agentAction('accept_deal',{deal_id:j.deal_id});
      }
      store.updateIntent(intent.id,{status:'COMPLETED'});j.deployment=chain.deployment;j.prepared=true;j.intent_prepared=true;persist();
    }finally{store.close();await chain.close();}
  }
  if(!j.funded){
    if(j.application_pid&&!j.application_stopped){try{process.kill(j.application_pid,0);throw new Error('PREVIOUS_APPLICATION_STILL_RUNNING');}catch(e){if(e.code!=='ESRCH')throw e;}}
    const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
    app=launch(['src/deal-escrow/server.mjs'],{...childEnv,ADE_DATA_DIR:runtime,ADE_NETWORK:'sepolia',ADE_PORT:String(port),SEPOLIA_RPC_URL:process.env.SEPOLIA_RPC_URL});j.application_pid=app.pid;j.application_origin=`http://127.0.0.1:${port}`;persist();
    await until(()=>{if(app.exitCode!==null){j.application_start_diagnostic=app.output.slice(-3000);persist();throw new Error('APPLICATION_EXITED_BEFORE_READY');}return app.output.includes('Agent Deal Escrow:');},{timeout:60000});
    const origin=j.application_origin,state=await(await fetch(origin+'/api/state')).json();
    const response=await fetch(origin+`/api/deals/${j.deal_id}/fund`,{method:'POST',headers:{'Content-Type':'application/json','X-ADE-Token':state.token,Origin:origin},body:'{}'});
    if(!response.ok){const failure=await response.json(),current=await(await fetch(origin+`/api/audit/${j.deal_id}`)).json();if(current.transactions?.fund?.status!=='PENDING')throw new Error(failure.error??'FUNDING_REQUEST_REJECTED');}
    let funded;await until(async()=>{funded=await(await fetch(origin+`/api/audit/${j.deal_id}`)).json();if(['BLOCKED','EXPIRED','REFUNDED','SETTLED'].includes(funded.state))throw new Error('UNEXPECTED_APPLICATION_OUTCOME');return funded.state==='ESCROW_FUNDED';},{interval:3000,timeout:180000});
    saveJson(`${directory}/funded-receipt.json`,funded);
    j.funded=true;persist();
    const packet={run:j.run,related_source_run:'a2f6f4fa-9f1e-4892-8518-325b8762c4f2',chain_id:11155111,contract:funded.network.contract,controller:funded.network.controller,buyer:funded.network.buyer,seller:funded.network.sellers['seller-a'],runtime_hash:funded.network.runtimeHash,deal_id:j.deal_id,deal_hash:funded.deal_hash,amount_wei:funded.evidence.escrow.amount,fund_tx:funded.transactions.fund.tx_hash,deadline:funded.evidence.escrow.deadline,maximum_gas_fee_wei:'90000000000000'};
    saveJson(`${directory}/public-packet.json`,packet);
    provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL,undefined,{cacheTimeout:-1});const c=new Contract(packet.contract,['function refund(bytes32,bytes32)'],provider);
    let earlyDenied=false;try{await c.refund.staticCall(packet.deal_hash,id('BUYER_DIRECT_DEADLINE_REFUND'),{from:packet.buyer});}catch(e){if(e.code==='CALL_EXCEPTION'&&e.reason==='REFUND_UNAUTHORIZED')earlyDenied=true;else throw e;}
    if(!earlyDenied)throw new Error('EARLY_BUYER_REFUND_NOT_REJECTED');j.early_buyer_refund_denied=true;persist();
    app.kill('SIGTERM');j.application_exit=await app.done;j.application_stopped_at=new Date().toISOString();j.application_stopped=true;
    let unavailable=false;try{await fetch(origin+'/api/health',{signal:AbortSignal.timeout(2000)});}catch{unavailable=true;}if(!unavailable)throw new Error('APPLICATION_STILL_SERVING');j.application_http_unavailable=true;persist();log('APPLICATION_STOPPED',{pid:app.pid,deadline:packet.deadline});
  }
  if(!j.application_stopped||!j.application_http_unavailable)throw new Error('APPLICATION_SHUTDOWN_EVIDENCE_REQUIRED');
  const packet=readJson(`${directory}/public-packet.json`);provider??=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL,undefined,{cacheTimeout:-1});
  await until(async()=>{const b=await provider.getBlock('latest');log('WAITING_REAL_CHAIN_DEADLINE',{remaining_seconds:Math.max(0,packet.deadline-b.timestamp)});return b.timestamp>=packet.deadline;},{interval:12000,timeout:240000});
  if(!j.unrelated_sender_denied){const c=new Contract(packet.contract,['function refund(bytes32,bytes32)'],provider);try{await c.refund.staticCall(packet.deal_hash,id('BUYER_DIRECT_DEADLINE_REFUND'),{from:j.deployment.sellers['seller-b']});throw new Error('UNRELATED_SENDER_ALLOWED');}catch(e){if(e.code!=='CALL_EXCEPTION'||e.reason!=='REFUND_UNAUTHORIZED')throw e;}j.unrelated_sender_denied=true;persist();}
  const buyerDir=path.join(privateDir,'buyer-only'),buyerKey=path.join(buyerDir,'buyer.json'),buyerJournal=path.join(buyerDir,'refund-intent.json'),packetFile=path.resolve(`${directory}/public-packet.json`),output=path.resolve(`${directory}/buyer-refund.json`);
  if(!existsSync(buyerKey))saveJson(buyerKey,{private_key:readJson(path.join(runtime,'identities.json')).buyer});
  if(!existsSync(output)){
    const readAllowed=['node_modules','package.json','scripts/deal-research-buyer-refund.mjs','src/deal-escrow/public-run.mjs',path.resolve(directory),buyerDir].map(p=>path.resolve(p));
    const args=['--permission',...readAllowed.map(p=>'--allow-fs-read='+p),'--allow-fs-write='+buyerDir,'--allow-fs-write='+path.resolve(directory),'scripts/deal-research-buyer-refund.mjs',packetFile,buyerKey,buyerJournal,output];
    const buyer=launch(args,childEnv);buyer.stdout.on('data',b=>process.stdout.write(b));const exit=await buyer.done;if(exit.code!==0){log('BUYER_HELPER_STOPPED',{output:buyer.output.slice(-1500)});throw new Error('BUYER_REFUND_INCOMPLETE_RESUME_SAME_RUN');}
    j.buyer_process_exit=exit;j.buyer_process_pid=buyer.pid;persist();log('INDEPENDENT_BUYER_REFUNDED',{tx_hash:readJson(output).tx_hash});
  }
  // Re-open the controller state only after the independent buyer has completed.
  const chain=await openChain({directory:runtime,publicNetwork:true}),store=new DealStore(path.join(runtime,'state.sqlite')),engine=new DealEngine(store,chain);
  try{
    const nonceBefore=await chain.provider.getTransactionCount(chain.deployment.controller);
    await until(async()=>{await engine.recover();return store.get(j.deal_id).state==='REFUNDED';},{interval:4000,timeout:120000});
    const r=receipt(engine,j.deal_id),v=await verifyReceipt(r,chain);if(v.verdict!=='VALID')throw new Error('RECONCILED_RECEIPT_NOT_VALID');
    const nonceAfter=await chain.provider.getTransactionCount(chain.deployment.controller);if(nonceBefore!==nonceAfter)throw new Error('RECONCILIATION_SENT_CONTROLLER_TRANSACTION');
    saveJson(`${directory}/reconciled-receipt.json`,r);j.reconciled=true;j.controller_nonce_before_recovery=nonceBefore;j.controller_nonce_after_recovery=nonceAfter;j.recovery_verdict=v.verdict;
    const report={run:j.run,status:'PASS',completed_at:new Date().toISOString(),network:'sepolia',deal_id:j.deal_id,application_pid:j.application_pid,application_exit:j.application_exit,application_stopped_at:j.application_stopped_at,application_http_unavailable:j.application_http_unavailable,early_buyer_refund_denied:j.early_buyer_refund_denied,unrelated_sender_denied:j.unrelated_sender_denied,buyer_helper:readJson(output),reconciled_state:r.state,reservation_after:store.accounting(j.mandate_id).reserved,controller_nonce_before_recovery:nonceBefore,controller_nonce_after_recovery:nonceAfter,model_calls:0,notes:['Separate deadline-recovery experiment; not a refund of the already released research purchase.','Application shutdown is observed by the local harness, not proven by blockchain.','Buyer child process cannot read the controller key or application database through its Node filesystem permissions.','Test gas is a separate operator-funded allowance; escrow returns principal, not gas.']};
    saveJson(`${directory}/report.json`,report);saveJson('artifacts/deal-escrow/source-recovery/latest.json',{run:j.run,directory});j.status='PASS';persist();log('RECOVERY_PASS',{run:j.run,refund_tx:report.buyer_helper.tx_hash,controller_transactions_during_reconciliation:0,model_calls:0});
  }finally{store.close();await chain.close();}
}catch(e){j.last_error=e.shortMessage??e.code??e.message;persist();log('STOPPED_RESUMABLE',{reason:j.last_error});process.exitCode=1;}
finally{provider?.destroy();if(app&&app.exitCode===null&&app.signalCode===null){app.kill('SIGTERM');await app.done;}runLock.release();}
