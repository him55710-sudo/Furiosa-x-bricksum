import express from 'express';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {JsonRpcProvider} from 'ethers';
import {runProcurement} from './procurement/run.mjs';
import {verifyProcurement} from './procurement/verify.mjs';
import {ensure,exact,integer} from './procurement/protocol.mjs';

const app=express(),port=Number(process.env.DEALTRACE_PROCUREMENT_PORT??3421),token=randomBytes(32).toString('hex');let current=null,job=null,stop=false,verifying=false;
const root='artifacts/dealtrace/procurement/runs';
const load=run=>{ensure(/^[a-f0-9-]{36}$/.test(run),'RUN_ID');return JSON.parse(readFileSync(`${root}/${run}/report.json`,'utf8'));};
const latest=()=>existsSync('artifacts/dealtrace/procurement/latest.json')?load(JSON.parse(readFileSync('artifacts/dealtrace/procurement/latest.json','utf8')).run):null;
app.disable('x-powered-by');app.use((req,res,next)=>{if(!['127.0.0.1','localhost'].includes(req.hostname))return res.sendStatus(403);res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'");res.setHeader('X-Content-Type-Options','nosniff');next();});app.use(express.json({limit:'12kb'}));
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='GET'&&(req.headers.origin!==`http://${req.headers.host}`||req.headers['x-dealtrace-token']!==token))return res.status(403).json({error:'LOCAL_APPROVAL_SESSION_REQUIRED'});next();});
app.get('/api/state',(_req,res)=>res.json({token,report:current??latest(),job,live_available:!!(process.env.KILN_API_KEY&&process.env.KILN_MODEL)}));
app.get('/api/history',(_req,res)=>res.json({runs:existsSync(root)?readdirSync(root).filter(id=>/^[a-f0-9-]{36}$/.test(id)).flatMap(id=>{try{const r=load(id);return [{run:id,status:r.status,mode:r.mode,billing:r.billing,started_at:r.started_at}];}catch{return [];}}).sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))).slice(0,40):[]}));
app.post('/api/select',(req,res)=>{exact(req.body,['run']);ensure(!job?.running,'RUN_IN_PROGRESS');current=load(req.body.run);res.json({selected:true});});
app.post('/api/run',(req,res)=>{
 exact(req.body,['live','metered','publicNetwork','approved','budget']);ensure(req.body.approved===true,'HUMAN_APPROVAL_REQUIRED');ensure(['live','metered','publicNetwork'].every(k=>typeof req.body[k]==='boolean'),'INVALID_MODE');integer(req.body.budget,100,100000);ensure(!job?.running,'RUN_ALREADY_ACTIVE');ensure(!req.body.live||!!process.env.KILN_API_KEY,'KILN_NOT_CONFIGURED');
 stop=false;job={running:true};current=null;runProcurement({...req.body,onProgress:r=>{current=r;job.run=r.run;},cancelled:()=>stop}).then(r=>{current=r;}).catch(e=>{job.error=e.message;}).finally(()=>{job.running=false;});res.status(202).json({started:true});
});
app.post('/api/stop',(req,res)=>{exact(req.body,[]);ensure(job?.running,'NO_ACTIVE_RUN');stop=true;res.json({stop_requested:true,note:'Stops new commitments. Already funded work retains its signed terms; expiry refunds remain available.'});});
app.get('/api/export',(_req,res)=>{const r=current??latest();ensure(r,'NO_REPORT');res.setHeader('Content-Disposition','attachment; filename="dealtrace-procurement-receipt.json"');res.json(r);});
app.post('/api/verify',async(req,res,next)=>{let provider;try{exact(req.body,['tamper']);ensure(typeof req.body.tamper==='boolean'&&!verifying,'VERIFY_REQUEST');verifying=true;const r=structuredClone(current??latest());ensure(r?.plan,'NO_COMMITTED_REPORT');const pin=r.network.metered?`artifacts/dealtrace/procurement/trusted/${r.run}.json`:'artifacts/dealtrace/vault/trusted-deployment.json';ensure(existsSync(pin)||r.network.chainId===31339,'TRUSTED_PIN_REQUIRED');const trusted=existsSync(pin)?{...JSON.parse(readFileSync(pin,'utf8')),metered:r.network.metered}:r.network;if(req.body.tamper)r.plan.packet.terms.price_minor+=500;if(r.network.chainId===11155111)provider=new JsonRpcProvider(process.env.ADE_AUDIT_RPC??'https://sepolia.gateway.tenderly.co',undefined,{cacheTimeout:-1});res.json(await verifyProcurement(r,{provider,trusted}));}catch(e){next(e);}finally{provider?.destroy();verifying=false;}});
app.use(express.static('web/procurement'));app.use((err,_req,res,_next)=>res.status(400).json({error:err.message}));
app.listen(port,'127.0.0.1',()=>console.log(`DealTrace procurement http://127.0.0.1:${port}`));
