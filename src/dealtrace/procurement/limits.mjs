import {ensure} from './protocol.mjs';

export const DEFAULT_NEGOTIATION_TOKENS=1200;
export const MESSAGE_MAX_LENGTH=160;
export function tokenCeiling(value=DEFAULT_NEGOTIATION_TOKENS){
 ensure(Number.isSafeInteger(value)&&value>=800&&value<=5000,'NEGOTIATION_TOKEN_CEILING');return value;
}
export const registeredSellers=[
 {id:'seller-a',floors:{document:1800,search:150,compute:200},min_delivery_seconds:300,quality:'ACTUAL_WITH_SOURCES'},
 {id:'seller-b',floors:{document:1100,search:60,compute:80},min_delivery_seconds:180,quality:'FORECAST_ONLY'},
 {id:'seller-c',floors:{document:2200,search:100,compute:120},min_delivery_seconds:240,quality:'ACTUAL_WITH_SOURCES'}
];

// Operator-pinned registry costs, never model-supplied floors. Unknown external
// costs cannot establish impossibility and are checked after their quote instead.
export function preflight({rfq,allowedSellerIds,expiresAt,feeReserveMinor=0,external=[]},now=Date.now()){
 ensure(Array.isArray(allowedSellerIds)&&allowedSellerIds.every(id=>typeof id==='string'),'SELLER_ALLOWLIST_REQUIRED');
 ensure(Number.isSafeInteger(expiresAt),'AUTHORITY_EXPIRY_REQUIRED');
 ensure(Number.isSafeInteger(feeReserveMinor)&&feeReserveMinor>=0,'FEE_RESERVE_INVALID');
 ensure(expiresAt>now,'MANDATE_EXPIRED');
 const sellers=registeredSellers.filter(s=>allowedSellerIds.includes(s.id));
 const externalAllowed=external.filter(s=>allowedSellerIds.includes(s.id));
 ensure(sellers.length+externalAllowed.length>0,'SELLER_NOT_ALLOWED');
 const eligible=sellers.filter(s=>s.quality==='ACTUAL_WITH_SOURCES'&&s.min_delivery_seconds<=rfq.max_delivery_seconds);
 const minimum=externalAllowed.length?0:Math.min(...eligible.map(s=>rfq.items.reduce((sum,i)=>sum+(i.minimum_units??i.units)*s.floors[i.service],0)));
 ensure(Number.isFinite(minimum),'NO_COMPATIBLE_PROVIDER');
 ensure(minimum+feeReserveMinor<=rfq.budget_minor&&feeReserveMinor<rfq.budget_minor,'BUDGET_EXCEEDED');
 return {status:'ALLOWED',allowed_seller_ids:[...sellers,...externalAllowed].map(s=>s.id),minimum_cost_minor:minimum,fee_reserve_minor:feeReserveMinor,all_in_minimum_minor:minimum+feeReserveMinor};
}
