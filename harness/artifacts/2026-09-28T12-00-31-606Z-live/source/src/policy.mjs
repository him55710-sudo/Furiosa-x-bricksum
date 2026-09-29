import {verifyTypedData} from 'ethers';
import {OFFER_TYPES,sameAddress,uint,nowSeconds,hash,scopeKey,RULE} from '../shared/schema.mjs';
export function checkOffer(session,record,domain,{now=nowSeconds(),includeReserved=true}={}) {
  const reject=reason=>({allowed:false,reason});
  if(session.status!=='ACTIVE')return reject('MANDATE_INACTIVE');
  const m=session.mandate;
  if(now>=Number(m.expiresAt))return reject('DEADLINE_EXPIRED');
  if(!record?.offer||!record.signature)return reject('EVIDENCE_MISSING');
  const o=record.offer;
  try {
    if(hash(Object.keys(o).sort())!==hash(OFFER_TYPES.Offer.map(x=>x.name).sort()))return reject('INVALID_OFFER');
    for(const f of ['quantity','refundHours','subtotal','fee','total','expiresAt'])uint(o[f],'INVALID_OFFER');
    if(o.sessionId!==m.sessionId)return reject('SESSION_MISMATCH');
    if(!session.merchants.some(a=>sameAddress(a,o.merchant)))return reject('MERCHANT_NOT_ALLOWED');
    if(!sameAddress(verifyTypedData(domain,OFFER_TYPES,o,record.signature),o.merchant))return reject('INVALID_OFFER_SIGNATURE');
    if(o.purposeHash!==m.purposeHash||o.skuHash!==m.skuHash)return reject('PURPOSE_MISMATCH');
    if(now>=Number(o.expiresAt))return reject('OFFER_EXPIRED');
    if(BigInt(o.quantity)<BigInt(m.minQuantity)||BigInt(o.refundHours)<BigInt(m.minRefundHours))return reject('SPEC_MISMATCH');
    const total=BigInt(o.total);
    if(total===0n||total!==BigInt(o.subtotal)+BigInt(o.fee))return reject('TOTAL_MISMATCH');
    if(total>BigInt(m.perTxCap))return reject('PER_PURCHASE_LIMIT_EXCEEDED');
    const reserved=includeReserved?BigInt(session.reserved??'0'):0n;
    if(BigInt(session.spent??'0')+reserved+total>BigInt(m.totalCap))return reject('ALL_IN_BUDGET_EXCEEDED');
    return {allowed:true,reason:'WITHIN_APPROVED_SCOPE',amount:o.total};
  }catch{return reject('INVALID_OFFER');}
}
export function reserve(store,sessionId,runId,record,domain) {
  return store.transaction(()=>{
    const s=store.get('session',sessionId),run=store.get('run',runId);
    if(!s||!run||run.sessionId!==sessionId)throw new Error('UNKNOWN_RUN');
    if(run.status!=='RUNNING')throw new Error('DUPLICATE_PAYMENT');
    const duplicate=store.all('run').some(r=>r.id!==runId&&r.sessionId===sessionId&&r.offer?.offer.offerId===record.offer.offerId&&['RESERVED','SUBMISSION_STARTED','UNKNOWN','SETTLED'].includes(r.status));
    if(duplicate)throw new Error('DUPLICATE_PAYMENT');
    const verdict=checkOffer(s,record,domain);
    if(!verdict.allowed)throw new Error(verdict.reason);
    const authorization={policyVersion:'cm-policy-1',at:nowSeconds(),spentBefore:s.spent,reservedBefore:s.reserved,approvedAmount:record.offer.total,reason:verdict.reason};
    s.reserved=(BigInt(s.reserved)+BigInt(record.offer.total)).toString();
    run.status='RESERVED';run.offer=record;run.authorization=authorization;
    store.put('session',sessionId,s);store.put('run',runId,run);
    store.event(sessionId,'BUDGET_RESERVED',authorization,runId);return run;
  });
}
export function startSubmission(store,runId,tx) {
  return store.transaction(()=>{
    const run=store.get('run',runId),s=store.get('session',run.sessionId);
    if(run.status!=='RESERVED'||s.status!=='ACTIVE')throw new Error('STOPPED_BEFORE_SUBMISSION');
    if(nowSeconds()>=Number(s.mandate.expiresAt)||nowSeconds()>=Number(run.offer.offer.expiresAt))throw new Error('DEADLINE_EXPIRED');
    run.status='SUBMISSION_STARTED';run.tx=tx;
    store.put('run',runId,run);store.event(run.sessionId,'SUBMISSION_STARTED',{txHash:tx.hash,nonce:tx.nonce},runId);return run;
  });
}
export function stopLocally(store,sessionId) {
  return store.transaction(()=>{
    const s=store.get('session',sessionId);s.status='STOPPED';
    const pending=[];
    for(const run of store.all('run').filter(r=>r.sessionId===sessionId)){
      if(['SUBMISSION_STARTED','UNKNOWN'].includes(run.status)){pending.push(run.id);continue;}
      if(['QUEUED','RUNNING','RESERVED'].includes(run.status)){
        if(run.status==='RESERVED')s.reserved=(BigInt(s.reserved)-BigInt(run.offer.offer.total)).toString();
        run.status='STOPPED';run.reason='USER_REVOKED';store.put('run',run.id,run);
        store.event(sessionId,'RUN_STOPPED',{reason:'USER_REVOKED'},run.id);
      }
    }
    store.put('session',sessionId,s);store.event(sessionId,'HUMAN_STOP',{submittedRuns:pending});return {session:s,submittedRuns:pending};
  });
}
export function deriveControl(store,session,record,event) {
  if(!session.policy.autoHarden||!['ALL_IN_BUDGET_EXCEEDED','PER_PURCHASE_LIMIT_EXCEEDED'].includes(event.data.reason))return null;
  const merchant=record.offer.merchant;
  const scope=scopeKey(session.mandate.owner,session.policy.purposeId,merchant);
  if(store.get('control',scope))return null;
  const rule={id:hash({scope,sourceEventHash:event.hash}),scope,owner:session.mandate.owner,purpose:session.policy.purposeId,merchant,rule:RULE,sourceSession:session.id,sourceEventHash:event.hash,sourceOffer:record.offer.offerId,createdAt:event.at,status:'ACTIVE',ruleVersion:1};
  store.put('control',scope,rule);store.event(session.id,'CONTROL_ACTIVATED',rule,event.runId);return rule;
}
