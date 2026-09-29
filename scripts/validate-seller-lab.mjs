import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {startSeller} from '../verification/generalization/start-seller.mjs';
import {laboratory} from '../verification/generalization/evm.mjs';
import {modes} from '../verification/generalization/seller-core.mjs';
import {startWorker,connectProvider} from '../src/dealtrace/procurement/client.mjs';
import {negotiate} from '../src/dealtrace/procurement/negotiate.mjs';
import {defaultRfq,hash,executionDeal,verifySigned,UNIT_WEI} from '../src/dealtrace/procurement/protocol.mjs';
import {validateUsage} from '../src/dealtrace/procurement/work.mjs';
import {digest,signTyped} from '../src/dealtrace/vault.mjs';
const run=randomUUID(),out=`artifacts/generalization/seller-lab/${run}`,privateRoot=`data/private/generalization/${run}`;mkdirSync(out,{recursive:true});
const externalFile=process.argv.find(a=>a.startsWith('--external='))?.slice(11),external=externalFile?JSON.parse(readFileSync(externalFile)):null;
const expected={NORMAL:'PAID',OVERBILL:'OVERBILL_BLOCKED',STALE_OFFER:'EVENT_ORDER',MISDELIVERY:'REFUNDED',DOUBLE_INVOICE:'DUPLICATE_BLOCKED',DEADLINE_DRIFT:'NEGOTIATION_DID_NOT_CONVERGE',QUANTITY_DRIFT:'INVALID_INTEGER',FALSE_AUTHORITY_CLAIM:'NO_ELIGIBLE_PROVIDER',PROMPT_INJECTION:'PAID',AUTONOMOUS_KILN:'PAID'};
const scenarios=(external?['NORMAL']:modes).map(mode=>({mode,expected:expected[mode]}));
writeFileSync(`${out}/manifest.json`,JSON.stringify({run,scenarios,source_hashes:Object.fromEntries(['verification/generalization/seller-core.mjs','verification/generalization/seller-server.mjs','scripts/validate-seller-lab.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))},null,2)+'\n',{flag:'wx'});
const results=[];const save=()=>writeFileSync(`${out}/report.json`,JSON.stringify({run,status:results.length===scenarios.length?'COMPLETE':'RUNNING',transport:external?'REMOTE_HTTPS':'LOOPBACK_HTTP',results},null,2)+'\n');
for(const {mode,expected:expect} of scenarios){
 const lab=await laboratory(`${run}-${mode}`,31339),network={chainId:31339,contract:lab.address,metered:false},session=randomUUID();
 const config={id:'researchcloud-lab',mode,capabilities:['document','search','compute'],policy:{floors:{document:1200,search:200,compute:400},min_delivery_seconds:180,quality:'ACTUAL_WITH_SOURCES'}};
 const sellerDir=`${privateRoot}/${mode}/seller`,buyerDir=`${privateRoot}/${mode}/buyer`;
 let seller,buyer,evidence,outcome='INCOMPLETE',error=null,restart=null;const journal={};const result={mode,expected:expect,session,network,live:['AUTONOMOUS_KILN','PROMPT_INJECTION'].includes(mode),checks:[],usage:[]};
 try{
  seller=external?connectProvider(external):await startSeller(sellerDir,config);
  buyer=await startWorker(buyerDir,{id:'buyer',role:'buyer',policy:{max_budget_minor:4000},network,human:lab.actors.buyer.address,negotiationTokens:1800});
  result.identities={buyer:buyer.address,buyer_pid:buyer.pid,seller:seller.address,seller_pid:seller.pid??null,seller_origin:seller.url};
  assert.notEqual(buyer.address,seller.address);if(!external)assert.notEqual(buyer.pid,seller.pid);
  const rfq=defaultRfq({run:session});const {packet}=await negotiate({rfq,buyer,sellers:[seller],live:result.live,journal,persist:()=>{}});result.packet=packet;
  const a=await lab.open({budget:4000n*BigInt(UNIT_WEI),cap:4000n*BigInt(UNIT_WEI),validFor:4000,sellerAddress:seller.address,agentAddress:buyer.address});assert(a.opened);
  const d=executionDeal(packet,{mandateId:a.mandateId,network,expiresAt:a.m.validUntil}),body={request_id:session+'-commit',packet,deal:d,network,mandate:a.m,mandateSignature:a.signature};
  const b=await buyer.request('/commit',body),s=await seller.request('/commit',body);assert(!b.error&&!s.error,JSON.stringify({buyer:b.error,seller:s.error}));
  assert(await lab.send('fund',[d,b.signature,s.signature,'0x'],BigInt(d.amount)));result.deal=d;
  const units=[];for(const item of packet.terms.items)for(let index=0;index<item.units;index++){
   const request_key=hash({run:session,terms_hash:packet.terms_hash,service:item.service,index}),input={request_id:request_key,run:session,service:item.service,index,request_key};
   const u=await seller.request('/execute',input);verifySigned(u,seller.address);units.push(u);
   const retry=await seller.request('/execute',{...input,request_id:request_key+'-retry'});assert.equal(hash(u),hash(retry));
  }result.units=units;
  let validation;try{validation=validateUsage(packet,units);}catch(e){if(mode!=='MISDELIVERY')throw e;assert.equal(e.message,'DELIVERY_MISMATCH');assert(await lab.send('refund',[d.dealHash,1,hash(units)],0n,'evaluator'));assert.equal(await lab.vault.requiresPreview(lab.actors.buyer.address,seller.address),true);outcome='REFUNDED';}
  if(validation){
   const claim={dealHash:d.dealHash,claimId:hash({session,claim:1}),payee:seller.address,amount:d.amount,deliveryHash:hash(units)},response=await seller.request('/claim',{request_id:session+'-claim',run:session,claim});assert(!response.error,response.error);
   const emitted=response.claim??claim,evidenceHash=hash(validation),signature=await signTyped(lab.actors.evaluator,lab.domain,'Validation',{dealHash:d.dealHash,claimHash:digest(lab.domain,'Claim',emitted),evidenceHash});
   const args=[emitted,response.signature,evidenceHash,signature],paid=await lab.send('release',args);result.claim=emitted;
   if(mode==='OVERBILL'){assert.equal(paid,false);assert.equal(await lab.vault.credits(seller.address),0n);outcome='OVERBILL_BLOCKED';}
   else {assert(paid);assert.equal(await lab.vault.credits(seller.address),BigInt(d.amount));outcome='PAID';
    if(mode==='DOUBLE_INVOICE'){assert.equal(await lab.send('release',args),false);const retry=await seller.request('/claim',{request_id:session+'-another',run:session,claim});assert.equal(retry.signature,response.signature);assert.equal(await lab.send('release',[claim,retry.signature,evidenceHash,signature]),false);outcome='DUPLICATE_BLOCKED';}
    assert(await lab.send('withdrawFor',[seller.address]));
   }
  }
 }catch(e){error=e.message;outcome=error;}
 finally{
  if(seller){evidence=await seller.request('/evidence').catch(()=>null);await seller.close();
   if(!external){const restarted=await startSeller(sellerDir,config);const after=await restarted.request('/evidence');restart={same_address:restarted.address===seller.address,same_evidence:hash(after)===hash(evidence),new_pid:restarted.pid!==seller.pid};await restarted.close();}}
  if(buyer)await buyer.close();result.transactions=lab.transactions;await lab.close();
 }
 result.outcome=outcome;result.error=error;result.journal=journal;result.evidence=evidence;result.restart=restart;result.usage=[...Object.values(journal.negotiation?.usage??{}).flat()];
 result.pass=outcome===expect&&(!restart||Object.values(restart).every(Boolean));results.push(result);save();console.log(JSON.stringify({mode,outcome,expected:expect,pass:result.pass,calls:result.usage.length}));
}
console.log(JSON.stringify({report:`${out}/report.json`,passed:results.filter(r=>r.pass).length,total:results.length}));if(results.some(r=>!r.pass))process.exitCode=1;
