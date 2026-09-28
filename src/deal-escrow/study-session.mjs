import express from 'express';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,readdirSync,existsSync,mkdirSync,appendFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {studyQuestions} from './study.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');

// Keep the rendered build and evidence fixed for a whole session. Rebuilding files
// cannot silently make a participant's answer refer to a different demo.
export function captureStudyBuild(directory){
  const files=new Map();
  function walk(relative=''){
    for(const entry of readdirSync(path.join(directory,relative),{withFileTypes:true})){
      const name=path.posix.join(relative,entry.name);
      if(entry.isDirectory())walk(name);
      else if(entry.isFile())files.set('/'+name,readFileSync(path.join(directory,name)));
    }
  }
  walk();if(!files.has('/index.html'))throw new Error('STUDY_BUILD_MISSING');return files;
}
export function createStudySession({replay,files,directory}){
  const evidence=structuredClone(replay),assets=new Map([...files].map(([name,bytes])=>[name,Buffer.from(bytes)]));
  if(evidence.efficiency)delete evidence.efficiency.generated_at;
  const questions=structuredClone(studyQuestions),manifest=[...assets].map(([name,bytes])=>({name,sha256:digest(bytes)})).sort((a,b)=>a.name.localeCompare(b.name));
  const descriptor={schema_version:1,source_run:evidence.run,recovery_run:evidence.recovery?.run??null,evidence_sha256:digest(canonical(evidence)),ui_manifest:manifest,questions};
  const version=digest(canonical(descriptor)),token=randomBytes(32).toString('hex'),file=path.join(directory,'responses.jsonl');
  const snapshotDirectory=path.join(directory,'sessions'),snapshotFile=path.join(snapshotDirectory,version+'.json');
  const snapshot=canonical({descriptor,replay:evidence,assets:[...assets].map(([name,bytes])=>({name,base64:bytes.toString('base64')}))});
  mkdirSync(snapshotDirectory,{recursive:true});
  if(existsSync(snapshotFile)){if(readFileSync(snapshotFile,'utf8')!==snapshot)throw new Error('STUDY_SNAPSHOT_MISMATCH');}
  else{const temporary=snapshotFile+'.tmp-'+randomBytes(8).toString('hex');writeFileSync(temporary,snapshot,{flag:'wx',mode:0o600});renameSync(temporary,snapshotFile);}
  const read=()=>existsSync(file)?readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
  const counts=()=>{
    const latest=new Map(read().filter(r=>r.evidence_version===version).map(r=>[r.participant_kind+':'+r.participant_id,r]));
    const rows=[...latest.values()];return {self_reported_humans:rows.filter(r=>r.participant_kind==='human').length,automated_qa:rows.filter(r=>r.participant_kind==='automated_qa').length,reviewed_humans:0};
  };
  const context={evidence_version:version,source_run:descriptor.source_run,recovery_run:descriptor.recovery_run,questions,source_url:'https://www.lgensol.com/upload/file/irEvent/25_4Q_LGES_business_performance_F_EN.pdf#page=16'};
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    if(!['127.0.0.1','localhost'].includes(req.hostname))return res.status(403).json({error:'LOCAL_ONLY'});
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    if(!['GET','HEAD'].includes(req.method)&&(req.headers['x-ade-token']!==token||req.headers.origin!==`http://${req.headers.host}`))return res.status(403).json({error:'LOCAL_SESSION_REQUIRED'});
    next();
  });
  app.use(express.json({limit:'128kb'}));
  app.get('/api/study',(_req,res)=>res.json({...context,token,counts:counts(),human_validation_complete:false}));
  app.get('/api/replay',(_req,res)=>res.json(evidence));
  app.get('/api/audit/:id',(req,res)=>{
    const receipt=[...(evidence.receipts??[]),...(evidence.recovery?[evidence.recovery.receipt]:[])].find(r=>r.deal.deal_id===req.params.id);
    return receipt?res.attachment(`deal-${receipt.deal.deal_id}.json`).json(receipt):res.sendStatus(404);
  });
  app.post('/api/study',(req,res)=>{
    const b=req.body;
    if(!exact(b,['submission_id','evidence_version','participant_id','participant_kind','newcomer','practitioner','consent','viewed','answers'])||!validId(b.submission_id)||!validId(b.participant_id)||!['human','automated_qa'].includes(b.participant_kind)||typeof b.newcomer!=='boolean'||typeof b.practitioner!=='boolean'||b.consent!==true||b.viewed!==true||!exact(b.answers,questions.map(q=>q.id))||Object.values(b.answers).some(v=>typeof v!=='string'||!v.trim()||v.length>4000))return res.status(400).json({error:'INVALID_STUDY_RESPONSE'});
    if(b.evidence_version!==version)return res.status(409).json({error:'STUDY_VERSION_CHANGED'});
    const contentHash=digest(canonical(b)),prior=read().find(r=>r.submission_id===b.submission_id);
    if(prior)return prior.content_sha256===contentHash?res.json({saved:true,duplicate:true,response_id:prior.submission_id,evidence_version:version,counts:counts(),human_validation_complete:false}):res.status(409).json({error:'SUBMISSION_ID_REUSED'});
    const record={...b,answers:Object.fromEntries(Object.entries(b.answers).map(([k,v])=>[k,v.trim()])),content_sha256:contentHash,received_at:new Date().toISOString(),evidence_descriptor:descriptor,provenance:b.participant_kind==='human'?'Participant self-report; identity and understanding require separate human review':'Automated QA; excluded from human validation'};
    mkdirSync(directory,{recursive:true});appendFileSync(file,JSON.stringify(record)+'\n',{mode:0o600});
    res.json({saved:true,duplicate:false,response_id:record.submission_id,evidence_version:version,counts:counts(),human_validation_complete:false});
  });
  app.use('/api',(_req,res)=>res.sendStatus(404));
  app.use((req,res)=>{
    if(!['GET','HEAD'].includes(req.method))return res.sendStatus(405);
    if(req.path==='/'&&!Object.hasOwn(req.query,'study')&&!Object.hasOwn(req.query,'replay'))return res.redirect('/?study=1');
    const name=req.path==='/'?'/index.html':req.path,bytes=assets.get(name);
    if(!bytes)return res.sendStatus(404);res.type(path.extname(name)).send(bytes);
  });
  app.use((err,_req,res,_next)=>res.status(err.type==='entity.too.large'?413:400).json({error:err.type==='entity.too.large'?'RESPONSE_TOO_LARGE':'STUDY_REQUEST_FAILED'}));
  return {app,context,version,counts};
}
