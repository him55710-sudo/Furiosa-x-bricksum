import { checkOffer } from '../src/policy.mjs';
import { API_CREDIT_FEATURES, eligiblePreferenceCandidates } from './features.mjs';
import { ensure, canonical } from './model.mjs';

// Trusted server-side adapter. The caller supplies authenticated user identity and saved state.
// Ranking is a snapshot, never a reservation. Existing reserve/startSubmission must run later.
export function verifiedMenu({ profile, session, records, domain, now, authenticatedOwner }) {
  const c = profile.model.config;
  ensure(typeof authenticatedOwner === 'string' && authenticatedOwner === c.ownerId &&
    authenticatedOwner.toLowerCase() === session.mandate.owner.toLowerCase(), 'OWNER_SCOPE_MISMATCH');
  ensure(c.purpose === session.policy.purposeId && c.featureSchema === API_CREDIT_FEATURES.id &&
    canonical(c.features) === canonical(API_CREDIT_FEATURES.names), 'FEATURE_SCOPE_MISMATCH');
  return eligiblePreferenceCandidates({ session, records, domain, now, verifyOffer: checkOffer });
}

export function recommendVerifiedOffers(args) {
  const menu = verifiedMenu(args);
  if (!menu.eligible.length) return { action: 'DEFER_TO_USER', reason: 'NO_ELIGIBLE_OFFERS', ...menu, mandateChange: null };
  return { ...args.profile.decide(menu.eligible, args.decisionPolicy), excluded: menu.excluded, checkedAt: args.now };
}
