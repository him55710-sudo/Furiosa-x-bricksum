import {runDealTrace} from '../src/dealtrace/run.mjs';
const publicNetwork=process.argv.includes('--sepolia');
if(publicNetwork)process.env.SEPOLIA_RPC_URL??='https://ethereum-sepolia-rpc.publicnode.com';
const result=await runDealTrace({live:process.argv.includes('--live'),publicNetwork,chainDirectory:process.env.DEALTRACE_SEPOLIA_DIR??null,resumeRun:process.argv.find(a=>a.startsWith('--resume='))?.slice(9)??null,onProgress:r=>console.log(JSON.stringify({run:r.run,stage:r.stage,status:r.status,calls:r.usage.length}))});
console.log(JSON.stringify({run:result.run,status:result.status,error:result.error??null,...result.summary}));process.exitCode=result.status==='PASS'?0:1;
