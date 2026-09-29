import express from 'express';
import {Wallet} from 'ethers';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {saveJson} from '../../src/dealtrace/procurement/storage.mjs';
import {hash,ensure} from '../../src/deal-escrow/domain.ts';
import {initialState,sellerAction} from './seller-core.mjs';

const directory=process.env.LAB_DIRECTORY;
const config=JSON.parse(directory?readFileSync(directory+'/config.json','utf8'):process.env.LAB_CONFIG_JSON??'null');
ensure(config&&process.env.LAB_TOKEN,'LAB_CONFIG_REQUIRED');
let blob;
async function load(){
 if(directory){mkdirSync(directory,{recursive:true});const path=directory+'/private-state.json';if(!existsSync(path))saveJson(path,{key:Wallet.createRandom().privateKey,...initialState()});return {state:JSON.parse(readFileSync(path)),etag:null};}
 blob??=await import('@vercel/blob');
 // Content-encoding can turn an origin ETag into a weak representation validator.
 // Request the identity representation for exact conditional writes; never strip W/.
 const options={access:'private',useCache:false,headers:{'accept-encoding':'identity'}};
 let response=await blob.get('seller-private-state.json',options);
 if(!response){try{await blob.put('seller-private-state.json',JSON.stringify({key:Wallet.createRandom().privateKey,...initialState()}),{access:'private',allowOverwrite:false,addRandomSuffix:false});}catch(e){if(!(e instanceof blob.BlobAlreadyExistsError))throw e;}response=await blob.get('seller-private-state.json',options);}
 ensure(response?.stream,'STATE_UNAVAILABLE');ensure(response.blob.etag&&!response.blob.etag.startsWith('W/'),'WEAK_BLOB_ETAG');return {state:JSON.parse(await new Response(response.stream).text()),etag:response.blob.etag};
}
async function save(state,etag){if(directory){saveJson(directory+'/private-state.json',state);return null;}const result=await blob.put('seller-private-state.json',JSON.stringify(state),{access:'private',allowOverwrite:true,addRandomSuffix:false,ifMatch:etag});return result.etag;}
const app=express();app.disable('x-powered-by');app.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.headers.authorization!=='Bearer '+process.env.LAB_TOKEN)return res.sendStatus(403);next();});app.use(express.json({limit:'3mb'}));
let queue=Promise.resolve();
for(const route of ['/identity','/evidence','/discover','/quote','/commit','/execute','/claim'])app[route==='/identity'||route==='/evidence'?'get':'post'](route,(req,res)=>{
 const work=queue.then(async()=>{
  const record=await load(),state=record.state;let etag=record.etag;const wallet=new Wallet(state.key);
  if(req.method==='GET')return sellerAction(route,{},state,wallet,config);
  const {request_id,...input}=req.body;ensure(typeof request_id==='string'&&request_id.length>0&&request_id.length<150,'REQUEST_ID');
  const k=route+':'+request_id,prior=state.requests[k];if(prior){ensure(prior.input_hash===hash(input),'REQUEST_REPLAY_CHANGED');return prior.result??{error:'REQUEST_REQUIRES_REVIEW'};}
  ensure(Object.keys(state.requests).length<500,'LAB_REQUEST_CAP');
  state.requests[k]={input_hash:hash(input),status:'STARTED',instance:process.env.VERCEL_DEPLOYMENT_ID??String(process.pid)};etag=await save(state,etag);
  let result;try{result=await sellerAction(route,input,state,wallet,config);}catch(e){result={error:e.message,usage:state.usage};}
  state.requests[k]={...state.requests[k],status:'COMPLETE',result};await save(state,etag);return result;
 });queue=work.catch(()=>{});work.then(result=>res.json(result)).catch(e=>{
  let diagnostic=String(e.message??'UNKNOWN_ERROR');
  for(const [key,value] of Object.entries(process.env))if(/TOKEN|KEY|SECRET/i.test(key)&&value)diagnostic=diagnostic.replaceAll(value,'[REDACTED]');
  diagnostic=diagnostic.replace(/0x[a-fA-F0-9]{64}/g,'[HASH_OR_KEY]').slice(0,400);
  console.error('LAB_REQUEST_FAILURE',String(e.name??'Error').replace(/[^A-Za-z]/g,''),diagnostic);
  res.status(409).json({error:'LAB_STATE_CONFLICT_OR_INVALID_REQUEST'});
 });
});
if(directory){const server=app.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port,pid:process.pid,instance:randomUUID()}));process.on('message',m=>{if(m==='shutdown')server.close(()=>process.exit(0));});}
export default app;
