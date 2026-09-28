import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PreferenceModel, digest } from '../model.mjs';
import { LearningProfile } from '../profile.mjs';
import { EpochAuthority } from '../epoch-authority.mjs';

const config = { ownerId: 'alice', purpose: 'sandbox', category: 'software', featureSchema: 'toy-v1', features: ['price', 'refund'], gridSteps: 4, betas: [1, 4], lapse: .05 };
const menu = [{ id: 'a', features: [1, 0] }, { id: 'b', features: [0, 1] }];
const policy = { ...config, preferenceEpochId: 'initial', approvalRef: 'TEST-ONLY', regretTolerance: 1, maxExpectedRegret: 1,
  maxTailProbability: 1, questionCost: 1, allowLearnedProposals: true, validationStatus: 'validated_for_scope' };

test('late async response cannot cross an epoch boundary or change the new posterior', async t => {
  const authority = new EpochAuthority(':memory:'); t.after(() => authority.close());
  const model = new PreferenceModel(config); authority.enrollInitial(model.export());
  const profile = new LearningProfile(model, { epochAuthority: authority });
  profile.issueQuery({ id: 'pending', objective: 'information_gain', candidates: menu, issuedAt: 1, expiresAt: 100 });
  let release;
  const verificationFinished = new Promise(resolve => { release = resolve; });
  const lateResponse = (async () => {
    await verificationFinished; // Simulates asynchronous authentication/verification BEFORE the guarded mutation.
    return profile.answer({ queryId: 'pending', evidenceId: 'late', actorId: 'alice', choice: 'left', now: 4 });
  })();
  profile.beginPreferenceEpoch({ id: 'second', actorId: 'alice', reason: 'needs changed', now: 3 });
  const hash = digest(profile.model.export());
  release();
  await assert.rejects(lateResponse, /UNKNOWN_QUERY/);
  assert.equal(digest(profile.model.export()), hash);
});

test('old model, policy, proposal and stale worker fail against the independent active epoch', t => {
  const authority = new EpochAuthority(':memory:'); t.after(() => authority.close());
  const model = new PreferenceModel(config), old = model.export(); authority.enrollInitial(old);
  const current = new LearningProfile(model, { epochAuthority: authority });
  const staleWorker = new LearningProfile(PreferenceModel.restore(old), { epochAuthority: authority });
  staleWorker.issueQuery({ id: 'old-query', objective: 'information_gain', candidates: menu, issuedAt: 1, expiresAt: 100 });
  const proposal = current.decide(menu, policy);
  assert.equal(proposal.action, 'READY_TO_PROPOSE');
  assert.equal(current.checkProposalFreshness(proposal).paymentAuthorized, false);
  current.beginPreferenceEpoch({ id: 'second', actorId: 'alice', reason: 'changed', now: 2 });
  assert.throws(() => new LearningProfile(PreferenceModel.restore(old), { epochAuthority: authority }), /STALE_PREFERENCE_EPOCH/);
  assert.throws(() => authority.enrollInitial(old), /STALE_PREFERENCE_EPOCH/);
  assert.throws(() => staleWorker.decide(menu, policy), /STALE_PREFERENCE_EPOCH/);
  assert.throws(() => staleWorker.answer({ queryId: 'old-query', evidenceId: 'late', actorId: 'alice', choice: 'left', now: 3 }), /STALE_PREFERENCE_EPOCH/);
  assert.throws(() => current.decide(menu, policy), /POLICY_EPOCH_MISMATCH/);
  assert.throws(() => current.checkProposalFreshness(proposal), /STALE_PREFERENCE_PROPOSAL/);
  assert.deepEqual(authority.current(config), { preferenceEpochId: 'second', preferenceEpochSequence: 1 });
});

test('active epoch survives database reopen and blocks rollback across independent connections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'learning-epoch-')), path = join(directory, 'epochs.sqlite');
  let first = new EpochAuthority(path), second = new EpochAuthority(path);
  try {
    const model = new PreferenceModel(config), old = model.export(); first.enrollInitial(old);
    const a = new LearningProfile(model, { epochAuthority: first });
    const b = new LearningProfile(PreferenceModel.restore(old), { epochAuthority: second });
    a.beginPreferenceEpoch({ id: 'next', actorId: 'alice', reason: 'explicit change', now: 10 });
    assert.throws(() => b.decide(menu, policy), /STALE_PREFERENCE_EPOCH/);
    first.close(); first = null; second.close(); second = null;
    first = new EpochAuthority(path);
    assert.throws(() => new LearningProfile(PreferenceModel.restore(old), { epochAuthority: first }), /STALE_PREFERENCE_EPOCH/);
    const recovered = new LearningProfile(PreferenceModel.restore(first.currentInitialSnapshot(config)), { epochAuthority: first });
    assert.equal(recovered.epochId, 'next'); assert.equal(recovered.epochSequence, 1);
    assert.throws(() => recovered.decide(menu, policy), /POLICY_EPOCH_MISMATCH/);
  } finally {
    first?.close(); second?.close();
    unlinkSync(path); rmdirSync(directory); // Only our named file and now-empty temporary directory.
  }
});
