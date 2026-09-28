import { Wallet, ZeroAddress } from 'ethers';
import { OFFER_TYPES, textHash, PURPOSE, SKU } from '../shared/schema.mjs';

// Public, deliberately insecure fixture keys. Never fund or use outside these offline examples.
export const owner = new Wallet('0x' + '1'.padStart(64, '0'));
export const seller = new Wallet('0x' + '2'.padStart(64, '0'));
export const domain = { name: 'PreferenceOfflineFixture', version: '1', chainId: 31337, verifyingContract: ZeroAddress };
export const fixtureNow = 100;
export function fixtureSession() {
  return { id: textHash('learning-fixture-session'), status: 'ACTIVE', spent: '0', reserved: '0', merchants: [seller.address],
    policy: { purposeId: PURPOSE, autoHarden: true }, mandate: { owner: owner.address,
      sessionId: textHash('learning-fixture-session'), totalCap: '2000', perTxCap: '1000', expiresAt: '1000',
      purposeHash: textHash(PURPOSE), skuHash: textHash(SKU), minQuantity: '100', minRefundHours: '0', policyHash: textHash('fixture-policy') } };
}
export async function signedOffer(id, extra = {}) {
  const offer = { sessionId: textHash('learning-fixture-session'), offerId: textHash(`fixture-offer-${id}`), merchant: seller.address,
    purposeHash: textHash(PURPOSE), skuHash: textHash(SKU), quantity: '100', refundHours: '24', subtotal: '600', fee: '0', total: '600', expiresAt: '900', ...extra };
  return { offer, signature: await seller.signTypedData(domain, OFFER_TYPES, offer) };
}
