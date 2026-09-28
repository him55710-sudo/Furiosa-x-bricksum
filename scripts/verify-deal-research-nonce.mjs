import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JsonRpcProvider,FetchRequest} from 'ethers';
import {findMinedNonce} from '../src/deal-escrow/nonce-transaction.mjs';
import {verificationSource} from '../src/deal-escrow/verification-source.mjs';

// Read-only corroboration of an EXISTING public transaction, not a new payment
// or replacement demonstration. No app database, wallet, key or model API.
const packetFile='artifacts/deal-escrow/source-recovery/5b2ccb95-10b9-4f62-a51a-73761d51c336/public-packet.json';
const bytes=readFileSync(packetFile),packet=JSON.parse(bytes),source=verificationSource();
const rpc='https://sepolia.gateway.tenderly.co',request=new FetchRequest(rpc);request.timeout=15000;
const provider=new JsonRpcProvider(request,undefined,{cacheTimeout:-1,batchMaxCount:1});
const allowed=new Set(['eth_chainId','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber','eth_getTransactionCount','eth_blockNumber']),methods={};
const send=provider.send.bind(provider);provider.send=async(method,params)=>{if(!allowed.has(method))throw new Error('READ_ONLY_RPC_REQUIRED');methods[method]=(methods[method]??0)+1;return send(method,params);};
const report={schema_version:1,checked_at:new Date().toISOString(),kind:'existing-public-transaction-locator',status:'INCOMPLETE',rpc_origin:rpc,chain_id:packet.chain_id,expected_transaction_hash:packet.fund_tx,packet_sha256:createHash('sha256').update(bytes).digest('hex'),source_fingerprint:source.sha256,model_calls:0,transactions_submitted:0,signer_required:false,app_database_required:false};
try{
  assert.equal(Number((await provider.getNetwork()).chainId),packet.chain_id);
  const known=await provider.getTransaction(packet.fund_tx),basis=await provider.getBlock('finalized');
  assert.ok(known&&basis);assert.equal(known.from.toLowerCase(),packet.controller.toLowerCase());assert.equal(known.to.toLowerCase(),packet.contract.toLowerCase());
  const fromBlock=Math.max(0,known.blockNumber-4096);
  const located=await findMinedNonce(provider,{sender:packet.controller,nonce:known.nonce,fromBlock,basis:{number:basis.number,hash:basis.hash}});
  assert.equal(located?.transaction.hash,packet.fund_tx);
  const receipt=await provider.getTransactionReceipt(located.transaction.hash);
  assert.ok(receipt);assert.equal(receipt.status,1);assert.equal(receipt.blockNumber,located.blockNumber);assert.equal(receipt.blockHash,located.blockHash);assert.equal(receipt.from.toLowerCase(),packet.controller.toLowerCase());assert.equal(receipt.to.toLowerCase(),packet.contract.toLowerCase());
  assert.equal((await provider.getBlock(basis.number)).hash,basis.hash);
  assert.equal(verificationSource().sha256,source.sha256);
  Object.assign(report,{status:'PASS',sender:packet.controller,nonce:known.nonce,located_transaction_hash:located.transaction.hash,transaction_block:located.blockNumber,transaction_block_hash:located.blockHash,finalized_block:basis.number,finalized_block_hash:basis.hash,transaction_age_blocks:basis.number-located.blockNumber,search_from_block:fromBlock,search_span_blocks:basis.number-fromBlock+1,locator_nonce_reads:located.nonceReads,locator_full_block_reads:located.fullBlockReads,receipt_status:receipt.status,limitation:'Existing original funding transaction; this public observation is not a new replacement, payment, refund or end-to-end run.'});
}catch(error){report.reason=error.message;process.exitCode=1;}finally{
  provider.destroy();report.rpc_methods=methods;
  const directory=`artifacts/deal-escrow/nonce-recovery/${report.checked_at.replace(/[:.]/g,'-')}`;mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/public-locator.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,directory,reason:report.reason,age_blocks:report.transaction_age_blocks,search_span_blocks:report.search_span_blocks,nonce_reads:report.locator_nonce_reads,full_block_reads:report.locator_full_block_reads}));
}
