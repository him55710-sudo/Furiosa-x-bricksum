import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ResearchModel} from '../src/purchase-model.mjs';
import {RESOURCE,hash} from '../shared/purchase.mjs';
const files=['tests/fixtures/purchase-research-eval.json','scripts/evaluate-purchase-model.mjs','src/purchase-model.mjs'];
const sources=Object.fromEntries(await Promise.all(files.map(async f=>[f,await readFile(f,'utf8')])));
const cases=JSON.parse(sources[files[0]]),output='artifacts/purchase/evaluation/'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir(output,{recursive:true});
const report={schemaVersion:1,startedAt:new Date().toISOString(),sourceHash:hash(sources),sources,kind:'SYNTHETIC_REAL_KILN_EVALUATION',baseline:'Case-provided query keywords; retrieval needed when any keyword is missing from preview; answer selects paragraph with most keyword hits (first on ties). No payment or recovery baseline is claimed.',rows:[]};
const model=new ResearchModel();
for(const c of cases){
  const row={id:c.id,flow:c.flow,case:c,usage:[],answerSemanticGrade:'NOT_AUTOMATICALLY_GRADED'};
  const input=c.flow==='need-assessment'?{question:c.question,preview:c.preview,resource:RESOURCE}:{question:c.question,document:{resource:RESOURCE,paragraphs:c.paragraphs}};
  row.keywordBaseline=c.flow==='need-assessment'?c.keywords.some(k=>!c.preview.includes(k)):[...c.paragraphs].sort((a,b)=>c.keywords.filter(k=>b.text.includes(k)).length-c.keywords.filter(k=>a.text.includes(k)).length)[0].id;
  row.baselinePass=row.keywordBaseline===(c.expected??c.expectedParagraph);
  try{row.result=await model.invoke(c.flow,input,r=>row.usage.push(r));row.modelPass=c.flow==='need-assessment'?row.result.needs_retrieval===c.expected:row.result.citations.some(x=>x.paragraph_id===c.expectedParagraph)&&!row.result.citations.some(x=>(c.forbiddenParagraphs??[]).includes(x.paragraph_id));}catch(e){row.modelPass=false;row.error=e.message;}
  report.rows.push(row);await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(c.id+': '+(row.modelPass?'PASS':'FAIL'));
}
report.finishedAt=new Date().toISOString();
report.summary=Object.fromEntries(['need-assessment','evidence-answer'].map(flow=>{const rows=report.rows.filter(r=>r.flow===flow);return [flow,{cases:rows.length,modelPass:rows.filter(r=>r.modelPass).length,keywordPass:rows.filter(r=>r.baselinePass).length,inputTokens:rows.flatMap(r=>r.usage).reduce((a,u)=>a+(u.promptTokens??0),0),outputTokens:rows.flatMap(r=>r.usage).reduce((a,u)=>a+(u.completionTokens??0),0)}];}));
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,summary:report.summary},null,2));
