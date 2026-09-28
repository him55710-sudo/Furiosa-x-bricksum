// Independently read finalized Sepolia state with no app process, keys or LLM.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Contract,JsonRpcProvider,keccak256} from 'ethers';
import {verifyReceipt} from '../src/deal-escrow/audit.ts';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const report=read('artifacts/deal-escrow/source-sepolia/latest.json');
const deployment=read(`${report.evidence_directory}/trusted-deployment.json`);
const rpc=process.env.ADE_AUDIT_RPC??'https://sepolia.gateway.tenderly.co';
const provider=new JsonRpcProvider(rpc,undefined,{cacheTimeout:-1});
try{
  if((await provider.getNetwork()).chainId!==11155111n||deployment.chainId!==11155111)throw new Error('SEPOLIA_ONLY');
  if(keccak256(await provider.getCode(deployment.contract))!==deployment.runtimeHash)throw new Error('CONTRACT_CODE_MISMATCH');
  const abi=read('artifacts/deal-escrow/contract.json').abi,contract=new Contract(deployment.contract,abi,provider);
  const finalized=await provider.getBlock('finalized');if(!finalized)throw new Error('FINALITY_UNAVAILABLE');
  const chain={provider,contract,deployment,finalityPolicy:{mode:'finalized',confirmations:2},inspect:async(hash,blockTag='finalized')=>{const e=await contract.escrows(hash,{blockTag});return {status:Number(e.status)};}};
  const results=[],transactions=new Map();
  for(const item of report.results){
    const bytes=readFileSync(`${report.evidence_directory}/${item.id}.json`),r=JSON.parse(bytes);
    const result=await verifyReceipt(r,chain);
    results.push({id:item.id,scenario:item.scenario,state:r.state,sha256:createHash('sha256').update(bytes).digest('hex'),...result});
    for(const [kind,op] of Object.entries(r.transactions))if(op.status==='CONFIRMED'){
      const receipt=await provider.getTransactionReceipt(op.tx_hash);
      transactions.set(op.tx_hash,{deal_id:item.id,kind,hash:op.tx_hash,status:receipt.status,block:receipt.blockNumber,block_hash:receipt.blockHash,gas_used:receipt.gasUsed.toString(),gas_price_wei:receipt.gasPrice.toString(),fee_wei:receipt.fee.toString()});
    }
  }
  const result={schema_version:1,run:report.run,status:results.every(r=>r.verdict==='VALID')?'PASS':'INCOMPLETE',checked_at:new Date().toISOString(),rpc_origin:new URL(rpc).origin,app_process_required:false,signer_required:false,finality_mode:'finalized',finalized_block:finalized.number,finalized_block_hash:finalized.hash,contract:deployment.contract,results,transactions:[...transactions.values()],transaction_fees_wei:[...transactions.values()].reduce((sum,t)=>sum+BigInt(t.fee_wei),0n).toString(),limitations:['Controller trust remains for off-chain mandate, validation timing, and event completeness.','Pinned issuer reference validation only; factual truth and unseen-document generalization are not established.','Network gas is funded from the separate demo operator budget, not the task principal limit.']};
  writeFileSync(`${report.evidence_directory}/independent-verification.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,run:result.run,finalized_block:result.finalized_block,results:results.map(r=>({scenario:r.scenario,verdict:r.verdict,reason:r.reason})),transactions:result.transactions}));
  if(result.status!=='PASS')process.exitCode=1;
}finally{provider.destroy();}
