import {readFileSync} from 'node:fs';
import path from 'node:path';
export const PROCUREMENT_RUN='fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9';
export function procurementEvidence(root){
 const directory=path.join(root,'artifacts/dealtrace/procurement/runs',PROCUREMENT_RUN);
 const report=JSON.parse(readFileSync(path.join(directory,'report.json'),'utf8'));
 const verification=JSON.parse(readFileSync(path.join(directory,'finalized-verification.json'),'utf8'));
 const usage=JSON.parse(readFileSync(path.join(root,'artifacts/dealtrace/procurement/usage-audit.json'),'utf8'));
 const required=[['open-mandate',1],['fund',1],['overbill-blocked',0],['settle',1],['withdraw-seller',1]];
 if(report.run!==PROCUREMENT_RUN||report.status!=='PASS'||report.mode!=='LIVE_KILN'||report.network.chainId!==11155111||verification.verdict!=='VALID'||verification.block_tag!=='finalized'||verification.checks!==verification.passed.length||!required.every(([label,status])=>report.transactions.filter(t=>t.label===label&&t.status===status).length===1))throw Error('PROCUREMENT_PROOF_REQUIRED');
 const scale=BigInt(report.network.unitWei)*100n;
 const units=value=>Number(BigInt(value))/Number(scale);
 if(report.claims.bad.dealHash!==report.plan.deal.dealHash||report.claims.correct.amount!==report.plan.deal.amount||report.paid_wei!==report.plan.deal.amount||BigInt(report.claims.bad.amount)<=BigInt(report.plan.deal.amount))throw Error('PROCUREMENT_PROOF_BINDING');
 const flows=new Map();for(const call of report.usage){const f=flows.get(call.flow_name)??{name:call.flow_name,calls:0,input:0,output:0};f.calls++;f.input+=call.prompt_tokens;f.output+=call.completion_tokens;flows.set(call.flow_name,f);}
 const summary={schema:'ACCORD_PUBLIC_PROOF_V1',run:report.run,recordedAt:report.completed_at,sourceHash:report.source_hash,model:[...new Set(report.usage.map(c=>c.model))].join(', '),budget:units(report.plan.mandate.budget),agreement:units(report.plan.deal.amount),rejectedInvoice:units(report.claims.bad.amount),calls:report.usage.length,tokens:report.usage.reduce((n,c)=>n+c.total_tokens,0),flows:[...flows.values()],verification:{verdict:verification.verdict,checks:verification.checks,block:verification.block,checkedAt:verification.checked_at},transactions:report.transactions.map(t=>({label:t.label,hash:t.tx_hash,status:t.status}))};
 return {'dealtrace-report':report,'dealtrace-finalized':verification,'dealtrace-usage':usage,'dealtrace-summary':summary};
}
