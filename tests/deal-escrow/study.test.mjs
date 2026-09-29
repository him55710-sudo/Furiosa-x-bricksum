import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {mountStudy} from '../../src/deal-escrow/study.mjs';

test('study binds the displayed source and questionnaire, rejects stale forms and isolates versions and QA counts',async()=>{
 const base=path.resolve(os.tmpdir()),directory=mkdtempSync(path.join(base,'ade-study-test-')),showcase=path.join(directory,'showcase.json');
 const record={steps:[{kind:'task',evidence:{document:{year:2025,page:15,url:'https://example.test/current.pdf',row_label:'Facilities',currency:'KRW',unit:'billion'}}},{kind:'delivery',rows:[{quarter:'2025-Q1',capex:100}]}]};
 writeFileSync(showcase,JSON.stringify(record));const app=express();app.use(express.json());mountStudy(app,directory,{showcase});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 const get=async()=>await(await fetch(origin+'/api/study')).json(),post=body=>fetch(origin+'/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const initial=await get();assert.equal(initial.document.page,15);assert.match(initial.questions.at(-1).label,/15쪽/);assert.equal(initial.counts.self_reported_humans,0);
  // This is an isolated synthetic test fixture, never a real study response.
  const response={study_id:initial.study_id,participant_id:'fixture-only',participant_kind:'human',newcomer:true,practitioner:false,consent:true,answers:Object.fromEntries(initial.questions.map(q=>[q.id,'Synthetic fixture in a disposable test directory.']))};
  assert.equal((await post(response)).status,200);assert.equal((await post({...response,participant_kind:'automated_qa'})).status,200);assert.equal((await post(response)).status,200);
  const counts=(await get()).counts;assert.equal(counts.self_reported_humans,1);assert.equal(counts.automated_qa,1);
  record.steps[0].evidence.document.page=20;writeFileSync(showcase,JSON.stringify(record));const current=await get();assert.notEqual(current.study_id,initial.study_id);assert.equal(current.counts.self_reported_humans,0);assert.equal(current.historical_response_count,3);assert.match(current.questions.at(-1).label,/20쪽/);
  const stale=await post(response);assert.equal(stale.status,409);assert.equal((await stale.json()).error,'STUDY_VERSION_CHANGED');
  const rows=readFileSync(path.join(directory,'human-study/responses.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows.length,3);assert.equal(rows[0].source_document.page,15);assert.equal(rows[0].showcase_sha256,initial.showcase_sha256);assert.match(rows[0].questions.at(-1).label,/15쪽/);
  assert.equal((await post({...response,study_id:current.study_id})).status,200);const repeated=(await get()).counts;assert.equal(repeated.self_reported_humans,1);assert.equal(repeated.newcomers,0,'A participant who saw an earlier version is not a new first-time viewer');
 }finally{await new Promise(r=>server.close(r));assert.equal(path.dirname(path.resolve(directory)),base);assert(path.basename(directory).startsWith('ade-study-test-'));rmSync(directory,{recursive:true,force:true});}
});
