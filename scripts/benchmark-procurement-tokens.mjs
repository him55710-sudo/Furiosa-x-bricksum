import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {startWorker} from '../src/dealtrace/procurement/client.mjs';
import {negotiate} from '../src/dealtrace/procurement/negotiate.mjs';
import {defaultRfq,hash} from '../src/dealtrace/procurement/protocol.mjs';
import {registeredSellers,tokenCeiling} from '../src/dealtrace/procurement/limits.mjs';

if(!process.argv.includes('--live'))throw Error('Use --live for actual paid Kiln requests. No chain transactions are made.');
if(!process.env.KILN_API_KEY)throw Error('KILN_API_KEY_REQUIRED');
process.env.KILN_MODEL='qwen3-32b';
const arg=name=>process.argv.find(s=>s.startsWith('--'+name+'='))?.split('=')[1];
const contextMode=arg('context')??'full';if(!['compact','full'].includes(contextMode))throw Error('CONTEXT_MODE');
const caps=(arg('caps')??'5000,1800,1200,800').split(',').map(Number);caps.forEach(tokenCeiling);
const repeats=Number(arg('repeats')??3);if(!Number.isInteger(repeats)||repeats<1||repeats>3)throw Error('REPEATS');
const batch=randomUUID(),out='artifacts/dealtrace/procurement/efficiency';mkdirSync(out,{recursive:true});
const sourceFiles=['src/dealtrace/procurement/client.mjs','src/dealtrace/procurement/protocol.mjs','src/dealtrace/procurement/worker.mjs','src/dealtrace/procurement/limits.mjs','src/dealtrace/procurement/negotiate.mjs','scripts/benchmark-procurement-tokens.mjs'];
const sourceManifest=()=>sourceFiles.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const source=sourceManifest();
const report={schema:'ACCORD_TOKEN_CEILING_EXPERIMENT_V1',batch,contextMode,model:process.env.KILN_MODEL,started_at:new Date().toISOString(),source,scope:'Live negotiation only, identical fixed RFQ and operator-pinned seller policies. No funding, settlement or synthetic fallback. Not a population reliability estimate.',repeats,caps,expected_calls:4,capability_prefilter:true,attempts:[],selected_ceiling:null};
const save=()=>writeFileSync(`${out}/${batch}.json`,JSON.stringify(report,null,2)+'\n');save();
for(let repeat=1;repeat<=repeats;repeat++)for(const cap of caps){
 const run=randomUUID(),directory=`data/private/token-experiment/${run}`,workers=[],journal={};mkdirSync(directory,{recursive:true});
 const attempt={run,repeat,cap,success:false,calls:0,retries:0,truncations:0,funding_transactions:0,terms:null,usage:[]};const start=performance.now();
 try{
  const buyer=await startWorker(directory+'/buyer',{id:'buyer',role:'buyer',contextMode,negotiationTokens:cap,policy:{max_budget_minor:4000,preference:'Lower price with all required source evidence, without extending the deadline.'}});workers.push(buyer);
  const sellers=[];for(const c of registeredSellers){const worker=await startWorker(directory+'/'+c.id,{id:c.id,role:'seller',contextMode,negotiationTokens:cap,capabilities:['document','search','compute'],policy:{...c,preferred_margin:'Make a commercially reasonable offer above cost; lower it only if the counteroffer remains profitable.'}});workers.push(worker);sellers.push(worker);}
  const result=await negotiate({rfq:defaultRfq({run}),buyer,sellers,live:true,journal,persist:()=>writeFileSync(directory+'/journal.json',JSON.stringify(journal))});attempt.success=true;attempt.terms=result.packet.terms;attempt.seller=result.selected.id;
 }catch(e){attempt.error=e.message;}
 finally{for(const worker of workers)await worker.close();}
 attempt.usage=Object.values(journal.negotiation?.usage??{}).flat();attempt.calls=attempt.usage.length;
 for(const [key,field] of [['input_tokens','prompt_tokens'],['output_tokens','completion_tokens'],['total_tokens','total_tokens'],['api_latency_ms','latency_ms']])attempt[key]=attempt.usage.some(u=>u[field]===null)?null:attempt.usage.reduce((n,u)=>n+u[field],0);
 attempt.truncations=attempt.usage.filter(u=>u.result==='KILN_OUTPUT_TRUNCATED').length;attempt.invalid_calls=attempt.usage.filter(u=>u.result!=='VALID_TOOL_PROPOSAL').length;
 attempt.elapsed_ms=Math.round(performance.now()-start);attempt.sessions=journal.negotiation?.sessions??{};report.attempts.push(attempt);save();console.log(JSON.stringify({cap,repeat,success:attempt.success,calls:attempt.calls,tokens:attempt.total_tokens,truncations:attempt.truncations,error:attempt.error??null}));
}
report.summary=caps.map(cap=>{const a=report.attempts.filter(a=>a.cap===cap);return {cap,attempts:a.length,successful:a.filter(x=>x.success).length,clean_successful:a.filter(x=>x.success&&x.invalid_calls===0&&x.calls===report.expected_calls).length,total_tokens:a.reduce((n,x)=>n+(x.total_tokens??0),0),truncations:a.reduce((n,x)=>n+x.truncations,0)};});
report.selected_ceiling=report.summary.filter(x=>x.attempts===repeats&&x.clean_successful===repeats&&repeats>=3).sort((a,b)=>a.cap-b.cap)[0]?.cap??null;
report.completed_at=new Date().toISOString();report.source_unchanged=hash(source)===hash(sourceManifest());save();
writeFileSync(out+'/latest.json',JSON.stringify({batch,report:`${out}/${batch}.json`,selected_ceiling:report.selected_ceiling},null,2)+'\n');console.log(JSON.stringify({completed:true,summary:report.summary,selected_ceiling:report.selected_ceiling}));
