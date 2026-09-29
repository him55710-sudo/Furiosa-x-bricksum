import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const input=process.argv[2];if(!input)throw new Error('REPORT_PATH_REQUIRED');
const bytes=await readFile(input),report=JSON.parse(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
const normal=report.rows.filter(r=>r.expectedPayable),success=r=>r.status==='AUTHORIZED_SIMULATION';
const b1=normal.filter(r=>r.arm==='B1'),cm=new Map(normal.filter(r=>r.arm==='CM').map(r=>[r.caseId,r]));
const failures=b1.filter(r=>!success(r)).map(r=>{
  const last=r.steps.at(-1),accepted=r.quotes.find(q=>q.offer.offerId===last?.action?.args?.offer_id)?.offer;
  const finalBlocked=r.status==='BLOCKED'&&last?.action?.name==='accept_offer';
  const latest=new Map(r.quotes.map(q=>[q.offer.merchant,q.offer]));
  const validAlternatives=[...latest.values()].filter(o=>o.merchant!==accepted?.merchant&&BigInt(o.total)>0n&&BigInt(o.total)<=BigInt(r.mandate.perTxCap)&&o.purposeHash===r.mandate.purposeHash&&o.skuHash===r.mandate.skuHash&&BigInt(o.quantity)>=BigInt(r.mandate.minQuantity)&&BigInt(o.refundHours)>=BigInt(r.mandate.minRefundHours));
  return {caseId:r.caseId,family:r.family,status:r.status,reason:r.reason,turnsUsed:r.steps.length,remainingTurnBudget:5-r.steps.length,
    category:!r.steps.length&&r.events.some(e=>e.type==='EARLY_GATE_BLOCK'&&e.data.reason==='ALL_IN_PRICE_REQUIRED')?'UPFRONT_QUOTE_FRICTION':r.status==='REJECTED'?'MODEL_REJECTION':finalBlocked?'FINAL_POLICY_BLOCK':'OTHER',
    finalBlocked,alternativeSellerCandidateCount:finalBlocked?validAlternatives.length:0,
    finalBlockedWithAlternativeAndTurns:finalBlocked&&validAlternatives.length>0&&r.steps.length<5,
    sameSellerNegotiationCouldBeRetried:finalBlocked&&r.family==='negotiation'&&r.steps.length<5,
    cmStatus:cm.get(r.caseId)?.status};
});
const ids=predicate=>b1.filter(r=>predicate(success(r),success(cm.get(r.caseId)))).map(r=>r.caseId);
const result={review:'GROK-HARNESS-R2-H3',exploratory:true,parent:path.basename(input),parentSha256:sha(bytes),sourceSha256:sha(await readFile(fileURLToPath(import.meta.url))),
  normalPairs:b1.length,bothSuccess:ids((b,c)=>b&&c),cmOnlySuccess:ids((b,c)=>!b&&c),b1OnlySuccess:ids((b,c)=>b&&!c),bothFail:ids((b,c)=>!b&&!c),
  categories:Object.fromEntries([...new Set(failures.map(r=>r.category))].map(c=>[c,failures.filter(r=>r.category===c).length])),failures,
  boundaries:['All arms use maxTurns=5 and terminate on final policy rejection; no arm has a post-block retry path.','Ten B1 late-quote failures are deliberately defined gate friction, not lack of learned intelligence.','Alternative seller count is a structured quote candidate count, not a new signature or expiry verification. In this run the only final-block normal failure has no other seller.','A same-seller counter after case-097 could be attempted with remaining turns, but no counterfactual success was measured.']};
await writeFile(path.join(path.dirname(input),'review-analysis.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({normalPairs:result.normalPairs,categories:result.categories,cmOnly:result.cmOnlySuccess,b1Only:result.b1OnlySuccess,bothSuccess:result.bothSuccess.length,bothFail:result.bothFail.length,finalBlockedWithAlternative:failures.filter(r=>r.finalBlockedWithAlternativeAndTurns).length,sameSellerRepair:failures.filter(r=>r.sameSellerNegotiationCouldBeRetried).map(r=>r.caseId)},null,2));
