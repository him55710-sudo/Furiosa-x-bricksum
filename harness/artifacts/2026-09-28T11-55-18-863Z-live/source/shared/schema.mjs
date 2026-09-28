import { AbiCoder, keccak256, toUtf8Bytes, TypedDataEncoder } from 'ethers';
export const MODEL = 'qwen3-32b';
export const POLICY_VERSION = 'cm-policy-1';
export const PURPOSE = 'DEV_API_CREDITS_V1';
export const SKU = 'API_CREDITS';
export const RULE = 'REQUIRE_ALL_IN_PRICE';
export const MANDATE_TYPES = { Mandate: [
  ['sessionId','bytes32'],['owner','address'],['totalCap','uint256'],['perTxCap','uint256'],
  ['expiresAt','uint256'],['purposeHash','bytes32'],['skuHash','bytes32'],['minQuantity','uint256'],
  ['minRefundHours','uint256'],['merchantsHash','bytes32'],['policyHash','bytes32'],['nonce','uint256'],
].map(([name,type])=>({name,type})) };
export const OFFER_TYPES = { Offer: [
  ['sessionId','bytes32'],['offerId','bytes32'],['merchant','address'],['purposeHash','bytes32'],
  ['skuHash','bytes32'],['quantity','uint256'],['refundHours','uint256'],['subtotal','uint256'],
  ['fee','uint256'],['total','uint256'],['expiresAt','uint256'],
].map(([name,type])=>({name,type})) };
export const REVOKE_TYPES = { Revoke: [{name:'sessionId',type:'bytes32'},{name:'owner',type:'address'}] };
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw new Error('NON_CANONICAL_VALUE');
}
export const hash = value => keccak256(toUtf8Bytes(canonical(value)));
export const textHash = value => keccak256(toUtf8Bytes(value));
export const merchantsHash = addresses => keccak256(AbiCoder.defaultAbiCoder().encode(['address[]'],[addresses]));
export const digestOffer = (domain, offer) => TypedDataEncoder.hash(domain,OFFER_TYPES,offer);
export const sameAddress = (a,b) => typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
export const nowSeconds = ()=>Math.floor(Date.now()/1000);
export function uint(value, code='INVALID_AMOUNT') {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})$/.test(value)) throw new Error(code);
  return BigInt(value);
}
export const scopeKey = (owner,purpose,merchant)=>`${owner.toLowerCase()}:${purpose}:${merchant.toLowerCase()}`;
