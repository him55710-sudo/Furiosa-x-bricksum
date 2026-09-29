import {runDealTrace} from '../src/dealtrace/run.mjs';
const result=await runDealTrace({live:process.argv.includes('--live'),onProgress:r=>console.log(JSON.stringify({run:r.run,stage:r.stage,status:r.status,calls:r.usage.length}))});
console.log(JSON.stringify({run:result.run,status:result.status,error:result.error??null,...result.summary}));process.exitCode=result.status==='PASS'?0:1;
