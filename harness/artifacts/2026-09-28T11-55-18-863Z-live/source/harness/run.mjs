import {mkdir,readFile,writeFile,appendFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {identities,catalog} from './cases.mjs';
import {runCase,ScriptedBuyer} from './runtime.mjs';
import {KilnStream} from './transport.mjs';
import {sellerBatch} from './sellers.mjs';
import {summarize,pairedArms,markdown} from './metrics.mjs';
const args=process.argv.slice(2),get=(k,d)=>args.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const live=args.includes('--live'),count=Number(get('count','100')),concurrency=Number(get('concurrency','3')),maxCalls=Number(get('max-calls','800')),sellerRepeats=Number(get('seller-repeats',live?'2':'0'));
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>6||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>3000||!Number.isInteger(sellerRepeats)||sellerRepeats<0||sellerRepeats>10)throw new Error('INVALID_OPTIONS');
catalog(count);
const snapshot=args.includes('--snapshot'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
if(!snapshot){
  if(live&&!process.env.KILN_API_KEY)throw new Error('MISSING_KILN_API_KEY');
  const id=new Date().toISOString().replace(/[:.]/g,'-')+(live?'-live':'-offline'),out=path.join(root,'harness/artifacts',id);
  const files=(await readdir(path.join(root,'harness'))).filter(f=>f.endsWith('.mjs')).map(f=>'harness/'+f).concat(['src/policy.mjs','src/store.mjs','shared/schema.mjs','package.json','pnpm-lock.yaml','harness/PROTOCOL.ko.md']);
  const source={};for(const f of files){const b=await readFile(path.join(root,f));source[f]=sha(b);await mkdir(path.dirname(path.join(out,'source',f)),{recursive:true});await writeFile(path.join(out,'source',f),b,{flag:'wx'});}
  for(const f of files)if(sha(await readFile(path.join(root,f)))!==source[f])throw new Error('SOURCE_CHANGED_DURING_SNAPSHOT');
  const manifest={version:1,id,registeredAt:new Date().toISOString(),kind:live?'LIVE_KILN':'OFFLINE_SCRIPTED',model:'qwen3-32b',count,arms:['B0','B1','CM'],concurrency,maxCalls,sellerRepeats,source,cases:catalog(count),maxBuyerTurns:5,maxOutputTokensPerCall:1800,sessionTokenStopThreshold:12000,transactions:0,
    memory:'One identical deterministic signed failure fixture for beta per evaluation row, derived by production deriveControl. No evaluation-result feedback. Training inference cost is zero; fixture construction overhead remains.',
    scope:'Fresh signed synthetic mandates/quotes. Production checkOffer/reserve. Harness tool state machine and supersession gate. No settlement adapter. Live model errors separate from system authorization violations.',
    ttft:'Client time from request start to first nonempty content/reasoning/tool delta, not role/usage/heartbeat chunks; first tool separately recorded.',
    tokenLimit:'Global request count and per-response max_tokens are hard bounds. Session total token threshold is checked after usage arrives; a single request can exceed the threshold. Missing usage stops the next turn.',
    energy:{measured:false,formula:'input_tokens * J_per_input_token + output_tokens * J_per_output_token + calls * J_per_request',coefficients:null,excludes:['client','network','CPU control','chain','idle power']},
  };
  await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({stage:'REGISTERED',id,out,plannedTransactions:count*3,live,maxCalls}));
  const child=spawn(process.execPath,[path.join(out,'source/harness/run.mjs'),...args,'--snapshot',`--out=${out}`],{cwd:root,stdio:'inherit',env:process.env,windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code===0)await writeFile(path.join(root,'harness/artifacts',live?'latest-live.json':'latest-offline.json'),JSON.stringify({id,path:`harness/artifacts/${id}/report.json`},null,2)+'\n');
  process.exitCode=code??1;
}else{
  const out=get('out',null);if(!out)throw new Error('MISSING_OUTPUT');
  const manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
  const buyer=live?new KilnStream({maxCalls}):new ScriptedBuyer({reckless:true}),actors=identities(),rows=[],robustnessRows=[],sellerBatches=[];
  const cases=catalog(count),jobs=cases.flatMap((testCase,i)=>['B0','B1','CM'].map((_,a)=>({testCase,arm:['B0','B1','CM'][(a+i)%3]})));let cursor=0;
  const worker=async()=>{while(cursor<jobs.length){const j=jobs[cursor++],row=await runCase({...j,actors,buyer});rows.push(row);await appendFile(path.join(out,'rows.jsonl'),JSON.stringify(row)+'\n');if(rows.length%10===0)console.log(JSON.stringify({stage:'EVALUATING',completed:rows.length,planned:jobs.length,apiCalls:buyer.calls??0}));}};
  await Promise.all(Array.from({length:concurrency},worker));
  if(live){
    for(let repeat=0;repeat<sellerRepeats;repeat++){
      for(const parallel of repeat%2?[true,false]:[false,true]){
        const batch=await sellerBatch(buyer,{parallel,runId:`sellers-${repeat}-${parallel?'parallel':'sequential'}`});sellerBatches.push(batch);
        if(batch.sellers.length){
          for(const arm of ['B0','B1','CM']){
            const row=await runCase({testCase:{id:batch.runId,family:'llm-sellers',variant:repeat},arm,actors,buyer,specs:batch.sellers});robustnessRows.push(row);await appendFile(path.join(out,'robustness.jsonl'),JSON.stringify(row)+'\n');
          }
        }
      }
    }
  }
  rows.sort((a,b)=>a.runId.localeCompare(b.runId));
  const sourceVerified=[];for(const [f,expected]of Object.entries(manifest.source))sourceVerified.push(sha(await readFile(path.join(root,f)))===expected);
  const report={version:1,id:manifest.id,kind:manifest.kind,completedAt:new Date().toISOString(),status:rows.length===count*3&&sourceVerified.every(Boolean)&&rows.every(r=>r.unauthorizedAuthorizations===0&&r.originalMandateHash===r.finalMandateHash)?'EVALUATION_COMPLETE':'INVARIANT_FAILURE',
    sourceSnapshotVerified:sourceVerified.every(Boolean),rows,byArm:Object.fromEntries(manifest.arms.map(arm=>[arm,summarize(rows.filter(r=>r.arm===arm))])),comparisons:[pairedArms(rows),pairedArms(rows,'CM','B1')],sellerBatches,robustnessRows,robustnessSummary:robustnessRows.length?summarize(robustnessRows):null,allInference:buyer.records,actualApiCalls:buyer.calls??0,actualTransactions:0};
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(path.join(out,'report.ko.md'),markdown(report));
  console.log(JSON.stringify({stage:'COMPLETE',id:report.id,status:report.status,rows:rows.length,actualApiCalls:report.actualApiCalls,report:path.join(out,'report.ko.md')}));
  if(report.status!=='EVALUATION_COMPLETE')process.exitCode=1;
}
