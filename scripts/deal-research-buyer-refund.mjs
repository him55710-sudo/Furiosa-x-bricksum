// Standalone buyer: public recovery packet + buyer key only. Run with Node's
// filesystem permission boundary; no database, controller key, app API or LLM.
import {readFileSync} from 'node:fs';import path from 'node:path';
import {Wallet,JsonRpcProvider,Contract,Transaction,FetchRequest,keccak256,id} from 'ethers';
import {readJson,saveJson} from '../src/deal-escrow/public-run.mjs';
const [packetFile,keyFile,journalFile,outFile]=process.argv.slice(2);
const connection=new FetchRequest('https://ethereum-sepolia-rpc.publicnode.com');connection.timeout=15000;
const provider=new JsonRpcProvider(connection,undefined,{cacheTimeout:-1});provider.pollingInterval=2000;
try{
  if(!process.permission||process.permission.has('fs.read',path.resolve('data/private/deal-escrow/source-sepolia/identities.json')))throw new Error('BUYER_KEY_ISOLATION_REQUIRED');
  const packet=readJson(packetFile),buyer=new Wallet(readJson(keyFile).private_key,provider),same=(a,b)=>a.toLowerCase()===b.toLowerCase();
  if((await provider.getNetwork()).chainId!==11155111n||packet.chain_id!==11155111)throw new Error('SEPOLIA_ONLY');
  if(!same(buyer.address,packet.buyer)||same(buyer.address,packet.controller))throw new Error('INDEPENDENT_BUYER_REQUIRED');
  const abi=['function controller() view returns(address)','function escrows(bytes32) view returns(address buyer,address seller,uint256 amount,uint64 deadline,uint8 status)','function refund(bytes32,bytes32)'];
  const contract=new Contract(packet.contract,abi,buyer),reason=id('BUYER_DIRECT_DEADLINE_REFUND');
  if(keccak256(await provider.getCode(packet.contract))!==packet.runtime_hash||!same(await contract.controller(),packet.controller))throw new Error('DEPLOYMENT_MISMATCH');
  const escrow=await contract.escrows(packet.deal_hash),block=await provider.getBlock('latest');
  if(!same(escrow.buyer,buyer.address)||!same(escrow.seller,packet.seller)||escrow.amount.toString()!==packet.amount_wei||Number(escrow.deadline)!==packet.deadline||block.timestamp<packet.deadline)throw new Error('REFUND_NOT_AVAILABLE');
  let journal;try{journal=readJson(journalFile);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!journal){
    if(escrow.status!==1n)throw new Error('ESCROW_NOT_LOCKED');
    const nonce=await provider.getTransactionCount(buyer.address);if(nonce!==await provider.getTransactionCount(buyer.address,'pending'))throw new Error('BUYER_HAS_PENDING_TRANSACTION');
    const fee=await provider.getFeeData(),estimated=await contract.refund.estimateGas(packet.deal_hash,reason),gasLimit=estimated*120n/100n,ceiling=BigInt(packet.maximum_gas_fee_wei)/gasLimit;
    const maxFeePerGas=fee.maxFeePerGas<ceiling?fee.maxFeePerGas:ceiling,maxPriorityFeePerGas=fee.maxPriorityFeePerGas;
    if(maxFeePerGas<=block.baseFeePerGas+maxPriorityFeePerGas)throw new Error('GAS_BUDGET_TOO_LOW');
    const balance=await provider.getBalance(buyer.address);if(balance<gasLimit*maxFeePerGas)throw new Error('BUYER_TEST_GAS_REQUIRED');
    const request=await buyer.populateTransaction({...await contract.refund.populateTransaction(packet.deal_hash,reason),nonce,gasLimit,maxFeePerGas,maxPriorityFeePerGas});
    const raw=await buyer.signTransaction(request);journal={raw,tx_hash:keccak256(raw),balance_before:balance.toString(),before_block:block.number,packet_hash:keccak256(readFileSync(packetFile))};saveJson(journalFile,journal);
  }
  const tx=Transaction.from(journal.raw);
  if(tx.hash!==journal.tx_hash||tx.chainId!==11155111n||!same(tx.from,buyer.address)||!same(tx.to,packet.contract)||tx.value!==0n||tx.data!==contract.interface.encodeFunctionData('refund',[packet.deal_hash,reason])||tx.gasLimit*tx.maxFeePerGas>BigInt(packet.maximum_gas_fee_wei)||journal.packet_hash!==keccak256(readFileSync(packetFile)))throw new Error('SIGNED_INTENT_MISMATCH');
  let mined=await provider.getTransactionReceipt(tx.hash);
  if(!mined){if(!await provider.getTransaction(tx.hash)){console.log(JSON.stringify({stage:'BROADCASTING_SAVED_BUYER_TRANSACTION',tx_hash:tx.hash}));await provider.broadcastTransaction(journal.raw);}mined=await provider.waitForTransaction(tx.hash,2,180000);}
  if(!mined||mined.status!==1)throw new Error('REFUND_UNCONFIRMED_RESUME_SAME_JOURNAL');
  const after=await provider.getBalance(buyer.address,mined.blockNumber),fee=mined.fee;
  if(after-BigInt(journal.balance_before)+fee!==escrow.amount)throw new Error('BUYER_BALANCE_MISMATCH');
  saveJson(outFile,{status:'REFUNDED',buyer:buyer.address,tx_hash:tx.hash,amount_wei:escrow.amount.toString(),balance_before:journal.balance_before,balance_after:after.toString(),gas_fee_wei:fee.toString(),reason_hash:reason,block_number:mined.blockNumber,block_hash:mined.blockHash,rpc_origin:'https://ethereum-sepolia-rpc.publicnode.com',app_access:false,controller_key_access:false,app_database_access:false,node_filesystem_permission_enforced:true,model_calls:0});
  console.log(JSON.stringify({status:'REFUNDED',tx_hash:tx.hash,model_calls:0}));
}catch(e){console.error(JSON.stringify({status:'STOPPED',reason:e.shortMessage??e.code??e.message,...(e.code==='ERR_ACCESS_DENIED'?{permission:e.permission,resource:e.resource}:{})}));process.exitCode=1;}finally{provider.destroy();}
