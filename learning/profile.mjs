import { PreferenceModel, ensure, clone, digest } from './model.mjs';
import { EpochAuthority, preferenceScope } from './epoch-authority.mjs';

// Application boundary: actorId MUST come from authenticated server context, never model output.
// Candidates MUST come from the policy/feature adapter, never client-supplied numeric vectors.
export class LearningProfile {
  #model; #queries = new Map(); #audit = []; #archivedEpochs = []; #authority;
  constructor(model, { epochAuthority = null } = {}) {
    ensure(model instanceof PreferenceModel, 'INVALID_MODEL');
    ensure(epochAuthority === null || epochAuthority instanceof EpochAuthority, 'INVALID_EPOCH_AUTHORITY');
    this.#model = model; this.#authority = epochAuthority;
    this.#authority?.assertCurrent(model.config);
  }
  get model() { return this.#model; }
  get audit() { return clone(this.#audit); }
  get epochId() { return this.#model.config.preferenceEpochId ?? 'initial'; }
  get epochSequence() { return this.#model.config.preferenceEpochSequence ?? 0; }
  get archivedEpochs() { return clone(this.#archivedEpochs); }
  beginPreferenceEpoch({ id, actorId, reason, now }) {
    ensure(actorId === this.#model.config.ownerId, 'UNAUTHORIZED_FEEDBACK');
    ensure(typeof id === 'string' && id.length && id !== this.epochId && !this.#archivedEpochs.some(x => x.epochId === id), 'DUPLICATE_PREFERENCE_EPOCH');
    ensure(typeof reason === 'string' && reason.trim().length > 0, 'PREFERENCE_CHANGE_REASON_REQUIRED');
    const lastTime = Math.max(this.#model.config.preferenceEpochStartedAt ?? 0, this.#model.summary().lastObservedAt ?? 0,
      ...[...this.#queries.values()].map(q => q.issuedAt));
    ensure(Number.isSafeInteger(now) && now >= lastTime, 'INVALID_EPOCH_TIME');
    const previous = { epochId: this.epochId, modelSnapshot: this.#model.export(), queries: clone([...this.#queries.values()]) };
    const config = { ...this.#model.config, preferenceEpochId: id, preferenceEpochSequence: this.epochSequence + 1, preferenceEpochStartedAt: now };
    const nextModel = new PreferenceModel(config); // Original symmetric prior; deliberately no parent transfer.
    const transition = { type: 'PREFERENCE_EPOCH_STARTED', actorId, reason, now, previousEpochId: previous.epochId, epochId: id,
      preferenceEpochSequence: config.preferenceEpochSequence, previousSnapshotHash: digest(previous.modelSnapshot), previousModelSnapshot: previous.modelSnapshot, invalidatedQueryIds: previous.queries.map(q => q.id) };
    this.#authority?.advance(this.#model.config, nextModel.export(), transition);
    this.#archivedEpochs.push(previous);
    this.#model = nextModel;
    this.#queries.clear();
    this.#audit.push(transition);
    return { applied: true, ...clone(transition), after: this.#model.summary(), paymentAuthorized: false };
  }
  issueQuery({ id, candidates, objective, issuedAt, expiresAt }) {
    const args = { id, candidates, objective, issuedAt, expiresAt };
    return this.#authority ? this.#authority.runCurrent(this.#model.config, () => this.#issueQuery(args)) : this.#issueQuery(args);
  }
  #issueQuery({ id, candidates, objective, issuedAt, expiresAt }) {
    ensure(typeof id === 'string' && id.length && !this.#queries.has(id) && !this.#archivedEpochs.some(x => x.queries.some(q => q.id === id)), 'DUPLICATE_QUERY');
    ensure(['information_gain', 'information_gain_weights', 'regret_reduction'].includes(objective), 'QUERY_OBJECTIVE_REQUIRED');
    ensure(Number.isSafeInteger(issuedAt) && Number.isSafeInteger(expiresAt) && issuedAt < expiresAt && issuedAt >= (this.#model.config.preferenceEpochStartedAt ?? 0), 'INVALID_QUERY_TIME');
    const previous = [...this.#queries.values()].map(q => [q.left.id, q.right.id]);
    const question = this.#model.bestQuestion(candidates, { excludedPairs: previous, objective });
    if (!question || question.score <= 1e-12) return { status: 'NO_INFORMATIVE_QUERY' };
    const c = this.#model.config;
    const query = { id, preferenceEpochId: this.epochId, scope: { ownerId: c.ownerId, purpose: c.purpose, category: c.category, featureSchema: c.featureSchema },
      left: clone(candidates.find(x => x.id === question.leftId)), right: clone(candidates.find(x => x.id === question.rightId)),
      issuedAt, expiresAt, acquisition: question, answered: null };
    query.presentationHash = digest({ scope: query.scope, preferenceEpochId: query.preferenceEpochId, left: query.left, right: query.right, issuedAt, expiresAt });
    this.#queries.set(id, query);
    return { status: 'ASK', query: clone(query) };
  }
  answer({ queryId, evidenceId, actorId, choice, source = 'explicit_comparison', now }) {
    const args = { queryId, evidenceId, actorId, choice, source, now };
    return this.#authority ? this.#authority.runCurrent(this.#model.config, () => this.#answer(args)) : this.#answer(args);
  }
  #answer({ queryId, evidenceId, actorId, choice, source, now }) {
    ensure(actorId === this.#model.config.ownerId, 'UNAUTHORIZED_FEEDBACK');
    const query = this.#queries.get(queryId);
    ensure(query, 'UNKNOWN_QUERY');
    ensure(query.preferenceEpochId === this.epochId, 'QUERY_EPOCH_MISMATCH');
    ensure(['left', 'right', 'skip'].includes(choice), 'PAIRWISE_CHOICE_REQUIRED');
    ensure(['explicit_comparison', 'confirmed_refund_comparison'].includes(source), 'UNSUPPORTED_FEEDBACK_SOURCE');
    ensure(typeof evidenceId === 'string' && evidenceId.length, 'INVALID_EVIDENCE');
    const response = { evidenceId, actorId, choice, source };
    if (query.answered) {
      ensure(digest(query.answered) === digest(response), 'FEEDBACK_CONFLICT');
      return { applied: false, reason: 'IDEMPOTENT_REPLAY' };
    }
    ensure(Number.isSafeInteger(now) && now >= query.issuedAt && now < query.expiresAt, 'QUERY_EXPIRED');
    ensure(!this.#archivedEpochs.some(x => x.modelSnapshot.evidence.some(e => e.id === evidenceId)), 'ARCHIVED_EVIDENCE_REUSE');
    let result = { applied: false, reason: 'USER_SKIPPED' };
    if (choice !== 'skip') result = this.#model.update({ id: evidenceId, queryId, actorId, scope: query.scope, presentationHash: query.presentationHash,
      left: query.left.features, right: query.right.features, choice, source, observedAt: now, preferenceEpochId: query.preferenceEpochId });
    query.answered = response;
    this.#audit.push({ type: choice === 'skip' ? 'SKIPPED' : 'PREFERENCE_UPDATED', queryId, ...response, now, modelSnapshotHash: digest(this.#model.export()) });
    return result;
  }
  decide(candidates, decisionPolicy) {
    return this.#authority ? this.#authority.runCurrent(this.#model.config, () => this.#decide(candidates, decisionPolicy)) : this.#decide(candidates, decisionPolicy);
  }
  #decide(candidates, decisionPolicy) {
    const c = this.#model.config;
    ensure(decisionPolicy?.preferenceEpochId === this.epochId, 'DECISION_POLICY_EPOCH_MISMATCH');
    ensure(decisionPolicy?.ownerId === c.ownerId && decisionPolicy.purpose === c.purpose && decisionPolicy.category === c.category && decisionPolicy.featureSchema === c.featureSchema && typeof decisionPolicy.approvalRef === 'string' && decisionPolicy.approvalRef.length, 'DECISION_POLICY_REQUIRED');
    for (const k of ['regretTolerance', 'maxExpectedRegret', 'maxTailProbability', 'questionCost']) ensure(Number.isFinite(decisionPolicy[k]) && decisionPolicy[k] >= 0 && decisionPolicy[k] <= 1, 'INVALID_DECISION_POLICY');
    const ranking = this.#model.rank(candidates, decisionPolicy);
    const top = ranking[0];
    const meetsRisk = top.expectedRegret <= decisionPolicy.maxExpectedRegret + 1e-12 && top.probabilityRegretExceedsTolerance <= decisionPolicy.maxTailProbability + 1e-12;
    const previous = [...this.#queries.values()].map(q => [q.left.id, q.right.id]);
    const question = this.#model.bestQuestion(candidates, { objective: 'regret_reduction', excludedPairs: previous });
    let action = 'DEFER_TO_USER';
    let reason = 'RISK_EXCEEDS_APPROVED_TOLERANCE';
    // Recommendation is NEVER authorization. Auto-proposal also requires a deployment validation gate.
    if (meetsRisk && this.#authority && decisionPolicy.allowLearnedProposals === true && decisionPolicy.validationStatus === 'validated_for_scope') {
      action = 'READY_TO_PROPOSE'; reason = 'WITHIN_APPROVED_RANKING_RISK';
    } else if (question && question.regretReduction > decisionPolicy.questionCost + 1e-12) {
      action = 'ASK'; reason = 'EXPECTED_RANKING_BENEFIT_EXCEEDS_QUESTION_COST';
    } else if (meetsRisk) reason = this.#authority ? 'DEPLOYMENT_VALIDATION_OR_OPT_IN_REQUIRED' : 'EPOCH_AUTHORITY_REQUIRED';
    return { action, reason, ranking, question, paymentAuthorized: false, mandateChange: null,
      scope: preferenceScope(c), preferenceEpochId: this.epochId, preferenceEpochSequence: this.epochSequence,
      empiricalValidationClaim: decisionPolicy.validationStatus, modelSnapshotHash: digest(this.#model.export()) };
  }
  checkProposalFreshness(proposal) {
    ensure(this.#authority, 'EPOCH_AUTHORITY_REQUIRED');
    return this.#authority.runCurrent(this.#model.config, () => {
      ensure(proposal?.preferenceEpochId === this.epochId && proposal.preferenceEpochSequence === this.epochSequence &&
        digest(proposal.scope) === digest(preferenceScope(this.#model.config)) && proposal.modelSnapshotHash === digest(this.#model.export()), 'STALE_PREFERENCE_PROPOSAL');
      return { current: true, paymentAuthorized: false };
    });
  }
}
