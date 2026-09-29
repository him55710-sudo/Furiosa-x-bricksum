import {fork} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {ensure,hash,verifySigned} from './protocol.mjs';

export function connectProvider({id,url,address,token}){
 const u=new URL(url);ensure(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/','PROVIDER_ORIGIN_ONLY');
 ensure(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)),'PROVIDER_TLS_REQUIRED');
 const request=async(route,body)=>{ensure(['/identity','/discover','/quote','/commit','/execute','/claim','/evidence'].includes(route),'PROVIDER_ROUTE');
  const response=await fetch(u.origin+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(110000)});
  ensure(response.ok,'PROVIDER_HTTP_'+response.status);const data=await response.json();ensure(JSON.stringify(data).length<=3000000,'PROVIDER_RESPONSE_SIZE');return data;
 };
 return {id,url:u.origin,address,request,close:async()=>{}};
}
export async function startWorker(directory,config){
 mkdirSync(directory,{recursive:true});const f=directory+'/config.json';
 if(existsSync(f))ensure(hash(JSON.parse(readFileSync(f,'utf8')))===hash(config),'WORKER_CONFIG_CHANGED');else writeFileSync(f,JSON.stringify(config));
 const token=randomBytes(32).toString('hex'),env=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','KILN_API_KEY','KILN_MODEL','KILN_BASE_URL'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const child=fork(new URL('./worker.mjs',import.meta.url),[directory],{env:{...env,DEALTRACE_WORKER_TOKEN:token},stdio:['ignore','ignore','pipe','ipc']});
 let diagnostic='';child.stderr.on('data',d=>diagnostic=(diagnostic+d).slice(-1500));
 const state=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('WORKER_START_TIMEOUT'));},15000);child.once('message',s=>{clearTimeout(timer);resolve(s);});child.once('exit',()=>{clearTimeout(timer);reject(new Error('WORKER_START_FAILED '+diagnostic));});});
 const client=connectProvider({id:config.id,url:`http://127.0.0.1:${state.port}`,token});
 const identity=await client.request('/identity');ensure(identity.id===config.id&&identity.role===config.role,'WORKER_IDENTITY');
 return {...client,address:identity.address,pid:identity.pid,async close(){if(child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.send('shutdown');});}};
}
export async function discover(client){
 const challenge=randomUUID(),packet=await client.request('/discover',{request_id:challenge,challenge});
 ensure(!packet.error,packet.error??'DISCOVERY_FAILED');const info=verifySigned(packet,client.address);
 ensure(info.id===client.id&&info.address===client.address&&info.challenge===challenge&&info.expires_at>Math.floor(Date.now()/1000),'DISCOVERY_SCOPE');
 return {id:info.id,address:info.address,capabilities:info.capabilities,execution:info.execution,proof:packet};
}
