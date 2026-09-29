import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {ensure} from '../deal-escrow/domain.ts';

export async function startAgent(directory,role){
 const token=randomBytes(32).toString('hex');
 const env=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','KILN_API_KEY','KILN_MODEL','KILN_BASE_URL'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const child=fork(new URL('./agent-service.mjs',import.meta.url),[directory,role],{env:{...env,DEALTRACE_AGENT_TOKEN:token},stdio:['ignore','ignore','pipe','ipc']});let diagnostic='';child.stderr.on('data',d=>{diagnostic=(diagnostic+d.toString()).slice(-1500);});
 const address=await new Promise((resolve,reject)=>{const t=setTimeout(()=>{child.kill();reject(new Error('AGENT_START_TIMEOUT'));},15000);child.once('message',m=>{clearTimeout(t);resolve(m);});child.once('exit',()=>{clearTimeout(t);reject(new Error('AGENT_START_FAILED: '+diagnostic));});});
 const request=async(route,body)=>{const res=await fetch(`http://127.0.0.1:${address.port}${route}`,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000)});const data=await res.json();ensure(res.ok,data.error??'AGENT_HTTP_ERROR');return data;};
 return {role,...address,identity:await request('/identity'),request,async close(){if(child.exitCode!==null)return;await new Promise(resolve=>{const t=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(t);resolve();});child.send('shutdown');});}};
}
