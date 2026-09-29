import {readFileSync} from 'node:fs';
import {runProcurement} from '../src/dealtrace/procurement/run.mjs';
const value=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const run=value('run'),externalFile=value('providers');
const result=await runProcurement({...(run?{run}:{}),resume:process.argv.includes('--resume'),approved:true,live:process.argv.includes('--live'),metered:process.argv.includes('--metered'),flexQuantity:process.argv.includes('--flex-quantity'),publicNetwork:process.argv.includes('--sepolia'),...(externalFile?{external:JSON.parse(readFileSync(externalFile,'utf8'))}:{}),onProgress:r=>console.log(JSON.stringify({run:r.run,stage:r.stage,status:r.status,calls:r.model_calls,error:r.error??null}))});
console.log(JSON.stringify({run:result.run,status:result.status,error:result.error??null,verification:result.verification?.verdict}));process.exitCode=result.status==='PASS'?0:1;
