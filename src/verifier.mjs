import {Contract,Interface,TypedDataEncoder,verifyTypedData,keccak256} from 'ethers';
import {hash,MANDATE_TYPES,OFFER_TYPES,merchantsHash,sameAddress,scopeKey,RULE} from '../shared/schema.mjs';
import {checkOffer} from './policy.mjs';

function controlProvenance(bundle){
  const controls=bundle.run.controls??[],sources=bundle.controlSources;
  if(!controls.length)return null;
  if(!Array.isArray(sources))return {status:'INCOMPLETE',reason:'CONTROL_SOURCE_MISSING'};
  for(const c of controls){
    const source=sources.find(x=>x.controlId===c.id),s=source?.session;
    if(!s?.mandate||!s.signature||!source.offer||!Array.isArray(source.events))return {status:'INCOMPLETE',reason:'CONTROL_SOURCE_MISSING'};
    const scope=scopeKey(bundle.session.mandate.owner,bundle.session.policy.purposeId,c.merchant);
    if(c.scope!==scope||c.id!==hash({scope,sourceEventHash:c.sourceEventHash})||c.rule!==RULE||c.ruleVersion!==1||c.status!=='ACTIVE'||!sameAddress(c.owner,s.mandate.owner)||!sameAddress(c.owner,bundle.session.mandate.owner)||c.purpose!==s.policy.purposeId||c.purpose!==bundle.session.policy.purposeId||s.id!==c.sourceSession||s.mandate.sessionId!==s.id)return {status:'INVALID',reason:'CONTROL_SCOPE_MISMATCH'};
    if(!s.policy.autoHarden||!sameAddress(verifyTypedData(bundle.domain,MANDATE_TYPES,s.mandate,s.signature),s.mandate.owner)||hash(s.policy)!==s.mandate.policyHash||merchantsHash(s.merchants)!==s.mandate.merchantsHash)return {status:'INVALID',reason:'CONTROL_SOURCE_APPROVAL'};
    let previous=null;
    for(const [i,{hash:h,...event}] of source.events.entries()){
      if(event.seq!==i+1||event.prevHash!==previous||event.sessionId!==s.id||hash(event)!==h)return {status:'INVALID',reason:'CONTROL_SOURCE_HISTORY_CHANGED'};
      previous=h;
    }
    const event=source.events.find(e=>e.hash===c.sourceEventHash),o=source.offer.offer;
    if(!event?.data?.policyContext&&event?.data?.reason!=='PER_PURCHASE_LIMIT_EXCEEDED')return {status:'INCOMPLETE',reason:'CONTROL_SOURCE_CONTEXT_MISSING'};
    if(event.type!=='POLICY_BLOCKED'||event.runId!==source.runId||event.at!==c.createdAt||event.data.offerId!==c.sourceOffer||o.offerId!==c.sourceOffer||!sameAddress(o.merchant,c.merchant)||event.data.amount!==o.total||!['ALL_IN_BUDGET_EXCEEDED','PER_PURCHASE_LIMIT_EXCEEDED'].includes(event.data.reason))return {status:'INVALID',reason:'CONTROL_SOURCE_EVENT_MISMATCH'};
    // Earlier receipts have no accounting context. A signed per-purchase cap is
    // independently sufficient to prove this one rejection, even with zero prior
    // spending. Never infer historical balances for a cumulative-budget failure.
    const context=event.data.policyContext??{spent:'0',reserved:'0',at:Math.floor(Date.parse(event.at)/1000)};
    if(!Number.isSafeInteger(context.at))return {status:'INVALID',reason:'CONTROL_SOURCE_TIME'};
    const verdict=checkOffer({...s,status:'ACTIVE',spent:context.spent,reserved:context.reserved},source.offer,bundle.domain,{now:context.at});
    if(verdict.allowed||verdict.reason!==event.data.reason)return {status:'INVALID',reason:'CONTROL_SOURCE_NOT_REPRODUCIBLE'};
  }
  return null;
}

/** Chain configuration is trusted input from the reviewer, never selected by an uploaded bundle. */
export async function verifyBundle(bundle,{provider,deployment,abi}={}){
  const checks=[];let observedSession=null;
  const result=(status,reason)=>({status,reason,checks,observedSession,unverifiedFields:['session.spent','session.reserved','session.status',...(bundle?.run?.controls?.length?['controlSources[].events occurrence and completeness','controlSources[].events[].data.policyContext historical balances']:[])],scope:'Approval, signed offer, policy and observed devnet settlement consistency. Control source checks prove signatures, scope and internal reproducibility, not the occurrence/completeness of unanchored events or historical reservations. Mutable session summaries are unverified; observedSession is reconstructed from the chain at the stated block. Not delivery or NPU energy.'});
  const ok=name=>checks.push({name,status:'PASS'});
  try{
    if(bundle?.schemaVersion!==1||!bundle.session?.mandate||!bundle.domain||!bundle.run||!Array.isArray(bundle.events))return result('INCOMPLETE','REQUIRED_RECORD_MISSING');
    const {session:s,run:r,domain}=bundle,m=s.mandate;
    if(m.sessionId!==s.id||r.sessionId!==s.id)return result('INVALID','SESSION_MISMATCH');
    if(!s.signature||!Array.isArray(s.merchants)||!s.policy)return result('INCOMPLETE','APPROVAL_MISSING');
    if(!sameAddress(verifyTypedData(domain,MANDATE_TYPES,m,s.signature),m.owner))return result('INVALID','OWNER_SIGNATURE');
    if(hash(s.policy)!==m.policyHash||merchantsHash(s.merchants)!==m.merchantsHash)return result('INVALID','APPROVAL_BINDING');ok('사람의 서명과 승인 범위');
    let previous=null;
    for(let i=0;i<bundle.events.length;i++){
      const {hash:eventHash,...event}=bundle.events[i];
      if(event.seq!==i+1||event.prevHash!==previous||event.sessionId!==s.id||hash(event)!==eventHash)return result('INVALID','EVENT_CHAIN_BROKEN');previous=eventHash;
    }
    if(bundle.events[0]?.type!=='APPROVAL_REQUESTED'||!bundle.events.some(e=>e.type==='HUMAN_APPROVED'))return result('INCOMPLETE','APPROVAL_HISTORY_MISSING');ok('이벤트 순서와 해시 연결');
    if(r.paymentKey!==hash({runId:r.id,purpose:'one-payment'}))return result('INVALID','PAYMENT_KEY_BINDING');
    if(r.status==='SETTLED'){
      const p=bundle.preEvidence;if(!p||!r.receipt||!r.offer||!r.authorization)return result('INCOMPLETE','SETTLEMENT_RECORD_MISSING');
      if(hash(p)!==r.evidenceHash)return result('INVALID','ANCHORED_EVIDENCE_CHANGED');
      if(hash(p.domain)!==hash(domain)||hash(p.controls)!==hash(r.controls))return result('INVALID','EVIDENCE_BINDING');
      if(p.runId!==r.id||p.paymentKey!==r.paymentKey||hash(p.session.mandate)!==hash(m)||p.session.signature!==s.signature||hash(p.session.policy)!==hash(s.policy)||hash(p.session.merchants)!==hash(s.merchants)||hash(p.offer)!==hash(r.offer)||hash(p.authorization)!==hash(r.authorization)||hash(p.usage)!==hash(r.usage)||hash(p.proposal)!==hash(r.proposal))return result('INVALID','EVIDENCE_BINDING');
      if(!Array.isArray(p.events)||!p.events.length||p.events.length>bundle.events.length||hash(p.events)!==hash(bundle.events.slice(0,p.events.length)))return result('INVALID','ANCHORED_HISTORY_CHANGED');
      if(!bundle.events.some(e=>e.runId===r.id&&e.type==='PAYMENT_CONFIRMED'&&e.data.txHash===r.receipt.hash))return result('INCOMPLETE','TERMINAL_HISTORY_MISSING');
      const verdict=checkOffer({...s,status:'ACTIVE',spent:r.authorization.spentBefore,reserved:r.authorization.reservedBefore},r.offer,domain,{now:r.authorization.at});
      if(!verdict.allowed)return result('INVALID',verdict.reason);ok('서명된 견적과 수수료 포함 한도');ok('결제 전 증빙 묶음');
    }else if(!['STOPPED','REVIEW_REQUIRED'].includes(r.status))return result('INCOMPLETE','RUN_NOT_FINAL');
    else if(!bundle.events.some(e=>e.runId===r.id&&['POLICY_BLOCKED','RUN_STOPPED'].includes(e.type)&&e.data.reason===r.reason))return result('INCOMPLETE','STOP_REASON_MISSING');
    const sourceProblem=controlProvenance(bundle);if(sourceProblem)return result(sourceProblem.status,sourceProblem.reason);
    if(r.controls?.length)ok('제공된 통제 기록의 서명·범위·내부 재현성');
    if(!provider||!deployment||!abi)return result('INCOMPLETE','TRUSTED_CHAIN_CONNECTION_REQUIRED');
    if(Number((await provider.getNetwork()).chainId)!==deployment.chainId||Number(domain.chainId)!==deployment.chainId||!sameAddress(domain.verifyingContract,deployment.vault))return result('INVALID','CHAIN_DOMAIN_MISMATCH');
    if(keccak256(await provider.getCode(deployment.vault))!==deployment.vaultCodeHash||keccak256(await provider.getCode(deployment.token))!==deployment.tokenCodeHash)return result('INVALID','DEPLOYED_CODE_MISMATCH');
    const iface=new Interface(abi),vault=new Contract(deployment.vault,abi,provider);
    const observedBlock=await provider.getBlock('latest');if(!observedBlock)return result('INCOMPLETE','BLOCK_NOT_FOUND');
    observedSession={asOfBlock:observedBlock.number,blockHash:observedBlock.hash,spent:(await vault.spent(s.id,{blockTag:observedBlock.number})).toString(),active:await vault.active(s.id,{blockTag:observedBlock.number}),reserved:null};
    const logs=await provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:observedBlock.number,topics:[null,s.id]});
    const parsed=logs.map(log=>({log,event:iface.parseLog(log)})).filter(x=>x.event);
    const approvals=parsed.filter(x=>x.event.name==='MandateCreated');
    if(approvals.length!==1)return result('INCOMPLETE','CHAIN_APPROVAL_NOT_FOUND');
    if(!sameAddress(approvals[0].event.args.owner,m.owner)||approvals[0].event.args.mandateDigest!==TypedDataEncoder.hash(domain,MANDATE_TYPES,m))return result('INVALID','CHAIN_APPROVAL_MISMATCH');
    for(const source of bundle.controlSources??[]){
      if(!(r.controls??[]).some(c=>c.id===source.controlId))continue;
      const sourceLogs=await provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:observedBlock.number,topics:[iface.getEvent('MandateCreated').topicHash,source.session.id]});
      if(sourceLogs.length!==1||iface.parseLog(sourceLogs[0]).args.mandateDigest!==TypedDataEncoder.hash(domain,MANDATE_TYPES,source.session.mandate))return result('INVALID','CONTROL_SOURCE_CHAIN_APPROVAL');
    }
    ok('체인 승인 및 배포 코드');
    if(r.status==='SETTLED'){
      const receipt=await provider.getTransactionReceipt(r.receipt.hash);if(!receipt)return result('INCOMPLETE','RECEIPT_NOT_FOUND');
      if(receipt.status!==1||receipt.blockHash!==r.receipt.blockHash)return result('INVALID','RECEIPT_MISMATCH');
      const match=parsed.filter(x=>x.event.name==='Payment'&&x.event.args.paymentKey===r.paymentKey);
      if(match.length!==1||match[0].log.transactionHash!==receipt.hash)return result('INVALID','PAYMENT_EVENT_MISMATCH');
      const payment=match[0],a=payment.event.args,o=r.offer.offer;
      const offerDigest=TypedDataEncoder.hash(domain,OFFER_TYPES,o);
      if(a.offerDigest!==offerDigest||a.evidenceHash!==r.evidenceHash||a.amount.toString()!==o.total||!sameAddress(a.merchant,o.merchant))return result('INVALID','ONCHAIN_EVIDENCE_MISMATCH');
      const before=parsed.filter(x=>x.log.blockNumber<payment.log.blockNumber||(x.log.blockNumber===payment.log.blockNumber&&x.log.index<payment.log.index));
      if(before.some(x=>x.event.name==='Revoked'))return result('INVALID','PAYMENT_AFTER_REVOCATION');
      const priorSpent=before.filter(x=>x.event.name==='Payment').reduce((n,x)=>n+x.event.args.amount,0n);
      if(priorSpent.toString()!==r.authorization.spentBefore||priorSpent+BigInt(o.total)>BigInt(m.totalCap)||a.cumulativeSpent!==priorSpent+BigInt(o.total))return result('INVALID','CUMULATIVE_BUDGET_MISMATCH');
      const block=await provider.getBlock(receipt.blockNumber);if(!block)return result('INCOMPLETE','BLOCK_NOT_FOUND');
      if(block.timestamp>=Number(m.expiresAt)||block.timestamp>=Number(o.expiresAt))return result('INVALID','CHAIN_DEADLINE_EXPIRED');
      const tokenIface=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
      const transfers=receipt.logs.filter(l=>sameAddress(l.address,deployment.token)).map(l=>{try{return tokenIface.parseLog(l);}catch{return null;}});
      if(!transfers.some(t=>t&&sameAddress(t.args.from,deployment.vault)&&sameAddress(t.args.to,o.merchant)&&t.args.value===BigInt(o.total)))return result('INVALID','TOKEN_TRANSFER_MISSING');
      if(!await vault.usedPayments(r.paymentKey))return result('INVALID','PAYMENT_KEY_NOT_CONSUMED');
      ok('누적 지출·취소·기한을 체인에서 재구성');ok('실제 토큰 이동과 증빙 해시');
    }else{
      if(parsed.some(x=>x.event.name==='Payment'&&x.event.args.paymentKey===r.paymentKey))return result('INVALID','STOPPED_RUN_HAS_PAYMENT');ok('중지된 시도의 온체인 결제 없음');
    }
    return result('VALID',r.status==='SETTLED'?'PAYMENT_WITHIN_SIGNED_APPROVAL':'STOP_RECORDED_NO_PAYMENT');
  }catch(e){
    if(['NETWORK_ERROR','SERVER_ERROR','TIMEOUT','UNKNOWN_ERROR'].includes(e?.code))return result('INCOMPLETE','CHAIN_UNAVAILABLE');
    return result('INVALID','MALFORMED_OR_INVALID_EVIDENCE');
  }
}
