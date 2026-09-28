import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {JsonRpcProvider,Contract,keccak256} from 'ethers';import {verifyReceipt} from '../src/deal-escrow/audit.ts';import {saveJson} from '../src/deal-escrow/public-run.mjs';
const index=JSON.parse(readFileSync('artifacts/deal-escrow/source-recovery/latest.json','utf8')),directory=index.directory;
const file=`${directory}/reconciled-receipt.json`,bytes=readFileSync(file),r=JSON.parse(bytes),packet=JSON.parse(readFileSync(`${directory}/public-packet.json`,'utf8'));
const provider=new JsonRpcProvider('https://sepolia.gateway.tenderly.co',undefined,{cacheTimeout:-1});
try{
  const deployment=JSON.parse(readFileSync('artifacts/deal-escrow/source-sepolia/a2f6f4fa-9f1e-4892-8518-325b8762c4f2/trusted-deployment.json','utf8'));
  if((await provider.getNetwork()).chainId!==11155111n||r.network.contract!==deployment.contract||packet.contract!==deployment.contract||keccak256(await provider.getCode(deployment.contract))!==deployment.runtimeHash)throw new Error('TRUSTED_DEPLOYMENT_MISMATCH');
  const contract=new Contract(deployment.contract,JSON.parse(readFileSync('artifacts/deal-escrow/contract.json','utf8')).abi,provider),finalized=await provider.getBlock('finalized');
  const chain={provider,contract,deployment,finalityPolicy:{mode:'finalized',confirmations:2},inspect:async(h,blockTag='finalized')=>({status:Number((await contract.escrows(h,{blockTag})).status)})};
  const verdict=await verifyReceipt(r,chain);
  const result={run:index.run,checked_at:new Date().toISOString(),status:verdict.verdict==='VALID'?'PASS':'INCOMPLETE',rpc_origin:'https://sepolia.gateway.tenderly.co',finalized_block:finalized.number,receipt_sha256:createHash('sha256').update(bytes).digest('hex'),packet_sha256:createHash('sha256').update(readFileSync(`${directory}/public-packet.json`)).digest('hex'),...verdict,app_process_required:false,app_database_required:false,signer_required:false};
  saveJson(`${directory}/independent-verification.json`,result);console.log(JSON.stringify({status:result.status,run:result.run,finalized_block:result.finalized_block,verdict:result.verdict,reason:result.reason}));if(result.status!=='PASS')process.exitCode=1;
}finally{provider.destroy();}
