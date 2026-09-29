import ganache from 'ganache';
import {Wallet,BrowserProvider,JsonRpcProvider,Contract,ContractFactory,Transaction,keccak256} from 'ethers';
import {existsSync} from 'node:fs';
import {readJson} from '../../deal-escrow/public-run.mjs';
import {saveJson} from './storage.mjs';
import {acquireRuntimeLock} from '../../deal-escrow/runtime-lock.mjs';
import {hash,ensure,UNIT_WEI} from './protocol.mjs';

export async function openExecution({directory,journal,report,persist,publicNetwork,metered,onProgress}){
 let rawProvider,provider,sourceLock;const keyFile=directory+'/chain-keys.json';
 try{
 const artifact=readJson(metered?'artifacts/dealtrace/metered-vault/contract.json':'artifacts/dealtrace/vault/contract.json');
 if(!existsSync(keyFile)){
  if(publicNetwork){const src=process.env.DEALTRACE_SEPOLIA_DIR??'data/private/deal-escrow/source-sepolia';sourceLock=acquireRuntimeLock(src);const keys=readJson(src+'/identities.json');saveJson(keyFile,{relayer:keys.controller,buyer:keys.buyer});}
  else saveJson(keyFile,{relayer:Wallet.createRandom().privateKey,buyer:Wallet.createRandom().privateKey});
 }else if(publicNetwork)sourceLock=acquireRuntimeLock(process.env.DEALTRACE_SEPOLIA_DIR??'data/private/deal-escrow/source-sepolia');
 const keys=readJson(keyFile);
 if(publicNetwork){provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL??'https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1});provider.pollingInterval=1500;}
 else{ensure(!journal.network,'LOCAL_CHAIN_CANNOT_RESUME_USE_NEW_RUN');rawProvider=ganache.provider({logging:{quiet:true},chain:{chainId:31339,hardfork:'shanghai'},wallet:{accounts:Object.values(keys).map(k=>({secretKey:k,balance:'0x8ac7230489e80000'}))}});provider=new BrowserProvider(rawProvider,undefined,{cacheTimeout:-1});provider.pollingInterval=10;}
 const chainId=Number((await provider.getNetwork()).chainId);ensure(chainId===(publicNetwork?11155111:31339),'TEST_NETWORK_ONLY');
 const relayer=new Wallet(keys.relayer,provider),buyer=new Wallet(keys.buyer,provider);
 journal.operations??={};
 async function tx(label,request,{signer=relayer,status=1}={}){
  const intent=hash({from:signer.address,to:request.to??null,data:request.data??'0x',value:String(request.value??0),status});let op=journal.operations[label];
  if(!op){const nonce=await provider.getTransactionCount(signer.address);ensure(nonce===await provider.getTransactionCount(signer.address,'pending'),'PENDING_NONCE_RECONCILIATION_REQUIRED');const block=await provider.getBlock('latest');
   const fees=publicNetwork?{maxPriorityFeePerGas:10000000n,maxFeePerGas:block.baseFeePerGas*2n+10000000n}:{};
   const populated=await signer.populateTransaction({...request,...fees,nonce});const reserved=populated.gasLimit*(populated.maxFeePerGas??populated.gasPrice);
   ensure(reserved<=BigInt(process.env.DEALTRACE_PROCUREMENT_GAS_CAP_WEI??(publicNetwork?'8000000000000000':'50000000000000000')),'OPERATOR_GAS_CAP');
   ensure(Object.values(journal.operations).reduce((n,o)=>n+BigInt(o.gas_reservation),0n)+reserved<=BigInt(process.env.DEALTRACE_PROCUREMENT_RUN_GAS_CAP_WEI??(publicNetwork?'15000000000000000':'100000000000000000')),'RUN_GAS_CAP');
   ensure(await provider.getBalance(signer.address)>=(populated.value??0n)+reserved,'INSUFFICIENT_TEST_ASSETS');
   const raw=await signer.signTransaction(populated);op={intent,raw,hash:keccak256(raw),gas_reservation:String(reserved)};journal.operations[label]=op;persist();
  }
  ensure(op.intent===intent,'RESUME_INTENT_MISMATCH');const decoded=Transaction.from(op.raw);ensure(decoded.hash===op.hash&&decoded.chainId===BigInt(chainId)&&decoded.from===signer.address,'SIGNED_INTENT_MISMATCH');
  let receipt=await provider.getTransactionReceipt(op.hash);
  if(!receipt){if(!await provider.getTransaction(op.hash))await provider.broadcastTransaction(op.raw);onProgress('WAITING_'+label);receipt=await provider.waitForTransaction(op.hash,publicNetwork?2:1,45000);}
  ensure(receipt,'PENDING_RESUME_SAME_RUN');ensure(receipt.status===status,'UNEXPECTED_TRANSACTION_STATUS');const block=await provider.getBlock(receipt.blockNumber);ensure(block.hash===receipt.blockHash,'REORG_DETECTED');
  const item={label,tx_hash:op.hash,status:receipt.status,block:receipt.blockNumber,block_hash:receipt.blockHash,from:decoded.from,to:decoded.to,input:decoded.data,value:String(decoded.value),gas_used:String(receipt.gasUsed),fee_wei:String(receipt.fee)};
  const index=report.transactions.findIndex(t=>t.label===label);if(index<0)report.transactions.push(item);else report.transactions[index]=item;persist();onProgress(label);return receipt;
 }
 let address=journal.network?.contract;
 if(!address){
  if(publicNetwork&&!metered){address=readJson('artifacts/dealtrace/vault/trusted-deployment.json').contract;}
  else{const d=await tx('deploy',{...await new ContractFactory(artifact.abi,artifact.bytecode,relayer).getDeployTransaction(),gasLimit:4500000n});address=d.contractAddress;}
  const runtimeHash=keccak256(await provider.getCode(address));ensure(runtimeHash!==keccak256('0x'),'CONTRACT_MISSING');journal.network={chainId,contract:address,runtimeHash,metered,unitWei:UNIT_WEI,sourceSha256:artifact.sourceSha256};persist();
 }
 ensure(keccak256(await provider.getCode(address))===journal.network.runtimeHash,'CONTRACT_RUNTIME_CHANGED');
 if(publicNetwork&&!metered)ensure(journal.network.runtimeHash===readJson('artifacts/dealtrace/vault/trusted-deployment.json').runtimeHash,'TRUSTED_RUNTIME_MISMATCH');
 const contract=new Contract(address,artifact.abi,relayer);
 return {provider,relayer,buyer,contract,network:journal.network,tx,call:(name,args,value=0n,gasLimit)=>contract[name].populateTransaction(...args,{value,...(gasLimit?{gasLimit}:{})}),async close(){provider.destroy();await rawProvider?.disconnect();sourceLock?.release();}};
 }catch(error){provider?.destroy();await rawProvider?.disconnect();sourceLock?.release();throw error;}
}
