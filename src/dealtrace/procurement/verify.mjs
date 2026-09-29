import {readFileSync} from 'node:fs';
import {Contract,Interface,keccak256,TypedDataEncoder,verifyTypedData} from 'ethers';
import {hash,ensure,verifyExecutionSignatures,verifySigned,domainFor,executionTypes,UNIT_WEI} from './protocol.mjs';
import {sellerListHash} from '../vault.mjs';
import {validateUsage} from './work.mjs';

export async function verifyProcurement(report,{provider,trusted,blockTag='finalized'}={}){
 const passed=[],check=(name,value)=>{ensure(value,name);passed.push(name);};
 try{
  ensure(report.plan&&report.units&&report.claims,'EVIDENCE_INCOMPLETE');const n=report.network,p=report.plan,c=report.claims,d=domainFor(n);
  check('DEPLOYMENT_PIN',trusted&&typeof n.metered==='boolean'&&n.chainId===trusted.chainId&&n.contract===trusted.contract&&n.runtimeHash===trusted.runtimeHash&&n.metered===Boolean(trusted.metered));
  check('BILLING_MODE',n.metered===(p.packet.rfq.billing==='SUCCESS_UNITS'));
  verifyExecutionSignatures(report);passed.push('CONVERSATION_AND_BILATERAL_SIGNATURES');
  check('MANDATE_ID',TypedDataEncoder.hash(d,executionTypes('Mandate'),p.mandate)===p.deal.mandateId&&sellerListHash(p.allowed)===p.mandate.sellersHash&&p.allowed.includes(p.deal.seller));
  check('HUMAN_BUDGET',p.mandate.budget===String(BigInt(p.packet.rfq.budget_minor)*BigInt(UNIT_WEI))&&BigInt(p.deal.amount)<=BigInt(p.mandate.maxPerDeal)&&BigInt(p.mandate.maxPerDeal)<=BigInt(p.mandate.budget));
  for(const unit of report.units)verifySigned(unit,p.deal.seller);passed.push('SIGNED_USAGE');
  const validation=validateUsage(p.packet,report.units);check('RECOMPUTED_DELIVERY_AND_BILL',hash(validation)===hash(report.validation)&&hash(validation)===report.evidence_hash);
  const amount=n.metered?BigInt(validation.amount_minor)*BigInt(UNIT_WEI):BigInt(p.deal.amount),refund=BigInt(p.deal.amount)-amount;
  check('FIXED_COMPLETENESS',n.metered||validation.failed===0);
  check('CLAIM_BOUND_TO_USAGE',c.correct.dealHash===p.deal.dealHash&&c.correct.payee===p.deal.seller&&c.correct.amount===String(amount)&&c.correct.deliveryHash===hash(report.units));
  check('EXPORTED_TOTALS',report.paid_wei===String(amount)&&report.refunded_wei===String(refund));
  for(const kind of ['correct','bad']){
   check(kind+':SELLER_CLAIM',verifyTypedData(d,executionTypes('Claim'),c[kind],c[kind+'Signature'])===p.deal.seller);
   const v={dealHash:p.deal.dealHash,claimHash:TypedDataEncoder.hash(d,executionTypes('Claim'),c[kind]),evidenceHash:report.evidence_hash};
   check(kind+':EVALUATOR_SIGNATURE',verifyTypedData(d,executionTypes('Validation'),v,kind==='correct'?c.validationSignature:c.badValidationSignature)===p.mandate.evaluator);
  }
  if(!provider)return {verdict:'INCOMPLETE',reason:'CHAIN_NOT_QUERIED',passed,checks:passed.length};
  const artifact=JSON.parse(readFileSync(n.metered?'artifacts/dealtrace/metered-vault/contract.json':'artifacts/dealtrace/vault/contract.json','utf8'));
  check('SOURCE_PROFILE',n.sourceSha256===artifact.sourceSha256);check('CHAIN_ID',Number((await provider.getNetwork()).chainId)===n.chainId);
  const boundary=await provider.getBlock(blockTag);ensure(boundary,'FINALITY_UNAVAILABLE');ensure(report.transactions.every(t=>t.block<=boundary.number),'FINALITY_PENDING');
  check('RUNTIME_CODE',keccak256(await provider.getCode(n.contract,boundary.number))===trusted.runtimeHash);
  const iface=new Interface(artifact.abi),contract=new Contract(n.contract,artifact.abi,provider),expected=new Map(),seen=new Map();
  const expect=(label,name,args,value='0',status=1)=>expected.set(label,{input:iface.encodeFunctionData(name,args),value:String(value),status});
  expect('open-mandate','openMandate',[p.mandate,p.allowed,p.mandateSignature]);
  expect('fund',n.metered?'fundMetered':'fund',n.metered?[p.deal,p.buyerSignature,p.sellerSignature,'0x',p.lines,p.buyerMeterSignature,p.sellerMeterSignature]:[p.deal,p.buyerSignature,p.sellerSignature,'0x'],p.deal.amount);
  const args=(claim,sig,vsig)=>[claim,sig,report.evidence_hash,vsig,...(n.metered?[p.lines,validation.counts]:[])];
  if(c.bad.amount!==c.correct.amount)expect('overbill-blocked',n.metered?'settleMetered':'release',args(c.bad,c.badSignature,c.badValidationSignature),'0',0);
  expect('settle',n.metered?'settleMetered':'release',args(c.correct,c.correctSignature,c.validationSignature));
  if(amount>0n)expect('withdraw-seller','withdrawFor',[p.deal.seller]);if(refund>0n)expect('withdraw-unused','withdrawFor',[p.mandate.buyer]);
  for(const item of report.transactions){
   check('UNIQUE_TX_LABEL_'+item.label,!seen.has(item.label));const receipt=await provider.getTransactionReceipt(item.tx_hash),tx=await provider.getTransaction(item.tx_hash);ensure(receipt&&tx,'TRANSACTION_UNAVAILABLE');ensure(receipt.blockNumber<=boundary.number,'FINALITY_PENDING');const block=await provider.getBlock(receipt.blockNumber);
   check(item.label+':CANONICAL',receipt.blockHash===block.hash&&item.block_hash===block.hash&&item.block===receipt.blockNumber);
   if(item.label==='deploy')check('DEPLOYMENT',receipt.contractAddress===n.contract&&receipt.status===1&&tx.data===artifact.bytecode&&tx.to===null);
   else{const e=expected.get(item.label);check(item.label+':EXACT_CALL',!!e&&tx.to===n.contract&&tx.data===e.input&&String(tx.value)===e.value&&receipt.status===e.status);}
   check(item.label+':EXPORT_MATCH',item.status===receipt.status&&item.from===tx.from&&item.to===tx.to&&item.input===tx.data&&item.value===String(tx.value));
   seen.set(item.label,{receipt,block,logs:receipt.logs.filter(l=>l.address.toLowerCase()===n.contract.toLowerCase()).map(l=>iface.parseLog(l)).filter(Boolean)});
  }
  check('REQUIRED_TRANSACTIONS',[...expected.keys()].every(k=>seen.has(k)));
  const event=(label,name)=>{const logs=seen.get(label).logs.filter(l=>l.name===name);ensure(logs.length===1,'EVENT_'+name);return logs[0].args;};
  const funded=event('fund','Funded');check('LOCKED_AGREEMENT',funded.dealHash===p.deal.dealHash&&String(funded.amount)===p.deal.amount&&funded.termsHash===hash(p.packet)&&Number(funded.deadline)===seen.get('fund').block.timestamp+p.deal.deliveryWindow);
  check('FULL_DELIVERY_WINDOW',Number(funded.deadline)<=p.deal.expiresAt&&p.deal.expiresAt<=p.mandate.validUntil);
  if(seen.has('overbill-blocked')){check('OVERBILL_NO_LOGS',seen.get('overbill-blocked').receipt.logs.length===0);check('ATTACK_BEFORE_SETTLEMENT',seen.get('overbill-blocked').block.number<seen.get('settle').block.number);}
  const settled=event('settle',n.metered?'MeteredSettled':'Released');check('SETTLEMENT_EVIDENCE',settled.dealHash===p.deal.dealHash&&settled.claimHash===TypedDataEncoder.hash(d,executionTypes('Claim'),c.correct)&&settled.evidenceHash===report.evidence_hash&&(n.metered?settled.usageHash:settled.deliveryHash)===hash(report.units));
  check('EXACT_SETTLEMENT',n.metered?settled.paid===amount&&settled.refunded===refund:settled.amount===amount);
  for(const [label,who,value] of [['withdraw-seller',p.deal.seller,amount],['withdraw-unused',p.mandate.buyer,refund]])if(value>0n){const e=event(label,'Withdrawn');check(label+':ACTUAL_TRANSFER',e.beneficiary===who&&e.destination===who&&e.amount===value);}
  const state=await contract.escrows(p.deal.dealHash,{blockTag:boundary.number});check('FINAL_ESCROW',state.status===2n&&state.seller===p.deal.seller&&String(state.amount)===p.deal.amount&&state.termsHash===hash(p.packet));
  check('STABLE_BOUNDARY',(await provider.getBlock(boundary.number)).hash===boundary.hash);
  return {verdict:'VALID',scope:'NEGOTIATED_PROCUREMENT_TO_WITHDRAWAL',checked_at:new Date().toISOString(),block_tag:blockTag,block:boundary.number,block_hash:boundary.hash,checks:passed.length,passed,private_keys_required:false,model_calls:0};
 }catch(e){return {verdict:/INCOMPLETE|FINALITY|UNAVAILABLE|network|timeout|missing response|ECONN|fetch failed/i.test(e.message)?'INCOMPLETE':'INVALID',reason:e.message,checks:passed.length,passed};}
}
