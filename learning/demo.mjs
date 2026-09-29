import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PreferenceModel, digest, dot } from './model.mjs';
import { LearningProfile } from './profile.mjs';
import { API_CREDIT_FEATURES } from './features.mjs';
import { verifiedMenu, recommendVerifiedOffers } from './product-adapter.mjs';
import { deriveFeeControl } from './control.mjs';
import { checkOffer } from '../src/policy.mjs';
import { fixtureSession, signedOffer, owner, domain, fixtureNow } from './fixtures.mjs';

const session = fixtureSession(), sessionBefore = digest(session);
const model = new PreferenceModel({ ownerId: owner.address, purpose: session.policy.purposeId, category: 'software/api-credit',
  featureSchema: API_CREDIT_FEATURES.id, features: API_CREDIT_FEATURES.names, gridSteps: 20, betas: [1, 2, 4], lapse: .05 });
const profile = new LearningProfile(model);
const decisionPolicy = { ownerId: owner.address, purpose: session.policy.purposeId, category: 'software/api-credit',
  featureSchema: API_CREDIT_FEATURES.id, preferenceEpochId: 'initial', approvalRef: 'OFFLINE-ILLUSTRATIVE-THRESHOLDS', regretTolerance: .05,
  maxExpectedRegret: .02, maxTailProbability: .1, questionCost: .005, allowLearnedProposals: false, validationStatus: 'synthetic_only' };
const hiddenFee = await signedOffer('fee', { subtotal: '900', fee: '200', total: '1100' });
const controlResult = deriveFeeControl({ session, record: hiddenFee, domain, now: fixtureNow, verifyOffer: checkOffer });
const before = model.summary(), updates = [];
let records;
for (let i = 0; i < 8; i++) {
  records = await Promise.all([
    signedOffer(`cheap-${i}`, { subtotal: String(500 + 10 * i), total: String(500 + 10 * i), refundHours: '0' }),
    signedOffer(`refundable-${i}`, { subtotal: String(820 + 10 * i), total: String(820 + 10 * i), refundHours: '168' }),
    signedOffer(`volume-${i}`, { subtotal: String(760 + 10 * i), total: String(760 + 10 * i), quantity: '200', refundHours: '24' }),
  ]);
  const args = { profile, session, records: [...records, hiddenFee], domain, now: fixtureNow + i, authenticatedOwner: owner.address };
  const menu = verifiedMenu(args);
  const issued = profile.issueQuery({ objective: 'information_gain', id: `demo-query-${i}`, candidates: menu.eligible, issuedAt: fixtureNow + i, expiresAt: 800 });
  if (issued.status !== 'ASK') break;
  const q = issued.query;
  // Explicitly SYNTHETIC respondent. This is never represented as a real user's feedback.
  const syntheticWeights = [.15, .75, .1];
  const choice = dot(syntheticWeights, q.left.features) >= dot(syntheticWeights, q.right.features) ? 'left' : 'right';
  const update = profile.answer({ queryId: q.id, evidenceId: `demo-evidence-${i}`, actorId: owner.address, choice, now: fixtureNow + i });
  updates.push({ query: q, syntheticResponse: choice, excludedBeforeQuestion: menu.excluded, update });
}
const decision = recommendVerifiedOffers({ profile, session, records, domain, now: 120, authenticatedOwner: owner.address, decisionPolicy });
const restored = PreferenceModel.restore(model.export());
const sourceHashes = {};
for (const path of ['model.mjs', 'profile.mjs', 'epoch-authority.mjs', 'features.mjs', 'product-adapter.mjs', 'control.mjs', 'demo.mjs', 'fixtures.mjs', '../src/policy.mjs', '../shared/schema.mjs'])
  sourceHashes[path] = createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
const result = { label: 'OFFLINE_SYNTHETIC_DEMO_NO_PURCHASE', before, updates, after: model.summary(), decisionPolicy, decision,
  controlResult, evidence: profile.audit, modelSnapshot: model.export(), sourceHashes,
  verification: { reconstructionMatches: digest(restored.export()) === digest(model.export()),
    mandateUnchanged: sessionBefore === digest(session), paymentAuthorized: decision.paymentAuthorized, submittedTransactions: 0, kilnCalls: 0 } };
await mkdir(new URL('./artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('./artifacts/demo.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
const rows = model.summary().weights.map((x, i) => ({ feature: x.feature, before: before.weights[i].mean, after: x.mean, credible95: x.credible95 }));
console.log(JSON.stringify({ weights: rows, decision: decision.action, verification: result.verification, artifact: 'learning/artifacts/demo.json' }, null, 2));
