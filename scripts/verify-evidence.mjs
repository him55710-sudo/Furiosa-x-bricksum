import {readFile} from 'node:fs/promises';
import {JsonRpcProvider} from 'ethers';
import {verifyBundle} from '../src/verifier.mjs';
const [file,deploymentFile='artifacts/devnet/deployment.json']=process.argv.slice(2);
if(!file){console.error('Usage: node scripts/verify-evidence.mjs <bundle.json> [trusted-deployment.json]');process.exit(2);}
const bundle=JSON.parse(await readFile(file,'utf8'));
const deployment=JSON.parse(await readFile(deploymentFile,'utf8'));
const abi=JSON.parse(await readFile('artifacts/contracts/BudgetVault.json','utf8')).abi;
const provider=new JsonRpcProvider(deployment.rpcUrl,undefined,{cacheTimeout:-1});
try {const report=await verifyBundle(bundle,{provider,deployment,abi});console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='VALID'?0:1;}finally{provider.destroy();}
