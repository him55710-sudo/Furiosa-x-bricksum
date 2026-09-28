import {readFile,writeFile} from 'node:fs/promises';
import {JsonRpcProvider} from 'ethers';
import {verifyPurchaseBundle} from '../src/purchase-verifier.mjs';
const [bundleFile,manifestFile,rpcUrl,outputFile]=process.argv.slice(2);
if(!bundleFile||!manifestFile||!rpcUrl)throw new Error('Usage: node scripts/verify-purchase.mjs BUNDLE TRUSTED_MANIFEST INDEPENDENT_RPC [OUTPUT]');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const [bundle,deployment,artifact]=await Promise.all([json(bundleFile),json(manifestFile),json('artifacts/contracts/PurchaseVault.json')]);
const provider=new JsonRpcProvider(rpcUrl,undefined,{cacheTimeout:-1});
try{const result=await verifyPurchaseBundle(bundle,{provider,deployment,artifact});if(outputFile)await writeFile(outputFile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='VALID')process.exitCode=1;}finally{provider.destroy();}
