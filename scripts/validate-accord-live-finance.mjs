import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import ganache from 'ganache';
import {createBrowserWorkspace} from '../web/spending/browser-workspace.mjs';
import {openBrowserChain} from '../web/spending/browser-chain.mjs';
import {checkRows} from '../web/spending/workspace-rules.mjs';
const input=process.argv.find(a=>a.startsWith('--report='))?.slice(9);assert(input,'--report= required');
const original=readFileSync(input),negotiation=JSON.parse(original);const partial=process.argv.includes('--partial');assert(partial?negotiation.results.length>0&&negotiation.results.length<=20:negotiation.results.length===20);const financialRun=randomUUID();assert.equal(negotiation.mode,'ACTUAL_KILN_ONLY');
const output={schema:'ACCORD_VARIED_LIVE_FINANCE_V1',run:negotiation.run,financialRun,partial,startedAt:new Date().toISOString(),input:{path:input,sha256:createHash('sha256').update(original).digest('hex')},scope:'Saved actual Kiln signatures replayed through the current browser workspace and real private-EVM bytecode. Source processing and the human approval bridge are deterministic test fixtures; this is not a second live HTTP model run or a public-chain proof.',results:[]};
const sourceFiles=['web/spending/browser-workspace.mjs','web/spending/browser-chain.mjs','web/spending/live-proof.mjs','web/spending/workspace-rules.mjs','artifacts/deal-escrow/contract.json','scripts/validate-accord-live-finance.mjs'];
output.source=sourceFiles.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const file=dirname(input)+(partial?'/financial-partial-'+financialRun+'.json':'/financial.json');const save=()=>writeFileSync(file,JSON.stringify(output,null,2)+'\n');save();
for(const r of negotiation.results){
 const c=negotiation.cases.find(c=>c.id===r.caseId),checks=[],events=[];let job,authority,blockedAttempt=null;
 let state={version:1,jobs:[],operations:{},chain:null};const storage={load:async()=>structuredClone(state),save:async x=>{state=structuredClone(x);}};
 const path=resolve(`data/private/varied-live/${negotiation.run}/${financialRun}/evm-${r.caseId}`);mkdirSync(path,{recursive:true});
 let tail=Promise.resolve();const locks={request:(_name,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}};
 const chainFactory=async(s,saveState)=>{
  let raw;const chain=await openBrowserChain(s,saveState,{dbPath:path,ganacheLoader:async()=>({provider:options=>(raw=ganache.provider(options))})});
  const transact=chain.transact;chain.transact=async(j,kind)=>{const result=await transact(j,kind);const latest=await raw.request({method:'eth_getBlockByNumber',params:['latest',false]});events.push({kind,blockedAttempt,deadline:j.deadline,blockTimestamp:Number(latest.timestamp),transactions:structuredClone(j.transactions)});return result;};return chain;
 };
 const workspace=createBrowserWorkspace({storage,locks,chainFactory,liveAuthority:async()=>structuredClone(authority)});
 const act=async(action,body={})=>job=await workspace.request(`/api/tasks/${job.id}/${action}`,{revision:job.revision,...body});
 const check=(name,actual,expected)=>{checks.push({name,actual,expected,pass:actual===expected});};
 const blocked=async(name,fn)=>{let error=null;blockedAttempt=name;try{await fn();}catch(e){error=e.message;}finally{blockedAttempt=null;}checks.push({name,pass:!!error,error});};
 let error=null;
 try{
  job=await workspace.request('/api/tasks',{title:r.session.request.title,brief:c.brief,budget:c.budget,perDeal:c.perDeal,deliveryMinutes:c.deliveryMinutes,sourceText:JSON.stringify(r.sourceRows),demoMode:false});
  authority={session:structuredClone(r.session),authorization:{taskId:job.id,agreementHash:r.session.agreement?.hash}};
  if(!r.converged){await blocked('No signed agreement cannot enter funding path',()=>act('live-import',{id:r.session.id}));check('No financial transactions',state.jobs[0].transactions?.length??0,0);}
  else{
   const originalAuthority=structuredClone(authority);authority.session.agreement.terms.price++;
   await blocked('Tampered signed price rejected',()=>act('live-import',{id:r.session.id}));authority=originalAuthority;
   const terms=r.session.agreement.terms;
   if(terms.sources>c.sources){
    await act('live-import',{id:r.session.id});await act('fund');await act('run');
    check('Delivery cannot satisfy higher signed source count',job.validation.verified,false);
    await blocked('Incomplete signed source coverage cannot settle',()=>act('settle'));
    check('Insufficient sources caused no payment',state.jobs[0].transactions.filter(t=>t.kind==='release').length,0);
    await act('refund');
   }
   else{
    await act('live-import',{id:r.session.id});await act('fund');check('Agreed price funded',job.agreedPrice,terms.price);
    check('Escrow delivery window matches signed terms',events.find(e=>e.kind==='fund').deadline-events.find(e=>e.kind==='fund').blockTimestamp,terms.deliveryMinutes*60);
    await act('run');await act('invoice',{amount:terms.price+1});const before=job.transactions.length;
    await blocked('Overbill below overall budget rejected',()=>act('settle'));check('Overbill caused no transaction',state.jobs[0].transactions.length,before);
    await act('invoice',{amount:terms.price});const validOutput=structuredClone(job.output),bad=structuredClone(job.output);bad[0].capex+=1;
    await act('delivery',{raw:JSON.stringify(bad)});await blocked('Wrong delivery rejected',()=>act('settle'));check('Wrong delivery caused no transaction',state.jobs[0].transactions.length,before);
    await act('delivery',{raw:JSON.stringify(validOutput)});
    check('Delivery after signed deadline rejected',checkRows(job,job.output,job.deadline+1).verified,false);
    await act('settle');check('Valid payment completed',job.status,'COMPLETED');check('Exactly one payment transaction',job.transactions.filter(t=>t.kind==='release').length,1);
    await blocked('Repeat settlement rejected',()=>act('settle'));check('Repeat caused no additional transaction',state.jobs[0].transactions.filter(t=>t.kind==='release').length,1);
    const verified=await workspace.request(`/api/tasks/${job.id}/verify`);check('Receipt independently checks within local chain',verified.verdict,'VALID');
   }
  }
 }catch(e){error=e.message;}finally{await workspace.close();}
 output.results.push({caseId:c.id,converged:r.converged,checks,error,events,passed:!error&&checks.every(c=>c.pass),finalStatus:state.jobs[0]?.status,receipt:state.jobs[0]?.status==='COMPLETED'?await workspace.request(`/api/tasks/${job.id}/receipt`):null});save();
 console.log(JSON.stringify({case:c.id,passed:output.results.at(-1).passed,error,checks:checks.length}));
}
output.completedAt=new Date().toISOString();output.summary={cases:output.results.length,passed:output.results.filter(r=>r.passed).length,failures:output.results.filter(r=>!r.passed).map(r=>({caseId:r.caseId,error:r.error,checks:r.checks.filter(c=>!c.pass)})),payments:output.results.filter(r=>r.finalStatus==='COMPLETED').length,unauthorizedSettlements:output.results.reduce((n,r)=>n+r.events.filter(e=>e.kind==='release'&&e.blockedAttempt).length,0)};
output.status=output.summary.failures.length?'FAIL':partial?'PARTIAL_PASS':'PASS';output.sourceUnchanged=output.source.every(f=>createHash('sha256').update(readFileSync(f.path)).digest('hex')===f.sha256);save();console.log(JSON.stringify(output.summary));if(output.status==='FAIL')process.exitCode=1;
