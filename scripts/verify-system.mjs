import {run} from 'node:test';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {checks,categories} from '../verification/catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const args=process.argv.slice(2),allowed=/^--(suite=(all|invariants|scenarios|redteam|operations|e2e|browser|personas|live)|seed=\d+|case=[A-Z0-9]+-\d{3}|help)$/;
if(args.some(a=>!allowed.test(a))){console.error('Unknown option. Use --help.');process.exit(2);}
if(args.includes('--help')){
  console.log('node scripts/verify-system.mjs [--suite=all|invariants|scenarios|redteam|operations|e2e|browser|personas|live] [--seed=20260928] [--case=INV-003]\nDefault: all local checks, no external requests. Live: explicit --suite=live, one real Kiln call. Reports: artifacts/verification/<run-id>/');process.exit(0);
}
const option=(key,fallback)=>args.find(a=>a.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const suite=option('suite','all'),caseId=option('case',null),seed=Number(option('seed','20260928'));
if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff){console.error('Seed must be a uint32.');process.exit(2);}
const selected=checks.filter(c=>(suite==='all'?c.category!=='live':c.category===suite)&&(!caseId||c.id===caseId));
if(!selected.length){console.error('No matching checks; LIVE-001 requires --suite=live.');process.exit(2);}
const startedAt=new Date().toISOString(),id=startedAt.replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const out=path.join(root,'artifacts','verification',id);await mkdir(out,{recursive:true});
process.env.CONTROL_VERIFY_DIR=out;process.env.CONTROL_VERIFY_SEED=String(seed);
// The default harness never receives the API key, even if its parent loaded .env.local.
if(suite!=='live')delete process.env.KILN_API_KEY;
const publicError=e=>{
  const message=String(e?.message??'TEST_FAILED')+(e?.cause?'\n'+String(e.cause.message??''): '');
  const secret=process.env.KILN_API_KEY;
  return (secret?message.split(secret).join('[REDACTED]'):message).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,1800);
};
async function fingerprint(){
  const files=[];
  async function walk(dir){for(const d of await readdir(path.join(root,dir),{withFileTypes:true})){const f=path.posix.join(dir,d.name);if(d.isDirectory())await walk(f);else if(/\.(mjs|sol|json|tsx?|css|html)$/.test(f))files.push(f);}}
  for(const dir of ['src','shared','contracts','verification','artifacts/contracts','web','tests'])await walk(dir);
  // Research modules may be developed in a separate task; core verification is standalone.
  try{await walk('learning');}catch(e){if(e.code!=='ENOENT')throw e;}
  files.push('package.json','pnpm-lock.yaml','scripts/verify-system.mjs','tsconfig.json','vite.config.ts');
  const hash=createHash('sha256');for(const f of files.sort()){hash.update(f+'\0');hash.update(await readFile(path.join(root,f)));}
  return {sha256:hash.digest('hex'),files};
}
const source=await fingerprint();let revision=null;
try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
console.log(`Verification ${id} | suite=${suite} | seed=${seed} | ${selected.length} checks`);
const outcomes=new Map(),baseline=[],infrastructure=[];
const files=[...new Set(selected.map(c=>path.join(root,'verification',`${c.category}.test.mjs`)))];
// Existing regression tests remain release gates, with their original names.
if(suite==='all'&&!caseId)for(const f of (await readdir('tests')).filter(f=>f.endsWith('.test.mjs')))files.push(path.join(root,'tests',f));
if(suite==='all'&&!caseId)for(const f of (await readdir('learning/tests').catch(()=>[])).filter(f=>f.endsWith('.test.mjs')))files.push(path.join(root,'learning/tests',f));
const stream=run({files,concurrency:1,timeout:180000,...(caseId?{testNamePatterns:[`\\[${caseId}\\]`]}:{})});
for await(const event of stream){
  if(!['test:pass','test:fail'].includes(event.type))continue;
  const d=event.data,id=checks.find(c=>d.name.startsWith(`[${c.id}]`))?.id;
  if(d.details?.type==='suite')continue;
  const row={name:d.name,status:d.skip||d.todo?'SKIPPED':event.type==='test:pass'?'PASS':'FAIL',durationMs:Math.round(d.details?.duration_ms??0),...(event.type==='test:fail'?{error:publicError(d.details?.error)}:{})};
  if(id){outcomes.set(id,row);console.log(`${row.status} ${id} (${row.durationMs}ms)${row.error?'\n'+row.error:''}`);}
  else if(d.name.endsWith('.mjs')){if(row.status==='FAIL')infrastructure.push(row);}
  else{baseline.push(row);if(row.status!=='PASS')console.log(`${row.status} regression: ${d.name}`);}
}
const rows=checks.map(c=>({...c,...(outcomes.get(c.id)??{status:selected.some(s=>s.id===c.id)?'MISSING':'NOT_RUN'}),reproduce:`node ${c.category==='live'?'--env-file-if-exists=.env.local ':''}scripts/verify-system.mjs --suite=${c.category} --case=${c.id} --seed=${seed}`}));
const active=rows.filter(c=>selected.some(s=>s.id===c.id)),bad=active.filter(r=>r.status!=='PASS');
const endingSource=await fingerprint(),sourceChanged=source.sha256!==endingSource.sha256;
const status=bad.length||infrastructure.length||baseline.some(r=>r.status!=='PASS')||sourceChanged?'FAIL':'PASS';
const artifacts=(await readdir(path.join(out,'evidence')).catch(()=>[])).map(name=>`evidence/${name}`);
const personaRuns=[];
for(const file of artifacts.filter(f=>/\/persona-\d{3}\.json$/.test(f)))personaRuns.push(JSON.parse(await readFile(path.join(out,file),'utf8')));
const personaObservations=personaRuns.flatMap(p=>p.observations.map(observation=>({caseId:p.id,...observation})));
const findings=bad.map(r=>({id:r.id,priority:r.priority,status:'OPEN',title:r.title,target:r.target,evidence:r.error??r.status,reproduce:r.reproduce,resolution:'Fix the target, replay this check, then run the complete local gate.'}));
for(const [index,r] of [...baseline.filter(r=>r.status!=='PASS'),...infrastructure].entries())findings.push({id:`RUNNER-${index+1}`,priority:'P1',status:'OPEN',title:r.name,evidence:r.error??r.status,reproduce:'node scripts/verify-system.mjs',resolution:'Inspect the regression or test-process failure, then rerun the full gate.'});
if(sourceChanged)findings.push({id:'SOURCE-CHANGED',priority:'P1',status:'OPEN',title:'Source changed during verification',evidence:'Start and completion source hashes differ.',reproduce:'node scripts/verify-system.mjs',resolution:'Finish source edits and rerun against a stable checkout.'});
const report={schemaVersion:1,id,status,startedAt,completedAt:new Date().toISOString(),suite,seed,node:process.version,platform:process.platform,revision,source,sourceChanged,
  evidenceLevel:suite==='live'?'LIVE_KILN_REAL_HTTP_LOCAL_EVM':'SYNTHETIC_MODEL_REAL_HTTP_LOCAL_EVM',
  counts:{selected:active.length,passed:active.filter(r=>r.status==='PASS').length,failed:bad.length,baseline:baseline.length,baselinePassed:baseline.filter(r=>r.status==='PASS').length},
  checks:rows,baseline,infrastructure,findings,artifacts,personaRuns,personaObservations,
  limitations:[outcomes.get('BROWSER-001')?.status==='PASS'?'Product browser flow passed with a synthetic model and the in-app devnet wallet; external wallet extensions are not verified.':'Product browser flow was not verified in this run.','Local EVM uses test assets; public testnet and production deployment are not verified.','Synthetic model usage is not real Kiln cost, NPU routing, or energy evidence.','An ephemeral chain is closed after the run; saved verification results are observations at execution time.','Production load, multi-process workers, chain reorganizations, and external monitoring remain separate gates.'],
};
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(out,'findings.json'),JSON.stringify(findings,null,2)+'\n');
const summary=`# Control Memory 검증 — ${status}\n\n실행: ${id}\n\n검증 ${report.counts.passed}/${active.length} 통과 · 기존 회귀 ${report.counts.baselinePassed}/${baseline.length} 통과 · seed ${seed}\n\n증거 수준: ${report.evidenceLevel}\n\n| ID | 검증 | 상태 | 수정 위치 |\n|---|---|---|---|\n${rows.map(r=>`| ${r.id} | ${r.title} | ${r.status} | ${r.target} |`).join('\n')}\n\n## 페르소나의 품질·마찰·증거 한계\n\n${personaObservations.map(o=>`- ${o.caseId} ${o.kind}: ${o.text}`).join('\n')||'이번 실행에 페르소나 관찰 없음.'}\n\n## 실패 재현\n\n${findings.map(f=>`- ${f.priority} ${f.id}: \`${f.reproduce}\``).join('\n')||'선택한 검사에서 실패 없음.'}\n\n## 미검증 범위\n\n${report.limitations.map(s=>'- '+s).join('\n')}\n`;
await writeFile(path.join(out,'report.md'),summary);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Control Memory 검증 ${status}</title>
<style>body{font:15px/1.65 system-ui,sans-serif;margin:0;background:#0c1421;color:#e6ecf5}main{max-width:1140px;margin:auto;padding:48px 24px}h1{font-size:32px;margin-bottom:8px}.muted{color:#a5b4c8}strong{color:${status==='PASS'?'#72dfb7':'#ff9b93'}}.cards{display:flex;gap:16px;margin:28px 0;flex-wrap:wrap}.card{background:#18263a;padding:20px 28px;border-radius:12px}.card b{font-size:28px;display:block}select{padding:10px;background:#18263a;color:white;border:1px solid #506278;border-radius:6px;margin:0 12px 20px 0}table{width:100%;border-collapse:collapse;background:#131f30}td,th{text-align:left;padding:14px;border-bottom:1px solid #304058;vertical-align:top}.PASS{color:#72dfb7}.FAIL,.MISSING{color:#ff9b93}.NOT_RUN,.SKIPPED{color:#d6b679}code{word-break:break-all;font-size:12px}details{margin-top:8px}a{color:#9bcaff}footer{margin-top:40px}.error{white-space:pre-wrap}</style>
<main><p class="muted">CONTROL MEMORY / VERIFICATION LAB</p><h1>시스템 검증 <strong>${status}</strong></h1><p class="muted">${escape(id)} · seed ${seed} · ${escape(report.evidenceLevel)}</p>
<div class="cards"><div class="card">선택 검증 통과<b>${report.counts.passed} / ${active.length}</b></div><div class="card">기존 회귀 통과<b>${report.counts.baselinePassed} / ${baseline.length}</b></div><div class="card">열린 문제<b>${findings.length}</b></div></div>
<p>실제 HTTP·서명·SQLite·로컬 EVM을 검증합니다. 기본 실행의 모델 응답은 합성 데이터입니다. 이 결과는 운영 배포 승인이나 공개 테스트넷 증거가 아닙니다.</p>
${personaRuns.length?`<section><h2>기획 기반 페르소나 관찰</h2><p>PASS는 정의한 판정 검사의 통과입니다. 품질 저하나 통제 마찰이 없다는 뜻이 아닙니다. 합성 행동으로 실제 정책·서명·로컬 EVM 경로를 시험했으며, 실제 고객 연구나 Kiln 공격 성공률은 측정하지 않았습니다.</p><table><thead><tr><th>역할과 목표</th><th>관측</th></tr></thead><tbody>${personaRuns.map(p=>`<tr><td>${p.id} · ${escape(p.roles.join(' / '))}<br>${escape(p.goal)}</td><td>${p.steps.length}개 관측 · ${p.status}<br><a href="evidence/persona-${p.id.slice(4)}.json">행동·금액·호출·견적·증빙 원본</a></td></tr>`).join('')}</tbody></table><div class="card"><b>별도로 남은 품질·마찰·증거 한계</b><ul>${personaObservations.map(o=>`<li>${o.caseId} · ${escape(o.kind)} ${o.arm?'('+o.arm+')':''}<br>${escape(o.text)}${o.utilityDegraded?`<br>24 → 28 TC · 120 → 100 credits · 환불 72 → 24시간`:''}</li>`).join('')}</ul></div></section>`:''}
<label>검증 축 <select id="category"><option value="">전체</option>${Object.entries(categories).map(([v,s])=>`<option value="${v}">${s}</option>`).join('')}</select></label><label>결과 <select id="status"><option value="">전체</option>${['PASS','FAIL','MISSING','NOT_RUN','SKIPPED'].map(s=>`<option>${s}</option>`).join('')}</select></label>
<table><thead><tr><th>ID / 우선순위</th><th>검증 및 재현</th><th>결과</th></tr></thead><tbody>${rows.map(r=>`<tr data-category="${r.category}" data-status="${r.status}"><td>${r.id}<br><small>${r.priority} · ${categories[r.category]}</small></td><td>${escape(r.title)}<details><summary>재현 명령·수정 위치</summary><code>${escape(r.reproduce)}</code><p>${escape(r.target)}</p>${r.error?`<p class="error">${escape(r.error)}</p>`:''}</details></td><td class="${r.status}">${r.status}<br><small>${r.durationMs??'—'} ms</small></td></tr>`).join('')}</tbody></table>
${infrastructure.length||sourceChanged?`<p class="FAIL">검증 기반 오류: ${escape(JSON.stringify({infrastructure,sourceChanged}))}</p>`:''}
<footer><h2>실행 증거</h2><ul><li><a href="report.json">JSON 전체 결과</a> · <a href="findings.json">열린 문제</a> · <a href="report.md">Markdown 보고서</a></li>${artifacts.map(a=>`<li><a href="${a}">${escape(a)}</a></li>`).join('')}</ul><h2>남은 검증 범위</h2><ul>${report.limitations.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><p class="muted">소스 SHA-256: ${source.sha256}</p></footer></main>
<script>const category=document.querySelector('#category'),status=document.querySelector('#status');function filter(){for(const row of document.querySelectorAll('tr[data-category]'))row.hidden=(category.value&&row.dataset.category!==category.value)||(status.value&&row.dataset.status!==status.value)}category.onchange=filter;status.onchange=filter;</script></html>`;
await writeFile(path.join(out,'report.html'),html);
await writeFile(path.join(root,'artifacts/verification/latest.json'),JSON.stringify({id,status,report:`${id}/report.json`,html:`${id}/report.html`,suite,seed},null,2)+'\n');
console.log(`${status}: checks ${report.counts.passed}/${active.length}; regressions ${report.counts.baselinePassed}/${baseline.length}\n${path.join(out,'report.html')}`);
process.exitCode=status==='PASS'?0:1;
