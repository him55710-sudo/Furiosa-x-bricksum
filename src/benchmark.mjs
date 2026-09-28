import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {quoteObservation,sumQuoteObservations} from '../shared/quote-metrics.mjs';

export function benchmarkView(result,correction=null) {
  if(correction && correction.experimentId !== result.id)throw new Error('QUOTE_CORRECTION_EXPERIMENT_MISMATCH');
  const observations = result.rows.map(row => row.quoteEvidence ? row : quoteObservation(row.quoteMetrics));
  const training = result.training.map(row => row.quoteEvidence ? row : quoteObservation(row.quoteMetrics));
  const summary = result.summary.map(row => ({...row,...sumQuoteObservations(observations.filter((_,i) => result.rows[i].arm === row.arm))}));
  const effectiveSummary=correction ? summary.map(row=>({...row,...correction.summary.find(item=>item.arm===row.arm)})) : summary;
  return {...result,summary:effectiveSummary,quoteAccounting:correction ?? {
    status: observations.every(row => row.quoteEvidence === 'DIRECT_COUNTERS') && training.every(row => row.quoteEvidence === 'DIRECT_COUNTERS') ? 'DIRECT_COUNTERS' : 'LEGACY_INCOMPLETE',
    summary: summary.map(({arm,quoteSuccesses,quoteAttempts,quoteRejections,quoteCacheHits}) => ({arm,quoteSuccesses,quoteAttempts,quoteRejections,quoteCacheHits})),
    training:sumQuoteObservations(training),
    note:'성공은 반환된 서명 견적, 시도는 캐시를 제외한 요청 진입입니다. 기록이 없으면 미확인으로 표시합니다.',
  }};
}
export async function readBenchmark(directory='artifacts/experiments',filename='latest.json') {
  const bytes=await readFile(path.join(directory,filename));
  const result=JSON.parse(bytes);
  let correction=null;
  if(/^[0-9TZ-]+$/.test(result.id)) {
    try {
      correction=JSON.parse(await readFile(path.join(directory,'corrections',result.id+'-quotes.json')));
      if(correction.originalResultSha256 !== createHash('sha256').update(bytes).digest('hex'))throw new Error('QUOTE_CORRECTION_SOURCE_MISMATCH');
    } catch(error) { if(error.code !== 'ENOENT')throw error; }
  }
  return benchmarkView(result,correction);
}
