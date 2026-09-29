import {hash,ensure,eligible,quoteTotal,dealPacket,verifySigned,validateQuote,verifyConversation} from './protocol.mjs';
import {discover} from './client.mjs';

export async function negotiate({rfq,buyer,sellers,live,onProgress=()=>{},cancelled=()=>false,journal,persist}){
 journal.negotiation??={providers:[],sessions:{},selection:null,usage:{}};const n=journal.negotiation;
 const checkpoint=()=>ensure(!cancelled(),'HUMAN_STOPPED');
 for(const seller of sellers){checkpoint();if(!n.providers.some(p=>p.id===seller.id)){n.providers.push(await discover(seller));persist();}}
 const request=async(agent,provider,events,request_id)=>{
  checkpoint();const result=await agent.request('/quote',{request_id,rfq,events,live,buyer:buyer.address,seller:provider.address});
  n.usage[agent.id]=result.usage??n.usage[agent.id]??[];persist();ensure(!result.error,result.error??'NEGOTIATION_FAILED');
  const event=result.event;verifySigned(event,agent.address);validateQuote(event.body.quote,rfq);ensure(event.body.run===rfq.run&&event.body.rfq_hash===hash(rfq),'RFQ_BINDING');return event;
 };
 // Each response and failed attempt is durably retained before requesting the next.
 for(const provider of n.providers){
  if(n.sessions[provider.id])continue;
  const seller=sellers.find(s=>s.id===provider.id),compatible=rfq.items.every(i=>provider.capabilities.includes(i.service));
  if(!compatible){n.sessions[provider.id]={events:[],reason:'CAPABILITY_MISMATCH'};persist();continue;}
  const policy=seller.localPolicy;
  // Only operator-pinned local configuration can establish these facts. An
  // external seller's unverified prose is never used as a trusted cost floor.
  const reason=policy?.quality&&policy.quality!=='ACTUAL_WITH_SOURCES'?'PREFILTER_QUALITY':policy?.min_delivery_seconds>rfq.max_delivery_seconds?'PREFILTER_DEADLINE':policy?.floors&&rfq.items.every(i=>Number.isSafeInteger(policy.floors[i.service]))&&rfq.items.reduce((n,i)=>n+(i.minimum_units??i.units)*policy.floors[i.service],0)>rfq.budget_minor?'PREFILTER_MINIMUM_COST':null;
  if(reason){n.sessions[provider.id]={events:[],reason,inference_calls:0};persist();continue;}

  try{const event=await request(seller,provider,[],`${rfq.run}-initial`);n.sessions[provider.id]={events:[event],reason:eligible(event.body.quote,rfq)?'ELIGIBLE':'PRICE_DEADLINE_OR_QUALITY'};}
  catch(e){n.sessions[provider.id]={events:[],reason:e.message};}
  persist();onProgress('QUOTES_RECEIVED');
 }
 if(!n.selection){const candidates=n.providers.filter(p=>n.sessions[p.id].events.length&&eligible(n.sessions[p.id].events.at(-1).body.quote,rfq)).sort((a,b)=>quoteTotal(n.sessions[a.id].events.at(-1).body.quote)-quoteTotal(n.sessions[b.id].events.at(-1).body.quote)||a.id.localeCompare(b.id));ensure(candidates.length,'NO_ELIGIBLE_PROVIDER');n.selection=candidates[0].id;persist();}
 const provider=n.providers.find(p=>p.id===n.selection),seller=sellers.find(s=>s.id===n.selection),session=n.sessions[n.selection];
 if(session.events.length===1){const e=await request(buyer,provider,session.events,`${rfq.run}-counter`);ensure(e.body.quote.action!=='decline','BUYER_DECLINED');session.events.push(e);persist();onProgress('BUYER_COUNTER');}
 if(session.events.length===2){const e=await request(seller,provider,session.events,`${rfq.run}-response`);session.events.push(e);persist();onProgress('SELLER_RESPONSE');}
 const final=session.events.at(-1).body.quote;ensure(eligible(final,rfq),'NEGOTIATION_DID_NOT_CONVERGE');
 const packet={...dealPacket(rfq,provider,session.events,final),buyer:buyer.address};verifyConversation(packet);
 n.packet=packet;persist();return {packet,selected:seller};
}
