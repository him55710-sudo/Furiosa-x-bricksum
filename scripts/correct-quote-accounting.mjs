// Offline erratum for one frozen pilot. No model, wallet, RPC, or payment calls.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sumQuoteObservations} from '../shared/quote-metrics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const id='2026-09-28T11-23-54-460Z',dir=path.join(root,'artifacts/experiments',id);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const resultBytes=await readFile(path.join(dir,'result.json')),result=JSON.parse(resultBytes);
const manifestBytes=await readFile(path.join(dir,'manifest.json')),manifest=JSON.parse(manifestBytes);
assert.equal(result.id,id);assert.equal(result.status,'COMPLETE');assert.equal(result.rows.length,48);
assert.equal(manifest.source['src/engine.mjs'],'21733ad753cece305000bacbf5712f1f3c66d2e4964b211c04b9bbdaa4dbb910');
for(const [file,digest] of Object.entries(manifest.source))assert.equal(sha(await readFile(path.join(dir,'source',file))),digest,file);
const sourceResultRows=JSON.parse(await readFile(path.join(dir,'rows.json')));assert.deepEqual(result.rows,sourceResultRows);
const rows=result.rows.map(row=>{
  const m=row.quoteMetrics;
  assert.equal(row.quoteCalls,m.early+m.final);
  assert.equal(m.attempts,undefined,'Use actual counters for a newer experiment');
  const refused=row.scenarioId==='late-quote' && ['B1','CM'].includes(row.arm);
  if(refused){assert.equal(row.status,'REVIEW_REQUIRED');assert.equal(row.reason,'ALL_IN_PRICE_REQUIRED');assert.equal(row.quoteCalls,0);}
  else assert.notEqual(row.reason,'ALL_IN_PRICE_REQUIRED');
  // In this pinned fixture there is exactly one candidate in late-quote.
  // Its early branch throws before the archived success counter increments.
  return {repetition:row.repetition,arm:row.arm,scenarioId:row.scenarioId,syntheticQuoteDelayMs:row.syntheticQuoteDelayMs,
    quoteSuccesses:row.quoteCalls,quoteAttempts:row.quoteCalls+Number(refused),quoteRejections:Number(refused),quoteCacheHits:m.cacheHits,
    provenance:{quoteSuccesses:'RECORDED',quoteAttempts:'RECONSTRUCTED_FROM_FROZEN_CODE_AND_ROWS',quoteRejections:'RECONSTRUCTED_FROM_FROZEN_CODE_AND_ROWS',quoteCacheHits:'RECORDED'}};
});
const trainingRows=result.training.map(row=>{
  assert.equal(row.reason,'PER_PURCHASE_LIMIT_EXCEEDED');assert.equal(row.calls,1);
  return {repetition:row.repetition,quoteSuccesses:1,quoteAttempts:1,quoteRejections:0,quoteCacheHits:0,provenance:'RECONSTRUCTED_FROM_FROZEN_TRAINING_PATH'};
});
assert.equal(trainingRows.length,2);
const summary=['B0','B1','CM'].map(arm=>({arm,...sumQuoteObservations(rows.filter(row=>row.arm===arm))}));
assert.deepEqual(summary.map(row=>row.quoteAttempts),[16,27,16]);
const training=sumQuoteObservations(trainingRows),cm=summary.find(row=>row.arm==='CM');
const correction={schemaVersion:1,experimentId:id,status:'OFFLINE_RECONSTRUCTION',originalResultSha256:sha(resultBytes),originalManifestSha256:sha(manifestBytes),
  sourceVerified:manifest.source,method:'Successes/cache hits are recorded in evaluation rows. Attempts/rejections are reconstructed from the exact frozen code, single-candidate late-quote fixture, and stop reasons. Training counters are reconstructed separately. No new inference or chain execution.',
  unknown:{rejectedQuoteLatencyMs:null,realProviderQuoteCostUsd:null},rows,summary,trainingRows,training,cmIncludingTraining:sumQuoteObservations([cm,training]),
  note:'성공 견적·캐시 수는 원래 기록, 시도·거절은 고정 코드에서 사후 재구성한 값입니다. CM 생성 비용도 별도 재구성했습니다. 거절 지연·실제 공급자 비용은 미확인입니다.'};
const out=path.join(root,'artifacts/experiments/corrections');await mkdir(out,{recursive:true});
const file=path.join(out,id+'-quotes.json');await writeFile(file,JSON.stringify(correction,null,2)+'\n');
console.log(JSON.stringify({file,summary,training,cmIncludingTraining:correction.cmIncludingTraining},null,2));
