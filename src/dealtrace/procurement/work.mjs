import {referenceRows} from '../../deal-escrow/reference.ts';
import {hash,ensure} from './protocol.mjs';

// Real bounded local work, not a claim of internet search or rented GPU capacity.
export function perform(service,input,index){
 const rows=referenceRows();
 if(service==='document')return {kind:'OFFICIAL_REFERENCE_EXTRACTION',rows};
 if(service==='search')return {kind:'LOCAL_SOURCE_SEARCH',query:input.periods[index%input.periods.length],matches:rows.filter(r=>r.quarter===input.periods[index%input.periods.length])};
 if(service==='compute'){let value=hash(rows);for(let n=0;n<2048;n++)value=hash({value,n,index});return {kind:'CPU_HASH_BATCH',iterations:2048,index,digest:value,input_hash:hash(rows)};}
 throw new Error('UNSUPPORTED_SERVICE');
}
export function validateUsage(packet,units){
 const expected=packet.terms.items.flatMap(i=>Array.from({length:i.units},(_,n)=>({service:i.service,index:n,id:hash({run:packet.rfq.run,terms_hash:packet.terms_hash,service:i.service,index:n})})));
 ensure(units.length===expected.length,'MISSING_USAGE');const seen=new Set(),counts=packet.terms.items.map(()=>0),checks=[];
 for(const signedUnit of units){const u=signedUnit.body,e=expected.find(x=>x.id===u.request_id);ensure(e&&!seen.has(e.id),'DUPLICATE_OR_UNKNOWN_USAGE');seen.add(e.id);ensure(u.run===packet.rfq.run&&u.terms_hash===packet.terms_hash&&u.service===e.service&&u.index===e.index,'USAGE_SCOPE');ensure(['SUCCESS','FAILED'].includes(u.status),'USAGE_STATUS');
  if(u.status==='SUCCESS'){const input=packet.rfq.items.find(i=>i.service===e.service).input;const correct=hash(u.output)===hash(perform(e.service,input,e.index));checks.push({request_id:e.id,pass:correct});ensure(correct,'DELIVERY_MISMATCH');counts[packet.terms.items.findIndex(i=>i.service===e.service)]++;}
  else{ensure(u.output===null&&typeof u.failure==='string'&&u.failure.length>0,'FAILED_USAGE_EVIDENCE');checks.push({request_id:e.id,pass:true,billable:false});}
 }
 const amount_minor=packet.terms.items.reduce((n,i,index)=>n+i.unit_price_minor*counts[index],0);
 return {counts,amount_minor,failed:units.filter(x=>x.body.status==='FAILED').length,checks,usage_hash:hash(units),profile:'LOCAL_DOCUMENT_SEARCH_CPU_V1'};
}
