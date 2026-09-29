import {JsonRpcProvider} from 'ethers';
import {readJson,saveJson} from '../src/deal-escrow/public-run.mjs';
import {verifyVaultProof} from '../src/dealtrace/vault-audit.mjs';
const pointer=readJson('artifacts/dealtrace/vault/public-latest.json'),file=process.argv[2]??pointer.report;
const report=readJson(file),trusted=readJson('artifacts/dealtrace/vault/trusted-deployment.json');
const provider=new JsonRpcProvider(process.env.ADE_AUDIT_RPC??'https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1});
try{const result=await verifyVaultProof(report,{provider,trusted});if(file===pointer.report)saveJson(`artifacts/dealtrace/vault/runs/${report.run}/finalized-verification.json`,result);console.log(JSON.stringify(result,null,2));process.exitCode=result.verdict==='VALID'?0:result.verdict==='INVALID'?1:2;}finally{provider.destroy();}
