import express from 'express';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getAddress,verifyMessage} from 'ethers';
import {verifyBundle} from './verifier.mjs';
import {SCENARIOS} from './fixtures.mjs';
import {readBenchmark} from './benchmark.mjs';
import {MODEL,MANDATE_TYPES,REVOKE_TYPES,sameAddress,nowSeconds} from '../shared/schema.mjs';

// Production and verification use the same HTTP handlers. Dependencies are supplied
// by the bootstrap; no request parameter can enable a mock or bypass policy.
export function createApp({chain,store,engine,port=3400}) {
const app=express(),origin=`http://127.0.0.1:${port}`;
app.disable('x-powered-by');
app.use((req,res,next)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return res.status(403).json({error:'HOST_NOT_ALLOWED'});
  if(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin))return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'});
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});next();
});
app.use(express.json({limit:'3mb'}));
const challenges=new Map(),auth=new Map();
app.get('/api/health',async(req,res)=>{
  try{store.db.prepare('SELECT 1').get();await chain.provider.getBlockNumber();res.json({status:'READY',mode:'LOCAL_DEVNET_TEST_ASSETS',pending:store.all('run').filter(r=>['SUBMISSION_STARTED','UNKNOWN'].includes(r.status)).length});}
  catch{res.status(503).json({status:'NOT_READY',reason:'DEPENDENCY_UNAVAILABLE'});}
});
app.get('/api/config',(req,res)=>res.json({model:MODEL,kilnConfigured:!!process.env.KILN_API_KEY,domain:chain.domain,mandateTypes:MANDATE_TYPES,merchants:chain.deployment.merchantRegistry.filter(m=>m.id!=='outsider'),scenarios:SCENARIOS,chain:chain.deployment,mode:'LOCAL_DEVNET_TEST_ASSETS',revokeTypes:REVOKE_TYPES}));
app.post('/api/auth/challenge',(req,res)=>{
  const address=getAddress(req.body.address),nonce=randomBytes(24).toString('hex');
  const message=`Control Memory local devnet login\nOrigin: ${origin}\nAddress: ${address}\nNonce: ${nonce}`;
  challenges.set(nonce,{address,message,expires:Date.now()+120000});res.json({nonce,message});
});
app.post('/api/auth/login',(req,res)=>{
  const c=challenges.get(req.body.nonce);challenges.delete(req.body.nonce);
  if(!c||c.expires<Date.now()||!sameAddress(verifyMessage(c.message,req.body.signature),c.address))return res.status(401).json({error:'LOGIN_SIGNATURE'});
  const token=randomBytes(32).toString('hex');auth.set(token,{address:c.address,expires:Date.now()+12*3600*1000});
  res.cookie('cm_auth',token,{httpOnly:true,sameSite:'strict',path:'/',maxAge:12*3600*1000});res.json({address:c.address});
});
app.post('/api/verify',async(req,res)=>res.json(await verifyBundle(req.body,{provider:chain.provider,deployment:chain.deployment,abi:chain.artifacts.vault.abi})));
app.get('/api/chain/transaction/:hash',async(req,res)=>{
  if(!/^0x[a-f0-9]{64}$/i.test(req.params.hash))return res.status(400).json({error:'INVALID_TX_HASH'});
  const receipt=await chain.provider.getTransactionReceipt(req.params.hash);if(!receipt)return res.status(404).json({error:'RECEIPT_NOT_FOUND'});
  res.json({network:'local EVM devnet',chainId:31337,hash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:receipt.status,gasUsed:receipt.gasUsed.toString(),to:receipt.to});
});
app.use('/api',(req,res,next)=>{
  const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('cm_auth='))?.slice(8);const user=auth.get(cookie);
  if(!user||user.expires<Date.now())return res.status(401).json({error:'LOGIN_REQUIRED'});req.owner=user.address;next();
});
const owned=(req,id)=>{const s=engine.session(id);if(!sameAddress(s.mandate.owner,req.owner))throw new Error('FORBIDDEN');return s;};
app.get('/api/dashboard',(req,res)=>{
  const sessions=store.all('session').filter(s=>sameAddress(s.mandate.owner,req.owner));const ids=new Set(sessions.map(s=>s.id));
  res.json({owner:req.owner,sessions,runs:store.all('run').filter(r=>ids.has(r.sessionId)).map(r=>engine.publicRun(r)).reverse(),controls:store.all('control').filter(c=>sameAddress(c.owner,req.owner)),now:nowSeconds()});
});
app.post('/api/mandates/draft',async(req,res)=>res.json(await engine.draft(req.owner,req.body)));
app.post('/api/mandates/:id/approve',async(req,res)=>{owned(req,req.params.id);res.json(await engine.approve(req.params.id,req.body.signature));});
app.post('/api/sessions/:id/run',(req,res)=>{owned(req,req.params.id);res.status(202).json(engine.enqueue(req.params.id,{scenarioId:req.body.scenarioId,requestId:req.body.requestId}));});
app.post('/api/sessions/:id/stop',async(req,res)=>{owned(req,req.params.id);res.json(await engine.stop(req.params.id,req.body.signature));});
app.get('/api/sessions/:id/events',(req,res)=>{owned(req,req.params.id);res.json(store.events(req.params.id));});
app.get('/api/runs/:id/evidence',(req,res)=>{const run=store.get('run',req.params.id);if(!run)return res.status(404).json({error:'RUN_NOT_FOUND'});owned(req,run.sessionId);res.setHeader('Content-Disposition',`attachment; filename="control-memory-${run.id.slice(2,10)}.json"`);res.json(engine.bundle(run.id));});
app.get('/api/benchmark',async(req,res)=>{try{res.json(await readBenchmark());}catch(error){res.json({status:error.code==='ENOENT'?'NOT_RUN':'EVIDENCE_UNAVAILABLE',rows:[]});}});
app.use(express.static('dist',{index:'index.html'}));
app.get('/{*path}',(req,res)=>res.sendFile('index.html',{root:'dist'}));
app.use((err,req,res,next)=>{const code=/^[A-Z][A-Z0-9_]{1,80}$/.test(err?.message??'')?err.message:'REQUEST_FAILED';res.status(code==='FORBIDDEN'?403:400).json({error:code});});
return app;
}
