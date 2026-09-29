import {verifyReceipt} from '../deal-escrow/audit.ts';
import {ensure,hash} from '../deal-escrow/domain.ts';

// Read-only demonstration: no store, RPC, model, wallet or write operation.
export async function verifyPriceChangedCopy(receipt){
 ensure(Number.isSafeInteger(receipt?.deal?.price_minor)&&receipt.deal.price_minor>0,'RECEIPT_PRICE_REQUIRED');
 const sourceHash=hash(receipt),copy=structuredClone(receipt);
 copy.deal.price_minor+=500;
 const result=await verifyReceipt(copy);
 ensure(hash(receipt)===sourceHash,'ORIGINAL_RECEIPT_CHANGED');
 return {variant:'PRICE_CHANGED_COPY',deal_id:receipt.deal.deal_id,source_receipt_hash:sourceHash,copy_receipt_hash:hash(copy),original_price_minor:receipt.deal.price_minor,copy_price_minor:copy.deal.price_minor,original_preserved:true,verification:result,scope:'Only the in-memory copy was changed. No chain query, model call or financial action. Offline verification cannot certify an original on-chain settlement.'};
}
