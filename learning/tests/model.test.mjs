import test from 'node:test';
import assert from 'node:assert/strict';
import { PreferenceModel, digest, dot } from '../model.mjs';
import { LearningProfile } from '../profile.mjs';

const config = (extra = {}) => ({ ownerId: 'alice', purpose: 'sandbox', category: 'software', featureSchema: 'toy-v1',
  features: ['affordability', 'refundability'], gridSteps: 2, betas: [Math.log(3)], lapse: 0, ...extra });
const event = (model, id, choice = 'left', extra = {}) => {
  const { ownerId, purpose, category, featureSchema } = model.config;
  return { id, queryId: `q-${id}`, actorId: ownerId, scope: { ownerId, purpose, category, featureSchema },
    presentationHash: digest({ id }), left: [1, 0], right: [0, 1], choice, source: 'explicit_comparison', observedAt: 10, ...extra };
};
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const menu = [{ id: 'a', features: [1, 0] }, { id: 'b', features: [0, 1] }];

test('hand calculation: one choice yields masses 1/6, 1/3, 1/2 and mean 2/3', () => {
  const m = new PreferenceModel(config());
  close(m.predict([1, 0], [0, 1]), .5);
  m.update(event(m, '1'));
  [1 / 6, 1 / 3, 1 / 2].forEach((x, i) => close(m.posterior[i], x));
  close(m.summary().weights[0].mean, 2 / 3);
  close(m.predict([1, 0], [0, 1]), 7 / 12);
});

test('binary softmax from APReL and weighted entropy formula match independently', () => {
  const m = new PreferenceModel(config({ betas: [1, 3], lapse: .05, gridSteps: 8 }));
  m.update(event(m, '1'));
  const h = m.hypotheses, p = m.posterior, a = [.9, .2], b = [.1, .8];
  const likelihoods = h.map(x => {
    const x1 = Math.exp(x.beta * dot(x.weights, a)), x2 = Math.exp(x.beta * dot(x.weights, b));
    return .025 + .95 * x1 / (x1 + x2);
  });
  const mean = dot(p, likelihoods);
  close(m.predict(a, b), mean);
  const expectedMI = likelihoods.reduce((sum, q, i) => sum + p[i] * (q * Math.log2(q / mean) + (1 - q) * Math.log2((1 - q) / (1 - mean))), 0);
  const before = digest(m.export()), question = m.bestQuestion([{ id: 'a', features: a }, { id: 'b', features: b }]);
  close(question.informationGainBits, expectedMI);
  assert.equal(digest(m.export()), before);
});

test('unidentifiable comparisons carry no evidence; conflicting choices remain symmetric', () => {
  const m = new PreferenceModel(config());
  m.update(event(m, 'equal', 'left', { left: [.8, .8], right: [.1, .1] }));
  m.posterior.forEach(p => close(p, 1 / 3));
  m.update(event(m, 'left'));
  m.update(event(m, 'right', 'right'));
  close(m.summary().weights[0].mean, .5);
  assert.deepEqual(m.summary().weights[0].credible95, [0, 1]);
});

test('idempotency, conflicting replay, unauthorized sources and scope are rejected', () => {
  const m = new PreferenceModel(config()), e = event(m, 'one');
  m.update(e);
  assert.equal(m.update(e).applied, false);
  for (const x of [{ ...e, choice: 'right' }, { ...e, id: 'different' }]) assert.throws(() => m.update(x), /FEEDBACK_CONFLICT/);
  assert.throws(() => m.update(event(m, '2', 'left', { actorId: 'mallory' })), /UNAUTHORIZED/);
  for (const source of ['ai_inferred', 'repeat_purchase', 'raw_refund', 'implicit_rejection'])
    assert.throws(() => m.update(event(m, source, 'left', { source })), /UNSUPPORTED/);
  for (const field of ['ownerId', 'purpose', 'category', 'featureSchema'])
    assert.throws(() => m.update(event(m, '3', 'left', { scope: { ...e.scope, [field]: 'different' } })), /SCOPE/);
  assert.equal(m.summary().evidenceCount, 1);
});

test('source label alone does not multiply the update and reversing presentation preserves posterior', () => {
  const a = new PreferenceModel(config()), b = new PreferenceModel(config());
  a.update(event(a, 'x'));
  b.update(event(b, 'x', 'right', { source: 'confirmed_refund_comparison', left: [0, 1], right: [1, 0] }));
  a.posterior.forEach((p, i) => close(p, b.posterior[i]));
});

test('retraction replays original prior; saved events reconstruct the same posterior', () => {
  const m = new PreferenceModel(config());
  m.update(event(m, 'a')); m.update(event(m, 'b', 'right'));
  m.retract({ evidenceId: 'a', actorId: 'alice', reason: 'user correction' });
  const fresh = new PreferenceModel(config()); fresh.update(event(fresh, 'b', 'right'));
  m.posterior.forEach((p, i) => close(p, fresh.posterior[i]));
  assert.deepEqual(PreferenceModel.restore(m.export()).summary(), m.summary());
  assert.throws(() => m.retract({ evidenceId: 'b', actorId: 'other', reason: 'x' }), /UNAUTHORIZED/);
});

test('only compatible frozen same-user parent transfers; child never updates parent', () => {
  const parent = new PreferenceModel(config({ gridSteps: 8 }));
  for (let i = 0; i < 6; i++) parent.update(event(parent, `p${i}`));
  const snapshot = digest(parent.export());
  const child = new PreferenceModel(config({ category: 'software/api', gridSteps: 8 }), { parent, transferConcentration: 5 });
  assert.ok(child.summary().weights[0].mean > .5);
  assert.throws(() => child.update(event(child, 'p0')), /ANCESTOR_EVIDENCE_REUSE/);
  child.update(event(child, 'c0', 'right'));
  assert.equal(digest(parent.export()), snapshot);
  assert.deepEqual(PreferenceModel.restore(child.export()).summary(), child.summary());
  for (const extra of [{ ownerId: 'bob', category: 'software/api' }, { purpose: 'other', category: 'software/api' }, { category: 'travel' }, { category: 'software/api', featureSchema: 'other' }])
    assert.throws(() => new PreferenceModel(config(extra), { parent, transferConcentration: 5 }), /INCOMPATIBLE/);
  const uniformChild = new PreferenceModel(config({ category: 'software/other' }), { parent, transferConcentration: 0 });
  close(uniformChild.summary().weights[0].mean, .5);
});

test('query selection excludes repeats and zero-information pairs', () => {
  const m = new PreferenceModel(config()), profile = new LearningProfile(m);
  const noInformation = [{ id: 'same1', features: [.5, .5] }, { id: 'same2', features: [.5, .5] }];
  close(m.bestQuestion(noInformation).informationGainBits, 0);
  assert.equal(profile.issueQuery({ objective: 'information_gain', id: 'zero', candidates: noInformation, issuedAt: 0, expiresAt: 10 }).status, 'NO_INFORMATIVE_QUERY');
  const issued = profile.issueQuery({ objective: 'information_gain', id: 'q', candidates: menu, issuedAt: 10, expiresAt: 20 });
  assert.equal(issued.status, 'ASK');
  assert.throws(() => profile.answer({ queryId: 'q', evidenceId: 'e', actorId: 'mallory', choice: 'left', now: 11 }), /UNAUTHORIZED/);
  assert.throws(() => profile.answer({ queryId: 'q', evidenceId: 'e', actorId: 'alice', choice: 'left', now: 20 }), /EXPIRED/);
  const response = { queryId: 'q', evidenceId: 'e', actorId: 'alice', choice: 'left', now: 11 };
  assert.equal(profile.answer(response).applied, true);
  assert.equal(profile.answer({ ...response, now: 100 }).applied, false);
  assert.throws(() => profile.answer({ ...response, choice: 'right' }), /CONFLICT/);
  assert.equal(profile.issueQuery({ objective: 'information_gain', id: 'q2', candidates: menu, issuedAt: 12, expiresAt: 20 }).status, 'NO_INFORMATIVE_QUERY');
});

test('skip is not a negative label', () => {
  const profile = new LearningProfile(new PreferenceModel(config()));
  profile.issueQuery({ objective: 'information_gain', id: 'q', candidates: menu, issuedAt: 1, expiresAt: 10 });
  profile.answer({ queryId: 'q', evidenceId: 'e', actorId: 'alice', choice: 'skip', now: 2, left: [99, 0] });
  assert.equal(profile.model.summary().evidenceCount, 0);
});

test('answer ignores supplied vectors and returned query copies cannot change saved presentation', () => {
  const profile = new LearningProfile(new PreferenceModel(config()));
  const issued = profile.issueQuery({ objective: 'information_gain', id: 'q', candidates: menu, issuedAt: 1, expiresAt: 10 });
  issued.query.left.features = [0, 1];
  profile.answer({ queryId: 'q', evidenceId: 'e', actorId: 'alice', choice: 'left', now: 2, left: [0, 1], right: [1, 0] });
  close(profile.model.summary().weights[0].mean, 2 / 3);
});

test('regret-based decision gates cannot authorize payment, even after opt-in', () => {
  const profile = new LearningProfile(new PreferenceModel(config()));
  const policy = { ownerId: 'alice', purpose: 'sandbox', category: 'software', featureSchema: 'toy-v1', preferenceEpochId: 'initial', approvalRef: 'TEST-POLICY',
    regretTolerance: .1, maxExpectedRegret: 1, maxTailProbability: 1, questionCost: 1,
    allowLearnedProposals: false, validationStatus: 'synthetic_only' };
  assert.equal(profile.decide(menu, policy).action, 'DEFER_TO_USER');
  const ready = profile.decide(menu, { ...policy, allowLearnedProposals: true, validationStatus: 'validated_for_scope' });
  assert.equal(ready.action, 'DEFER_TO_USER');
  assert.equal(ready.reason, 'EPOCH_AUTHORITY_REQUIRED');
  assert.equal(ready.paymentAuthorized, false); assert.equal(ready.mandateChange, null);
  const ask = profile.decide(menu, { ...policy, maxExpectedRegret: 0, questionCost: 0 });
  assert.equal(ask.action, 'ASK');
  assert.ok(ask.question.regretReduction > 0);
  assert.throws(() => profile.decide(menu, { ...policy, ownerId: 'other' }), /POLICY_REQUIRED/);
});

test('malformed data and unsupported numerical settings are rejected', () => {
  for (const bad of [{ gridSteps: 0 }, { betas: [0] }, { lapse: 1 }, { features: ['same', 'same'] }])
    assert.throws(() => new PreferenceModel(config(bad)));
  const m = new PreferenceModel(config());
  for (const bad of [[NaN, 0], [2, 0], [-1, 1], [1]]) assert.throws(() => m.predict(bad, [0, 1]), /VECTOR/);
  assert.throws(() => m.rank([]), /CANDIDATES/);
  assert.throws(() => m.rank([{ id: 'a', features: [1, 0] }, { id: 'a', features: [0, 1] }]), /DUPLICATE/);
});

test('log-space update recovers tiny hypotheses after long contrary evidence', () => {
  const m = new PreferenceModel(config({ betas: [8] }));
  for (let i = 0; i < 120; i++) m.update(event(m, `left-${i}`));
  assert.ok(m.summary().weights[0].mean > .999);
  for (let i = 0; i < 120; i++) m.update(event(m, `right-${i}`, 'right'));
  close(m.summary().weights[0].mean, .5, 1e-9);
});
