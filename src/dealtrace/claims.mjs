import {sign,verify,createPublicKey,randomUUID} from 'node:crypto';
import {ensure,exact,hash,identifier,integer} from '../deal-escrow/domain.ts';
import {reference,sourcePacket} from '../deal-escrow/reference.ts';

export const sourceManifest={reference,source_packet:sourcePacket};
export function assuranceProfile(network,seller){
 return {version:1,source_manifest_hash:hash(sourceManifest),validator_profile:'PINNED_CAPEX_REFERENCE_V1',pricing:'ALL_IN_FIXED_PRICE',claim_required:true,payee:network.sellers[seller].toLowerCase(),chain_id:network.chainId,contract:network.contract.toLowerCase(),unit_wei:String(network.unitWei),deadline_rule:'FUNDING_BLOCK_PLUS_WINDOW'};
}
export function validateProfile(p){
 exact(p,['version','source_manifest_hash','validator_profile','pricing','claim_required','payee','chain_id','contract','unit_wei','deadline_rule']);
 ensure(p.version===1&&p.claim_required===true&&p.pricing==='ALL_IN_FIXED_PRICE'&&p.validator_profile==='PINNED_CAPEX_REFERENCE_V1'&&p.deadline_rule==='FUNDING_BLOCK_PLUS_WINDOW','ASSURANCE_PROFILE');
 ensure(/^0x[a-f0-9]{64}$/.test(p.source_manifest_hash)&&[p.payee,p.contract].every(v=>/^0x[a-f0-9]{40}$/.test(v))&&/^[1-9][0-9]*$/.test(p.unit_wei),'ASSURANCE_BINDING');integer(p.chain_id,1,Number.MAX_SAFE_INTEGER);
}
export function assertProfile(deal,network){if(deal.assurance){validateProfile(deal.assurance);ensure(hash(deal.assurance)===hash(assuranceProfile(network,deal.seller_id)),'ASSURANCE_NETWORK_OR_SOURCE_MISMATCH');}}
export function signClaim(actor,deal,delivery,{amount_minor=deal.price_minor,claim_id=randomUUID(),issued_at=Math.floor(Date.now()/1000),...patch}={}){
 const body={type:'DEALTRACE_SETTLEMENT_CLAIM_V1',claim_id,deal_hash:hash(deal),seller_id:actor.id,payee:deal.assurance.payee,amount_minor,asset:deal.currency_or_demo_asset,delivery_hash:hash(delivery),issued_at,...patch};
 return {...body,signature:sign(null,Buffer.from(hash(body)),actor.private_key).toString('base64')};
}
export function assessClaim(input,{deal,delivery,publicKey,network,time}){
 const checks=[];const check=(name,pass,actual,expected)=>{checks.push({name,pass,actual,expected});ensure(pass,name);};
 try{
  exact(input,['type','claim_id','deal_hash','seller_id','payee','amount_minor','asset','delivery_hash','issued_at','signature']);identifier(input.claim_id);integer(input.amount_minor,1,1_000_000_000);integer(input.issued_at,0,9_000_000_000);
  check('CLAIM_TYPE',input.type==='DEALTRACE_SETTLEMENT_CLAIM_V1',input.type,'DEALTRACE_SETTLEMENT_CLAIM_V1');
  const {signature,...body}=input;let valid=false;try{valid=verify(null,Buffer.from(hash(body)),createPublicKey({key:Buffer.from(publicKey,'base64'),type:'spki',format:'der'}),Buffer.from(signature,'base64'));}catch{}
  check('CLAIM_SIGNATURE',valid,valid,true);assertProfile(deal,network);
  check('CLAIM_DEAL',input.deal_hash===hash(deal),input.deal_hash,hash(deal));
  check('CLAIM_SELLER',input.seller_id===deal.seller_id,input.seller_id,deal.seller_id);
  check('CLAIM_PAYEE',input.payee===deal.assurance.payee,input.payee,deal.assurance.payee);
  check('CLAIM_ASSET',input.asset===deal.currency_or_demo_asset,input.asset,deal.currency_or_demo_asset);
  check('CLAIM_AMOUNT',input.amount_minor===deal.price_minor,input.amount_minor,deal.price_minor);
  check('CLAIM_TIME',input.issued_at>=deal.created_at&&input.issued_at<=time&&time<deal.expires_at,input.issued_at,{created_at:deal.created_at,checked_at:time,expires_at:deal.expires_at});
  check('CLAIM_DELIVERY',typeof delivery==='string'&&input.delivery_hash===hash(delivery),input.delivery_hash,typeof delivery==='string'?hash(delivery):null);
  return {verdict:'ACCEPTED',reason:'MATCHING_COMMITTED_DEAL',checks};
 }catch(e){return {verdict:'REJECTED',reason:e.message,checks};}
}
export function claimHistory(store,id){return store.events(id).filter(e=>e.event_type==='SETTLEMENT_CLAIM_RECORDED').map(e=>e.structured_payload);}
export function matchingClaim(store,r,network,time){
 if(!r.deal.assurance)return null;
 // Sessions keep their immutable body in JSON; deal IDs are indexed by commits.
 return matchingClaimFromHistory(claimHistory(store,r.deal.deal_id),r.deal,r.details.delivery,network,time,publicSellerKey(store,r.deal.deal_id));
}
export function publicSellerKey(store,id){const c=store.db.prepare('SELECT session_id FROM trace_commits WHERE deal_id=?').get(id);ensure(c,'BILATERAL_COMMIT_REQUIRED');const s=JSON.parse(store.db.prepare('SELECT body FROM trace_sessions WHERE id=?').get(c.session_id).body);return s.identities[s.seller];}
export function matchingClaimFromHistory(history,deal,delivery,network,time,key){
 const accepted=history.findLast(h=>h.decision.verdict==='ACCEPTED');
 if(!accepted)return null;return assessClaim(accepted.claim,{deal,delivery,publicKey:key,network,time}).verdict==='ACCEPTED'?accepted.claim:null;
}
export function recordClaim(engine,id,input){
 identifier(input?.claim_id);const r=engine.store.get(id);ensure(r.deal.assurance,'CLAIM_NOT_REQUIRED');ensure(JSON.stringify(input).length<12000,'CLAIM_SIZE');
 const old=claimHistory(engine.store,id).find(h=>h.claim.claim_id===input.claim_id);
 if(old){ensure(hash(old.claim)===hash(input),'CLAIM_ID_CONTENT_MISMATCH');return old;}
 ensure(['ESCROW_FUNDED','DELIVERY_SUBMITTED','DELIVERY_VERIFIED'].includes(r.state),'CLAIM_STATE');
 const checked_at=engine.clock(),decision=assessClaim(input,{deal:r.deal,delivery:r.details.delivery,publicKey:publicSellerKey(engine.store,id),network:engine.chain.deployment,time:checked_at});
 const result={claim:input,checked_at,delivery_seen:typeof r.details.delivery==='string',decision};engine.store.event(id,'SETTLEMENT_CLAIM_RECORDED',result,'seller',r.deal.seller_id);return result;
}
export function verifyClaims(r){
 if(!r.deal.assurance)return;
 assertProfile(r.deal,r.network);ensure(r.negotiation?.identities,'CLAIM_IDENTITY_MISSING');
 ensure(r.source_manifest&&hash(r.source_manifest)===r.deal.assurance.source_manifest_hash,'SOURCE_MANIFEST_MISSING_OR_CHANGED');
 const history=r.events.filter(e=>e.event_type==='SETTLEMENT_CLAIM_RECORDED').map(e=>e.structured_payload),ids=new Set();
 for(const h of history){ensure(!ids.has(h.claim.claim_id),'DUPLICATE_CLAIM_ID');ids.add(h.claim.claim_id);const expected=assessClaim(h.claim,{deal:r.deal,delivery:h.delivery_seen?r.evidence.delivery:undefined,publicKey:r.negotiation.identities[r.deal.seller_id],network:r.network,time:h.checked_at});ensure(hash(expected)===hash(h.decision),'CLAIM_DECISION_MISMATCH');}
 const a=r.evidence.attestation;
 if(a){ensure(a.claim_history_hash===hash(history),'CLAIM_HISTORY_COMMITMENT');if(a.outcome==='release'){const selected=matchingClaimFromHistory(history,r.deal,r.evidence.delivery,r.network,r.events.find(e=>e.event_hash===a.prior_event_hash).structured_payload.time,r.negotiation.identities[r.deal.seller_id]);ensure(selected&&hash(selected)===a.settlement_claim_hash,'MATCHING_CLAIM_REQUIRED');}}
 if(r.state==='SETTLED')ensure(a?.outcome==='release','CLAIM_ATTESTATION_REQUIRED');
 if(r.state==='SETTLED')ensure(r.evidence.delivery_window_intact===true&&r.evidence.escrow.deadline===r.evidence.funding_block_timestamp+r.deal.deadline,'FULL_DELIVERY_WINDOW_REQUIRED');
}
