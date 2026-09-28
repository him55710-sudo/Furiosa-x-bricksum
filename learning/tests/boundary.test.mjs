import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOffer } from '../../src/policy.mjs';
import { PreferenceModel } from '../model.mjs';
import { LearningProfile } from '../profile.mjs';
import { API_CREDIT_FEATURES, apiCreditFeatures } from '../features.mjs';
import { recommendVerifiedOffers, verifiedMenu } from '../product-adapter.mjs';
import { deriveFeeControl, requiresFirmQuote } from '../control.mjs';
import { fixtureSession, signedOffer, domain, fixtureNow, owner, seller } from '../fixtures.mjs';
const profile = session => new LearningProfile(new PreferenceModel({ ownerId: owner.address, purpose: session.policy.purposeId,
  category: 'software/api-credit', featureSchema: API_CREDIT_FEATURES.id, features: API_CREDIT_FEATURES.names,
  gridSteps: 10, betas: [1, 2, 4], lapse: .05 }));
const decisionPolicy = p => ({ ownerId: owner.address, purpose: p.model.config.purpose, category: p.model.config.category,
  featureSchema: API_CREDIT_FEATURES.id,
  preferenceEpochId: 'initial', approvalRef: 'OFFLINE-TEST-POLICY', regretTolerance: .05, maxExpectedRegret: .05, maxTailProbability: .1, questionCost: .01,
  allowLearnedProposals: false, validationStatus: 'synthetic_only' });

test('real EIP-712 verification precedes ranking; caps, invalid signatures, expiry and OOD excluded', async () => {
  const session = fixtureSession(), p = profile(session), before = structuredClone(session);
  const good = await signedOffer('good');
  const overCap = await signedOffer('over', { subtotal: '900', fee: '201', total: '1101', refundHours: '168', quantity: '200' });
  const tampered = structuredClone(good); tampered.offer.refundHours = '168';
  const expired = await signedOffer('expired', { expiresAt: '99' });
  const ood = await signedOffer('ood', { quantity: '201' });
  const result = recommendVerifiedOffers({ profile: p, session, domain, now: fixtureNow, authenticatedOwner: owner.address,
    records: [overCap, good, tampered, expired, ood], decisionPolicy: decisionPolicy(p) });
  assert.deepEqual(result.ranking.map(x => x.id), [good.offer.offerId]);
  assert.deepEqual(result.excluded.map(x => x.reason), ['PER_PURCHASE_LIMIT_EXCEEDED', 'INVALID_OFFER_SIGNATURE', 'OFFER_EXPIRED', 'OUT_OF_FEATURE_SUPPORT']);
  assert.deepEqual(session, before);
  assert.equal(result.paymentAuthorized, false);
});

test('menu rejection and scope checks do not produce an authorized purchase', async () => {
  const session = fixtureSession(), p = profile(session), record = await signedOffer('a');
  const args = { profile: p, session, records: [record], domain, now: fixtureNow, authenticatedOwner: owner.address, decisionPolicy: decisionPolicy(p) };
  assert.throws(() => verifiedMenu({ ...args, authenticatedOwner: seller.address }), /OWNER_SCOPE/);
  session.status = 'STOPPED';
  const result = recommendVerifiedOffers(args);
  assert.equal(result.action, 'DEFER_TO_USER'); assert.equal(result.reason, 'NO_ELIGIBLE_OFFERS');
  assert.equal(result.paymentAuthorized, false);
});

test('fixed anchors prevent unrelated menu offers changing an existing feature vector', async () => {
  const a = await signedOffer('a');
  assert.deepEqual(apiCreditFeatures(a), [.85, 24 / 168, .5]);
  assert.throws(() => apiCreditFeatures(a, { ...API_CREDIT_FEATURES, priceMaxMinor: 8000 }), /SCHEMA_CHANGED/);
  assert.throws(() => apiCreditFeatures({ offer: { ...a.offer, total: '1e2' } }), /INVALID_OFFER_FEATURE/);
});

test('fee control requires verified causal fee failure, and adds only a scoped quote requirement', async () => {
  const session = fixtureSession(), before = structuredClone(session);
  const record = await signedOffer('fee', { subtotal: '900', fee: '200', total: '1100' });
  const args = { session, record, domain, now: fixtureNow, verifyOffer: checkOffer };
  const first = deriveFeeControl(args);
  assert.equal(first.created, true); assert.equal(first.controls.length, 1);
  assert.deepEqual(session, before);
  const scope = { owner: owner.address, purpose: session.policy.purposeId, merchant: seller.address };
  assert.equal(requiresFirmQuote(first.controls, scope), true);
  assert.equal(requiresFirmQuote(first.controls, { ...scope, merchant: owner.address }), false);
  assert.equal(requiresFirmQuote(first.controls, { ...scope, purpose: 'hotel' }), false);
  const repeat = deriveFeeControl({ ...args, priorControls: first.controls });
  assert.equal(repeat.created, false); assert.deepEqual(repeat.controls, first.controls);
  const reformed = await signedOffer('reformed', { subtotal: '800', fee: '0', total: '800' });
  assert.equal(checkOffer(session, reformed, domain, { now: fixtureNow }).allowed, true);
  assert.equal(deriveFeeControl({ ...args, record: reformed, priorControls: first.controls }).created, false);
});

test('no control from tampered evidence, high base price, unapproved hardening, or unrelated budget failure', async () => {
  const session = fixtureSession();
  const highBase = await signedOffer('high', { subtotal: '1100', fee: '100', total: '1200' });
  const fee = await signedOffer('fee2', { subtotal: '900', fee: '200', total: '1100' });
  const tampered = structuredClone(fee); tampered.offer.total = '1200';
  const args = { session, domain, now: fixtureNow, verifyOffer: checkOffer };
  assert.equal(deriveFeeControl({ ...args, record: highBase }).reason, 'FEE_CAUSALITY_NOT_ESTABLISHED');
  assert.equal(deriveFeeControl({ ...args, record: tampered }).reason, 'NO_VERIFIED_FEE_FAILURE');
  session.spent = '1500'; // Remaining cap 500 is below subtotal, so the fee did not cause the failure.
  assert.equal(deriveFeeControl({ ...args, record: fee }).created, false);
  session.policy.autoHarden = false;
  assert.equal(deriveFeeControl({ ...args, record: fee }).reason, 'HARDENING_NOT_APPROVED');
});
