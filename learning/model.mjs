// Bayesian feature-based pairwise preferences. See RESEARCH.ko.md and THIRD_PARTY_NOTICES.md.
// No payment, mandate mutation, network call, or LLM dependency exists in this module.
import { createHash } from 'node:crypto';

export const MODEL_VERSION = 'finite-bayes-logit-1';
export const clone = value => structuredClone(value);
export function ensure(condition, code) { if (!condition) throw new Error(code); }
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  ensure(value && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_JSON_VALUE');
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const logistic = x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
const entropy = p => p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
function normalize(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  ensure(Number.isFinite(sum) && sum > 0 && values.every(x => Number.isFinite(x) && x >= 0), 'INVALID_MASS');
  return values.map(x => x / sum);
}
function normalizeLogs(logs) {
  const max = Math.max(...logs);
  ensure(Number.isFinite(max), 'INVALID_LOG_MASS');
  const offset = Math.log(logs.reduce((sum, x) => sum + Math.exp(x - max), 0));
  // Keep tiny hypotheses in log space so later contrary evidence can recover them.
  return logs.map(x => (x - max) - offset);
}
function simplexGrid(dimensions, steps) {
  const out = [];
  function visit(prefix, remaining) {
    if (prefix.length === dimensions - 1) { out.push([...prefix, remaining].map(x => x / steps)); return; }
    for (let i = 0; i <= remaining; i++) visit([...prefix, i], remaining - i);
  }
  visit([], steps);
  return out;
}
function validateConfig(config) {
  ensure(config && ['ownerId', 'purpose', 'category', 'featureSchema'].every(k => typeof config[k] === 'string' && config[k].length > 0), 'INVALID_SCOPE');
  ensure(Array.isArray(config.features) && config.features.length >= 2 && config.features.length <= 4 && new Set(config.features).size === config.features.length && config.features.every(x => typeof x === 'string' && x.length), 'INVALID_FEATURES');
  ensure(Number.isInteger(config.gridSteps) && config.gridSteps >= 2 && config.gridSteps <= 30, 'INVALID_GRID');
  ensure(Array.isArray(config.betas) && config.betas.length > 0 && config.betas.length <= 8 && new Set(config.betas).size === config.betas.length && config.betas.every(x => Number.isFinite(x) && x > 0 && x <= 16), 'INVALID_BETAS');
  ensure(Number.isFinite(config.lapse) && config.lapse >= 0 && config.lapse < 1, 'INVALID_LAPSE');
  ensure(config.preferenceEpochId === undefined || (typeof config.preferenceEpochId === 'string' && config.preferenceEpochId.length > 0), 'INVALID_PREFERENCE_EPOCH');
  ensure(config.preferenceEpochStartedAt === undefined || (Number.isSafeInteger(config.preferenceEpochStartedAt) && config.preferenceEpochStartedAt >= 0), 'INVALID_EPOCH_TIME');
  ensure(config.preferenceEpochSequence === undefined || (Number.isSafeInteger(config.preferenceEpochSequence) && config.preferenceEpochSequence >= 0), 'INVALID_EPOCH_SEQUENCE');
}
function vector(x, n) { ensure(Array.isArray(x) && x.length === n && x.every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'INVALID_FEATURE_VECTOR'); }
const scope = c => ({ ownerId: c.ownerId, purpose: c.purpose, category: c.category, featureSchema: c.featureSchema });
function ancestorEvidence(parent) {
  const result = [];
  for (let node = parent; node; node = node.snapshot.parent) result.push(...node.snapshot.evidence);
  return result;
}
function quantile(values, masses, q) {
  const sorted = values.map((v, i) => [v, masses[i]]).sort((a, b) => a[0] - b[0]);
  let cum = 0;
  for (const [v, p] of sorted) { cum += p; if (cum >= q) return v; }
  return sorted.at(-1)[0];
}

export class PreferenceModel {
  #config; #hypotheses; #prior; #logs; #evidence; #retractions; #parent;
  constructor(config, { parent = null, transferConcentration = null } = {}) {
    validateConfig(config);
    this.#config = clone(config);
    const weights = simplexGrid(config.features.length, config.gridSteps);
    ensure(weights.length * config.betas.length <= 20000, 'GRID_TOO_LARGE');
    this.#hypotheses = weights.flatMap(w => config.betas.map(beta => ({ weights: w, beta })));
    let prior = this.#hypotheses.map(() => 1 / this.#hypotheses.length);
    this.#parent = null;
    if (parent !== null) {
      // Explicit, frozen, same-owner parent snapshot; no reverse update or global pooling.
      ensure(parent instanceof PreferenceModel, 'INVALID_PARENT');
      const pc = parent.config;
      ensure((pc.preferenceEpochId ?? 'initial') === (config.preferenceEpochId ?? 'initial'), 'INCOMPATIBLE_PARENT_EPOCH');
      ensure(pc.ownerId === config.ownerId && pc.purpose === config.purpose && config.category.startsWith(pc.category + '/') && pc.featureSchema === config.featureSchema && canonical(pc.features) === canonical(config.features), 'INCOMPATIBLE_PARENT');
      ensure(Number.isFinite(transferConcentration) && transferConcentration >= 0 && transferConcentration <= 100, 'INVALID_TRANSFER_CONCENTRATION');
      const parentMass = parent.posterior;
      const parentHyp = parent.hypotheses;
      const childMass = weights.map(() => 0);
      // K(w_child | w_parent) is normalized for EACH parent hypothesis.
      for (let i = 0; i < parentHyp.length; i++) {
        const kernel = normalize(weights.map(w => Math.exp(-transferConcentration * w.reduce((s, x, j) => s + (x - parentHyp[i].weights[j]) ** 2, 0))));
        kernel.forEach((p, j) => { childMass[j] += parentMass[i] * p; });
      }
      prior = childMass.flatMap(p => config.betas.map(() => p / config.betas.length));
      this.#parent = { snapshot: parent.export(), concentration: transferConcentration };
      let depth = 0;
      for (let node = this.#parent; node; node = node.snapshot.parent) depth++;
      ensure(depth < 5, 'MAX_PARENT_DEPTH');
    }
    this.#prior = normalize(prior);
    this.#logs = this.#prior.map(Math.log);
    this.#evidence = [];
    this.#retractions = [];
  }
  get config() { return clone(this.#config); }
  get hypotheses() { return clone(this.#hypotheses); }
  get posterior() { return normalize(this.#logs.map(Math.exp)); }
  get evidence() { return clone(this.#evidence); }
  get activeEvidence() { const gone = new Set(this.#retractions.map(x => x.evidenceId)); return this.evidence.filter(e => !gone.has(e.id)); }
  #likelihoods(left, right) {
    vector(left, this.#config.features.length); vector(right, this.#config.features.length);
    const delta = left.map((x, i) => x - right[i]);
    return this.#hypotheses.map(h => this.#config.lapse / 2 + (1 - this.#config.lapse) * logistic(h.beta * dot(h.weights, delta)));
  }
  predict(left, right) { return dot(this.posterior, this.#likelihoods(left, right)); }
  update(evidence) {
    ensure(evidence && typeof evidence.id === 'string' && evidence.id.length && typeof evidence.queryId === 'string' && evidence.queryId.length && typeof evidence.presentationHash === 'string' && evidence.presentationHash.length, 'INVALID_EVIDENCE');
    ensure(canonical(evidence.scope) === canonical(scope(this.#config)), 'EVIDENCE_SCOPE_MISMATCH');
    ensure(evidence.actorId === this.#config.ownerId, 'UNAUTHORIZED_FEEDBACK');
    ensure((evidence.preferenceEpochId ?? 'initial') === (this.#config.preferenceEpochId ?? 'initial'), 'EVIDENCE_EPOCH_MISMATCH');
    ensure(['explicit_comparison', 'confirmed_refund_comparison'].includes(evidence.source), 'UNSUPPORTED_FEEDBACK_SOURCE');
    ensure(evidence.choice === 'left' || evidence.choice === 'right', 'PAIRWISE_CHOICE_REQUIRED');
    ensure(Number.isSafeInteger(evidence.observedAt) && evidence.observedAt >= 0, 'INVALID_EVIDENCE_TIME');
    ensure(evidence.observedAt >= (this.#config.preferenceEpochStartedAt ?? 0), 'EVIDENCE_PREDATES_EPOCH');
    const probabilities = this.#likelihoods(evidence.left, evidence.right);
    const previous = this.#evidence.find(e => e.id === evidence.id || e.queryId === evidence.queryId);
    if (previous) { ensure(canonical(previous) === canonical(evidence), 'FEEDBACK_CONFLICT'); return { applied: false, reason: 'IDEMPOTENT_REPLAY' }; }
    ensure(!ancestorEvidence(this.#parent).some(e => e.id === evidence.id || e.queryId === evidence.queryId), 'ANCESTOR_EVIDENCE_REUSE');
    const before = this.summary();
    const y = evidence.choice === 'left';
    this.#logs = normalizeLogs(this.#logs.map((v, i) => v + Math.log(y ? probabilities[i] : 1 - probabilities[i])));
    this.#evidence.push(clone(evidence));
    return { applied: true, evidenceId: evidence.id, before, after: this.summary() };
  }
  allEvidenceIds() { return [...this.#evidence, ...ancestorEvidence(this.#parent)].map(e => e.id); }
  retract({ evidenceId, actorId, reason }) {
    ensure(actorId === this.#config.ownerId, 'UNAUTHORIZED_FEEDBACK');
    ensure(typeof reason === 'string' && reason.trim().length > 0, 'RETRACTION_REASON_REQUIRED');
    ensure(this.#evidence.some(e => e.id === evidenceId), 'UNKNOWN_EVIDENCE');
    if (this.#retractions.some(e => e.evidenceId === evidenceId)) return { applied: false };
    this.#retractions.push({ evidenceId, actorId, reason });
    this.#logs = this.#prior.map(Math.log);
    for (const e of this.activeEvidence) {
      const p = this.#likelihoods(e.left, e.right);
      this.#logs = normalizeLogs(this.#logs.map((v, i) => v + Math.log(e.choice === 'left' ? p[i] : 1 - p[i])));
    }
    return { applied: true, after: this.summary() };
  }
  summary() {
    const mass = this.posterior;
    const weights = this.#config.features.map((feature, j) => {
      const values = this.#hypotheses.map(h => h.weights[j]);
      return { feature, mean: dot(values, mass), credible95: [quantile(values, mass, .025), quantile(values, mass, .975)] };
    });
    return { modelVersion: MODEL_VERSION, scope: scope(this.#config), preferenceEpochId: this.#config.preferenceEpochId ?? 'initial', evidenceCount: this.activeEvidence.length,
      lastObservedAt: this.activeEvidence.reduce((max, e) => Math.max(max ?? 0, e.observedAt), null), weights,
      parentEvidenceRecorded: ancestorEvidence(this.#parent).length,
      betaMean: dot(this.#hypotheses.map(h => h.beta), mass),
      uncertaintyMeaning: 'Posterior conditional on finite grid, feature schema, linear utility, likelihood and prior; not empirically calibrated correctness.',
      parentSnapshotHash: this.#parent ? digest(this.#parent.snapshot) : null };
  }
  rank(candidates, { regretTolerance = 0 } = {}) {
    ensure(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 40, 'INVALID_CANDIDATES');
    ensure(new Set(candidates.map(c => c.id)).size === candidates.length && candidates.every(c => typeof c.id === 'string' && c.id.length), 'DUPLICATE_CANDIDATE');
    ensure(Number.isFinite(regretTolerance) && regretTolerance >= 0 && regretTolerance <= 1, 'INVALID_REGRET_TOLERANCE');
    candidates.forEach(c => vector(c.features, this.#config.features.length));
    const p = this.posterior;
    const utilities = this.#hypotheses.map(h => candidates.map(c => dot(h.weights, c.features)));
    const best = utilities.map(row => Math.max(...row));
    const result = candidates.map((candidate, j) => {
      const regrets = utilities.map((row, i) => Math.max(0, best[i] - row[j]));
      const optimal = utilities.map((row, i) => Math.abs(row[j] - best[i]) < 1e-12 ? 1 / row.filter(u => Math.abs(u - best[i]) < 1e-12).length : 0);
      return { id: candidate.id, expectedUtility: dot(utilities.map(row => row[j]), p), expectedRegret: dot(regrets, p),
        regret95: quantile(regrets, p, .95), probabilityRegretExceedsTolerance: dot(regrets.map(r => r > regretTolerance + 1e-12 ? 1 : 0), p),
        probabilityBestWithSplitTies: dot(optimal, p) };
    });
    result.sort((a, b) => b.expectedUtility - a.expectedUtility || a.id.localeCompare(b.id, 'en'));
    return result;
  }
  bestQuestion(candidates, { excludedPairs = [], objective = 'information_gain' } = {}) {
    ensure(['information_gain', 'information_gain_weights', 'regret_reduction'].includes(objective), 'INVALID_QUERY_OBJECTIVE');
    const ranking = this.rank(candidates);
    const p = this.posterior;
    const utilities = this.#hypotheses.map(h => candidates.map(c => dot(h.weights, c.features)));
    const bestUtilities = utilities.map(row => Math.max(...row));
    const bayesRisk = mass => dot(mass, bestUtilities) - Math.max(...candidates.map((_, j) => dot(mass, utilities.map(row => row[j]))));
    const excluded = new Set(excludedPairs.map(pair => pair.slice().sort().join('\u0000')));
    let best = null;
    for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) {
      if (excluded.has([candidates[a].id, candidates[b].id].sort().join('\u0000'))) continue;
      const lik = this.#likelihoods(candidates[a].features, candidates[b].features);
      const pLeft = dot(p, lik);
      const informationGainBits = Math.max(0, entropy(pLeft) - dot(p, lik.map(entropy)));
      // Marginalize beta CONDITIONAL on each w, using current posterior masses.
      const betaCount = this.#config.betas.length;
      let conditionalWeightEntropy = 0;
      for (let start = 0; start < p.length; start += betaCount) {
        let weightMass = 0, responseMass = 0;
        for (let i = start; i < start + betaCount; i++) { weightMass += p[i]; responseMass += p[i] * lik[i]; }
        if (weightMass > 0) conditionalWeightEntropy += weightMass * entropy(responseMass / weightMass);
      }
      const weightInformationGainBits = Math.max(0, entropy(pLeft) - conditionalWeightEntropy);
      const leftRisk = bayesRisk(normalize(p.map((v, i) => v * lik[i])));
      const rightRisk = bayesRisk(normalize(p.map((v, i) => v * (1 - lik[i]))));
      const expectedRisk = pLeft * leftRisk + (1 - pLeft) * rightRisk;
      const regretReduction = Math.max(0, ranking[0].expectedRegret - expectedRisk);
      const score = objective === 'information_gain' ? informationGainBits : objective === 'information_gain_weights' ? weightInformationGainBits : regretReduction;
      if (!best || score > best.score + 1e-14) best = { leftId: candidates[a].id, rightId: candidates[b].id, pLeft, informationGainBits, weightInformationGainBits, regretReduction, objective, score };
    }
    return best;
  }
  export() {
    return { version: MODEL_VERSION, config: this.config, parent: clone(this.#parent), evidence: this.evidence, retractions: clone(this.#retractions) };
  }
  static restore(snapshot, depth = 0) {
    ensure(depth < 5 && snapshot?.version === MODEL_VERSION && Array.isArray(snapshot.evidence) && snapshot.evidence.length <= 10000 && Array.isArray(snapshot.retractions), 'INVALID_SNAPSHOT');
    const parent = snapshot.parent ? PreferenceModel.restore(snapshot.parent.snapshot, depth + 1) : null;
    const model = new PreferenceModel(snapshot.config, { parent, transferConcentration: snapshot.parent?.concentration ?? null });
    snapshot.evidence.forEach(e => model.update(e));
    snapshot.retractions.forEach(e => model.retract(e));
    return model;
  }
}
