import {ensure,hash,now,policy} from './domain.ts';
import type {Deal,Mandate} from './domain.ts';
import type {DealEngine} from './engine.ts';
import {KilnClient,validateOfferReviews} from './kiln.ts';
import {reference,referenceRows,researchRequirements,sourcePacket} from './reference.ts';
import {validateDelivery,validatePreview} from './delivery.ts';
import {sourceDescriptor,sourceDocument,sourceTask,sourcePacketForModel,citedSourceRows} from './source-document.ts';

export type Offer={offer_id:string;seller_id:string;price_minor:number;floor_price_minor:number;minimum_rows:number;minimum_source_coverage:number;deadline:number;description:string;preview_json?:string;delivery_mode?:string};
export const researchTask='Buy all four 2025 quarterly realized facility-investment cash outflows of LG Energy Solution from its Q4 2025 earnings presentation, in billion KRW, with original signed value, exact document hash, page and row. Do not substitute annual totals, forecasts or total investing cash flows.';
export function contentReviewTask(m:Mandate){
 const d=m.task_requirements?.source_document_id?sourceDescriptor(m.task_requirements.source_document_id):{company:'LG Energy Solution',year:2025,row_label:'Investment in Facilities'};
 return {as_of_utc:new Date(now()*1000).toISOString().slice(0,10),company:d.company,periods:[1,2,3,4].map(q=>`${d.year}-Q${q}`),metric:d.row_label,kind:'Historical actual cash outflows for facilities; exclude annual totals, forecast allocations and total investing activities.',representations:{capex:'Positive spending magnitude in billion KRW',source_value:'Original signed source amount, in a separate field. These two representations are compatible, not contradictory.'}};
}
export const marketOffers:Offer[]=[
  {offer_id:'primary-reports',seller_id:'seller-a',price_minor:210,floor_price_minor:180,minimum_rows:4,minimum_source_coverage:1,deadline:120,description:'Four realized 2025 quarters from the issuer facility-investment cash-flow row, normalized to positive billion KRW. Exact page and signed source amounts included.',preview_json:JSON.stringify(referenceRows()),delivery_mode:'source-extraction'},
  {offer_id:'outlook-summary',seller_id:'seller-b',price_minor:120,floor_price_minor:100,minimum_rows:4,minimum_source_coverage:1,deadline:60,description:'Annual investment outlook for 2026 divided into four equal quarterly estimates. Includes the issuer URL. This is not historical cash expenditure.',preview_json:JSON.stringify(referenceRows().map((r:any)=>({...r,capex:2604.25,source_value:-2604.25}))),delivery_mode:'annual-estimate'},
  {offer_id:'archive-service',seller_id:'seller-b',price_minor:170,floor_price_minor:160,minimum_rows:4,minimum_source_coverage:1,deadline:300,description:'Historical actual quarterly facility cash expenditures from the original presentation. Archive verification takes 300 seconds.',preview_json:JSON.stringify(referenceRows()),delivery_mode:'source-extraction'},
];
export const publicOffers=(offers:Offer[])=>offers.map(({preview_json,delivery_mode,...offer})=>offer);
export function documentOffers(id:string):Offer[]{
  const d=sourceDescriptor(id),sample=citedSourceRows(id).slice(0,d.preview_rows);
  return marketOffers.map(offer=>({...offer,description:offer.description.replace(/2025|2026/g,year=>String(d.year+(year==='2026'?1:0))),preview_json:JSON.stringify(sample.map((row:any)=>offer.delivery_mode==='annual-estimate'?{...row,capex:row.capex+1}:row))}));
}
export function dealFromOffer(m:Mandate,offer:Offer,id:string,price=offer.price_minor,time=now()):Deal{
  const {version,max_delivery_seconds,...requirements}=m.task_requirements??researchRequirements;
  return {deal_id:id,buyer_id:m.buyer_id,seller_id:offer.seller_id,price_minor:price,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{...requirements,minimum_rows:offer.minimum_rows,minimum_source_coverage:offer.minimum_source_coverage},deadline:offer.deadline,created_at:time,expires_at:Math.min(time+1800,m.expires_at),supersedes_deal_id:null};
}
export function resolveSelection(m:Mandate,offers:Offer[],proposal:any,time=now()){
  if(proposal.decision==='reject')return {accepted:false,reason:'MODEL_REJECTED_ALL',offer:null,deal:null};
  const offer=offers.find(o=>o.offer_id===proposal.offer_id);ensure(offer,'UNKNOWN_OFFER');
  const price=proposal.decision==='counter'?proposal.counter_price_minor:offer.price_minor;
  ensure(Number.isSafeInteger(price)&&price>=offer.floor_price_minor&&price<=offer.price_minor,'SELLER_COUNTER_OUTSIDE_RANGE');
  const deal=dealFromOffer(m,offer,'candidate',price,time),checks=policy(m,deal,{time});
  const failure=checks.find(c=>!c.pass);return {accepted:!failure,reason:failure?.name??'FEASIBLE_OFFER',offer,deal,checks};
}
// Explicit, reproducible baseline: structured constraints plus disclosed content keywords.
// It negotiates to the same published floor as the AI and receives the same offers.
export function fixedSelection(m:Mandate,offers:Offer[],time=now()){
  const eligible=offers.filter(o=>!/(forecast|outlook|annual.*estimate|not historical)/i.test(o.description)&&/(realized|actual|historical)/i.test(o.description)&&/(quarter|cash expenditure)/i.test(o.description)).map(o=>({offer:o,proposal:{decision:o.floor_price_minor<o.price_minor?'counter':'accept',offer_id:o.offer_id,counter_price_minor:o.floor_price_minor<o.price_minor?o.floor_price_minor:null,reason:'Structured policy + published content keyword filter; minimum published price.'}})).filter(x=>resolveSelection(m,offers,x.proposal,time).accepted).sort((a,b)=>a.offer.floor_price_minor-b.offer.floor_price_minor||a.offer.deadline-b.offer.deadline||a.offer.offer_id.localeCompare(b.offer.offer_id));
  return eligible[0]?.proposal??{decision:'reject',offer_id:null,counter_price_minor:null,reason:'No offer passed the disclosed baseline rules.'};
}
export function reviewedSelection(m:Mandate,offers:Offer[],args:any,time=now()){
  const reviews=validateOfferReviews(offers,args),matches=new Set(reviews.filter((r:any)=>r.fit==='match').map((r:any)=>r.offer_id));
  const candidates=offers.filter(o=>matches.has(o.offer_id)).map(offer=>{
    const proposal={decision:offer.floor_price_minor<offer.price_minor?'counter':'accept',offer_id:offer.offer_id,counter_price_minor:offer.floor_price_minor<offer.price_minor?offer.floor_price_minor:null,reason:'Code selected the lowest posted floor among AI-reviewed matching offers that pass the human policy; ties prefer faster delivery.'};
    return {offer,proposal,selection:resolveSelection(m,offers,proposal,time)};
  }).filter(x=>x.selection.accepted).sort((a,b)=>a.offer.floor_price_minor-b.offer.floor_price_minor||a.offer.deadline-b.offer.deadline||a.offer.offer_id.localeCompare(b.offer.offer_id));
  return candidates[0]?.proposal??{decision:'reject',offer_id:null,counter_price_minor:null,reason:'No offer both matches the reviewed task and passes the human policy. Unclear offers need clarification.'};
}
export function memoryScreen(engine:DealEngine,m:Mandate,offers:Offer[]){
  return offers.map(offer=>{const control=engine.store.control(m.company_id,offer.seller_id);if(!control)return {offer,eligible:true,preview:null};const preview=offer.preview_json?(m.task_requirements?.source_document_id?validatePreview(offer.preview_json,m.task_requirements,now(),m.expires_at):validateDelivery(offer.preview_json,m.task_requirements!,now(),m.expires_at)):null;return {offer,eligible:preview?.verified===true,preview,control};});
}
const requests=new WeakMap<object,Map<string,Promise<any>>>();
export function researchRequests(engine:DealEngine){return engine.store.db.prepare('SELECT body FROM research_requests ORDER BY rowid DESC').all().map((r:any)=>JSON.parse(r.body));}
export function researchRequest(engine:DealEngine,id:string){const row=engine.store.db.prepare('SELECT body FROM research_requests WHERE mandate_id=?').get(id) as any;return row?JSON.parse(row.body):null;}
function save(engine:DealEngine,id:string,patch:any){const value={...researchRequest(engine,id),...patch,updated_at:new Date().toISOString()};engine.store.db.prepare('UPDATE research_requests SET body=? WHERE mandate_id=?').run(JSON.stringify(value),id);return value;}
export function procureResearch(engine:DealEngine,mandateId:string,{offers:offered,selectionMode='content_review',clientFactory=(record:any)=>new KilnClient({onRecord:record})}:any={}){
  let active=requests.get(engine.store);if(!active){active=new Map();requests.set(engine.store,active);}if(active.has(mandateId))return active.get(mandateId)!;
  const existing=researchRequest(engine,mandateId);if(existing)return Promise.resolve(existing);
  const mandate=engine.store.mandate(mandateId),documentId=mandate.task_requirements?.source_document_id;ensure(documentId||mandate.task_requirements?.reference_dataset_id===reference.id,'RESEARCH_MANDATE_REQUIRED');
  ensure(mandate.status==='ACTIVE','MANDATE_ACTIVE');ensure(now()<mandate.expires_at,'MANDATE_NOT_EXPIRED');if(documentId)sourceDocument(documentId);
  const offers:Offer[]=offered??(documentId?documentOffers(documentId):marketOffers),task=documentId?sourceTask(documentId):researchTask;
  const record={mandate_id:mandateId,status:'RUNNING',task,source_document_id:documentId??null,offers:publicOffers(offers),started_at:new Date().toISOString(),deal_id:null};
  engine.store.db.prepare('INSERT INTO research_requests(mandate_id,body) VALUES(?,?)').run(mandateId,JSON.stringify(record));
  const work=(async()=>{
    const screening=memoryScreen(engine,mandate,offers),eligible=screening.filter(x=>x.eligible).map(x=>x.offer);save(engine,mandateId,{screening:screening.map(({offer,eligible,preview,control})=>({offer_id:offer.offer_id,eligible,preview,control:control??null}))});
    if(!eligible.length)return save(engine,mandateId,{status:'REJECTED',reason:'NO_VERIFIED_PREVIEW',model_calls:0});
    const client=clientFactory((r:any)=>engine.store.telemetry('market.'+mandateId,r));await client.models();
    ensure(['content_review','offer_selection'].includes(selectionMode),'INVALID_SELECTION_MODE');
    const decision=selectionMode==='offer_selection'
      ? await client.selectOffer({human_task:task,mandate,offers:publicOffers(eligible)})
      : await (async()=>{const review=await client.reviewOffers({human_task:contentReviewTask(mandate),offers:publicOffers(eligible)});return {...review,raw_args:review.args,args:reviewedSelection(mandate,eligible,review.args),selection_source:'deterministic_ranking_after_ai_review'};})();
    save(engine,mandateId,{decision});
    const selection=resolveSelection(mandate,eligible,decision.args);if(!selection.accepted)return save(engine,mandateId,{status:decision.args.decision==='reject'?'REJECTED':'BLOCKED',reason:selection.reason});
    const offer=selection.offer!,intent=engine.store.getOrCreateIntent(mandateId,offer.seller_id),deal={...selection.deal!,deal_id:intent.deal_id};
    engine.propose(deal,mandateId);engine.store.details(deal.deal_id,{purchase_intent_id:intent.id,negotiation:[{actor:'Buyer Agent',...decision}],research:{offer:publicOffers([offer])[0],task,...(documentId?{source_document_id:documentId}:{reference_dataset_id:reference.id}),counteroffer_accepted:decision.args.decision==='counter',seller_response:'Posted floor-price policy; no model bargaining response claimed',sample_scope:documentId?'one quarter; final delivery requires all four':'legacy full-reference preview'}});
    engine.store.event(deal.deal_id,'NEGOTIATION_EVIDENCE',{decision,offers:publicOffers(eligible),task},'system','research-market');
    engine.store.db.prepare('UPDATE telemetry SET deal_id=? WHERE deal_id=?').run(deal.deal_id,'market.'+mandateId);
    engine.agentAction('accept_deal',{deal_id:deal.deal_id});if(engine.store.get(deal.deal_id).state==='PREVIEW_REQUIRED'&&offer.preview_json)engine.preview(deal.deal_id,offer.preview_json);
    engine.store.updateIntent(intent.id,{status:'COMPLETED'});return save(engine,mandateId,{status:'READY',deal_id:deal.deal_id,selected_offer:offer.offer_id});
  })().catch(e=>save(engine,mandateId,{status:'FAILED',reason:/^[A-Z0-9_]+$/.test(e.message)?e.message:'RESEARCH_FAILED'})).finally(()=>active!.delete(mandateId));active.set(mandateId,work);return work;
}
export async function deliverResearch(engine:DealEngine,id:string,{clientFactory=(record:any)=>new KilnClient({onRecord:record}),mode}:any={}){
  const r=engine.store.get(id),documentId=r.deal.requirements.source_document_id;ensure(documentId||r.deal.requirements.reference_dataset_id===reference.id,'RESEARCH_DEAL_REQUIRED');ensure(r.state==='ESCROW_FUNDED','INVALID_STATE_TRANSITION');
  if(r.details.extracted_delivery)return engine.deliver(id,r.details.extracted_delivery.raw);
  ensure(!r.details.extraction_started,'EXTRACTION_ALREADY_STARTED');engine.store.details(id,{extraction_started:true});
  try{
    const packet=documentId?sourcePacketForModel(documentId):sourcePacket,input={human_task:documentId?sourceTask(documentId):researchTask,source_document:packet};
    if(documentId&&mode!=='model'){const started=performance.now(),raw=JSON.stringify(citedSourceRows(documentId));engine.store.details(id,{extraction_method:'deterministic PDF cell selection',extracted_delivery:{raw,model:null,request_id:null,source_packet_hash:hash(packet),model_calls:0,elapsed_ms:Math.round(performance.now()-started)}});return await engine.deliver(id,raw);}
    const client=clientFactory((record:any)=>engine.store.telemetry(id,record)),result=documentId?await client.extractCitedDataset(input):await client.extractDataset(input),raw=JSON.stringify(result.args.rows);engine.store.details(id,{extraction_method:'actual Kiln extraction',extracted_delivery:{raw,model:result.model,request_id:result.request_id,source_packet_hash:hash(packet)}});return await engine.deliver(id,raw);
  }
  catch(e){engine.store.details(id,{extraction_error:e instanceof Error?e.message:'EXTRACTION_FAILED'});throw e;}
}
