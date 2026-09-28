import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {request} from 'node:http';
import {createStudySession,captureStudyBuild} from '../../src/deal-escrow/study-session.mjs';

const replay=()=>({run:'source-run',recovery:{run:'recovery-run',receipt:{deal:{deal_id:'recovery-deal'},state:'REFUNDED'}},receipts:[{deal:{deal_id:'source-deal'},state:'SETTLED'}],efficiency:{generated_at:new Date().toISOString(),flows:[]}});
const files=()=>new Map([['/index.html',Buffer.from('<main>fixed demo</main>')],['/assets/app.js',Buffer.from('console.log("fixed")')]]);
async function setup(){
  const directory=mkdtempSync(path.join(tmpdir(),'ade-study-')),evidence=replay(),build=files();
  const session=createStudySession({replay:evidence,files:build,directory}),server=session.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,context=await(await fetch(origin+'/api/study')).json();
  const body={submission_id:'qa-response-1',evidence_version:context.evidence_version,participant_id:'QA1',participant_kind:'automated_qa',newcomer:true,practitioner:false,consent:true,viewed:true,answers:Object.fromEntries(context.questions.map(q=>[q.id,'Automated test answer; not a human response.']))};
  return {directory,evidence,build,session,origin,context,body,post:(b=body,headers={})=>fetch(origin+'/api/study',{method:'POST',headers:{'Content-Type':'application/json','X-ADE-Token':context.token,Origin:origin,...headers},body:JSON.stringify(b)}),close:()=>new Promise(resolve=>server.close(resolve))};
}
test('study freezes rendered bytes and evidence and binds their version to the saved response',async()=>{
  const s=await setup();try{
    s.evidence.run='changed';s.build.set('/index.html',Buffer.from('changed'));
    assert.match(await(await fetch(s.origin+'/')).text(),/fixed demo/);
    assert.equal((await(await fetch(s.origin+'/api/replay')).json()).run,'source-run');
    const result=await s.post();assert.equal(result.status,200);assert.equal((await result.json()).human_validation_complete,false);
    const stored=JSON.parse(readFileSync(path.join(s.directory,'responses.jsonl'),'utf8'));
    assert.equal(stored.evidence_descriptor.source_run,'source-run');assert.equal(stored.evidence_version,s.context.evidence_version);assert.equal(stored.evidence_descriptor.ui_manifest.length,2);
    const snapshot=JSON.parse(readFileSync(path.join(s.directory,'sessions',s.context.evidence_version+'.json'),'utf8'));assert.equal(snapshot.replay.run,'source-run');assert.equal(Buffer.from(snapshot.assets.find(f=>f.name==='/index.html').base64,'base64').toString(),'<main>fixed demo</main>');
    const receipt=await fetch(s.origin+'/api/audit/recovery-deal');assert.equal((await receipt.json()).state,'REFUNDED');assert.match(receipt.headers.get('content-disposition'),/attachment/);
    const blocked=await fetch(s.origin+'/api/deals/source-deal/fund',{method:'POST',headers:{'X-ADE-Token':s.context.token,Origin:s.origin}});assert.equal(blocked.status,404);
  }finally{await s.close();}
});
test('study retries save once and reject conflicting reuse, stale evidence, missing consent and invalid answers',async()=>{
  const s=await setup();try{
    assert.equal((await s.post({...s.body,evidence_version:'old'})).status,409);
    assert.equal((await s.post({...s.body,consent:false})).status,400);
    assert.equal((await s.post({...s.body,viewed:false})).status,400);
    assert.equal((await s.post({...s.body,answers:{...s.body.answers,user_and_problem:'  '}})).status,400);
    assert.equal((await s.post({...s.body,answers:{...s.body.answers,unknown:'field'}})).status,400);
    assert.equal((await s.post({...s.body,answers:{...s.body.answers,user_and_problem:'x'.repeat(4001)}})).status,400);
    assert.equal((await s.post()).status,200);assert.equal((await(await s.post()).json()).duplicate,true);
    assert.equal((await s.post({...s.body,participant_id:'different'})).status,409);
    assert.equal(readFileSync(path.join(s.directory,'responses.jsonl'),'utf8').trim().split('\n').length,1);
  }finally{await s.close();}
});
test('study requires a local same-origin session and excludes automated QA from human counts',async()=>{
  const s=await setup();try{
    assert.equal((await s.post(s.body,{'X-ADE-Token':'wrong'})).status,403);
    assert.equal((await s.post(s.body,{Origin:'https://external.example'})).status,403);
    const denied=await new Promise((resolve,reject)=>{const req=request(s.origin+'/api/study',{headers:{Host:'external.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});assert.equal(denied,403);
    assert.equal((await s.post()).status,200);
    assert.deepEqual(s.session.counts(),{self_reported_humans:0,automated_qa:1,reviewed_humans:0});
    assert.equal((await s.post({...s.body,submission_id:'human1',participant_kind:'human',participant_id:'P1'})).status,200);
    assert.equal((await s.post({...s.body,submission_id:'human2',participant_kind:'human',participant_id:'P1'})).status,200);
    assert.deepEqual(s.session.counts(),{self_reported_humans:1,automated_qa:1,reviewed_humans:0});
    const counts=await(await fetch(s.origin+'/api/study')).json();assert.equal(counts.human_validation_complete,false);assert.equal(counts.answers,undefined);
  }finally{await s.close();}
});
test('study version survives a restart but changes when evidence or rendered build change',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'ade-study-version-')),one=replay(),two=replay();two.efficiency.generated_at='later';
  const a=createStudySession({replay:one,files:files(),directory}),b=createStudySession({replay:two,files:files(),directory});assert.equal(a.version,b.version);
  two.receipts[0].state='REFUNDED';assert.notEqual(a.version,createStudySession({replay:two,files:files(),directory}).version);
  const changed=files();changed.set('/assets/app.js',Buffer.from('changed'));assert.notEqual(a.version,createStudySession({replay:one,files:changed,directory}).version);
  const buildDirectory=mkdtempSync(path.join(tmpdir(),'ade-study-build-'));writeFileSync(path.join(buildDirectory,'index.html'),'<main>capture</main>');const captured=captureStudyBuild(buildDirectory);writeFileSync(path.join(buildDirectory,'index.html'),'different');assert.equal(captured.get('/index.html').toString(),'<main>capture</main>');
  writeFileSync(path.join(directory,'sessions',a.version+'.json'),'corrupt');assert.throws(()=>createStudySession({replay:one,files:files(),directory}),/STUDY_SNAPSHOT_MISMATCH/);
});
