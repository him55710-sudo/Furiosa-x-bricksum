// Successes exclude refused requests. Cache reuse never starts a new attempt.
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const sum = values => values.every(value => value !== null) ? values.reduce((a,b) => a+b,0) : null;
export const QUOTE_FIELDS = ['quoteSuccesses','quoteAttempts','quoteRejections','quoteCacheHits'];
export function quoteObservation(metrics = {}) {
  const successes = sum([count(metrics.early),count(metrics.final)]);
  const attempts = metrics.attempts ? sum([count(metrics.attempts.early),count(metrics.attempts.final)]) : null;
  const complete = [successes,attempts,count(metrics.rejected),count(metrics.cacheHits)].every(value=>value!==null);
  return {
    quoteSuccesses: successes,
    quoteAttempts: attempts,
    quoteRejections: count(metrics.rejected),
    quoteCacheHits: count(metrics.cacheHits),
    quoteEvidence: complete ? 'DIRECT_COUNTERS' : attempts === null ? 'LEGACY_SUCCESS_ONLY' : 'PARTIAL_COUNTERS',
    quoteSuccessLatencyMs: count(metrics.latencyMs),
    quoteRejectedLatencyMs: null,
    quoteProviderCostUsd: null,
  };
}
export function sumQuoteObservations(rows) {
  return Object.fromEntries(QUOTE_FIELDS.map(field => [field,sum(rows.map(row => count(row[field])))]));
}
