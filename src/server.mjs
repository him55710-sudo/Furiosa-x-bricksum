import {createApp} from './app.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {Store} from './store.mjs';
import {startChain} from './chain.mjs';
import {Engine} from './engine.mjs';
import {Kiln} from './kiln.mjs';
import {MODEL} from '../shared/schema.mjs';
const chain=await startChain();
await mkdir('artifacts/devnet',{recursive:true});await writeFile('artifacts/devnet/deployment.json',JSON.stringify(chain.deployment,null,2)+'\n');
const store=new Store(),engine=new Engine({store,chain,kiln:new Kiln()});await engine.recover();
const port=3400,origin=`http://127.0.0.1:${port}`;
const app=createApp({chain,store,engine,port});
const server=app.listen(port,'127.0.0.1',()=>console.log(`Control Memory ready: ${origin} | local EVM devnet 31337 | ${MODEL}`));
let recoveryJob=null;
const recovery=setInterval(()=>{if(recoveryJob)return;recoveryJob=engine.recover().catch(()=>console.error('RECOVERY_FAILED')).finally(()=>{recoveryJob=null;});},15000);recovery.unref();
async function close(){clearInterval(recovery);server.close();await Promise.allSettled([...engine.jobs.values(),recoveryJob]);store.close();await chain.close();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
