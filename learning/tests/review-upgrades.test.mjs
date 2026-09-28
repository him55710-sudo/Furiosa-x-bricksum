import test from 'node:test';
import assert from 'node:assert/strict';
import { PreferenceModel, digest } from '../model.mjs';
import { LearningProfile } from '../profile.mjs';
import { pairedBootstrap } from '../statistics.mjs';

const config = { ownerId: 'alice', purpose: 'sandbox', category: 'software', featureSchema: 'toy-v1', features: ['price', 'refund'], gridSteps: 4, betas: [1, 4], lapse: .05 };
const menu = [{ id: 'a', features: [1, 0] }, { id: 'b', features: [0, 1] }];
const policy = { ownerId: 'alice', purpose: 'sandbox', category: 'software', featureSchema: 'toy-v1', preferenceEpochId: 'initial',
  approvalRef: 'TEST', regretTolerance: 1, maxExpectedRegret: 1, maxTailProbability: 1, questionCost: 1, allowLearnedProposals: true, validationStatus: 'validated_for_scope' };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('weights-only information ignores pure beta learning and never exceeds joint information', () => {
  const model = new PreferenceModel(config);
  const betaOnly = [{ id: 'a', features: [.9, .9] }, { id: 'b', features: [.1, .1] }];
  const question = model.bestQuestion(betaOnly, { objective: 'information_gain_weights' });
  assert.ok(question.informationGainBits > .001);
  close(question.weightInformationGainBits, 0);
  const q = model.bestQuestion(menu, { objective: 'information_gain_weights' });
  assert.ok(q.weightInformationGainBits > 0);
  assert.ok(q.weightInformationGainBits <= q.informationGainBits + 1e-12);
  const fixed = new PreferenceModel({ ...config, betas: [2] }).bestQuestion(menu);
  close(fixed.weightInformationGainBits, fixed.informationGainBits);
});

test('caller must choose question objective; a beta-only comparison is not a weight-information question', () => {
  const profile = new LearningProfile(new PreferenceModel(config));
  assert.throws(() => profile.issueQuery({ id: 'a', candidates: menu, issuedAt: 1, expiresAt: 10 }), /QUERY_OBJECTIVE_REQUIRED/);
  const result = profile.issueQuery({ id: 'b', objective: 'information_gain_weights',
    candidates: [{ id: 'a', features: [.9, .9] }, { id: 'b', features: [.1, .1] }], issuedAt: 1, expiresAt: 10 });
  assert.equal(result.status, 'NO_INFORMATIVE_QUERY');
});

test('explicit preference change clears old posterior, invalidates queries and old approval epoch', () => {
  const profile = new LearningProfile(new PreferenceModel(config));
  profile.issueQuery({ id: 'q1', objective: 'information_gain', candidates: menu, issuedAt: 1, expiresAt: 100 });
  profile.answer({ queryId: 'q1', evidenceId: 'e1', actorId: 'alice', choice: 'left', now: 2 });
  profile.issueQuery({ id: 'pending', objective: 'information_gain', candidates: menu.map(c => ({ ...c, id: `new-${c.id}` })), issuedAt: 3, expiresAt: 100 });
  assert.ok(profile.model.summary().weights[0].mean > .5);
  const oldSnapshot = profile.model.export(), before = digest(oldSnapshot);
  assert.throws(() => profile.beginPreferenceEpoch({ id: 'changed', actorId: 'other', reason: 'x', now: 4 }), /UNAUTHORIZED/);
  assert.throws(() => profile.beginPreferenceEpoch({ id: 'changed', actorId: 'alice', reason: '', now: 4 }), /REASON/);
  assert.throws(() => profile.beginPreferenceEpoch({ id: 'changed', actorId: 'alice', reason: 'x', now: 0 }), /TIME/);
  const result = profile.beginPreferenceEpoch({ id: 'changed', actorId: 'alice', reason: 'My needs changed', now: 4 });
  assert.equal(result.paymentAuthorized, false);
  assert.equal(profile.model.summary().evidenceCount, 0);
  assert.equal(profile.model.summary().parentSnapshotHash, null);
  close(profile.model.summary().weights[0].mean, .5);
  assert.equal(digest(profile.archivedEpochs[0].modelSnapshot), before);
  assert.throws(() => profile.answer({ queryId: 'pending', evidenceId: 'late', actorId: 'alice', choice: 'left', now: 5 }), /UNKNOWN_QUERY/);
  assert.throws(() => profile.decide(menu, policy), /EPOCH_MISMATCH/);
  assert.throws(() => profile.model.update(oldSnapshot.evidence[0]), /EPOCH_MISMATCH/);
  assert.throws(() => profile.issueQuery({ id: 'backdated', objective: 'information_gain', candidates: menu, issuedAt: 1, expiresAt: 100 }), /INVALID_QUERY_TIME/);
  assert.throws(() => profile.beginPreferenceEpoch({ id: 'changed', actorId: 'alice', reason: 'again', now: 6 }), /DUPLICATE/);
  assert.equal(new LearningProfile(PreferenceModel.restore(profile.model.export())).epochId, 'changed');
  const newPolicy = { ...policy, preferenceEpochId: 'changed', validationStatus: 'synthetic_only' };
  assert.equal(profile.decide(menu, newPolicy).action, 'DEFER_TO_USER');
});

test('beginning a new epoch discards inherited old preference rather than silently transferring it', () => {
  const parent = new PreferenceModel(config);
  const child = new PreferenceModel({ ...config, category: 'software/api' }, { parent, transferConcentration: 20 });
  const profile = new LearningProfile(child);
  assert.ok(profile.model.summary().parentSnapshotHash);
  profile.beginPreferenceEpoch({ id: 'second', actorId: 'alice', reason: 'new needs', now: 1 });
  assert.equal(profile.model.summary().parentSnapshotHash, null);
  close(profile.model.summary().weights[0].mean, .5);
  assert.throws(() => new PreferenceModel({ ...config, category: 'software/api', preferenceEpochId: 'different' }, { parent, transferConcentration: 20 }), /PARENT_EPOCH/);
});

test('paired bootstrap matches by subject identity, retains exact zero, and rejects missing subjects', () => {
  const left = [{ seed: 1, loss: 3 }, { seed: 2, loss: 4 }, { seed: 3, loss: 5 }];
  const right = [{ seed: 3, loss: 4 }, { seed: 1, loss: 2 }, { seed: 2, loss: 3 }];
  const result = pairedBootstrap(left, right, 'loss');
  assert.equal(result.meanDifference, 1); assert.deepEqual(result.percentileBootstrap95, [1, 1]);
  const identical = pairedBootstrap(left, left, 'loss');
  assert.deepEqual(identical.percentileBootstrap95, [0, 0]); assert.equal(identical.excludesZero, false);
  assert.throws(() => pairedBootstrap(left, right.slice(1), 'loss'), /SUBJECTS/);
  assert.throws(() => pairedBootstrap(left, [...right.slice(0, 2), { seed: 4, loss: 3 }], 'loss'), /UNPAIRED/);
  assert.deepEqual(pairedBootstrap(left, right, 'loss'), result);
});
