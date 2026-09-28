// Read-only independent public RPC verification, including finalized state.
import {readFileSync,writeFileSync} from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {JsonRpcProvider,Contract,keccak256} from 'ethers';import {verifyReceipt} from '../src/deal-escrow/audit.ts';
const root=path.resolve('artifacts/deal-escrow/research/sepolia-source-v1'),read=f=>JSON.parse(readFileSync(path.join(root,f),'utf8')),report=read('report.json'),deployment=read('deployment.json');
const finalized=process.argv.includes('--finalized'),mode=finalized?'finalized':'confirmations',rpc='https://sepolia.gateway.tenderly.co',provider=new JsonRpcProvider(rpc,undefined,{cacheTimeout:-1});
try{
 if(Number((await provider.getNetwork()).chainId)!==11155111||deployment.chainId!==11155111||keccak256(await provider.getCode(deployment.contract))!==deployment.runtimeHash)throw new Error('TRUSTED_DEPLOYMENT_MISMATCH');
 const contract=new Contract(deployment.contract,JSON.parse(readFileSync('artifacts/deal-escrow/contract.json','utf8')).abi,provider),head=await provider.getBlock(finalized?'finalized':'latest');
 const chain={provider,contract,deployment,finalityPolicy:{mode,confirmations:2},inspect:async(hash,blockTag=finalized?'finalized':'latest')=>{const e=await contract.escrows(hash,{blockTag});return {status:Number(e.status)};}};
 const results=[];
 for(const scenario of report.results){const bytes=readFileSync(path.join(root,scenario.receipt_file)),r=JSON.parse(bytes),verification=await verifyReceipt(r,chain);results.push({scenario:scenario.scenario,deal_id:r.deal.deal_id,receipt_sha256:createHash('sha256').update(bytes).digest('hex'),...verification});}
 let refund;
 try{execFileSync(process.execPath,['scripts/deal-escrow-independent-verify.mjs',path.join(root,'public-packet.json'),path.join(root,'buyer-refund.json'),path.join(root,'independent-refund-'+mode+'.json'),...(finalized?['--finalized']:[])],{windowsHide:true,timeout:30000,stdio:'pipe'});refund=read('independent-refund-'+mode+'.json');}catch{refund={verdict:'INCOMPLETE',reason:'Independent buyer refund has not met the requested verification boundary'};}
 const result={status:results.every(r=>r.verdict==='VALID')&&refund.verdict==='VALID'?'PASS':'INCOMPLETE',checked_at:new Date().toISOString(),rpc_origin:rpc,chain_id:11155111,contract:deployment.contract,finality_mode:mode,observed_block:head.number,results,refund,app_process_required:false,signer_required:false};
 writeFileSync(path.join(root,'independent-'+mode+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,finality_mode:mode,observed_block:head.number,results:results.map(r=>({scenario:r.scenario,verdict:r.verdict,reason:r.reason})),refund:refund.verdict}));if(result.status!=='PASS')process.exitCode=1;
}finally{provider.destroy();}
