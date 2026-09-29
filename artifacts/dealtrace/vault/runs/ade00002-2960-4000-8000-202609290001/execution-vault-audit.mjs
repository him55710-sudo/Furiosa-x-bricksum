import {readFileSync} from 'node:fs';
import {Contract,Interface,keccak256,verifyTypedData} from 'ethers';
import {hash,ensure} from '../deal-escrow/domain.ts';
import {validateDelivery} from '../deal-escrow/delivery.ts';
import {compileVaultDeal,digest,sellerListHash,types,vaultDomain} from './vault.mjs';

// This verifier is deliberately scoped to the published adversarial v2 scenario.
// It checks inputs, canonical receipt logs and state using an independently pinned vault.
export async function verifyVaultProof(report,{provider,trusted,blockTag='finalized'}){
 const checks=[];const check=(name,condition)=>{ensure(condition,name);checks.push(name);};
 try{
  const artifact=JSON.parse(readFileSync('artifacts/dealtrace/vault/contract.json','utf8'));
  const {network:n,plan,domain}=report;
  check('TRUSTED_DEPLOYMENT',n.chainId===trusted.chainId&&n.contract===trusted.contract&&n.runtimeHash===trusted.runtimeHash&&n.sourceSha256===artifact.sourceSha256);
  check('CHAIN_AND_DOMAIN',Number((await provider.getNetwork()).chainId)===n.chainId&&hash(domain)===hash(vaultDomain(n.chainId,n.contract)));
  const boundary=await provider.getBlock(blockTag);ensure(boundary,'FINALITY_UNAVAILABLE');
  check('CONTRACT_CODE',keccak256(await provider.getCode(n.contract,boundary.number))===trusted.runtimeHash);
  const vault=new Contract(n.contract,artifact.abi,provider),iface=new Interface(artifact.abi),expected=new Map();
  const expect=(label,method,args,status=1,value='0',sender=null)=>expected.set(label,{data:iface.encodeFunctionData(method,args),status,value:String(value),sender});
  const {success:s,failure:f,repeat:r}=plan;
  for(const c of [s,f,r]){
   check(`${c.name}:MANDATE`,digest(domain,'Mandate',c.mandate)===c.mandateId&&sellerListHash(c.allowed)===c.mandate.sellersHash&&verifyTypedData(domain,{Mandate:types.Mandate},c.mandate,c.mandateSignature)===c.mandate.buyer);
   check(`${c.name}:COMPILED_AGREEMENT`,hash(compileVaultDeal(c.packet,{mandateId:c.mandateId,seller:c.deal.seller,unitWei:n.unitWei,domain}))===hash(c.deal));
   check(`${c.name}:BILATERAL_SIGNATURES`,verifyTypedData(domain,{Deal:types.Deal},c.deal,c.agentSignature)===c.mandate.agent&&verifyTypedData(domain,{Deal:types.Deal},c.deal,c.sellerSignature)===c.deal.seller);
   check(`${c.name}:SOURCE_MANIFEST`,hash(plan.source_manifest)===c.packet.revisions.at(-1).deal.assurance.source_manifest_hash);
   expect(`open-${c.name}`,'openMandate',[c.mandate,c.allowed,c.mandateSignature]);
  }
  check('40_26_31_CASE',s.mandate.budget===String(4000n*BigInt(n.unitWei))&&s.deal.amount===String(2600n*BigInt(n.unitWei))&&s.badClaim.amount===String(3100n*BigInt(n.unitWei)));
  check('GENUINELY_SIGNED_OVERBILL',verifyTypedData(domain,{Claim:types.Claim},s.badClaim,s.badClaimSignature)===s.deal.seller&&verifyTypedData(domain,{Validation:types.Validation},{dealHash:s.deal.dealHash,claimHash:digest(domain,'Claim',s.badClaim),evidenceHash:s.evidenceHash},s.badValidationSignature)===s.mandate.evaluator);
  for(const c of [s,f]){
   expect(`fund-${c.name}`,'fund',[c.deal,c.agentSignature,c.sellerSignature,'0x'],1,c.deal.amount);
   const validation=validateDelivery(c.delivery,c.packet.revisions.at(-1).deal.requirements,c.validation.submitted_at,c.validation.deadline);
   check(`${c.name}:DELIVERY_VALIDATION`,c.validation_finalized===true&&hash(validation)===hash(c.validation)&&hash(validation)===c.evidenceHash&&validation.verified===(c===s));
   check(`${c.name}:CLAIM_BINDING`,c.goodClaim.deliveryHash===hash(c.delivery)&&c.goodClaim.dealHash===c.deal.dealHash&&c.goodClaim.amount===c.deal.amount&&c.goodClaim.payee===c.deal.seller);
  }
  expect('attack-overbill','release',[s.badClaim,s.badClaimSignature,s.evidenceHash,s.badValidationSignature],0);
  expect('release-success','release',[s.goodClaim,s.goodClaimSignature,s.evidenceHash,s.validationSignature]);
  expect('withdraw-seller','withdrawFor',[s.deal.seller]);
  expect('refund-failure','refund',[f.deal.dealHash,1,f.evidenceHash],1,'0',f.mandate.evaluator);
  expect('withdraw-buyer','withdrawFor',[f.mandate.buyer]);
  expect('attack-preview','fund',[r.deal,r.agentSignature,r.sellerSignature,'0x'],0,r.deal.amount);
  expect('revoke-repeat','revoke',[r.mandateId],1,'0',r.mandate.buyer);
  expect('attack-revoked','fund',[r.deal,r.agentSignature,r.sellerSignature,'0x'],0,r.deal.amount);
  check('TRANSACTION_SET',report.transactions.length===expected.size+1&&new Set(report.transactions.map(t=>t.label)).size===expected.size+1);
  const receipts=new Map();
  for(const item of report.transactions){
   const receipt=await provider.getTransactionReceipt(item.tx_hash),tx=await provider.getTransaction(item.tx_hash);
   ensure(receipt&&tx,'TRANSACTION_UNAVAILABLE');ensure(receipt.blockNumber<=boundary.number,'FINALITY_PENDING');
   const block=await provider.getBlock(receipt.blockNumber);check(`${item.label}:CANONICAL`,block.hash===receipt.blockHash&&receipt.blockHash===item.block_hash&&receipt.blockNumber===item.block);
   if(item.label==='deploy')check('DEPLOYMENT_TRANSACTION',receipt.status===1&&receipt.contractAddress===trusted.contract&&tx.data===artifact.bytecode&&tx.to===null);
   else{const e=expected.get(item.label);check(`${item.label}:EXACT_INTENT`,!!e&&tx.to===trusted.contract&&tx.data===e.data&&String(tx.value)===e.value&&receipt.status===e.status&&(!e.sender||tx.from===e.sender));}
   check(`${item.label}:EXPORTED_TRANSACTION`,item.status===receipt.status&&item.input===tx.data&&item.from===tx.from&&item.to===tx.to&&item.value===String(tx.value));
   receipts.set(item.label,{receipt,block,logs:receipt.logs.filter(l=>l.address.toLowerCase()===trusted.contract.toLowerCase()).map(l=>iface.parseLog(l)).filter(Boolean)});
  }
  // Named events are required; a status=1 receipt alone never proves payment.
  const event=(label,name)=>{const matches=receipts.get(label).logs.filter(l=>l.name===name);ensure(matches.length===1,'REQUIRED_EVENT_'+label);return matches[0].args;};
  for(const c of [s,f]){const a=event(`fund-${c.name}`,'Funded'),block=receipts.get(`fund-${c.name}`).block;check(`${c.name}:FUNDED_EVENT`,a.dealHash===c.deal.dealHash&&String(a.amount)===c.deal.amount&&a.termsHash===c.deal.termsHash&&Number(a.deadline)===block.timestamp+c.deal.deliveryWindow);check(`${c.name}:DELIVERY_AFTER_FUNDING`,c.validation.submitted_at>=block.timestamp&&c.validation.deadline===Number(a.deadline)&&c.validation.submitted_at<c.validation.deadline);}
  const paid=event('release-success','Released');check('EXACT_CLAIM_RELEASE',paid.dealHash===s.deal.dealHash&&paid.claimHash===digest(domain,'Claim',s.goodClaim)&&paid.evidenceHash===s.evidenceHash&&paid.deliveryHash===hash(s.delivery)&&String(paid.amount)===s.deal.amount);
  for(const [label,who,amount] of [['withdraw-seller',s.deal.seller,s.deal.amount],['withdraw-buyer',f.mandate.buyer,f.deal.amount]]){const a=event(label,'Withdrawn');check(label+':TRANSFER',a.beneficiary===who&&a.destination===who&&String(a.amount)===amount);}
  const refund=event('refund-failure','Refunded');check('REFUND_AND_MEMORY_EVENT',refund.dealHash===f.deal.dealHash&&refund.reason===1n&&refund.evidenceHash===f.evidenceHash&&event('refund-failure','PreviewRequired').triggerDeal===f.deal.dealHash);
  for(const label of ['attack-overbill','attack-preview','attack-revoked'])check(label+':NO_EVENT',receipts.get(label).receipt.logs.length===0);
  for(const [label,reason] of [['attack-overbill','CLAIM_MISMATCH'],['attack-preview','PREVIEW_REQUIRED'],['attack-revoked','AUTHORITY_INACTIVE']]){
   const input=report.transactions.find(t=>t.label===label);let observed=null;
   try{await provider.call({to:trusted.contract,from:input.from,data:input.input,value:BigInt(input.value),blockTag:input.block});}catch(error){observed=error.reason??error.info?.error?.message??error.shortMessage;}
   check(label+':HISTORICAL_REVERT_REASON',typeof observed==='string'&&observed.includes(reason));
  }
  check('ATTACK_ORDER',receipts.get('attack-overbill').block.number<receipts.get('release-success').block.number&&receipts.get('refund-failure').block.number<receipts.get('attack-preview').block.number&&receipts.get('attack-preview').block.number<receipts.get('revoke-repeat').block.number&&receipts.get('revoke-repeat').block.number<receipts.get('attack-revoked').block.number);
  const state=await Promise.all([vault.escrows(s.deal.dealHash,{blockTag:boundary.number}),vault.escrows(f.deal.dealHash,{blockTag:boundary.number}),vault.escrows(r.deal.dealHash,{blockTag:boundary.number})]);
  check('TERMINAL_STATES',state[0].status===2n&&state[1].status===3n&&state[2].status===0n);
  check('PERSISTENT_MEMORY_AND_REVOCATION',await vault.requiresPreview(f.mandate.buyer,f.deal.seller,{blockTag:boundary.number})&&(await vault.mandates(r.mandateId,{blockTag:boundary.number})).revoked);
  const locked=await vault.totalLocked({blockTag:boundary.number}),credits=await vault.totalCredits({blockTag:boundary.number}),balance=await provider.getBalance(trusted.contract,boundary.number);
  check('SOLVENCY_AND_NO_STRANDED_DEMO_FUNDS',locked===0n&&credits===0n&&balance>=locked+credits);
  // Freeze the boundary hash too, so a changing RPC view cannot silently pass.
  check('STABLE_BOUNDARY',(await provider.getBlock(boundary.number)).hash===boundary.hash);
  return {verdict:'VALID',scope:'V2_AUTHORITY_CLAIM_MEMORY_WITHDRAWAL',checked_at:new Date().toISOString(),block_tag:blockTag,block:boundary.number,block_hash:boundary.hash,checks:checks.length,passed:checks,model_calls:0,private_keys_required:false};
 }catch(error){return {verdict:/FINALITY|UNAVAILABLE|network|timeout|missing response|ECONN|fetch failed/i.test(error.message)?'INCOMPLETE':'INVALID',reason:error.message,checks:checks.length,passed:checks};}
}
