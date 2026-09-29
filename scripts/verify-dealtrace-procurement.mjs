import {readFileSync} from 'node:fs';
import {JsonRpcProvider} from 'ethers';
import {verifyProcurement} from '../src/dealtrace/procurement/verify.mjs';
const file=process.argv[2],pin=process.argv[3];if(!file||!pin)throw new Error('Usage: report.json trusted-deployment.json [--offline]');
const report=JSON.parse(readFileSync(file,'utf8')),trusted=JSON.parse(readFileSync(pin,'utf8'));
const provider=process.argv.includes('--offline')?null:new JsonRpcProvider(process.env.ADE_AUDIT_RPC??'https://sepolia.gateway.tenderly.co',undefined,{cacheTimeout:-1});
try{const result=await verifyProcurement(report,{provider,trusted});console.log(JSON.stringify(result,null,2));process.exitCode={VALID:0,INVALID:1,INCOMPLETE:2}[result.verdict];}finally{provider?.destroy();}
