import {mkdirSync,existsSync,readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {TypedDataEncoder,ZeroHash} from 'ethers';
import {readJson} from '../../deal-escrow/public-run.mjs';
import {saveJson} from './storage.mjs';
import {acquireRuntimeLock} from '../../deal-escrow/runtime-lock.mjs';
import {sellerListHash} from '../vault.mjs';
import {openExecution} from './chain.mjs';
import {startWorker,connectProvider} from './client.mjs';
import {negotiate} from './negotiate.mjs';
import {validateUsage} from './work.mjs';
import {verifyProcurement} from './verify.mjs';
import {hash,ensure,defaultRfq,validateRfq,UNIT_WEI,executionDeal,domainFor,executionTypes,meterLines,verifySigned} from './protocol.mjs';

function source(){const files=['contracts/DealTraceVault.sol','contracts/DealTraceMeteredVault.sol','artifacts/dealtrace/vault/contract.json','artifacts/dealtrace/metered-vault/contract.json','src/deal-escrow/domain.ts','src/deal-escrow/kiln.ts','src/deal-escrow/reference.ts','src/deal-escrow/runtime-lock.mjs','src/dealtrace/vault.mjs','data/reference/capex/lges-2025-v1.json',...readdirSync('src/dealtrace/procurement').filter(n=>n.endsWith('.mjs')).map(n=>'src/dealtrace/procurement/'+n)];return hash(files.sort().map(p=>({path:p,hash:hash(readFileSync(p,'utf8'))})));}
export async function runProcurement({run=randomUUID(),resume=false,live=false,metered=false,publicNetwork=false,approved=false,budget=4000,flexQuantity=false,failOne=metered,external=[],onProgress=()=>{},cancelled=()=>false}={}){
 ensure(approved===true,'HUMAN_APPROVAL_REQUIRED');ensure(/^[a-f0-9-]{36}$/.test(run),'RUN_ID');
 const directory=`data/private/dealtrace/procurement/${run}`,out=`artifacts/dealtrace/procurement/runs/${run}`;mkdirSync(directory,{recursive:true});mkdirSync(out,{recursive:true});
 const lock=acquireRuntimeLock(directory),journalFile=directory+'/journal.json';
 let journal,report,chain;const workers=[];
 try{
  if(resume){ensure(existsSync(journalFile),'RUN_NOT_FOUND');journal=readJson(journalFile);report=readJson(out+'/report.json');ensure(journal.config.live===live&&journal.config.metered===metered&&journal.config.publicNetwork===publicNetwork,'RESUME_MODE_MISMATCH');ensure(journal.source_hash===source(),'RESUME_SOURCE_MISMATCH');if(report.status==='PASS')return report;ensure(publicNetwork,'LOCAL_RESUME_UNAVAILABLE');}
  else{ensure(!existsSync(journalFile),'RUN_EXISTS_USE_RESUME');journal={run,source_hash:source(),config:{live,metered,publicNetwork,failOne,flexQuantity},rfq:defaultRfq({run,metered,budget_minor:budget,flexQuantity})};report={schema:'DEALTRACE_PROCUREMENT_PROOF_V1',run,status:'RUNNING',mode:live?'LIVE_KILN':'DETERMINISTIC_OFFLINE',billing:journal.rfq.billing,source_hash:journal.source_hash,started_at:new Date().toISOString(),transactions:[],usage:[],limits:['All bundled default providers are separate local processes under one operator. External endpoints require an explicit identity pin.','Search operates on the pinned source corpus; compute executes a CPU hash batch, not an internet search service or rented GPU.','The evaluator attests off-chain delivery and successful usage. Cryptography does not establish business identity or semantic truth.','Failed units and overbilling are labeled injected adversarial scenarios. All chain assets are test assets.','This run is automated validation, not a human comprehension study.']};}
  const persist=()=>{saveJson(journalFile,journal);saveJson(out+'/report.json',report);};
  const refresh=stage=>{report.stage=stage;report.negotiation=journal.negotiation??null;report.usage=Object.values(journal.negotiation?.usage??{}).flat();report.model_calls=report.usage.length;persist();onProgress(structuredClone(report));};
  validateRfq(journal.rfq);report.rfq=journal.rfq;persist();
  chain=await openExecution({directory,journal,report,persist,publicNetwork,metered,onProgress:refresh});report.network=chain.network;persist();
  const pin={network:chain.network,human:chain.buyer.address};
  const buyer=await startWorker(directory+'/buyer',{id:'buyer',role:'buyer',identity_directory:'data/private/dealtrace/procurement-identities/buyer',policy:{max_budget_minor:journal.rfq.budget_minor,preference:'Lower price with all required source evidence, without extending the deadline.'},...pin});workers.push(buyer);
  const sellerConfigs=[{id:'seller-a',floors:{document:1800,search:150,compute:200},min_delivery_seconds:300,quality:'ACTUAL_WITH_SOURCES'},{id:'seller-b',floors:{document:1100,search:60,compute:80},min_delivery_seconds:180,quality:'FORECAST_ONLY'},{id:'seller-c',floors:{document:2200,search:100,compute:120},min_delivery_seconds:240,quality:'ACTUAL_WITH_SOURCES'}];
  const sellers=[];
  for(const c of sellerConfigs){const seller=await startWorker(directory+'/'+c.id,{id:c.id,role:'seller',identity_directory:'data/private/dealtrace/procurement-identities/'+c.id,capabilities:['document','search','compute'],policy:{...c,preferred_margin:'Make a commercially reasonable offer above cost; lower it only if the counteroffer remains profitable.'},...pin});workers.push(seller);sellers.push(seller);}
  for(const cfg of external){ensure(!sellers.some(s=>s.id===cfg.id),'DUPLICATE_PROVIDER_ID');sellers.push(connectProvider(cfg));}
  report.identities={buyer:buyer.address,sellers:sellers.map(s=>({id:s.id,address:s.address,local_pid:s.pid??null,external:!s.pid}))};refresh('DISCOVERY');
  const {packet,selected}=await negotiate({rfq:journal.rfq,buyer,sellers,live,cancelled,journal,persist,onProgress:refresh});
  ensure(!cancelled(),'HUMAN_STOPPED');
  if(!journal.plan){
   const now=(await chain.provider.getBlock('latest')).timestamp,allowed=sellers.map(s=>s.address),domain=domainFor(chain.network);
   const m={buyer:chain.buyer.address,agent:buyer.address,evaluator:chain.relayer.address,sellersHash:sellerListHash(allowed),budget:(BigInt(journal.rfq.budget_minor)*BigInt(UNIT_WEI)).toString(),maxPerDeal:(BigInt(journal.rfq.budget_minor)*BigInt(UNIT_WEI)).toString(),validUntil:now+7200,nonce:BigInt(hash({run})).toString()};
   const mandateId=TypedDataEncoder.hash(domain,executionTypes('Mandate'),m),mandateSignature=await chain.buyer.signTypedData(domain,executionTypes('Mandate'),m);
   const deal=executionDeal(packet,{mandateId,network:chain.network,expiresAt:now+7100});
   journal.plan={packet,mandate:m,mandateSignature,allowed,deal};persist();
  }
  const p=journal.plan,domain=domainFor(chain.network),commitBody={packet:p.packet,deal:p.deal,network:chain.network,mandate:p.mandate,mandateSignature:p.mandateSignature};
  for(const [agent,which] of [[buyer,'buyer'],[selected,'seller']])if(!p[which+'Signature']){const result=await agent.request('/commit',{request_id:run+'-commit',...commitBody});ensure(!result.error,result.error??'COMMIT_FAILED');p[which+'Signature']=result.signature;p[which+'MeterSignature']=result.meterSignature;p[which+'Review']=result.review;persist();}
  if(metered)p.lines=meterLines(p.packet);report.plan=p;refresh('BILATERALLY_COMMITTED');
  const send=async(label,method,args,value=0n,opts={})=>chain.tx(label,await chain.call(method,args,value,opts.gasLimit),opts);
  const stop=async()=>{if(cancelled()||journal.stopped){journal.stopped=true;persist();if(journal.operations['open-mandate'])await send('revoke','revoke',[p.deal.mandateId],0n,{signer:chain.buyer});throw new Error('HUMAN_STOPPED');}};
  await stop();await send('open-mandate','openMandate',[p.mandate,p.allowed,p.mandateSignature]);await stop();
  const funding=await send('fund',metered?'fundMetered':'fund',metered?[p.deal,p.buyerSignature,p.sellerSignature,'0x',p.lines,p.buyerMeterSignature,p.sellerMeterSignature]:[p.deal,p.buyerSignature,p.sellerSignature,'0x'],BigInt(p.deal.amount));
  report.funding_timestamp=(await chain.provider.getBlock(funding.blockNumber)).timestamp;report.deadline=report.funding_timestamp+p.deal.deliveryWindow;refresh('FUNDED');await stop();
  journal.units??=[];
  for(const item of p.packet.terms.items)for(let index=0;index<item.units;index++){
   const key=hash({run,terms_hash:p.packet.terms_hash,service:item.service,index});if(journal.units.some(u=>u.body.request_id===key))continue;
   await stop();const result=await selected.request('/execute',{request_id:key,run,service:item.service,index,request_key:key,fail:journal.config.failOne&&item.service==='search'&&index===1});ensure(!result.error,result.error??'DELIVERY_FAILED');verifySigned(result,selected.address);journal.units.push(result);persist();refresh('DELIVERING');
  }
  // A new transport request with the same unit key must return identical evidence.
  const first=journal.units[0].body,retry=await selected.request('/execute',{request_id:run+'-retry-unit',run,service:first.service,index:first.index,request_key:first.request_id,fail:false});ensure(hash(retry)===hash(journal.units[0]),'DUPLICATE_UNIT_CHANGED');report.idempotent_retry={request_id:first.request_id,same_evidence:true,billed_twice:false};
  report.units=journal.units;report.validation=validateUsage(p.packet,journal.units);report.evidence_hash=hash(report.validation);refresh('DELIVERY_VERIFIED');await stop();
  const amount=metered?BigInt(report.validation.amount_minor)*BigInt(UNIT_WEI):BigInt(p.deal.amount);ensure(metered||report.validation.failed===0,'FIXED_JOB_INCOMPLETE');
  if(!journal.claims){
   const claim={dealHash:p.deal.dealHash,claimId:hash({run,type:'correct'}),payee:selected.address,amount:String(amount),deliveryHash:hash(journal.units)};
   const bad={...claim,claimId:hash({run,type:'overbill'}),amount:String(metered?BigInt(p.deal.amount):amount+500n*BigInt(UNIT_WEI))};
   const signValidation=async c=>chain.relayer.signTypedData(domain,executionTypes('Validation'),{dealHash:c.dealHash,claimHash:TypedDataEncoder.hash(domain,executionTypes('Claim'),c),evidenceHash:report.evidence_hash});
   const correctSignature=await selected.request('/claim',{request_id:run+'-claim',run,claim,attack:false}),badSignature=await selected.request('/claim',{request_id:run+'-attack',run,claim:bad,attack:true});ensure(!correctSignature.error&&!badSignature.error,'CLAIM_FAILED');
   journal.claims={correct:claim,bad,correctSignature:correctSignature.signature,badSignature:badSignature.signature,validationSignature:await signValidation(claim),badValidationSignature:await signValidation(bad)};persist();
  }
  report.claims=journal.claims;const c=journal.claims;
  const args=(claim,sig,vsig)=>[claim,sig,report.evidence_hash,vsig,...(metered?[p.lines,report.validation.counts]:[])];
  if(c.bad.amount!==c.correct.amount)await send('overbill-blocked',metered?'settleMetered':'release',args(c.bad,c.badSignature,c.badValidationSignature),0n,{status:0,gasLimit:400000n});
  await stop();await send('settle',metered?'settleMetered':'release',args(c.correct,c.correctSignature,c.validationSignature));
  if(amount>0n)await send('withdraw-seller','withdrawFor',[selected.address]);const refund=BigInt(p.deal.amount)-amount;if(refund>0n)await send('withdraw-unused','withdrawFor',[p.mandate.buyer]);
  report.paid_wei=String(amount);report.refunded_wei=String(refund);report.status='PASS';refresh('SETTLED');
  report.verification=await verifyProcurement(report,{provider:chain.provider,trusted:chain.network,blockTag:'latest'});ensure(report.verification.verdict==='VALID','VERIFICATION_'+report.verification.reason);
  report.completed_at=new Date().toISOString();report.ending_source_hash=source();ensure(report.source_hash===report.ending_source_hash,'SOURCE_CHANGED_DURING_RUN');
  refresh('COMPLETE');saveJson('artifacts/dealtrace/procurement/latest.json',{run,report:out+'/report.json'});if(publicNetwork)saveJson('artifacts/dealtrace/procurement/public-latest.json',{run,report:out+'/report.json'});
  return report;
 }catch(error){
  if(report){report.negotiation=journal?.negotiation??null;report.usage=Object.values(journal?.negotiation?.usage??{}).flat();report.model_calls=report.usage.length;report.status=error.message==='HUMAN_STOPPED'?'STOPPED':/PENDING|timeout|NETWORK|RPC/i.test(error.message)?'INCOMPLETE':'FAIL';report.error=error.message;report.resume_same_run=publicNetwork;report.financial_intents=Object.keys(journal?.operations??{});saveJson(out+'/report.json',report);onProgress(structuredClone(report));}
  if(journal)saveJson(journalFile,journal);return report??{run,status:'FAIL',error:error.message};
 }finally{for(const worker of workers)await worker.close();await chain?.close();lock.release();}
}
