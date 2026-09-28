import { ensure } from './model.mjs';
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let x = state; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const quantile = (sorted, p) => {
  const index = (sorted.length - 1) * p, lower = Math.floor(index), fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[Math.min(lower + 1, sorted.length - 1)] * fraction;
};

// Paired percentile bootstrap. Resampling unit is a subject, never individual test pairs.
export function pairedBootstrap(left, right, metric, { seed = 92026, replicates = 2000 } = {}) {
  ensure(Number.isSafeInteger(replicates) && replicates >= 100, 'INVALID_BOOTSTRAP_COUNT');
  const leftMap = new Map(left.map(row => [row.seed, row[metric]]));
  const rightMap = new Map(right.map(row => [row.seed, row[metric]]));
  ensure(left.length >= 2 && left.length === leftMap.size && right.length === rightMap.size && leftMap.size === rightMap.size, 'INVALID_PAIRED_SUBJECTS');
  const pairs = [...leftMap].sort(([a], [b]) => a - b).map(([subjectSeed, value]) => {
    const reference = rightMap.get(subjectSeed);
    ensure(Number.isFinite(value) && Number.isFinite(reference), 'UNPAIRED_OR_INVALID_METRIC');
    return { seed: subjectSeed, difference: value - reference };
  });
  const random = seededRandom(seed), sampled = [];
  for (let i = 0; i < replicates; i++) {
    let total = 0;
    for (let j = 0; j < pairs.length; j++) total += pairs[Math.floor(random() * pairs.length)].difference;
    sampled.push(total / pairs.length);
  }
  sampled.sort((a, b) => a - b);
  const interval95 = [quantile(sampled, .025), quantile(sampled, .975)];
  return { metric, differenceDefinition: 'left minus right; lower is better for loss/regret', meanDifference: mean(pairs.map(p => p.difference)),
    percentileBootstrap95: interval95, excludesZero: interval95[1] < 0 || interval95[0] > 0,
    signs: { improved: pairs.filter(p => p.difference < 0).length, tied: pairs.filter(p => p.difference === 0).length, worsened: pairs.filter(p => p.difference > 0).length },
    nSubjects: pairs.length, bootstrapSeed: seed, replicates, pairs,
    interpretation: 'Exploratory subject-level synthetic comparison; no multiple-comparison adjustment or real-user guarantee.' };
}
