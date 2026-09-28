// Reproducible synthetic evaluation; no network, accounts, user records or real money.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PreferenceModel, dot, logistic, digest } from './model.mjs';
import { LearningProfile } from './profile.mjs';
import { pairedBootstrap, seededRandom } from './statistics.mjs';

const out = new URL('./artifacts/', import.meta.url);
const rng = seededRandom;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const normalize = xs => xs.map(x => x / xs.reduce((a, b) => a + b, 0));
const randomVector = random => Array.from({ length: 3 }, random);
const distribution = random => normalize(Array.from({ length: 3 }, () => -Math.log(Math.max(random(), 1e-12))));
const probability = (u1, u2, beta, lapse) => lapse / 2 + (1 - lapse) * logistic(beta * (u1 - u2));
const logLoss = (p, y) => -Math.log(Math.max(1e-12, y ? p : 1 - p));
const config = (seed, tuning) => ({ ownerId: `synthetic-${seed}`, purpose: 'offline-evaluation', category: 'api-credit',
  featureSchema: 'synthetic-unit-cube-v1', features: ['affordability', 'refundability', 'quantity'], gridSteps: 12, ...tuning });
const evidence = (m, pair, i) => {
  const { ownerId, purpose, category, featureSchema } = m.config;
  return { id: `e-${i}`, queryId: `q-${i}`, actorId: ownerId, scope: { ownerId, purpose, category, featureSchema },
    presentationHash: digest(pair), left: pair.a, right: pair.b, choice: pair.y ? 'left' : 'right', source: 'explicit_comparison', observedAt: i,
    preferenceEpochId: m.config.preferenceEpochId ?? 'initial' };
};
function subject(seed, scenario) {
  const random = rng(seed), w = distribution(random), beta = 3, lapse = scenario === 'high_noise' ? .35 : .05;
  const trainWeights = scenario === 'drift' ? [.1, .8, .1] : w;
  const testWeights = scenario === 'drift' ? [.8, .1, .1] : w;
  const utility = (x, weights) => {
    if (scenario === 'threshold_utility') return .3 * x[0] + .6 * (x[1] >= .6 ? 1 : 0) + .1 * x[2];
    if (scenario === 'ideal_quantity') return .2 * x[0] + .2 * x[1] + .6 * (1 - Math.abs(x[2] - .6) / .6);
    if (scenario === 'refund_saturation') return .15 * x[0] + .75 * Math.min(x[1] / .4, 1) + .1 * x[2];
    return dot(x, weights);
  };
  const trainFeature = () => {
    const x = randomVector(random);
    if (scenario === 'correlated_to_independent') x[1] = x[0];
    return x;
  };
  const pair = (training = false) => {
    const a = training ? trainFeature() : randomVector(random), b = training ? trainFeature() : randomVector(random);
    const p = probability(utility(a, training ? trainWeights : testWeights), utility(b, training ? trainWeights : testWeights), beta, lapse);
    return { a, b, p, y: random() < p ? 1 : 0 };
  };
  const train = Array.from({ length: 24 }, () => pair(true));
  const validation = Array.from({ length: 40 }, () => pair());
  const test = Array.from({ length: 80 }, () => pair());
  const menus = Array.from({ length: 20 }, (_, n) => Array.from({ length: 4 }, (_, j) => ({ id: `m${n}-${j}`, features: randomVector(random) })));
  return { seed, scenario, train, validation, test, menus, trueWeights: testWeights, utility: x => utility(x, testWeights) };
}
function fit(data, tuning) {
  const model = new PreferenceModel(config(data.seed, tuning));
  data.train.forEach((pair, i) => model.update(evidence(model, pair, i)));
  return model;
}
function ema(data) {
  // Deliberately specified illustrative heuristic, not a claim about an established algorithm.
  let w = [1 / 3, 1 / 3, 1 / 3];
  for (const { a, b, y } of data.train) {
    const positive = (y ? a : b).map((x, i) => Math.max(0, x - (y ? b : a)[i]));
    if (positive.some(x => x > 0)) w = normalize(w.map((x, i) => .9 * x + .1 * normalize(positive)[i]));
  }
  return w;
}
function assess(data, method, tuning, { modelOverride = null } = {}) {
  const model = modelOverride ?? (method === 'bayesian' ? fit(data, tuning) : null);
  const w = model ? model.summary().weights.map(x => x.mean) : method === 'uniform' ? [1 / 3, 1 / 3, 1 / 3] : ema(data);
  const predict = (a, b) => model ? model.predict(a, b) : probability(dot(w, a), dot(w, b), 3, .05);
  const ll = [], brier = [], accuracy = [], probabilityError = [], regrets = [], gateRegrets = [];
  for (const p of data.test) {
    const predicted = predict(p.a, p.b);
    ll.push(logLoss(predicted, p.y)); brier.push((predicted - p.y) ** 2);
    accuracy.push(Number((predicted >= .5) === Boolean(p.y))); probabilityError.push((predicted - p.p) ** 2);
  }
  for (const menu of data.menus) {
    const sorted = [...menu].sort((a, b) => dot(w, b.features) - dot(w, a.features) || a.id.localeCompare(b.id));
    const regret = Math.max(...menu.map(c => data.utility(c.features))) - data.utility(sorted[0].features);
    regrets.push(regret);
    if (model) {
      const top = model.rank(menu, { regretTolerance: .05 })[0];
      if (top.expectedRegret <= .02 && top.probabilityRegretExceedsTolerance <= .1) gateRegrets.push(regret);
    }
  }
  const hasLinearTarget = !['threshold_utility', 'ideal_quantity', 'refund_saturation'].includes(data.scenario);
  const coverage = model && hasLinearTarget ? mean(model.summary().weights.map((x, i) => Number(data.trueWeights[i] >= x.credible95[0] && data.trueWeights[i] <= x.credible95[1]))) : null;
  return { seed: data.seed, method, scenario: data.scenario, logLoss: mean(ll), brier: mean(brier), accuracy: mean(accuracy),
    probabilityMSE: mean(probabilityError), meanRegret: mean(regrets), marginalWeightCoverage95: coverage,
    hypotheticalGatePass: model ? gateRegrets.length / data.menus.length : null,
    gatePassedCount: gateRegrets.length, gateRegretViolationCount: gateRegrets.filter(r => r > .05).length };
}
const tuningCandidates = [
  { betas: [1, 2, 4], lapse: 0 }, { betas: [1, 2, 4], lapse: .05 },
  { betas: [1, 2, 4], lapse: .2 }, { betas: [1, 2, 4, 8], lapse: .05 },
];
function interval(xs) {
  const average = mean(xs), variance = xs.length > 1 ? xs.reduce((s, x) => s + (x - average) ** 2, 0) / (xs.length - 1) : 0;
  const half = 1.96 * Math.sqrt(variance / xs.length);
  return { mean: average, normalApprox95: [average - half, average + half], nSubjects: xs.length };
}
function aggregate(rows) {
  const result = {};
  for (const key of ['logLoss', 'brier', 'accuracy', 'probabilityMSE', 'meanRegret', 'marginalWeightCoverage95', 'hypotheticalGatePass']) {
    const values = rows.map(r => r[key]).filter(x => x !== null);
    result[key] = values.length ? interval(values) : null;
  }
  result.gatePassedCount = rows.reduce((s, r) => s + r.gatePassedCount, 0);
  result.gateRegretViolationCount = rows.reduce((s, r) => s + r.gateRegretViolationCount, 0);
  return result;
}
function activeExperiment(tuning, { from = 301, to = 312, cohort = 'original_exploratory' } = {}) {
  const results = [];
  for (let seed = from; seed <= to; seed++) {
    const data = subject(seed, 'matched'), random = rng(seed + 5000);
    const models = Object.fromEntries(['random', 'information_gain', 'information_gain_weights'].map(method => [method, new PreferenceModel(config(seed, tuning))]));
    for (let count = 0; count <= 12; count++) {
      if ([0, 4, 8, 12].includes(count)) for (const [method, model] of Object.entries(models))
        results.push({ seed, method, comparisons: count, testLogLoss: mean(data.test.map(p => logLoss(model.predict(p.a, p.b), p.y))) });
      if (count === 12) break;
      const candidates = Array.from({ length: 4 }, (_, j) => ({ id: `${count}-${j}`, features: randomVector(random) }));
      const pairs = [];
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) pairs.push({ a, b, u: random() });
      const randomPair = pairs[Math.floor(random() * pairs.length)];
      for (const [method, model] of Object.entries(models)) {
        const question = method === 'random' ? null : model.bestQuestion(candidates, { objective: method });
        const pair = method === 'random' ? randomPair : pairs.find(p => candidates[p.a].id === question.leftId && candidates[p.b].id === question.rightId);
        const a = candidates[pair.a].features, b = candidates[pair.b].features;
        const p = probability(data.utility(a), data.utility(b), 3, .05);
        models[method].update(evidence(models[method], { a, b, y: Number(pair.u < p) }, count));
      }
    }
  }
  return { cohort, seedRange: [from, to], rows: results, summary: [0, 4, 8, 12].map(count => ({ comparisons: count,
    random: interval(results.filter(r => r.comparisons === count && r.method === 'random').map(r => r.testLogLoss)),
    information_gain: interval(results.filter(r => r.comparisons === count && r.method === 'information_gain').map(r => r.testLogLoss)),
    information_gain_weights: interval(results.filter(r => r.comparisons === count && r.method === 'information_gain_weights').map(r => r.testLogLoss)),
    pairedAgainstRandom: Object.fromEntries(['information_gain', 'information_gain_weights'].map(method => [method,
      pairedBootstrap(results.filter(r => r.comparisons === count && r.method === method), results.filter(r => r.comparisons === count && r.method === 'random'), 'testLogLoss')])) })) };
}

function epochExperiment(tuning, referenceRows) {
  const rows = [];
  for (let seed = 101; seed <= 124; seed++) {
    const data = subject(seed, 'drift'), profile = new LearningProfile(fit(data, tuning)), continuingModel = fit(data, tuning), random = rng(seed + 10000);
    profile.beginPreferenceEpoch({ id: 'explicit-change', actorId: profile.model.config.ownerId, reason: 'Synthetic user explicitly changed preferences', now: 100 });
    for (let count = 0; count <= 24; count++) {
      if ([0, 8, 24].includes(count)) for (const [arm, model] of [['reset', profile.model], ['continue', continuingModel]])
        rows.push({ ...assess(data, `${arm}_${count}`, tuning, { modelOverride: model }), arm, newComparisons: count });
      if (count === 24) break;
      const a = randomVector(random), b = randomVector(random), p = probability(data.utility(a), data.utility(b), 3, .05);
      const pair = { a, b, y: Number(random() < p) };
      profile.model.update({ ...evidence(profile.model, pair, count), observedAt: 100 + count });
      continuingModel.update({ ...evidence(continuingModel, pair, 100 + count), observedAt: 100 + count });
    }
  }
  return { rows, summary: [0, 8, 24].map(count => {
    const group = rows.filter(r => r.newComparisons === count && r.arm === 'reset');
    const continuing = rows.filter(r => r.newComparisons === count && r.arm === 'continue');
    return { newComparisons: count, result: aggregate(group), continuingResult: aggregate(continuing),
      versusContinuing: pairedBootstrap(group, continuing, 'meanRegret'),
      versusUniform: pairedBootstrap(group, referenceRows.filter(r => r.scenario === 'drift' && r.method === 'uniform'), 'meanRegret'),
      versusStale: pairedBootstrap(group, referenceRows.filter(r => r.scenario === 'drift' && r.method === 'bayesian'), 'meanRegret') };
  }) };
}

async function main() {
  const development = Array.from({ length: 12 }, (_, i) => subject(i + 1, 'matched'));
  const validation = tuningCandidates.map(tuning => ({ tuning, meanLogLoss: mean(development.map(data => {
    const model = fit(data, tuning);
    return mean(data.validation.map(p => logLoss(model.predict(p.a, p.b), p.y)));
  })) })).sort((a, b) => a.meanLogLoss - b.meanLogLoss);
  const selected = validation[0].tuning;
  const scenarios = ['matched', 'high_noise', 'correlated_to_independent', 'threshold_utility', 'drift', 'ideal_quantity', 'refund_saturation'];
  const rows = [], summary = {};
  for (const scenario of scenarios) {
    for (let seed = 101; seed <= 124; seed++) {
      const data = subject(seed, scenario);
      for (const method of ['uniform', 'ema_0.1', 'bayesian']) rows.push(assess(data, method, selected));
    }
    summary[scenario] = Object.fromEntries(['uniform', 'ema_0.1', 'bayesian'].map(method => [method, aggregate(rows.filter(r => r.scenario === scenario && r.method === method))]));
    process.stdout.write(`Evaluated ${scenario}\n`);
  }
  const gridSensitivity = [];
  for (const gridSteps of [8, 12, 20, 30]) {
    const group = Array.from({ length: 8 }, (_, i) => assess(subject(401 + i, 'matched'), 'bayesian', { ...selected, gridSteps }));
    gridSensitivity.push({ gridSteps, result: aggregate(group) });
  }
  const active = activeExperiment(selected);
  const activeNewSeeds = activeExperiment(selected, { from: 501, to: 524, cohort: 'new_followup_seeds' });
  const explicitEpochReset = epochExperiment(selected, rows);
  const pairedComparisons = Object.fromEntries(scenarios.map(scenario => [scenario, Object.fromEntries(['logLoss', 'meanRegret'].map(metric => [metric,
    pairedBootstrap(rows.filter(r => r.scenario === scenario && r.method === 'bayesian'), rows.filter(r => r.scenario === scenario && r.method === 'uniform'), metric)]))]));
  const sourceHashes = {};
  for (const filename of ['model.mjs', 'profile.mjs', 'epoch-authority.mjs', 'statistics.mjs', 'simulate.mjs', 'review/EXPERIMENT-V2.ko.md']) sourceHashes[filename] = createHash('sha256').update(await readFile(new URL(filename, import.meta.url))).digest('hex');
  const report = { label: 'SYNTHETIC_ONLY_NOT_DEPLOYMENT_VALIDATION', protocolVersion: 2, runtime: process.version,
    protocol: { trainPairs: 24, validationPairs: 40, testPairs: 80, menusPerSubject: 20, candidatesPerMenu: 4,
      scenarios, developmentSeeds: [1, 12], heldOutSubjectSeeds: [101, 124], activeSeeds: [301, 312], activeNewSeeds: [501, 524], gridSensitivitySeeds: [401, 408],
      criterion: 'development-subject mean validation log loss; held-out subjects never select configuration',
      baselineNote: 'EMA is a fully specified illustrative heuristic. Baseline beta=3 is the synthetic generating beta; no handicap from scale mismatch.',
      intervalNote: 'Descriptive normal intervals plus paired subject-level percentile bootstrap differences (2000 resamples). Exploratory, not multiplicity-adjusted or real-user confidence. Drift coverage is diagnostic against changed true weights.',
      hardPolicyNote: 'Normalized eligible feature space only. Payment invariants tested separately with signed records.' },
    validation, selected, summary, active, activeNewSeeds, explicitEpochReset, pairedComparisons, gridSensitivity, sourceHashes, rows };
  await mkdir(out, { recursive: true });
  await writeFile(new URL('simulation.json', out), JSON.stringify(report, null, 2) + '\n');
  const format = n => n.toFixed(4), lines = ['# 합성 실험 결과', '',
    '자동 생성 결과. 실제 사용자 검증·금전적 개선·논문 재현 결과가 아닙니다. 모든 손실과 후회(regret)는 작을수록 좋습니다.', '',
    `선택한 합성 실험 설정: beta 후보 ${JSON.stringify(selected.betas)}, lapse=${selected.lapse}. 격자 12, 학습 24쌍, 평가 사용자 seed 24개.`, '',
    '| 상황 | 방법 | Log loss | Brier | 평균 regret | 95% 주변 가중치 구간 포함률 |', '|---|---|---:|---:|---:|---:|'];
  for (const scenario of scenarios) for (const method of ['uniform', 'ema_0.1', 'bayesian']) {
    const r = summary[scenario][method];
    lines.push(`| ${scenario} | ${method} | ${format(r.logLoss.mean)} | ${format(r.brier.mean)} | ${format(r.meanRegret.mean)} | ${r.marginalWeightCoverage95 ? format(r.marginalWeightCoverage95.mean) : '해당 없음'} |`);
  }
  const ci = value => `[${value.percentileBootstrap95.map(format).join(', ')}]`;
  lines.push('', '## 사용자별 짝 비교: Bayesian − 균등', '', '차이가 음수이면 Bayesian의 손실이 낮다. 24명을 재표집한 2,000회 percentile bootstrap의 탐색적 95% 구간이다.', '',
    '| 상황 | 평균 regret 차이 | 95% bootstrap 구간 | 개선/동률/악화 사용자 | log loss 차이 | 95% bootstrap 구간 |', '|---|---:|---|---|---:|---|');
  const signs = value => `${value.signs.improved}/${value.signs.tied}/${value.signs.worsened}`;
  for (const scenario of scenarios) { const r = pairedComparisons[scenario]; lines.push(`| ${scenario} | ${format(r.meanRegret.meanDifference)} | ${ci(r.meanRegret)} | ${signs(r.meanRegret)} | ${format(r.logLoss.meanDifference)} | ${ci(r.logLoss)} |`); }
  for (const experiment of [active, activeNewSeeds]) {
    lines.push('', `## 질문 선택: ${experiment.cohort} (seed ${experiment.seedRange.join('~')})`, '',
      '| 질문 수 | 임의 log loss | joint 정보이득 | w 정보이득 | joint−임의 구간 | w−임의 구간 | w 개선/동률/악화 |', '|---:|---:|---:|---:|---|---|---|');
    for (const r of experiment.summary) lines.push(`| ${r.comparisons} | ${format(r.random.mean)} | ${format(r.information_gain.mean)} | ${format(r.information_gain_weights.mean)} | ${ci(r.pairedAgainstRandom.information_gain)} | ${ci(r.pairedAgainstRandom.information_gain_weights)} | ${signs(r.pairedAgainstRandom.information_gain_weights)} |`);
  }
  lines.push('', '## 명시적 취향 변경 이후 새 epoch', '', '사용자가 변화를 선언한 시점을 합성으로 제공했다. 자동 변화 감지 성능을 뜻하지 않는다. 새 응답 0개에서는 기존 대칭 사전분포로 돌아간다.', '',
    '| 새 응답 수 | reset regret | 같은 응답 누적 regret | reset−누적 차이 | 95% bootstrap 구간 | 개선/동률/악화 | 현재 w 구간 포함률(reset/누적) |', '|---:|---:|---:|---:|---|---|---|');
  for (const r of explicitEpochReset.summary) lines.push(`| ${r.newComparisons} | ${format(r.result.meanRegret.mean)} | ${format(r.continuingResult.meanRegret.mean)} | ${format(r.versusContinuing.meanDifference)} | ${ci(r.versusContinuing)} | ${signs(r.versusContinuing)} | ${format(r.result.marginalWeightCoverage95.mean)}/${format(r.continuingResult.marginalWeightCoverage95.mean)} |`);
  lines.push('', '같은 새 응답을 누적하는 비교군은 Grok 2차 검토 후 추가했다. v2 리셋 수치를 본 뒤 추가한 탐색적 분석이며 독립 사전등록 결과가 아니다. 균등·동결된 과거 모형과의 비교도 JSON에 유지한다.');
  lines.push('', '## 격자 민감도', '', '| 격자 분할 | Log loss | 평균 regret |', '|---:|---:|---:|');
  for (const r of gridSensitivity) lines.push(`| ${r.gridSteps} | ${format(r.result.logLoss.mean)} | ${format(r.result.meanRegret.mean)} |`);
  lines.push('', '전체 사용자별 값, seed, 설정 비교, 출처 해시, 오차 구간은 [simulation.json](simulation.json)에 있습니다.', '',
    '주의: 모형에 맞춘 데이터에서의 개선은 실제 사용자 효과를 입증하지 않습니다. drift는 학습 후 선호가 바뀌는 실패 사례입니다. 상관 특성을 분리하지 못하는 문제, 비선형 취향, 노이즈 증가도 따로 측정했습니다.', '',
    '평균의 차이만으로 통계적으로 악화되었다고 단정하지 않습니다. 구간이 0을 포함하면 이 실험에서 차이를 구분하지 못한 것입니다. 새 seed 12회 log loss 비교도 탐색적이며 실제 사용자 효과를 뜻하지 않습니다. 다중 비교 보정 없이 여러 상황에서 나온 구간을 확증적 발견으로 쓰지 않습니다.', '',
    '질문 선택은 합성 선호와 후보 풀에 따라 임의 질문보다 나빠질 수 있습니다. 특정 질문 횟수에서 항상 우월하거나 실사용 질문 수가 감소한다고 주장하지 않습니다. 질문 목표는 호출자가 명시해야 하며 실험 우승자가 자동 기본값이 되지 않습니다.', '',
    '수치상 위험 기준 통과율은 가상 비교용입니다. 이 파일로 validationStatus를 validated_for_scope로 바꾸면 안 됩니다.');
  await writeFile(new URL('simulation.ko.md', out), lines.join('\n') + '\n');
  process.stdout.write(`Wrote ${fileURLToPath(new URL('simulation.json', out))}\n`);
}
await main();
