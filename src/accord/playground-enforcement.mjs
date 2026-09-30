import {hash,verifySigned} from './playground-crypto.mjs';

// Agent-independent payment boundary. Callers supply trusted mandate/identities,
// never a model's verdict. Amounts are integer minor units, with no FX conversion.
export function authorizePlaygroundPayment({mandate,agreement,invoice,identities,now=Date.now(),stopped=false,settled=false}) {
 const checks=[];
 const check=(name,pass,actual,expected)=>checks.push({name,pass:!!pass,actual,expected});
 const a=agreement?.body,i=invoice?.body;
 const valid=(packet,key)=>{try{verifySigned(packet,key);return true;}catch{return false;}};
 check('AUTHORITY_ACTIVE',!stopped&&!settled&&now<mandate.expiresAt,{stopped,settled,now},mandate.expiresAt);
 check('BILATERAL_AGREEMENT',!!a&&agreement.hash===hash(a)&&valid({body:a,signature:agreement.buyerSignature},identities.buyer.address)&&valid({body:a,signature:agreement.sellerSignature},identities[a.seller]?.address),agreement?.hash??null,'Both signatures on the same terms');
 check('MANDATE_BINDING',a?.mandateHash===hash(mandate),a?.mandateHash??null,hash(mandate));
 check('SELLER_ALLOWLIST',mandate.allowedSellers.includes(a?.seller),a?.seller??null,mandate.allowedSellers);
 check('AGREEMENT_AUTHORITY',Number.isSafeInteger(a?.amountMinor)&&a.amountMinor>0&&a.amountMinor<=Math.min(mandate.budgetMinor,mandate.perDealMinor),a?.amountMinor??null,Math.min(mandate.budgetMinor,mandate.perDealMinor));
 check('INVOICE_SIGNATURE',!!a&&valid(invoice,identities[a.seller]?.address),!!invoice?.signature,'Selected seller signature');
 check('BUDGET',Number.isSafeInteger(i?.amountMinor)&&i.amountMinor>0&&i.amountMinor<=mandate.budgetMinor,i?.amountMinor??null,mandate.budgetMinor);
 check('AGREEMENT_PRICE_MISMATCH',i?.amountMinor===a?.amountMinor&&a?.amountMinor>0,i?.amountMinor??null,a?.amountMinor??null);
 check('RECIPIENT',i?.recipient===a?.recipient&&a?.recipient===identities[a?.seller]?.address,i?.recipient??null,a?.recipient??null);
 check('CURRENCY',i?.currency===a?.currency&&a?.currency===mandate.currency,i?.currency??null,mandate.currency);
 check('DEAL_HASH',!!agreement?.hash&&i?.dealHash===agreement.hash,i?.dealHash??null,agreement?.hash??null);
 check('SIGNED_TERMS',i?.scope===a?.scope&&a?.scope===mandate.task&&i?.deliveryMinutes===a?.deliveryMinutes&&a?.deliveryMinutes<=mandate.maxDeliveryMinutes,i?{scope:i.scope,deliveryMinutes:i.deliveryMinutes}:null,a?{scope:a.scope,deliveryMinutes:a.deliveryMinutes}:null);
 const failed=checks.find(c=>!c.pass);
 return {verdict:failed?'PAYMENT_BLOCKED':'PAYMENT_AUTHORIZED',reason:failed?.name??'MATCHING_SIGNED_AGREEMENT',checks,at:now};
}
