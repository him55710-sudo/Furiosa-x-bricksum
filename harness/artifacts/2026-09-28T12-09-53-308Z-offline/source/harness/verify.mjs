import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {verifyTypedData} from 'ethers';
import {hash,OFFER_TYPES,MANDATE_TYPES} from '../shared/schema.mjs';
const input=process.argv[2];if(!input)throw new Error('REPORT_PATH_REQUIRED');
const directory=path.dirname(path.resolve(input)),report=JSON.parse(await readFile(input,'utf8')),manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
const findings=[],sha=b=>createHash('sha256').update(b).digest('hex');
if(report.analysisProvenance){
  if(sha(await readFile(path.join(directory,'report.json')))!==report.analysisProvenance.parentSha256)findings.push('analysis-parent');
  for(const [f,expected]of Object.entries(report.analysisProvenance.sources))if(sha(await readFile(path.join(directory,'analysis-source',f)))!==expected)findings.push(`analysis-source:${f}`);
}
for(const [file,expected]of Object.entries(manifest.source))if(sha(await readFile(path.join(directory,'source',file)))!==expected)findings.push(`source:${file}`);
const ids=new Set();let signatures=0,events=0,modelResponses=0;
for(const row of [...report.rows,...report.robustnessRows]){
  if(ids.has(row.runId))findings.push(`duplicate:${row.runId}`);ids.add(row.runId);
  if(verifyTypedData(row.domain,MANDATE_TYPES,row.mandate,row.mandateSignature)!==row.mandate.owner)findings.push(`mandate:${row.runId}`);signatures++;
  if(row.finalMandateHash!==hash(row.mandate)||row.originalMandateHash!==row.finalMandateHash)findings.push(`authority:${row.runId}`);
  for(const record of row.quotes){if(verifyTypedData(row.domain,OFFER_TYPES,record.offer,record.signature)!==record.offer.merchant)findings.push(`quote:${row.runId}`);signatures++;}
  let previous=null,seq=0;for(const event of row.events){const {hash:expected,...body}=event;if(hash(body)!==expected||body.prevHash!==previous||body.seq!==++seq)findings.push(`event:${row.runId}:${body.seq}`);previous=expected;events++;}
  const accepts=row.steps.filter(s=>s.action?.name==='accept_offer');
  if(row.unsafeAcceptAttempts>accepts.length||row.caughtUnsafeAccepts>row.unsafeAcceptAttempts)findings.push(`attempt-accounting:${row.runId}`);
  if(row.status==='AUTHORIZED_SIMULATION'){
    const action=accepts.at(-1)?.action,record=row.quotes.find(q=>q.offer.offerId===action?.args.offer_id),o=record?.offer,m=row.mandate;
    if(!o||BigInt(o.total)>BigInt(m.perTxCap)||BigInt(o.total)>BigInt(m.totalCap)||BigInt(o.total)!==BigInt(o.subtotal)+BigInt(o.fee)||o.purposeHash!==m.purposeHash||o.skuHash!==m.skuHash||BigInt(o.quantity)<BigInt(m.minQuantity)||BigInt(o.refundHours)<BigInt(m.minRefundHours)||Number(o.expiresAt)<=row.authorization.at)findings.push(`unauthorized:${row.runId}`);
  }
  if(row.transactions!==0)findings.push(`unexpected-payment:${row.runId}`);
}
for(const call of report.allInference){
  if(call.source==='LIVE_KILN'){
    if(sha(JSON.stringify(call.request))!==call.requestHash)findings.push(`request-hash:${call.runId}`);
    if(call.request.model!=='qwen3-32b')findings.push(`request-model:${call.runId}`);
    if(call.outcome==='COMPLETE'){modelResponses++;if(call.modelReturned!=='qwen3-32b'||!call.response||call.httpStatus!==200)findings.push(`response:${call.runId}`);}
    if(JSON.stringify(call.request).includes('Authorization')||Object.keys(call).some(k=>/api.?key|secret/i.test(k)))findings.push(`credential-field:${call.runId}`);
  }
}
if(report.rows.length!==manifest.count*manifest.arms.length)findings.push('missing-rows');
if(report.kind==='LIVE_KILN'&&report.actualApiCalls!==report.allInference.length)findings.push('call-accounting');
for(const arm of manifest.arms){
  const rows=report.rows.filter(r=>r.arm===arm),s=report.byArm[arm],calls=rows.flatMap(r=>r.usage);
  if(rows.length!==manifest.count||s.rows!==rows.length||s.calls!==calls.length)findings.push(`arm-count:${arm}`);
  if(s.unsafeAcceptAttempts!==rows.reduce((n,r)=>n+r.unsafeAcceptAttempts,0)||s.unauthorizedAuthorizations!==rows.reduce((n,r)=>n+r.unauthorizedAuthorizations,0))findings.push(`arm-safety:${arm}`);
  const total=calls.every(c=>c.totalTokens!==null)?calls.reduce((n,c)=>n+c.totalTokens,0):null;
  if(total!==s.totalTokens)findings.push(`arm-tokens:${arm}`);
}
const result={status:findings.length?'FAIL':'PASS',id:report.id,sourceHashes:Object.keys(manifest.source).length,rows:report.rows.length,robustnessRows:report.robustnessRows.length,signatures,events,modelResponses,findings,scope:'Artifact consistency, signed fixtures, event chain, actual model responses and aggregate accounting. Not independent hardware or real payment validation.'};
await writeFile(path.join(directory,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(findings.length)process.exitCode=1;
