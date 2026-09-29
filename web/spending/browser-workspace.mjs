import reference from '../../data/reference/capex/lges-2025-v1.json' with {type:'json'};
import {normalizeRows,offersFor,workerNames} from './workspace-model.mjs';
import {taskSpec,checkRows,requireValue,whole} from './workspace-rules.mjs';
import {browserStore} from './browser-store.mjs';
import {openBrowserChain,digest} from './browser-chain.mjs';

const sample=()=>({title:'Quarterly CAPEX research',brief:'Normalize quarterly facility-investment data into a clean table. Preserve the company, quarter, value, currency and source URL for every row. Return JSON and CSV with a verifiable receipt.',sourceText:JSON.stringify(reference.records.map(r=>({...r,source_url:reference.source.url,source_page:reference.source.pdf_page,source_sha256:reference.source.sha256,source_label:reference.source.row_label})),null,2),sourceName:'LG Energy Solution · reference dataset.json',budget:40,perDeal:30,deliveryMinutes:10,demoMode:true});
export function createBrowserWorkspace({storage=browserStore(),locks=globalThis.navigator?.locks,chainFactory=openBrowserChain}={}){
 requireValue(locks?.request,'This workspace needs browser storage and Web Locks. Open it in a recent Chrome, Edge, Firefox or Safari browser.');
 const serial=fn=>locks.request('accord-lock-workspace-v1',async()=>{const state=await storage.load();requireValue(state.version===1,'This workspace was created by a newer app version. Refresh this page.');return fn(state,()=>storage.save(state));});
 const event=(job,actor,title,detail)=>job.events.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor,title,detail});
 const get=(state,id)=>{const job=state.jobs.find(j=>j.id===id);requireValue(job,'Task not found in this browser.');return job;};
 const network=state=>({name:'Browser EVM',chainId:31338,contract:state.chain?.contract??null,unit:'gwei',mode:'BROWSER_EVM',description:'Real private-EVM transactions and rule-based data workers, running in this browser. No public funds or external AI calls.'});
 const packet=(state,job)=>({schema:'accord-browser-evm-v1',product:'accord lock',mode:'BROWSER_EVM',network:{...network(state),...(state.chain?.publicNetwork??{})},task:structuredClone(job),receipt:{agreement:job.agreement??null,attestation:job.attestation??null,transactions:Object.fromEntries(Object.entries(state.operations[job.id]??{}).map(([kind,op])=>[kind,{hash:op.hash,status:op.status,receipt:op.receipt??null}]))},trust:'This browser controls its private test chain. Receipts are verifiable against this browser storage, not independently against a public network. No cloud sync. Export records before clearing site data.'});
 async function act(state,save,id,action,input){
  const job=get(state,id);requireValue(input.revision===job.revision,'This task changed in another tab. Refresh it before trying again.');
  const stage=allowed=>requireValue(allowed.includes(job.status),'This action is not available at this stage.');
  if(job.authorityRevoked&&(['edit','quotes','select','counter'].includes(action)||(action==='fund'&&!job.dealId)))throw Error('Task authority revoked. New commitments are disabled; existing funded work is preserved.');
  if(action==='stop'){
   requireValue(!job.authorityRevoked,'Task authority is already revoked.');
   job.authorityRevoked=true;job.authorityRevokedAt=new Date().toISOString();
   event(job,'human','Task authority revoked','New commitments disabled for this task. Existing funded work remains payable on its agreed terms; refunds require a separate decision. This is a local workspace control.');
  }
  else if(action==='edit'){stage(['DRAFT','QUOTED','BLOCKED']);Object.assign(job,taskSpec(input),{status:'DRAFT',offers:[],selected:null});event(job,'human','Brief updated','Source data and spending limits saved in this browser.');}
  else if(action==='quotes'){stage(['DRAFT','QUOTED','BLOCKED']);job.offers=offersFor(job.source.length);job.selected=null;job.status='QUOTED';event(job,'buyer','Requested offers',`${job.source.length} source rows; ${job.perDeal} test units per-deal limit.`);for(const offer of job.offers)event(job,offer.seller,`${offer.name} offered ${offer.price} test units`,'All-in fixed price, calculated by the local worker’s pricing rules.');if(job.demoMode){const over=job.offers.find(o=>o.price>job.perDeal||o.price>job.budget);if(over){job.selected=over.seller;job.status='BLOCKED';event(job,'policy','Sample offer blocked',`${over.name}: ${over.price} test units exceeds the ${job.perDeal} per-deal limit. Automatic sample check; no transaction was signed. Choose Atlas and negotiate 20.`);}}}
  else if(action==='select'){stage(['QUOTED','BLOCKED']);requireValue(job.offers.some(o=>o.seller===input.seller),'Choose an available offer.');job.selected=input.seller;const selected=job.offers.find(o=>o.seller===input.seller);job.status=selected.price>job.perDeal||selected.price>job.budget?'BLOCKED':'QUOTED';if(job.status==='BLOCKED')event(job,'policy','Spending request blocked',`${selected.price} test units exceeds your ${job.perDeal} per-deal limit. No transaction was signed. Negotiate within your existing authority.`);event(job,'human','Offer selected',`${workerNames[job.selected]} selected. Funds have not moved.`);}
  else if(action==='counter'){stage(['QUOTED','BLOCKED']);const offer=job.offers.find(o=>o.seller===job.selected);requireValue(offer,'Select an offer first.');requireValue(whole(input.price),'Enter a whole number of test units for the counteroffer.');event(job,'buyer',`Counteroffer: ${input.price} test units`,'Requested an all-in fixed price.');if(input.price<offer.floor){offer.counterPrice=offer.floor;event(job,offer.seller,`Revised offer: ${offer.floor} test units`,`I cannot accept ${input.price} for the same scope. I can do ${offer.floor}, with all ${job.source.length} referenced rows.`);}else{delete offer.counterPrice;offer.price=input.price;job.status=offer.price>job.perDeal||offer.price>job.budget?'BLOCKED':'QUOTED';event(job,offer.seller,'Counteroffer accepted',`${input.price} test units for the complete task.`);}}
  else if(action==='fund'){
   stage(['QUOTED','BLOCKED','FUNDING']);const offer=job.offers.find(o=>o.seller===job.selected);requireValue(offer,'Select an offer before approving.');
   if(offer.price>job.perDeal||offer.price>job.budget){job.status='BLOCKED';event(job,'policy','Spending request blocked',`${offer.price} test units exceeds your authority. No transaction was signed.`);}
   else{
    if(!job.dealHash){job.agreedPrice=offer.price;job.dealId=crypto.randomUUID();job.agreement={id:job.dealId,task:job.id,seller:job.selected,price:job.agreedPrice,budget:job.budget,perDeal:job.perDeal,sourceHash:digest(job.source),brief:job.brief,deliveryMinutes:job.deliveryMinutes,expiresAt:Math.floor(Date.now()/1000)+86400};job.dealHash=digest(job.agreement);job.transactions=[];}
    job.status='FUNDING';job.revision++;await save();
    const chain=await chainFactory(state,save);try{state.chain.publicNetwork=chain.network;await chain.transact(job,'fund');job.status='LOCKED';event(job,'policy','Authority checks passed',`${job.agreedPrice} test units fits both approved spending limits.`);event(job,'chain','Funds locked in escrow','The escrow contract executed on this browser’s private EVM. No public funds were used.');}finally{await chain.close();}
   }
  }
  else if(action==='run'){stage(['LOCKED']);job.output=normalizeRows(job.source);job.invoice=job.agreedPrice+(job.demoMode?5:0);if(job.demoMode)event(job,'policy','Sample overcharge blocked',`Authored demo invoice: ${job.invoice} test units; agreement: ${job.agreedPrice}. Payment blocked by the application before signing. Escrow remains locked.`);job.validation=checkRows(job,job.output);job.status='REVIEW';event(job,job.selected,'Worker completed the task',`Read ${job.source.length} rows, normalized fields and preserved citations and units.`);event(job,'policy','Delivery ready for review',`${job.validation.checks.filter(c=>c.pass).length}/${job.validation.checks.length} checks passed. Inspect the output before paying.`);}
  else if(action==='delivery'){stage(['REVIEW']);requireValue(typeof input.raw==='string'&&input.raw.length<1000000,'Use a delivery smaller than 1 MB.');let rows;try{rows=JSON.parse(input.raw);}catch{throw Error('The delivery must be a valid JSON array.');}requireValue(Array.isArray(rows)&&rows.length<=1000,'Use an array with no more than 1,000 rows.');job.output=rows;job.validation=checkRows(job,rows);event(job,job.selected,'Delivery updated',job.validation.verified?'All acceptance checks passed.':'Validation failed. Payment remains blocked.');}
  else if(action==='invoice'){stage(['REVIEW']);requireValue(whole(input.amount),'Enter a whole number of test units for the invoice.');job.invoice=input.amount;event(job,'policy',job.invoice===job.agreedPrice?'Invoice matches the agreement':'Invoice blocked',`${job.invoice} test units requested; ${job.agreedPrice} test units agreed. A spending limit does not authorize an overcharge.`);}
  else if(action==='settle'||action==='refund'){
   const paying=action==='settle';stage(paying?['REVIEW','SETTLING']:['LOCKED','REVIEW','REFUNDING']);
   if(paying&&job.status==='REVIEW'){requireValue(job.invoice===job.agreedPrice,'The invoice must exactly match the agreed price.');job.validation=checkRows(job,job.output);requireValue(job.validation.verified,'The delivery must pass every check before payment.');}
   const kind=paying?'release':'refund';job.status=paying?'SETTLING':'REFUNDING';
   if(!state.operations[job.id]?.[kind]){job.attestation={dealHash:job.dealHash,outputHash:digest(job.output??null),invoice:job.invoice??null,reason:paying?'DELIVERY_VERIFIED':'BUYER_REJECTED_DELIVERY',outcome:kind};job.attestationHash=digest(job.attestation);}
   job.revision++;await save();
   const chain=await chainFactory(state,save);try{await chain.transact(job,kind);job.status=paying?'COMPLETED':'REFUNDED';event(job,'chain',paying?'Payment confirmed':'Refund confirmed',`${job.agreedPrice} test units ${paying?'paid once to '+workerNames[job.selected]:'returned to the buyer'} on this browser’s private EVM.`);}catch(error){if(!state.operations[job.id]?.[kind]){job.status=job.output?'REVIEW':'LOCKED';await save();}throw error;}finally{await chain.close();}
  }
  else if(action==='cancel'){stage(['DRAFT','QUOTED','BLOCKED']);job.status='CANCELLED';event(job,'human','Task cancelled','No funds were allocated.');}
  else throw Error('Unknown task action.');
  job.revision++;job.updatedAt=new Date().toISOString();await save();return structuredClone(job);
 }
 return {
  request:(url,body)=>serial(async(state,save)=>{
   if(url==='/api/workspace')return {token:'browser-session',network:network(state),tasks:state.jobs.slice().reverse().map(j=>({id:j.id,title:j.title,status:j.status,updatedAt:j.updatedAt,rows:j.source.length,price:j.agreedPrice??null,revision:j.revision}))};
   if(url==='/api/sample')return sample();
   if(url==='/api/tasks'&&body){const spec=taskSpec(body),job={...spec,id:crypto.randomUUID(),revision:0,status:'DRAFT',offers:[],selected:null,events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};event(job,'human','Task created',`${spec.source.length} source rows saved in this browser. Budget ${spec.budget} test units.`);state.jobs.push(job);await save();return structuredClone(job);}
   const match=/^\/api\/tasks\/([a-f0-9-]+)(?:\/([a-z-]+))?$/.exec(url);requireValue(match,'Unknown workspace request.');const [,id,action]=match;
   if(body)return act(state,save,id,action,body);
   const job=get(state,id);
   if(action==='receipt')return packet(state,job);
   if(action==='verify'){requireValue(job.dealId,'Create an escrow before verifying its receipt.');const chain=await chainFactory(state,save);try{return await chain.verify(job);}finally{await chain.close();}}
   requireValue(!action,'Unknown workspace request.');return structuredClone(job);
  }),
  close:()=>storage.close?.()
 };
}
export const executionMode='browser';
let instance;
export async function request(url,body){instance??=createBrowserWorkspace();return instance.request(url,body);}
