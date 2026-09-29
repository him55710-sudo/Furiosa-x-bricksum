import {mkdirSync,writeFileSync} from 'node:fs';
import {runProcurement} from '../src/dealtrace/procurement/run.mjs';
const scenarios=[
 {name:'SELLER_NOT_ALLOWED',options:{allowedSellerIds:['seller-a','seller-b','seller-c'],requestedSellerIds:['seller-x']},explanation:'The human permits sellers A, B and C. Seller X is requested and blocked before worker discovery.'},
 {name:'BUDGET_EXCEEDED',options:{budget:4000,feeReserveMinor:2300},explanation:'Minimum compatible registered work is 18; an explicit fee reserve of 23 makes the all-in minimum 41, above authority 40. The reserve is not a fee transfer.'},
 {name:'MANDATE_EXPIRED',options:{authorityExpiresAt:Date.now()-1000},explanation:'The human authority expired before any provider or chain was opened.'}
];
const results=[];
for(const scenario of scenarios){
 const r=await runProcurement({approved:true,live:true,...scenario.options});
 if(r.status!=='STOPPED'||r.error!==scenario.name||r.model_calls!==0||r.transactions.length!==0||r.financial_intents.length!==0||r.network)throw Error('BOUNDARY_NOT_STOPPED_BEFORE_SIDE_EFFECTS: '+scenario.name);
 results.push({scenario:scenario.name,explanation:scenario.explanation,report:r,kiln_calls:r.model_calls,input_tokens:0,output_tokens:0,funding_transactions:0,chain_opened:!!r.network});
}
mkdirSync('artifacts/dealtrace/procurement/boundaries',{recursive:true});
writeFileSync('artifacts/dealtrace/procurement/boundaries/report.json',JSON.stringify({schema:'ACCORD_PREFLIGHT_BOUNDARIES_V1',status:'PASS',generated_at:new Date().toISOString(),mode:'Actual live-enabled runner stopped before inference and chain setup; no simulated token usage',results},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',scenarios:results.map(r=>r.scenario),kiln_calls:0,chain_transactions:0}));
