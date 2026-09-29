import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {verificationSource} from '../src/deal-escrow/verification-source.mjs';

const origin=process.env.ADE_ORIGIN??'http://127.0.0.1:3412',out='artifacts/deal-escrow/research',source=verificationSource();
const get=async path=>{const r=await fetch(origin+path);assert(r.ok,path);return r.json();};
const [state,study,showcase,research]=await Promise.all(['/api/state','/api/study','/api/showcase','/api/research?document_id=lges-2026q2-pdf'].map(get));
const request=research.requests[0],deal=state.deals.find(d=>d.deal.deal_id===request.deal_id);
assert.equal(deal.state,'SETTLED');assert.equal(request.decision.tool,'review_offers');assert.equal(request.decision.selection_source,'deterministic_ranking_after_ai_review');assert.equal(deal.details.extracted_delivery.model_calls,0);
const dataset=await get('/api/deals/'+deal.deal.deal_id+'/dataset');assert.deepEqual(dataset.map(r=>r.capex),[3014,2717,2171,2515]);
assert.equal((await get('/api/audit/'+deal.deal.deal_id+'/verify')).verdict,'VALID');
assert.equal((await fetch(origin+'/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
const qa={study_id:study.study_id,participant_id:'automated-browser-qa',participant_kind:'automated_qa',newcomer:false,practitioner:false,consent:true,answers:Object.fromEntries(study.questions.map(q=>[q.id,'Automated transport verification; not a human response.']))};
const saved=await fetch(origin+'/api/study',{method:'POST',headers:{'Content-Type':'application/json','X-ADE-Token':state.token,Origin:origin},body:JSON.stringify(qa)});assert(saved.ok);assert.equal((await get('/api/study')).counts.self_reported_humans,study.counts.self_reported_humans);
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));mkdirSync(out,{recursive:true});
try{
 await page.goto(origin);await page.getByRole('heading',{name:'Buy research you can check.',exact:true}).waitFor();await page.getByRole('cell',{name:'2025-Q4',exact:true}).waitFor();
 await page.screenshot({path:out+'/current-delivery.png',fullPage:true});checks.push('Current real-model purchase, dataset export and independent receipt verification');
 await page.getByRole('button',{name:'Inspect Deal',exact:true}).click();await page.getByText('LG Energy Solution · 2025 quarterly facility investment',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Submit .* delivery/}).count(),0);checks.push('Research Deal detail does not offer a synthetic-delivery action');
 for(let i=0;i<showcase.steps.length;i++){await page.goto(origin+'/?replay=1&step='+i);await page.getByRole('heading',{name:showcase.steps[i].title,exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(i===2)await page.screenshot({path:out+'/showcase-dataset.png',fullPage:true});}
 checks.push('Every recorded scene renders without horizontal overflow at 1440px');
 await page.goto(origin+'/?study=1');await page.getByRole('heading',{name:'데모가 전달하는 내용을 확인합니다.',exact:true}).waitFor();assert.equal(await page.locator('textarea').count(),7);assert.equal(await page.getByRole('link',{name:`원문 보고서 ${study.document.page}쪽`,exact:true}).getAttribute('href'),study.document.url+'#page='+study.document.page);checks.push('Source-bound study questions, exact document link and version-bound automated-QA submission; human counts unchanged');
 assert.deepEqual(errors,[]);assert.deepEqual(verificationSource(),source);
 const report={status:'PASS',created_at:new Date().toISOString(),source,runtime_source:state.runtime_source,deal_id:deal.deal.deal_id,checks,browser_errors:errors,human_counts:(await get('/api/study')).counts,new_model_calls:0};writeFileSync(out+'/browser-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
