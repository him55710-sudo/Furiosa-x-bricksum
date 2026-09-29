import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {DealStore} from '../deal-escrow/store.ts';
import {DealEngine} from '../deal-escrow/engine.ts';
import {openChain} from '../deal-escrow/chain.mjs';
import {validateDelivery} from '../deal-escrow/delivery.ts';
import {receipt,verifyReceipt} from '../deal-escrow/audit.ts';
import {referenceRows} from '../deal-escrow/reference.ts';
import {hash} from '../deal-escrow/domain.ts';
import {parseSource,normalizeRows,offersFor,workerNames,columns} from '../../web/spending/workspace-model.mjs';

const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const number=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export async function createWorkspace({directory='data/private/accord-workspace',chainFactory=openChain}={}){
 mkdirSync(directory,{recursive:true});
 // This workspace can never inherit a public-network or remote RPC setting.
 const chain=await chainFactory({directory:path.join(directory,'evm'),extraSellerIds:['seller-c'],publicNetwork:false,devnetRpc:null,confirmations:1,finalityMode:'confirmations'});
 const store=new DealStore(path.join(directory,'workspace.sqlite')),engine=new DealEngine(store,chain);
 store.db.exec('CREATE TABLE IF NOT EXISTS accord_jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
 let queue=Promise.resolve();
 const serial=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;};
 const now=()=>Math.floor(Date.now()/1000);
 const get=id=>{const row=store.db.prepare('SELECT body FROM accord_jobs WHERE id=?').get(id);requireValue(row,'Task not found.');return JSON.parse(row.body);};
 const save=job=>{store.db.prepare('INSERT INTO accord_jobs(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(job.id,JSON.stringify(job));return job;};
 const event=(job,actor,title,detail)=>{job.events.push({id:randomUUID(),at:new Date().toISOString(),actor,title,detail});};
 function view(job){
  if(job.dealId){const r=store.get(job.dealId);job.chainState=r.state;job.dealHash=r.dealHash;job.transactions=['fund','release','refund'].flatMap(kind=>{const o=store.operation(job.dealId,kind);return o?[{kind,status:o.status,hash:o.txHash??null,block:o.receipt?.blockNumber??null,amount:job.agreedPrice}]:[];});job.deadline=r.details.escrow?.deadline??null;if(r.state==='SETTLED')job.status='COMPLETED';if(r.state==='REFUNDED')job.status='REFUNDED';if(r.state==='ESCROW_FUNDED'&&['QUOTED','FUNDING'].includes(job.status))job.status='LOCKED';}
  return job;
 }
 const requirements=job=>({minimum_rows:job.source.length,required_columns:columns,minimum_source_coverage:1,format:'JSON'});
 function check(job,rows){
  const end=job.deadline??now()+job.deliveryMinutes*60;
  const result=validateDelivery(JSON.stringify(rows),requirements(job),now(),end);
  const expected=normalizeRows(job.source);
  const same=rows.length===expected.length&&expected.every(a=>rows.some(b=>b&&Object.keys(a).every(k=>JSON.stringify(b[k])===JSON.stringify(a[k]))));
  result.checks.push({name:'SOURCE_VALUES_MATCH',pass:same,actual:same,expected:'Every source field is preserved, including units and reference metadata when supplied.'});
  result.verified=result.checks.every(c=>c.pass);return result;
 }
 function schema(input){
  requireValue(typeof input.title==='string'&&input.title.trim().length>=3&&input.title.length<=100,'Give this task a title between 3 and 100 characters.');
  requireValue(typeof input.brief==='string'&&input.brief.trim().length>=10&&input.brief.length<=4000,'Describe the required work in 10 to 4,000 characters.');
  requireValue(number(input.budget,1,1000000)&&number(input.perDeal,1,input.budget),'Use whole test units amounts. The per-deal limit cannot exceed the task budget.');
  requireValue(number(input.deliveryMinutes,1,60),'Set a delivery window from 1 to 60 minutes.');
  const source=parseSource(input.sourceText);
  const probe={source,deliveryMinutes:input.deliveryMinutes};const checks=check(probe,normalizeRows(source));
  requireValue(checks.verified,'The source table has invalid values, duplicate rows or missing HTTP(S) source URLs. Use 2025–2026 quarters and three-letter currencies.');
  return {demoMode:input.demoMode===true,title:input.title.trim(),brief:input.brief.trim(),budget:input.budget,perDeal:input.perDeal,deliveryMinutes:input.deliveryMinutes,source,sourceName:String(input.sourceName??'Source table').slice(0,120)};
 }
 async function act(id,action,input={}){return serial(async()=>{
  let job=view(get(id));requireValue(input.revision===job.revision,'This task changed in another tab. Refresh it before trying again.');
  const state=allowed=>requireValue(allowed.includes(job.status),'This action is not available at this stage.');
  if(job.authorityRevoked&&(['edit','quotes','select','counter'].includes(action)||(action==='fund'&&!job.dealId)))throw Error('Task authority revoked. New commitments are disabled; existing funded work is preserved.');
  if(action==='stop'){
   requireValue(!job.authorityRevoked,'Task authority is already revoked.');
   job.authorityRevoked=true;job.authorityRevokedAt=new Date().toISOString();
   event(job,'human','Task authority revoked','New commitments disabled for this task. Existing funded work remains payable on its agreed terms; refunds require a separate decision. This is a local workspace control.');
  }
  else if(action==='edit'){state(['DRAFT','QUOTED','BLOCKED']);Object.assign(job,schema(input),{status:'DRAFT',offers:[],selected:null});event(job,'human','Brief updated','The source table and spending limits have been updated.');}
  else if(action==='quotes'){state(['DRAFT','QUOTED','BLOCKED']);job.offers=offersFor(job.source.length);job.selected=null;job.status='QUOTED';event(job,'buyer','Requested offers',`Requested ${job.source.length} source-linked rows within ${job.perDeal} test units per deal.`);for(const offer of job.offers)event(job,offer.seller,`${offer.name} offered ${offer.price} test units`,`${job.deliveryMinutes}-minute window. All-in fixed price. Generated by the local worker's pricing rules.`);if(job.demoMode){const over=job.offers.find(o=>o.price>job.perDeal||o.price>job.budget);if(over){job.selected=over.seller;job.status='BLOCKED';event(job,'policy','Sample offer blocked',`${over.name}: ${over.price} test units exceeds the ${job.perDeal} per-deal limit. Automatic sample check; no transaction was signed. Choose Atlas and negotiate 20.`);}}}
  else if(action==='select'){state(['QUOTED','BLOCKED']);requireValue(job.offers.some(o=>o.seller===input.seller),'Choose an available offer.');job.selected=input.seller;const selected=job.offers.find(o=>o.seller===input.seller);job.status=selected.price>job.perDeal||selected.price>job.budget?'BLOCKED':'QUOTED';if(job.status==='BLOCKED')event(job,'policy','Spending request blocked',`${selected.price} test units exceeds your ${job.perDeal} per-deal limit. No transaction was signed. Negotiate within your existing authority.`);event(job,'human','Offer selected',`${workerNames[input.seller]} is selected. Funds have not moved.`);}
  else if(action==='counter'){state(['QUOTED','BLOCKED']);const offer=job.offers.find(o=>o.seller===job.selected);requireValue(offer,'Select an offer first.');requireValue(number(input.price,1,1000000),'Enter a whole number of test units for the counteroffer.');event(job,'buyer',`Counteroffer: ${input.price} test units`,`Requested an all-in fixed price from ${offer.name}.`);if(input.price<offer.floor){offer.counterPrice=offer.floor;event(job,offer.seller,`Revised offer: ${offer.floor} test units`,`I cannot accept ${input.price} for the same scope. I can do ${offer.floor}, with all ${job.source.length} referenced rows.`);}else{delete offer.counterPrice;offer.price=input.price;job.status=offer.price>job.perDeal||offer.price>job.budget?'BLOCKED':'QUOTED';event(job,offer.seller,'Counteroffer accepted',`${input.price} test units, including all work and source references.`);}}
  else if(action==='fund'){
   state(['QUOTED','BLOCKED','FUNDING']);const offer=job.offers.find(o=>o.seller===job.selected);requireValue(offer,'Select an offer before approving.');
   if(offer.price>job.perDeal||offer.price>job.budget){job.status='BLOCKED';event(job,'policy','Spending request blocked',`${offer.price} test units exceeds your approved limit. Lower the offer or edit the brief. No transaction was signed.`);}
   else{
    if(!job.dealId){const t=now();const mandate={mandate_id:randomUUID(),company_id:`accord-${job.id}`,buyer_id:'buyer-agent',task_budget_minor:job.budget,max_single_minor:job.perDeal,allowed_sellers:['seller-a','seller-b','seller-c'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+86400};
    engine.mandate(mandate);const deal={deal_id:randomUUID(),buyer_id:'buyer-agent',seller_id:offer.seller,price_minor:offer.price,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:requirements(job),deadline:job.deliveryMinutes*60,created_at:t,expires_at:t+86400,supersedes_deal_id:null};
    engine.propose(deal,mandate.mandate_id);engine.agentAction('accept_deal',{deal_id:deal.deal_id});job.dealId=deal.deal_id;job.agreedPrice=offer.price;job.status='FUNDING';job.revision++;save(job);}
    await engine.fund(job.dealId);job=view(job);requireValue(job.chainState==='ESCROW_FUNDED','The escrow could not be funded. Inspect the task before retrying.');job.status='LOCKED';event(job,'policy','Authority checks passed',`${offer.price} test units is within the ${job.perDeal} test units per-deal limit and ${job.budget} test units task budget.`);event(job,'chain','Funds locked in escrow','A real transaction was confirmed on the private local EVM. No public funds were used.');
   }
  }
  else if(action==='run'){
   state(['LOCKED']);job.output=normalizeRows(job.source);job.invoice=job.agreedPrice+(job.demoMode?5:0);if(job.demoMode)event(job,'policy','Sample overcharge blocked',`Authored demo invoice: ${job.invoice} test units; agreement: ${job.agreedPrice}. Payment blocked by the application before signing. Escrow remains locked.`);job.validation=check(view(job),job.output);job.status='REVIEW';event(job,job.selected,'Worker completed the task',`Read ${job.source.length} rows; normalized company names, quarters, values and currencies; preserved source references.`);event(job,'policy','Delivery ready for your review',`${job.validation.checks.filter(c=>c.pass).length}/${job.validation.checks.length} checks passed. Compare the output with its sources before approving payment.`);
  }
  else if(action==='delivery'){
   state(['REVIEW']);requireValue(typeof input.raw==='string'&&input.raw.length<1000000,'Use a delivery smaller than 1 MB.');let rows;try{rows=JSON.parse(input.raw);}catch{throw Error('The delivery must be a valid JSON array.');}requireValue(Array.isArray(rows)&&rows.length<=1000,'Use an array with no more than 1,000 rows.');job.output=rows;job.validation=check(view(job),rows);event(job,job.selected,'Delivery updated',job.validation.verified?'The replacement delivery passed all checks.':'The replacement delivery failed validation. Payment remains locked.');
  }
  else if(action==='invoice'){
   state(['REVIEW']);requireValue(number(input.amount,1,1000000),'Enter a whole number of test units for the invoice.');job.invoice=input.amount;event(job,'policy',input.amount===job.agreedPrice?'Invoice matches the agreement':'Invoice blocked',`${input.amount} test units requested; ${job.agreedPrice} test units agreed. ${input.amount===job.agreedPrice?'Ready for your approval.':'A spending limit does not authorize an overcharge. Funds remain locked.'}`);
  }
  else if(action==='settle'){
   state(['REVIEW','SETTLING']);if(job.status==='REVIEW'){requireValue(job.invoice===job.agreedPrice,'The invoice must exactly match the agreed price.');job.validation=check(view(job),job.output);requireValue(job.validation.verified,'The delivery must pass every check before payment.');job.status='SETTLING';job.revision++;save(job);}
   if(store.get(job.dealId).state==='ESCROW_FUNDED')await engine.deliver(job.dealId,JSON.stringify(job.output));else await engine.serial(()=>engine.settle(job.dealId));
   job=view(job);requireValue(['COMPLETED','REFUNDED'].includes(job.status),'The transaction is pending. Retry confirmation for this same deal.');event(job,'chain',job.status==='COMPLETED'?'Payment confirmed':'Funds returned',job.status==='COMPLETED'?`${job.agreedPrice} test units paid once to ${workerNames[job.selected]}. Download the result and receipt.`:'The on-chain deadline or final policy check prevented payment.');
  }
  else if(action==='refund'){
   state(['LOCKED','REVIEW','REFUNDING']);job.status='REFUNDING';job.revision++;save(job);
   // Preserve an existing signed intent. The controller records the operator's explicit rejection.
   if(!store.operation(job.dealId,'refund'))store.transaction(()=>{
    const r=store.get(job.dealId),time=now(),checks=engine.checks(job.dealId,time),mandate=store.mandate(r.mandateId);
    store.event(job.dealId,'BUYER_REJECTED_DELIVERY',{task_id:job.id},'buyer',r.deal.buyer_id);
    store.event(job.dealId,'FINAL_AUTHORIZATION',{checks,time,mandate,accounting:store.accounting(r.mandateId,job.dealId)});
    const attestation={deal:r.deal,deal_hash:r.dealHash,mandate,delivery:r.details.delivery??null,validation:r.details.validation??null,final_checks:checks,reason:'BUYER_REJECTED_DELIVERY',outcome:'refund',prior_event_hash:store.events(job.dealId).at(-1).event_hash,preview:r.details.preview??null};
    store.details(job.dealId,{attestation,attestation_hash:hash(attestation),settlement_reason:attestation.reason});store.saveOperation(job.dealId,'refund',{status:'PENDING',created_at:time});
   });
   await engine.serial(()=>engine.execute(job.dealId,'refund'));job=view(job);event(job,'human','Delivery rejected','You requested return of the locked local test funds.');event(job,'chain','Refund confirmed',`${job.agreedPrice} test units returned by the escrow contract.`);
  }
  else if(action==='cancel'){state(['DRAFT','QUOTED','BLOCKED']);job.status='CANCELLED';event(job,'human','Task cancelled','No funds were allocated.');}
  else throw Error('Unknown action.');
  job.revision++;job.updatedAt=new Date().toISOString();return save(view(job));
 });}
 return {
  sample:()=>({title:'Quarterly CAPEX research',brief:'Normalize quarterly facility-investment data into a clean table. Preserve the company, quarter, value, currency and source URL for every row. Return JSON and CSV with a verifiable receipt.',sourceText:JSON.stringify(referenceRows(),null,2),sourceName:'LG Energy Solution · reference dataset.json',budget:40,perDeal:30,deliveryMinutes:10,demoMode:true}),
  network:()=>({name:'Local EVM',chainId:chain.deployment.chainId,contract:chain.deployment.contract,unit:'gwei',mode:'LOCAL_EXECUTION',description:'Local rule-based workers; real private-EVM escrow transactions. No external AI calls or real funds.'}),
  list:()=>store.db.prepare('SELECT body FROM accord_jobs ORDER BY rowid DESC').all().map(r=>{const j=view(JSON.parse(r.body));return {id:j.id,title:j.title,status:j.status,updatedAt:j.updatedAt,rows:j.source.length,price:j.agreedPrice??null,revision:j.revision};}),
  get:id=>view(get(id)),
  create:input=>serial(async()=>{const spec=schema(input),job={...spec,id:randomUUID(),revision:0,status:'DRAFT',offers:[],selected:null,events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};event(job,'human','Task created',`${spec.source.length} source rows saved locally. Budget ${spec.budget} test units; per-deal limit ${spec.perDeal} test units.`);return save(job);}),
  act,
  export:id=>{const j=view(get(id));return {product:'accord lock',mode:'LOCAL_EXECUTION',network:chain.deployment,task:j,receipt:j.dealId?receipt(engine,j.dealId):null,trust:'Local workers and controller are trusted. Generic imports are checked against supplied data, not independently fact-checked.'};},
  verify:async id=>{const j=get(id);requireValue(j.dealId,'Create an escrow before verifying a receipt.');return verifyReceipt(receipt(engine,j.dealId),chain);},
  close:async()=>{await queue;await engine.queue;store.close();await chain.close();}
 };
}
