// Explicit v2 testnet proof. Uses the existing conversation compiler and validator,
// authored dialogue, fresh EIP-712 consent, real EVM execution; zero model calls.
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import ganache from 'ganache';
import {Wallet,BrowserProvider,JsonRpcProvider,Contract,ContractFactory,Transaction,keccak256,ZeroHash} from 'ethers';
import {saveJson,readJson} from '../src/deal-escrow/public-run.mjs';
import {acquireRuntimeLock} from '../src/deal-escrow/runtime-lock.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';
import {DealEngine} from '../src/deal-escrow/engine.ts';
import {hash,ensure} from '../src/deal-escrow/domain.ts';
import {validateDelivery} from '../src/deal-escrow/delivery.ts';
import {referenceRows} from '../src/deal-escrow/reference.ts';
import {NegotiationLedger,exportedNegotiation} from '../src/dealtrace/ledger.mjs';
import {participants,newMandate,opening,openingInterpretation,send,priceInterpretation,confirmBoth} from '../src/dealtrace/scenario.mjs';
import {assuranceProfile,sourceManifest} from '../src/dealtrace/claims.mjs';
import {vaultDomain,sellerListHash,digest,signTyped,compileVaultDeal} from '../src/dealtrace/vault.mjs';
import {verifyVaultProof} from '../src/dealtrace/vault-audit.mjs';

const publicMode=process.argv.includes('--sepolia'),run=process.argv.find(x=>x.startsWith('--run='))?.slice(6)??randomUUID();
ensure(/^[a-f0-9-]{36}$/.test(run),'RUN_ID');
const directory=`data/private/dealtrace/vault/${run}`,output=`artifacts/dealtrace/vault/runs/${run}`;
mkdirSync(directory,{recursive:true});mkdirSync(output,{recursive:true});
const lock=acquireRuntimeLock(directory),sourceDirectory=process.env.DEALTRACE_SEPOLIA_DIR??'data/private/deal-escrow/source-sepolia';
const sourceLock=publicMode?acquireRuntimeLock(sourceDirectory):null;
const artifact=readJson('artifacts/dealtrace/vault/contract.json');
let rawProvider,provider;
try{
 let keys;
 if(existsSync(`${directory}/identities.json`))keys=readJson(`${directory}/identities.json`);
 else{const source=publicMode?readJson(`${sourceDirectory}/identities.json`):Object.fromEntries(['controller','buyer','seller-a'].map(k=>[k,Wallet.createRandom().privateKey]));keys={relayer:source.controller,evaluator:source.controller,buyer:source.buyer,seller:source['seller-a'],agent:Wallet.createRandom().privateKey};saveJson(`${directory}/identities.json`,keys);}
 if(publicMode){provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL??'https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1});provider.pollingInterval=2000;}
 else{rawProvider=ganache.provider({logging:{quiet:true},chain:{chainId:31338,hardfork:'shanghai'},wallet:{accounts:[...new Set(Object.values(keys))].map(k=>({secretKey:k,balance:'0x8ac7230489e80000'}))}});provider=new BrowserProvider(rawProvider,undefined,{cacheTimeout:-1});provider.pollingInterval=10;}
 const chainId=Number((await provider.getNetwork()).chainId);ensure(chainId===(publicMode?11155111:31338),'TEST_NETWORK_ONLY');
 const actors=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,new Wallet(v,provider)]));
 const journalFile=`${directory}/journal.json`,journal=existsSync(journalFile)?readJson(journalFile):{run,chainId,source:artifact.sourceSha256,operations:{}};
 ensure(journal.source===artifact.sourceSha256&&journal.chainId===chainId,'RESUME_SOURCE_MISMATCH');
 const executionFiles=['contracts/DealTraceVault.sol','src/dealtrace/vault.mjs','src/dealtrace/vault-audit.mjs','src/dealtrace/ledger.mjs','src/deal-escrow/domain.ts','src/deal-escrow/delivery.ts','scripts/demo-dealtrace-vault.mjs'];
 const executionSource=()=>Object.fromEntries(executionFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
 const report={schema_version:2,run,status:'RUNNING',mode:publicMode?'SEPOLIA':'LOCAL_EVM',model_calls:0,dialogue:'AUTHORED_CURRENT_LEDGER',execution_source:executionSource(),transactions:[],checks:[]};
 const persist=()=>saveJson(`${output}/report.json`,report);
 async function tx(name,request,signer=actors.relayer,status=1){
  const requestIdentity=hash({to:request.to??null,data:request.data??'0x',value:String(request.value??0),from:signer.address,status});
  let op=journal.operations[name];
  if(!op){const nonce=await provider.getTransactionCount(signer.address);ensure(nonce===await provider.getTransactionCount(signer.address,'pending'),'PENDING_NONCE_RECONCILIATION_REQUIRED');
   const feeBlock=publicMode?await provider.getBlock('latest'):null;
   const fees=publicMode?{maxPriorityFeePerGas:10000000n,maxFeePerGas:feeBlock.baseFeePerGas*2n+10000000n}:{};
   const populated=await signer.populateTransaction({...request,...fees,nonce});
   const cap=BigInt(process.env.DEALTRACE_VAULT_MAX_GAS_WEI??(publicMode?'600000000000000':'10000000000000000'));ensure(populated.gasLimit*(populated.maxFeePerGas??populated.gasPrice)<=cap,'OPERATOR_GAS_BUDGET_EXCEEDED');
   ensure(await provider.getBalance(signer.address)>=(populated.value??0n)+populated.gasLimit*(populated.maxFeePerGas??populated.gasPrice),'INSUFFICIENT_TEST_ASSETS');
   const raw=await signer.signTransaction(populated);op={requestIdentity,raw,hash:keccak256(raw)};journal.operations[name]=op;saveJson(journalFile,journal);
  }
  ensure(op.requestIdentity===requestIdentity,'RESUME_INTENT_MISMATCH');
  const decoded=Transaction.from(op.raw);ensure(decoded.hash===op.hash&&decoded.chainId===BigInt(chainId)&&decoded.from===signer.address,'SIGNED_INTENT_MISMATCH');
  let receipt=await provider.getTransactionReceipt(op.hash);
  if(!receipt){if(!await provider.getTransaction(op.hash))await provider.broadcastTransaction(op.raw);receipt=await provider.waitForTransaction(op.hash,publicMode?2:1,45000);}
  ensure(receipt,'PENDING_RESUME_SAME_RUN');ensure(receipt.status===status,'UNEXPECTED_TRANSACTION_STATUS');
  const block=await provider.getBlock(receipt.blockNumber);ensure(block.hash===receipt.blockHash,'REORG_DETECTED');
  const item={label:name,tx_hash:op.hash,status:receipt.status,block:receipt.blockNumber,block_hash:receipt.blockHash,from:decoded.from,to:decoded.to,input:decoded.data,value:String(decoded.value),gas_used:String(receipt.gasUsed),fee_wei:String(receipt.fee)};
  report.transactions.push(item);persist();console.log(JSON.stringify({stage:name,tx_hash:op.hash,status}));return receipt;
 }
 // 3M is a bounded headroom over the measured ~2.2M local deployment, avoiding
 // RPC estimateGas balance caps that incorrectly apply a higher suggested fee.
 const deployed=await tx('deploy',{...await new ContractFactory(artifact.abi,artifact.bytecode,actors.relayer).getDeployTransaction(),gasLimit:3000000n});
 const address=deployed.contractAddress,domain=vaultDomain(chainId,address),vault=new Contract(address,artifact.abi,actors.relayer);
 const runtimeHash=keccak256(await provider.getCode(address));ensure(runtimeHash!==keccak256('0x'),'DEPLOYMENT_MISSING');
 const network={chainId,contract:address,runtimeHash,sourceSha256:artifact.sourceSha256,unitWei:'1000000000',buyer:actors.buyer.address,sellers:{'seller-a':actors.seller.address}};
 report.network=network;report.domain=domain;
 const planFile=`${directory}/plan.json`;
 let plan;
 if(existsSync(planFile))plan=readJson(planFile);
 else{
  const timestamp=(await provider.getBlock('latest')).timestamp,store=new DealStore(':memory:'),engine=new DealEngine(store,{deployment:network,sellers:network.sellers},()=>timestamp),ledger=new NegotiationLedger(engine),roles=participants();
  const sign=(actor,type,body)=>signTyped(actor,domain,type,body),until=timestamp+3600,allowed=[actors.seller.address];
  async function make(name,nonce){
   const m={buyer:actors.buyer.address,agent:actors.agent.address,evaluator:actors.evaluator.address,sellersHash:sellerListHash(allowed),budget:'4000000000000',maxPerDeal:'4000000000000',validUntil:until,nonce};
   const mandateId=digest(domain,'Mandate',m),human=newMandate(engine,{company_id:'vault-proof',task_budget_minor:4000,max_single_minor:4000,allowed_sellers:['seller-a'],expires_at:until,deal_assurance_required:true});
   const s=ledger.create(human.mandate_id,roles.buyer,roles.sellerA,assuranceProfile(network,'seller-a'));
   const text=opening.replace('2.00 DEMO','40.00 DEMO'),first=send(ledger,s.session_id,roles.buyer,text),interpretation=openingInterpretation(first);
   for(const patch of interpretation.patch)if(patch.quote===opening)patch.quote=text;
   ledger.interpret(s.session_id,interpretation);
   for(const [role,price] of [[roles.sellerA,3100],[roles.buyer,2500],[roles.sellerA,2600]]){const e=send(ledger,s.session_id,role,`${(price/100).toFixed(2)} DEMO all-in, keeping the requested work and delivery terms.`);ledger.interpret(s.session_id,priceInterpretation(e,price));}
   const yes=send(ledger,s.session_id,roles.buyer,'Agreed.');ledger.interpret(s.session_id,{event_id:yes.event_id,kind:'accept',patch:[]});confirmBoth(ledger,s.session_id,roles);
   const packet=exportedNegotiation(store,s.deal_id),d=compileVaultDeal(packet,{mandateId,seller:actors.seller.address,unitWei:network.unitWei,domain});
   const rows=referenceRows();if(name==='failure')rows[0].capex=42;const delivery=JSON.stringify(rows),deal=packet.revisions.at(-1).deal;
   const validation=validateDelivery(delivery,deal.requirements,timestamp,timestamp+deal.deadline);
   ensure(validation.verified===(name!=='failure'),'VALIDATOR_SCENARIO');
   const good={dealHash:d.dealHash,claimId:hash(name+'-correct-'+run),payee:d.seller,amount:d.amount,deliveryHash:hash(delivery)};
   const bad={...good,claimId:hash(name+'-overbill-'+run),amount:'3100000000000'};
   const evidenceHash=hash(validation),validationFor=c=>({dealHash:d.dealHash,claimHash:digest(domain,'Claim',c),evidenceHash});
   return {name,mandate:m,allowed,mandateId,mandateSignature:await sign(actors.buyer,'Mandate',m),packet,deal:d,agentSignature:await sign(actors.agent,'Deal',d),sellerSignature:await sign(actors.seller,'Deal',d),delivery,validation,goodClaim:good,badClaim:bad,goodClaimSignature:await sign(actors.seller,'Claim',good),badClaimSignature:await sign(actors.seller,'Claim',bad),evidenceHash,validationSignature:await sign(actors.evaluator,'Validation',validationFor(good)),badValidationSignature:await sign(actors.evaluator,'Validation',validationFor(bad))};
  }
  try{plan={source_manifest:sourceManifest,success:await make('success',1),failure:await make('failure',2),repeat:await make('repeat',3)};}finally{store.close();}
  saveJson(planFile,plan);
 }
 report.plan=plan;persist();
 const call=(method,args,value=0n,gasLimit)=>vault[method].populateTransaction(...args,{value,...(gasLimit?{gasLimit}:{})});
 // Resolve request promises before the transaction journal hashes the intent.
 async function operation(name,method,args,value=0n,status=1,signer=actors.relayer){return tx(name,await call(method,args,value,status===0?250000n:undefined),signer,status);}
 async function delivered(c,fundingReceipt){
  if(c.validation_finalized)return;
  const block=await provider.getBlock(fundingReceipt.blockNumber),submitted=(await provider.getBlock('latest')).timestamp;
  c.validation=validateDelivery(c.delivery,c.packet.revisions.at(-1).deal.requirements,submitted,block.timestamp+c.deal.deliveryWindow);
  ensure(c.validation.verified===(c.name!=='failure'),'DELIVERY_VALIDATION');c.evidenceHash=hash(c.validation);
  const approval=claim=>({dealHash:c.deal.dealHash,claimHash:digest(domain,'Claim',claim),evidenceHash:c.evidenceHash});
  c.validationSignature=await signTyped(actors.evaluator,domain,'Validation',approval(c.goodClaim));
  // Intentionally malicious approval for the excessive invoice: contract must still reject it.
  c.badValidationSignature=await signTyped(actors.evaluator,domain,'Validation',approval(c.badClaim));
  c.validation_finalized=true;saveJson(planFile,plan);persist();
 }
 const {success:s,failure:f,repeat:r}=plan;
 await operation('open-success','openMandate',[s.mandate,s.allowed,s.mandateSignature]);
 await delivered(s,await operation('fund-success','fund',[s.deal,s.agentSignature,s.sellerSignature,'0x'],BigInt(s.deal.amount)));
 await operation('attack-overbill','release',[s.badClaim,s.badClaimSignature,s.evidenceHash,s.badValidationSignature],0n,0);
 await operation('release-success','release',[s.goodClaim,s.goodClaimSignature,s.evidenceHash,s.validationSignature]);
 await operation('withdraw-seller','withdrawFor',[s.deal.seller]);
 await operation('open-failure','openMandate',[f.mandate,f.allowed,f.mandateSignature]);
 await delivered(f,await operation('fund-failure','fund',[f.deal,f.agentSignature,f.sellerSignature,'0x'],BigInt(f.deal.amount)));
 await operation('refund-failure','refund',[f.deal.dealHash,1,f.evidenceHash],0n,1,actors.evaluator);
 await operation('withdraw-buyer','withdrawFor',[f.mandate.buyer]);
 await operation('open-repeat','openMandate',[r.mandate,r.allowed,r.mandateSignature]);
 await operation('attack-preview','fund',[r.deal,r.agentSignature,r.sellerSignature,'0x'],BigInt(r.deal.amount),0);
 await operation('revoke-repeat','revoke',[r.mandateId],0n,1,actors.buyer);
 await operation('attack-revoked','fund',[r.deal,r.agentSignature,r.sellerSignature,'0x'],BigInt(r.deal.amount),0);
 ensure(hash(executionSource())===hash(report.execution_source),'EXECUTION_SOURCE_CHANGED');
 report.checked_at=new Date().toISOString();report.status='PASS';
 report.final_state={success:Number((await vault.escrows(s.deal.dealHash)).status),failure:Number((await vault.escrows(f.deal.dealHash)).status),repeat:Number((await vault.escrows(r.deal.dealHash)).status),requires_preview:await vault.requiresPreview(actors.buyer.address,actors.seller.address),locked:String(await vault.totalLocked()),credits:String(await vault.totalCredits()),balance:String(await provider.getBalance(address))};
 ensure(report.final_state.success===2&&report.final_state.failure===3&&report.final_state.repeat===0&&report.final_state.requires_preview&&report.final_state.locked==='0'&&report.final_state.credits==='0','FINAL_STATE');
 report.limitations=['Authored conversation through the existing compiler; this v2 run adds no Kiln calls.','Demo role keys are controlled by one operator, not independent companies.','Evaluator attests to pinned source validation, not arbitrary real-world truth.','Revocation blocks new commitments, not already locked work.','Budget counts gross allocation; refund does not replenish permission.','Release creates withdrawal credit; only Withdrawn proves native-asset transfer.'];
 persist();saveJson(`${output}/deployment.json`,{...network,deploymentTx:deployed.hash});
 const verification=await verifyVaultProof(report,{provider,trusted:network,blockTag:publicMode?'latest':'latest'});saveJson(`${output}/verification.json`,verification);ensure(verification.verdict==='VALID','PROOF_VERIFICATION');
 if(process.argv.includes('--self-check')){
  const mutations=[['changed_price',r=>{r.plan.success.packet.revisions.at(-1).deal.price_minor+=500;}],['missing_transaction',r=>{r.transactions.pop();}],['changed_block_hash',r=>{r.transactions[2].block_hash=ZeroHash;}],['changed_delivery',r=>{r.plan.success.delivery='[]';}]];
  const cases=[];for(const [name,change] of mutations){const copy=structuredClone(report);change(copy);const result=await verifyVaultProof(copy,{provider,trusted:network,blockTag:'latest'});ensure(result.verdict==='INVALID','TAMPER_ACCEPTED');cases.push({name,...result});}
  saveJson(`${output}/tamper-cases.json`,{model_calls:0,original_hash:hash(report),cases});
 }
 saveJson(`artifacts/dealtrace/vault/${publicMode?'public-latest':'local-latest'}.json`,{run,report:`${output}/report.json`,verification:`${output}/verification.json`});
 console.log(JSON.stringify({run,status:report.status,transactions:report.transactions.length,verification}));
}catch(error){
 const diagnostic={run,status:'INCOMPLETE',reason:error.code??error.shortMessage??error.message,rpc_message:error.info?.error?.message??null};
 saveJson(`${output}/last-error.json`,diagnostic);console.error(JSON.stringify(diagnostic));process.exitCode=1;
}finally{provider?.destroy();await rawProvider?.disconnect();sourceLock?.release();lock.release();}
