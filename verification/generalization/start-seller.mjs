import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {saveJson} from '../../src/dealtrace/procurement/storage.mjs';
import {connectProvider} from '../../src/dealtrace/procurement/client.mjs';
import {hash,ensure} from '../../src/deal-escrow/domain.ts';
export async function startSeller(directory,config){
 mkdirSync(directory,{recursive:true});const path=directory+'/config.json';if(existsSync(path))ensure(hash(JSON.parse(readFileSync(path)))===hash(config),'CONFIG_CHANGED');else saveJson(path,config);
 const token=randomBytes(32).toString('hex'),env=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','KILN_API_KEY','KILN_MODEL','KILN_BASE_URL'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const child=fork(new URL('./seller-server.mjs',import.meta.url),[],{env:{...env,LAB_DIRECTORY:directory,LAB_TOKEN:token},stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr.on('data',b=>stderr=(stderr+b).slice(-2000));
 const state=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('LAB_START_TIMEOUT'));},15000);child.once('message',s=>{clearTimeout(timer);resolve(s);});child.once('exit',()=>{clearTimeout(timer);reject(new Error('LAB_START_FAILED '+stderr));});});
 const client=connectProvider({id:config.id,url:`http://127.0.0.1:${state.port}`,token});const identity=await client.request('/identity');
 return {...client,address:identity.address,pid:identity.pid,async close(){if(child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>child.kill(),5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.send('shutdown');});}};
}
