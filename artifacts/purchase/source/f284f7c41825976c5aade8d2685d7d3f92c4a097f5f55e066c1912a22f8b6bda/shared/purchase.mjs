import {AbiCoder,keccak256,TypedDataEncoder,verifyTypedData} from 'ethers';
import {hash,sameAddress,uint,nowSeconds,merchantsHash} from './schema.mjs';
export {hash,sameAddress,uint,nowSeconds,merchantsHash};
const fields=a=>a.map(([name,type])=>({name,type}));
export const CONSENT_TYPES={Consent:fields([
  ['purchaseId','bytes32'],['owner','address'],['resourceSpecHash','bytes32'],['totalCap','uint256'],['perTxCap','uint256'],['expiresAt','uint256'],['merchantsHash','bytes32'],['maxSettlements','uint256'],['nonce','uint256'],
])};
export const QUOTE_TYPES={Quote:fields([
  ['purchaseId','bytes32'],['owner','address'],['resourceSpecHash','bytes32'],['offerId','bytes32'],['merchant','address'],['subtotal','uint256'],['fee','uint256'],['total','uint256'],['expiresAt','uint256'],
])};
export const PURCHASE_REVOKE_TYPES={RevokePurchase:fields([['purchaseId','bytes32'],['owner','address']])};
export const ACCESS_TYPES={Retrieve:fields([['purchaseId','bytes32'],['owner','address'],['resourceSpecHash','bytes32'],['nonce','bytes32'],['expiresAt','uint256']])};
export const DELIVERY_TYPES={Delivery:fields([['purchaseId','bytes32'],['owner','address'],['resourceSpecHash','bytes32'],['contentHash','bytes32'],['paymentTx','bytes32']])};
export const RESOURCE={schemaVersion:1,url:'https://sample-research.invalid/a/guest-policy',version:'2026-09-28',kind:'page-text',responseSchema:'research-page-1',synthetic:true};
export const QUESTION='A사의 외부 게스트도 문서를 편집할 수 있나요? 최신 안내에서 근거를 찾아 주세요.';
export const PREVIEW='이전 요약 (2025-01-01): 외부 게스트를 무료로 초대할 수 있습니다. 편집 가능 여부는 이 요약에 없습니다.';
export const DOCUMENT={schema:'research-page-1',resource:RESOURCE,title:'A사 외부 협업 안내 — 합성 테스트 자료',paragraphs:[
  {id:'p1',text:'외부 게스트는 초대한 문서를 무료로 열람하고 댓글을 남길 수 있습니다.'},
  {id:'p2',text:'문서 내용을 직접 편집하려면 게스트를 유료 편집 좌석으로 전환해야 합니다. 무료 게스트 권한에는 편집이 포함되지 않습니다.'},
  {id:'p3',text:'이 문서는 2026년 9월 28일자 합성 테스트 자료입니다. 실제 회사의 요금제가 아닙니다.'},
]};
export const purchaseKey=(domain,owner,id)=>keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','bytes32'],[domain.chainId,domain.verifyingContract,owner,id]));
export function validateQuote(p,record,domain,now=nowSeconds()){
  const q=record?.quote,c=p.consent;
  if(!q||Object.keys(q).sort().join()!==QUOTE_TYPES.Quote.map(f=>f.name).sort().join())throw new Error('INVALID_QUOTE');
  if(!p.signature||!sameAddress(verifyTypedData(domain,CONSENT_TYPES,c,p.signature),c.owner))throw new Error('OWNER_SIGNATURE');
  if(!sameAddress(verifyTypedData(domain,QUOTE_TYPES,q,record.signature),q.merchant))throw new Error('SELLER_SIGNATURE');
  if(q.purchaseId!==c.purchaseId||!sameAddress(q.owner,c.owner)||q.resourceSpecHash!==c.resourceSpecHash)throw new Error('RESOURCE_MISMATCH');
  if(hash(p.resource)!==c.resourceSpecHash)throw new Error('RESOURCE_MISMATCH');
  if(!p.merchants.some(a=>sameAddress(a,q.merchant)))throw new Error('MERCHANT_NOT_ALLOWED');
  if(uint(c.expiresAt)<=BigInt(now)||uint(q.expiresAt)<=BigInt(now))throw new Error('DEADLINE_EXPIRED');
  if(uint(q.total)===0n||uint(q.subtotal)+uint(q.fee)!==uint(q.total))throw new Error('TOTAL_MISMATCH');
  if(uint(q.total)>uint(c.perTxCap)||uint(q.total)>uint(c.totalCap))throw new Error('BUDGET_EXCEEDED');
  return TypedDataEncoder.hash(domain,QUOTE_TYPES,q);
}
export function validateDelivery(p,record,domain,merchant,paymentTx){
  if(!record?.delivery||!record.document)throw new Error('DELIVERY_MISSING');
  const d=record.delivery;
  if(Object.keys(d).sort().join()!==DELIVERY_TYPES.Delivery.map(f=>f.name).sort().join())throw new Error('INVALID_DELIVERY');
  if(d.purchaseId!==p.id||!sameAddress(d.owner,p.consent.owner)||d.resourceSpecHash!==p.consent.resourceSpecHash||d.paymentTx!==paymentTx)throw new Error('DELIVERY_BINDING_MISMATCH');
  if(hash(record.document)!==d.contentHash||hash(record.document.resource)!==d.resourceSpecHash)throw new Error('CONTENT_HASH_MISMATCH');
  if(record.document.schema!=='research-page-1'||!Array.isArray(record.document.paragraphs)||record.document.paragraphs.length<1||record.document.paragraphs.some(x=>typeof x.id!=='string'||typeof x.text!=='string'))throw new Error('INVALID_DOCUMENT');
  if(!sameAddress(verifyTypedData(domain,DELIVERY_TYPES,d,record.signature),merchant))throw new Error('DELIVERY_SIGNATURE');
  return true;
}
