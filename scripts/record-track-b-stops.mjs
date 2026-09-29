import {randomUUID} from 'node:crypto';
import {writeFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {DealStore} from '../src/deal-escrow/store.ts';
import {DealEngine} from '../src/deal-escrow/engine.ts';

// A read-only financial boundary exercise: both proposals must stop before
// prepare/broadcast, so a chain connection and Kiln credentials are unnecessary.
const output=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6);
const store=new DealStore(':memory:');
let financialCalls=0;
const chain={sellers:Object.fromEntries(['seller-a','seller-b','seller-c','seller-d'].map(id=>[id,{}])),
  prepare:async()=>{financialCalls++;throw Error('UNEXPECTED_FINANCIAL_PREPARE');},
  broadcast:async()=>{financialCalls++;throw Error('UNEXPECTED_FINANCIAL_BROADCAST');}};
const engine=new DealEngine(store,chain);
const now=Math.floor(Date.now()/1000);
const cases=[
  {name:'STOP RUN 1',boundary:'per-deal limit',price:35,seller:'seller-b',allowed:['seller-a','seller-b','seller-c'],reason:'MAX_SINGLE'},
  {name:'STOP RUN 2',boundary:'seller allowlist',price:20,seller:'seller-d',allowed:['seller-a','seller-b','seller-c'],reason:'SELLER_ALLOWED'}
];
try{
  const runs=[];
  for(const spec of cases){
    const mandate={mandate_id:randomUUID(),company_id:'track-b-capture',buyer_id:'buyer-agent',task_budget_minor:40,max_single_minor:30,allowed_sellers:spec.allowed,category:'RESEARCH_DATA',status:'ACTIVE',created_at:now,expires_at:now+3600};
    const deal={deal_id:randomUUID(),buyer_id:mandate.buyer_id,seller_id:spec.seller,price_minor:spec.price,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:4,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:1,format:'JSON'},deadline:600,created_at:now,expires_at:now+1800,supersedes_deal_id:null};
    engine.mandate(mandate);engine.propose(deal,mandate.mandate_id);engine.agentAction('accept_deal',{deal_id:deal.deal_id});
    await engine.fund(deal.deal_id);
    const state=store.get(deal.deal_id),events=store.events(deal.deal_id),blocked=events.findLast(event=>event.event_type==='TRANSACTION_BLOCKED');
    const operations=['fund','release','refund'].flatMap(kind=>store.operation(deal.deal_id,kind)?[kind]:[]);
    if(state.state!=='BLOCKED'||blocked?.structured_payload?.reason!==spec.reason||operations.length||store.usage(deal.deal_id).length||financialCalls)throw Error(`STOP_CAPTURE_FAILED: ${spec.name}`);
    runs.push({run:spec.name,outcome:'STOPPED',implementation_state:state.state,boundary:spec.boundary,reason:blocked.structured_payload.reason,mandate:{budget:40,per_deal_limit:30,allowed_sellers:spec.allowed},attempt:{seller:spec.seller,offer:spec.price},kiln_calls:0,deal_financial_transactions:0,payment:0,funding:0,deal_id:deal.deal_id,policy_checks:state.details.policy,financial_operations:operations,events});
  }
  const evidence={schema:'ACCORD_LOCK_TRACK_B_STOPS_V1',captured_at:new Date().toISOString(),runtime:'DealEngine deterministic local policy path; no Kiln or blockchain connection',scope:'Two separate attempted deals. STOPPED is the submission outcome; BLOCKED is the exact implementation state.',runs};
  if(output){if(existsSync(output))throw Error('OUTPUT_ALREADY_EXISTS');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');}
  else console.log(JSON.stringify(evidence,null,2));
}finally{store.close();}
