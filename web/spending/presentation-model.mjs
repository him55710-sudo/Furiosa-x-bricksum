// Read-only projection. No protocol state or financial authority lives here.
const names={'seller-a':'Atlas','seller-b':'Nexus','seller-c':'Orbit',atlas:'Atlas',nexus:'Nexus',orbit:'Orbit',buyer:'Buyer'};
export const sellerNames=names;
const activeEvents=job=>{const events=job?.events??[];return events.slice(Math.max(0,events.findLastIndex(e=>['Brief updated','Requested offers'].includes(e.title))));};
export function presentationModel({job,live,mode='guided',receipt=null,verification=null,pending=null}={}){
 const isLive=mode==='live';
 if(!isLive&&job?.liveSessionId)job=null;
 const session=isLive&&(live?.current?.session.id===job?.liveSessionId||!job)?live?.current?.session:null;
 if(isLive&&job&&!job.liveSessionId)job=null;
 const request=session?.request??job;
 const messages=session?.messages??job?.liveSession?.messages??[];
 const seller=session?.agreement?.sellerId??live?.seller??'atlas';
 const turns=messages.filter(m=>m.seller===seller),last=turns.at(-1);
 const selected=job?.offers?.find(o=>o.seller===job.selected);
 const agreement=session?.agreement??job?.liveSession?.agreement;
 const signatures=!!(agreement?.buyerSignature&&agreement?.sellerSignature||job?.agreementSignatures?.buyerSignature&&job?.agreementSignatures?.sellerSignature);
 const funded=!!job?.transactions?.some(t=>t.kind==='fund'&&t.status==='CONFIRMED');
 const paid=funded&&job?.status==='COMPLETED'&&!!job.transactions?.some(t=>t.kind==='release'&&t.status==='CONFIRMED');
 const price=agreement?.terms.price??(job?.dealHash&&(signatures||funded)?job.agreedPrice:null);
 const invoice=job?.invoice??null,budget=request?.budget??40,limit=request?.perDeal??30;
 const proposed=isLive?last?.quote.price:selected?.price;
 const authorityBlocked=!!(isLive?proposed>Math.min(budget,limit):job?.status==='BLOCKED');
 const rejected=isLive?live?.current?.error:null;
 const stopped=!!(session?.stopped||job?.authorityRevoked);
 const events=activeEvents(job);
 const quotes=isLive?['atlas','nexus','orbit'].map(id=>({id,name:names[id],price:messages.find(m=>m.actor===id)?.quote.price??null})):['seller-a','seller-b','seller-c'].map(id=>({id,name:names[id],price:(Number(events.find(ev=>ev.actor===id&&/ offered /.test(ev.title))?.title.match(/offered (\d+)/)?.[1])||job?.offers?.find(o=>o.seller===id)?.price)??null}));
 const historicalAuthority=quotes.find(q=>q.price>Math.min(budget,limit))?.price??null;
 const rejectedInvoiceEvent=job?.events?.find(ev=>['Sample overcharge blocked','Invoice blocked'].includes(ev.title));
 const historicalInvoice=rejectedInvoiceEvent?Number(rejectedInvoiceEvent.detail.match(/(?:invoice: )?(\d+) test units/)?.[1])||null:null;
 const hasQuotes=quotes.some(q=>q.price!=null),negotiated=isLive?turns.length>=2:!!events.some(e=>e.title.startsWith('Counteroffer:'));
 const revision=selected?.counterPrice??selected?.price;
 const delivery=!!job?.output,valid=!!job?.validation?.verified;
 const mismatch=invoice!=null&&price!=null&&invoice!==price;
 const matched=invoice!=null&&price!=null&&invoice===price&&valid;
 const receiptReady=paid&&receipt?.task?.id===job.id;
 const verified=receiptReady&&verification?.verdict==='VALID';
 const busy=!stopped&&(!!pending||!!live?.current?.pending);
 let phase=!request?'ready':!hasQuotes?'mandate':authorityBlocked?'authority':negotiated?'negotiation':'quotes';
 if(price!=null)phase='deal';if(funded)phase='escrow';if(delivery)phase=mismatch?'blocked':matched?'matched':'delivery';if(paid)phase=receiptReady?'receipt':'settled';
 if(rejected&&!price)phase='rejected';if(stopped&&!funded)phase='stopped';if(job?.status==='REFUNDED')phase='refunded';if(job?.status==='CANCELLED')phase='cancelled';
 const counterEvents=events.filter(ev=>/Counteroffer:|Revised offer:/.test(ev.title));
 const packets=isLive?turns.slice(-3).map(m=>({actor:names[m.actor],price:m.quote.price,kind:m.quote.action})):counterEvents.slice(0,2).map(ev=>({actor:names[ev.actor],price:Number(ev.title.match(/: (\d+)/)?.[1]),kind:ev.actor==='buyer'?'Counter':'Revision'}));
 const negotiationPackets=packets.length?(!isLive?[{actor:names[job?.selected]??'Atlas',price:events.find(e=>e.actor===job?.selected&&/ offered /.test(e.title))?.title.match(/offered (\d+)/)?.[1]??selected?.price,kind:'Offer'},...packets]:packets):[];
 const nodes={human:true,mandate:!!request,buyer:!!request,discovery:hasQuotes,atlas:quotes[0].price!=null,nexus:quotes[1].price!=null,orbit:quotes[2].price!=null,authority:hasQuotes,negotiation:negotiated,deal:price!=null,escrow:funded,delivery,invoice:invoice!=null,agreement:invoice!=null,settlement:paid,receipt:receiptReady};
 const activeSeller=names[job?.selected]??names[seller]??'Atlas';
 const failureReason=rejected==='LIVE_BUYER_AUTHORITY'?'Outside authority':rejected==='LIVE_SELLER_POLICY'?'Outside seller policy':rejected==='LIVE_SCOPE_CHANGED'?'Required scope changed':rejected?'Invalid or incomplete structured response':null;
 let action,actionLabel;
 if(!isLive){
  if(!job){action='delegate';actionLabel='Delegate task';}
  else if(job.status==='DRAFT'){action='delegate';actionLabel='Continue delegation';}
  else if(['QUOTED','BLOCKED'].includes(job.status)){action=negotiated?'approve':'negotiate';actionLabel=negotiated?'Approve signed Deal':'Let Buyer negotiate';}
  else if(['FUNDING','LOCKED'].includes(job.status)){action='approve';actionLabel='Continue approved deal';}
  else if(job.status==='SETTLING'||job.status==='REVIEW'&&valid){action='pay';actionLabel=mismatch?'Pay corrected invoice':'Pay agreed invoice';}
  else if(paid&&!verified){action='receipt';actionLabel='Verify receipt';}
 }else if(!session&&!job?.dealId){action='live-start';actionLabel='Delegate to Live agents';}
 else if(job?.dealId){
  if(['FUNDING','LOCKED'].includes(job.status)){action='live-execute';actionLabel='Continue approved deal';}
  else if(['REVIEW','SETTLING'].includes(job.status)&&matched){action='live-pay';actionLabel='Approve & pay '+price;}
  else if(paid&&!verified){action='receipt';actionLabel='Verify receipt';}
 }else if(agreement){action='live-execute';actionLabel='Approve signed Deal';}
 else if(!stopped){action=!last?'live-offer':last.actor==='buyer'?'live-respond':'live-counter';actionLabel=!last?'Request '+names[seller]+' offer':last.actor==='buyer'?'Let '+names[seller]+' respond':'Let Buyer negotiate';}
 if(stopped&&!funded){action=null;actionLabel=null;}
 const canSign=isLive&&!agreement&&!stopped&&turns.length>=3&&last?.actor===seller&&last.quote.action!=='decline'&&last.quote.price<=Math.min(budget,limit);
 return {mode,isLive,job,session,phase,nodes,quotes,packets:negotiationPackets,budget,limit,price,invoice,proposed,revision,signatures,funded,paid,delivery,valid,matched,mismatch,receiptReady,verified,authorityBlocked,stopped,rejected,failureReason,busy,pending,hasQuotes,negotiated,activeSeller,seller,action,actionLabel,canSign,attempts:live?.current?.attempts??0,liveAvailable:live?.available,liveRemaining:live?.remainingCalls,receipt,verification,historicalAuthority,historicalInvoice};
}

// Four orchestration commands; all writes still use the existing revision-checked API.
export async function runGuidedStory(action,io){
 let j=io.getJob();
 const apply=async(name,fields)=>{await io.mutate(name,fields);j=io.getJob();await io.checkpoint();};
 if(j?.liveSessionId||j&&j.demoMode!==true)throw Error('Use a Guided sample for this story. Live and custom deals remain in Detailed Deal Room.');
 if(j?.authorityRevoked&&!j.dealId)throw Error('Authority is stopped. Start a new story to delegate again.');
 if(action==='delegate'){
  if(!j){await io.create();j=io.getJob();await io.checkpoint();}
  if(j.status==='DRAFT')await apply('quotes');
 }else if(action==='negotiate'){
  if(!['QUOTED','BLOCKED'].includes(j?.status))throw Error('Request quotes before negotiating.');
  const seller=io.seller??'seller-a';
  if(j.selected!==seller)await apply('select',{seller});
  const counter=Math.min(18,j.budget,j.perDeal);
  if(!activeEvents(j).slice(activeEvents(j).findLastIndex(e=>e.title==='Offer selected')).some(ev=>ev.title===`Counteroffer: ${counter} test units`))await apply('counter',{price:counter});
 }else if(action==='approve'){
  if(['QUOTED','BLOCKED'].includes(j?.status)){
   const offer=j.offers.find(o=>o.seller===j.selected);
   if(!offer)throw Error('Select a seller before approving this Guided deal.');
   if(offer.counterPrice!=null)await apply('counter',{price:offer.counterPrice});
  }
  if(['QUOTED','FUNDING'].includes(j?.status))await apply('fund');
  if(j.status==='LOCKED')await apply('run');
 }else if(action==='pay'){
  if(j?.status==='REVIEW'&&j.invoice!==j.agreedPrice)await apply('invoice',{amount:j.agreedPrice});
  if(['REVIEW','SETTLING'].includes(j?.status))await apply('settle');
  if(j.status!=='COMPLETED')throw Error('Settlement is not confirmed. Inspect the current deal.');
  await io.receipt();await io.checkpoint();
 }else if(action==='receipt'){await io.receipt();await io.checkpoint();}
 else throw Error('Unknown presentation action.');
}
