import { ensure } from './model.mjs';

// Fixed, versioned anchors; do NOT renormalize using the currently offered candidate set.
// These anchors define a DEMO utility model and are not learned customer preferences.
export const API_CREDIT_FEATURES = Object.freeze({
  id: 'api-credit-features-v1', names: Object.freeze(['affordability', 'refundability', 'quantity']),
  priceMaxMinor: 4000, refundMaxHours: 168, quantityMax: 200, unit: 'TestCredit/100',
});
function integer(value) {
  ensure(typeof value === 'string' && /^(0|[1-9]\d{0,11})$/.test(value), 'INVALID_OFFER_FEATURE');
  return Number(value);
}
export function apiCreditFeatures(record, schema = API_CREDIT_FEATURES) {
  ensure(schema.id === API_CREDIT_FEATURES.id, 'UNKNOWN_FEATURE_SCHEMA');
  // For this version anchors cannot silently change under the same schema ID.
  ensure(schema.priceMaxMinor === 4000 && schema.refundMaxHours === 168 && schema.quantityMax === 200, 'FEATURE_SCHEMA_CHANGED');
  const o = record.offer;
  const price = integer(o.total), refund = integer(o.refundHours), quantity = integer(o.quantity);
  ensure(price <= schema.priceMaxMinor && refund <= schema.refundMaxHours && quantity <= schema.quantityMax, 'OUT_OF_FEATURE_SUPPORT');
  return [1 - price / schema.priceMaxMinor, refund / schema.refundMaxHours, quantity / schema.quantityMax];
}

// The supplied verifier is the product's deterministic checkOffer(session, record, domain, {now}).
// All records, even ones later excluded for missing features, are independently checked.
export function eligiblePreferenceCandidates({ session, records, domain, now, verifyOffer }) {
  ensure(typeof verifyOffer === 'function', 'POLICY_VERIFIER_REQUIRED');
  const eligible = [], excluded = [];
  for (const record of records) {
    const verdict = verifyOffer(session, record, domain, { now });
    if (verdict?.allowed !== true) { excluded.push({ id: record.offer?.offerId ?? null, reason: verdict?.reason ?? 'POLICY_REJECTED' }); continue; }
    try { eligible.push({ id: record.offer.offerId, features: apiCreditFeatures(record) }); }
    catch (error) { excluded.push({ id: record.offer.offerId, reason: error.message }); }
  }
  ensure(new Set(eligible.map(x => x.id)).size === eligible.length, 'DUPLICATE_CANDIDATE');
  return { eligible, excluded, featureSchema: API_CREDIT_FEATURES.id, paymentAuthorized: false };
}
