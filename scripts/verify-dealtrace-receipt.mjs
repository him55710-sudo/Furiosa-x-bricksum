// Read-only verifier. Requires no application DB, agent process, signing key or Kiln access.
import {readFileSync} from 'node:fs';import {Contract,JsonRpcProvider,keccak256} from 'ethers';import {verifyReceipt} from '../src/deal-escrow/audit.ts';
const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/verify-dealtrace-receipt.mjs receipt.json [--offline]');
const r=JSON.parse(readFileSync(file,'utf8'));let provider;
try{
 let chain;
 if(!process.argv.includes('--offline')){
  const trusted=JSON.parse(readFileSync('artifacts/dealtrace/trusted-deployment.json','utf8'));
  if(r.network?.chainId!==11155111||['contract','controller','runtimeHash','unitWei'].some(k=>r.network[k]!==trusted[k]))throw new Error('TRUSTED_DEPLOYMENT_MISMATCH');
  provider=new JsonRpcProvider(process.env.ADE_AUDIT_RPC??'https://sepolia.gateway.tenderly.co',undefined,{cacheTimeout:-1});
  if((await provider.getNetwork()).chainId!==11155111n||keccak256(await provider.getCode(trusted.contract))!==trusted.runtimeHash)throw new Error('CHAIN_ID_OR_CONTRACT_MISMATCH');
  const contract=new Contract(trusted.contract,JSON.parse(readFileSync('artifacts/deal-escrow/contract.json','utf8')).abi,provider);
  chain={provider,contract,deployment:trusted,finalityPolicy:{mode:'finalized',confirmations:2},inspect:async h=>({status:Number((await contract.escrows(h,{blockTag:'finalized'})).status)})};
 }
 const result=await verifyReceipt(r,chain);console.log(JSON.stringify({deal_id:r.deal.deal_id,...result},null,2));process.exitCode=result.verdict==='VALID'?0:result.verdict==='INCOMPLETE'?2:1;
}catch(error){console.log(JSON.stringify({verdict:'INCOMPLETE',reason:error.message}));process.exitCode=2;}finally{provider?.destroy();}
