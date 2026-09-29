// A separate read-only process: no private identities, SQLite or Kiln credentials.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Contract,JsonRpcProvider,keccak256} from 'ethers';
import {verifyReceipt} from '../deal-escrow/audit.ts';
import {readJson,saveJson} from '../deal-escrow/public-run.mjs';

const pointer=readJson('artifacts/dealtrace/public-latest.json');
const report=readJson(pointer.report),deployment=report.network;
if(report.status!=='PASS'||deployment.chainId!==11155111)throw new Error('COMPLETED_SEPOLIA_RUN_REQUIRED');
const rpc=process.env.ADE_AUDIT_RPC??'https://sepolia.gateway.tenderly.co';
const provider=new JsonRpcProvider(rpc,undefined,{cacheTimeout:-1});
try{
 if((await provider.getNetwork()).chainId!==11155111n)throw new Error('SEPOLIA_ONLY');
 if(keccak256(await provider.getCode(deployment.contract))!==deployment.runtimeHash)throw new Error('CONTRACT_CODE_MISMATCH');
 const contract=new Contract(deployment.contract,readJson('artifacts/deal-escrow/contract.json').abi,provider);
 const finalized=await provider.getBlock('finalized');if(!finalized)throw new Error('FINALITY_UNAVAILABLE');
 const chain={provider,contract,deployment,finalityPolicy:{mode:'finalized',confirmations:2},inspect:async hash=>{const e=await contract.escrows(hash,{blockTag:finalized.number});return {status:Number(e.status)};}};
 const results=[],transactions=[];
 for(const o of report.outcomes){
  const file=`artifacts/dealtrace/runs/${report.run}/${o.receipt_file}`,bytes=readFileSync(file),r=JSON.parse(bytes);
  results.push({deal_id:o.deal_id,label:o.label,state:r.state,receipt_sha256:createHash('sha256').update(bytes).digest('hex'),...(await verifyReceipt(r,chain))});
  for(const [kind,op] of Object.entries(r.transactions))if(op.status==='CONFIRMED'){
   const receipt=await provider.getTransactionReceipt(op.tx_hash);
   transactions.push({deal_id:o.deal_id,kind,hash:op.tx_hash,status:receipt.status,block:receipt.blockNumber,fee_wei:receipt.fee.toString()});
  }
 }
 const result={run:report.run,status:results.every(r=>r.verdict==='VALID')?'PASS':'INCOMPLETE',checked_at:new Date().toISOString(),rpc_origin:new URL(rpc).origin,source_fingerprint:report.source_fingerprint,app_process_required:false,signer_required:false,model_calls:0,finalized_block:finalized.number,finalized_block_hash:finalized.hash,results,transactions,limitations:['Trusted off-chain controller and locally pinned demo role identities.','Finalized settlement and signed evidence do not establish arbitrary semantic truth.','Gas is a separate operator cost, not part of the DEMO principal allowance.']};
 saveJson(`artifacts/dealtrace/runs/${report.run}/independent-verification.json`,result);
 console.log(JSON.stringify(result));process.exitCode=result.status==='PASS'?0:1;
}finally{provider.destroy();}
