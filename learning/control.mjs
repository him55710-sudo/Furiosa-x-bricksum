import { ensure, digest } from './model.mjs';

const canonicalOwner = owner => owner.toLowerCase();
// A deterministic rule compiler. No source multiplier, preference weight, or model score.
// verifyOffer must independently verify the seller signature and all earlier policy checks.
export function deriveFeeControl({ session, record, domain, now, verifyOffer, priorControls = [] }) {
  ensure(typeof verifyOffer === 'function', 'POLICY_VERIFIER_REQUIRED');
  const verdict = verifyOffer(session, record, domain, { now });
  if (session.policy?.autoHarden !== true) return { created: false, reason: 'HARDENING_NOT_APPROVED', controls: structuredClone(priorControls) };
  if (!['ALL_IN_BUDGET_EXCEEDED', 'PER_PURCHASE_LIMIT_EXCEEDED'].includes(verdict.reason) || verdict.allowed !== false) return { created: false, reason: 'NO_VERIFIED_FEE_FAILURE', controls: structuredClone(priorControls) };
  const o = record.offer, m = session.mandate;
  const available = BigInt(m.totalCap) - BigInt(session.spent ?? '0') - BigInt(session.reserved ?? '0');
  const cap = available < BigInt(m.perTxCap) ? available : BigInt(m.perTxCap);
  if (!(BigInt(o.fee) > 0n && BigInt(o.subtotal) <= cap && BigInt(o.total) > cap && BigInt(o.subtotal) + BigInt(o.fee) === BigInt(o.total))) {
    return { created: false, reason: 'FEE_CAUSALITY_NOT_ESTABLISHED', controls: structuredClone(priorControls) };
  }
  const scope = { owner: canonicalOwner(m.owner), purpose: session.policy.purposeId, merchant: canonicalOwner(o.merchant) };
  ensure(typeof scope.purpose === 'string' && scope.purpose.length, 'CONTROL_SCOPE_REQUIRED');
  const id = digest({ scope, rule: 'REQUIRE_ALL_IN_PRICE_BEFORE_NEGOTIATION', version: 1 });
  if (priorControls.some(c => c.id === id && c.status === 'ACTIVE')) return { created: false, reason: 'CONTROL_ALREADY_ACTIVE', controls: structuredClone(priorControls) };
  const evidence = { record: structuredClone(record), policyHash: m.policyHash, totalCap: m.totalCap, perTxCap: m.perTxCap, spent: session.spent ?? '0', reserved: session.reserved ?? '0', verdict: structuredClone(verdict), observedAt: now };
  const control = { id, scope, rule: 'REQUIRE_ALL_IN_PRICE_BEFORE_NEGOTIATION', version: 1, status: 'ACTIVE', sourceEvidenceHash: digest(evidence), evidence };
  return { created: true, reason: 'VERIFIED_FEE_CAUSED_CAP_FAILURE', control, controls: [...structuredClone(priorControls), control] };
}
export function requiresFirmQuote(controls, { owner, purpose, merchant }) {
  return controls.some(c => c.status === 'ACTIVE' && c.rule === 'REQUIRE_ALL_IN_PRICE_BEFORE_NEGOTIATION' && c.scope.owner === canonicalOwner(owner) && c.scope.purpose === purpose && c.scope.merchant === canonicalOwner(merchant));
}
