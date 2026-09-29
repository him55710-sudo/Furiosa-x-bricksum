import {Wallet,verifyMessage,verifyTypedData,ZeroHash,AbiCoder,keccak256} from 'ethers';
import {randomUUID,createHash} from 'node:crypto';
import {hash,ensure,exact} from '../../deal-escrow/domain.ts';
import {types as vaultTypes,vaultDomain} from '../vault.mjs';

export {hash,ensure,exact};
export const UNIT_WEI='1000000000';
export const services=['document','search','compute'];
export const clone=x=>structuredClone(x);
export const meterTypes={Metering:[{name:'dealHash',type:'bytes32'},{name:'linesHash',type:'bytes32'}]};
export const meteredDomain=(chainId,address)=>({name:'DealTraceMeteredVault',version:'3',chainId,verifyingContract:address});
export const domainFor=(network)=>network.metered?meteredDomain(network.chainId,network.contract):vaultDomain(network.chainId,network.contract);
export const executionTypes=type=>type==='Metering'?meterTypes:{[type]:vaultTypes[type]};
export const quantity=(n,max=1000)=>ensure(Number.isSafeInteger(n)&&n>=1&&n<=max,'INVALID_QUANTITY');
export const integer=(n,min,max)=>ensure(Number.isSafeInteger(n)&&n>=min&&n<=max,'INVALID_INTEGER');
export function defaultRfq({run=randomUUID(),metered=false,budget_minor=4000}={}){
 return {schema:'DEALTRACE_RFQ_V1',run,task:'Extract quarterly actual facility investment with source evidence; optionally search and process the returned records.',
  budget_minor,max_delivery_seconds:600,asset:'DEMO',billing:metered?'SUCCESS_UNITS':'FIXED_ALL_OR_REFUND',
  items:(metered?[['document',1],['search',3],['compute',2]]:[['document',1]]).map(([service,units])=>({service,units,input:{periods:['2025-Q1','2025-Q2','2025-Q3','2025-Q4'],metric:'ACTUAL_QUARTERLY_FACILITY_INVESTMENT'}})),
  required_evidence:'ORIGINAL_SOURCE_CELLS',deadline_anchor:'ESCROW_FUNDING_BLOCK',failed_units_billable:false};
}
export function validateRfq(r){
 exact(r,['schema','run','task','budget_minor','max_delivery_seconds','asset','billing','items','required_evidence','deadline_anchor','failed_units_billable']);
 ensure(r.schema==='DEALTRACE_RFQ_V1'&&/^[a-f0-9-]{36}$/.test(r.run),'RFQ_SCHEMA');
 integer(r.budget_minor,1,1000000);integer(r.max_delivery_seconds,60,3600);
 ensure(r.asset==='DEMO'&&['SUCCESS_UNITS','FIXED_ALL_OR_REFUND'].includes(r.billing)&&r.failed_units_billable===false,'RFQ_BILLING');
 ensure(r.required_evidence==='ORIGINAL_SOURCE_CELLS'&&r.deadline_anchor==='ESCROW_FUNDING_BLOCK','RFQ_EVIDENCE');
 ensure(Array.isArray(r.items)&&r.items.length>0&&r.items.length<=8,'RFQ_ITEMS');
 ensure(new Set(r.items.map(i=>i.service)).size===r.items.length,'DUPLICATE_SERVICE');
 for(const i of r.items){exact(i,['service','units','input']);ensure(services.includes(i.service),'UNSUPPORTED_SERVICE');quantity(i.units,20);ensure(i.input.metric==='ACTUAL_QUARTERLY_FACILITY_INVESTMENT'&&hash(i.input.periods)===hash(['2025-Q1','2025-Q2','2025-Q3','2025-Q4']),'UNSUPPORTED_INPUT');}
 return r;
}
export async function signed(wallet,body){return {body:clone(body),signature:await wallet.signMessage(hash(body))};}
export function verifySigned(packet,address){ensure(packet&&packet.body&&typeof packet.signature==='string','SIGNATURE_REQUIRED');ensure(verifyMessage(hash(packet.body),packet.signature).toLowerCase()===address.toLowerCase(),'SIGNATURE_INVALID');return packet.body;}
export function validateQuote(q,rfq){
 exact(q,['action','message','items','delivery_seconds','quality']);ensure(['offer','accept','decline'].includes(q.action),'QUOTE_ACTION');ensure(typeof q.message==='string'&&q.message.length>0&&q.message.length<2500,'QUOTE_MESSAGE');ensure(!/\d/.test(q.message),'NUMERIC_TERMS_MUST_BE_STRUCTURED');
 ensure(['ACTUAL_WITH_SOURCES','FORECAST_ONLY'].includes(q.quality),'QUOTE_QUALITY');integer(q.delivery_seconds,1,3600);
 ensure(Array.isArray(q.items)&&q.items.length===rfq.items.length,'QUOTE_ITEMS');
 for(let n=0;n<q.items.length;n++){const i=q.items[n],r=rfq.items[n];exact(i,['service','units','unit_price_minor']);ensure(i.service===r.service&&i.units===r.units,'QUOTE_SCOPE');integer(i.unit_price_minor,1,1000000);}
 // The outward prose is not authorization: both parties review the complete tool offer.
 return q;
}
export const quoteTotal=q=>q.items.reduce((n,i)=>n+i.units*i.unit_price_minor,0);
export function eligible(q,rfq){return q.action!=='decline'&&q.quality==='ACTUAL_WITH_SOURCES'&&q.delivery_seconds<=rfq.max_delivery_seconds&&quoteTotal(q)<=rfq.budget_minor;}
export function quoteTerms(q){return {items:q.items,delivery_seconds:q.delivery_seconds,quality:q.quality};}
export function validateLocalPolicy(q,rfq,policy,role){
 validateQuote(q,rfq);if(q.action==='decline')return;
 if(role==='buyer')ensure(eligible(q,rfq),'BUYER_SCOPE_OR_BUDGET');
 else{ensure(q.quality===policy.quality&&q.delivery_seconds>=policy.min_delivery_seconds,'SELLER_CAPABILITY');for(const i of q.items)ensure(i.unit_price_minor>=policy.floors[i.service],'SELLER_PRICE_FLOOR');}
}
export function dealPacket(rfq,provider,events,offer){
 ensure(eligible(offer,rfq),'NO_ELIGIBLE_AGREEMENT');
 const terms={schema:'DEALTRACE_PROCUREMENT_V1',run:rfq.run,rfq_hash:hash(rfq),seller:provider.address,items:clone(offer.items),price_minor:quoteTotal(offer),delivery_seconds:offer.delivery_seconds,quality:offer.quality,billing:rfq.billing,failed_units_billable:false,deadline_anchor:rfq.deadline_anchor,required_evidence:rfq.required_evidence};
 const provenance={};for(const field of ['items','delivery_seconds','quality']){const e=[...events].reverse().find(x=>hash(x.body.quote[field])===hash(offer[field]));ensure(e,'MISSING_PROVENANCE');provenance[field]={event_hash:hash(e.body),value:clone(offer[field])};}
 return {rfq:clone(rfq),provider:clone(provider),events:clone(events),terms,terms_hash:hash(terms),provenance};
}
export function verifyConversation(p){
 validateRfq(p.rfq);ensure(p.terms_hash===hash(p.terms),'TERMS_HASH');ensure(p.events.length>0&&p.events.length<=12,'TRANSCRIPT_SIZE');
 let previous=ZeroHash;for(let n=0;n<p.events.length;n++){const e=p.events[n],b=e.body;ensure(b.run===p.rfq.run&&b.sequence===n+1&&b.previous_hash===previous&&b.rfq_hash===hash(p.rfq),'EVENT_ORDER');ensure(['buyer','seller'].includes(b.role),'EVENT_ROLE');verifySigned(e,b.role==='seller'?p.provider.address:p.buyer);validateQuote(b.quote,p.rfq);previous=hash(b);}
 const offer=p.events.at(-1).body.quote;ensure(p.events.at(-1).body.role==='seller'&&eligible(offer,p.rfq),'FINAL_SELLER_OFFER');
 const expected=dealPacket(p.rfq,p.provider,p.events,offer);ensure(hash(expected.terms)===hash(p.terms)&&hash(expected.provenance)===hash(p.provenance),'TERMS_PROVENANCE');
 return true;
}
export function executionDeal(packet,{mandateId,network,expiresAt}){
 verifyConversation(packet);const d={dealHash:hash(packet.terms),mandateId,seller:packet.provider.address,amount:(BigInt(packet.terms.price_minor)*BigInt(UNIT_WEI)).toString(),deliveryWindow:packet.terms.delivery_seconds,expiresAt,termsHash:hash(packet),previewHash:ZeroHash};return d;
}
export const meterLines=p=>p.terms.items.map(i=>({lineId:hash({service:i.service,input:p.rfq.items.find(x=>x.service===i.service).input}),unitPrice:(BigInt(i.unit_price_minor)*BigInt(UNIT_WEI)).toString(),maxUnits:i.units}));
export const linesHash=lines=>keccak256(AbiCoder.defaultAbiCoder().encode(['tuple(bytes32 lineId,uint256 unitPrice,uint32 maxUnits)[]'],[lines]));
export function verifyExecutionSignatures(report){
 const {network,plan}=report,domain=domainFor(network),check=(type,body,sig,address)=>ensure(verifyTypedData(domain,executionTypes(type),body,sig).toLowerCase()===address.toLowerCase(),'EXECUTION_SIGNATURE');
 verifyConversation(plan.packet);ensure(hash(executionDeal(plan.packet,{mandateId:plan.deal.mandateId,network,expiresAt:plan.deal.expiresAt}))===hash(plan.deal),'EXECUTION_TERM_BINDING');
 check('Mandate',plan.mandate,plan.mandateSignature,plan.mandate.buyer);check('Deal',plan.deal,plan.buyerSignature,plan.mandate.agent);check('Deal',plan.deal,plan.sellerSignature,plan.deal.seller);
 ensure(plan.packet.buyer===plan.mandate.agent,'BUYER_BINDING');
 if(network.metered){ensure(hash(plan.lines)===hash(meterLines(plan.packet)),'METER_LINES');const body={dealHash:plan.deal.dealHash,linesHash:linesHash(plan.lines)};check('Metering',body,plan.buyerMeterSignature,plan.mandate.agent);check('Metering',body,plan.sellerMeterSignature,plan.deal.seller);}
 return true;
}
export function sourceHash(text){return '0x'+createHash('sha256').update(text).digest('hex');}
