import {hash} from './domain.ts';

const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const check=(condition,reason)=>{if(!condition)throw new Error(reason);};

// Read-only observation. A finalized buyer transaction, never a timeout or a
// reported balance, is the authority for releasing the application's reservation.
export async function observeBuyerRefund({provider,contract,deployment,finalityPolicy,confirmReceipt,normalizeReceipt},dealHash,funding){
  const escrow=await contract.escrows(dealHash);
  if(Number(escrow.status)!==3)return null;
  check(!same(deployment.buyer,deployment.controller),'BUYER_CONTROLLER_NOT_SEPARATE');
  const fund=await provider.getTransactionReceipt(funding.txHash);
  check(fund?.status===1&&same(fund.to,deployment.contract)&&same(fund.from,deployment.controller),'BUYER_REFUND_FUNDING_MISMATCH');
  check(fund.blockHash===funding.receipt.blockHash,'CHAIN_REORG_DETECTED');
  await confirmReceipt(provider,fund,finalityPolicy);
  const head=await provider.getBlock('latest');
  check(head&&head.number-fund.blockNumber<=2048,'BUYER_REFUND_SEARCH_LIMIT');
  const logs=await contract.queryFilter(contract.filters.Refunded(dealHash),fund.blockNumber,head.number);
  check(logs.length===1,'BUYER_REFUND_EVENT_MISSING');
  const mined=await provider.getTransactionReceipt(logs[0].transactionHash),tx=await provider.getTransaction(logs[0].transactionHash);
  check(mined?.status===1&&tx&&same(mined.to,deployment.contract)&&same(mined.from,deployment.buyer)&&same(tx.from,deployment.buyer),'BUYER_REFUND_SENDER_MISMATCH');
  const finality=await confirmReceipt(provider,mined,finalityPolicy),block=await provider.getBlock(mined.blockNumber);
  check(block?.hash===mined.blockHash,'CHAIN_REORG_DETECTED');
  const decoded=contract.interface.parseTransaction({data:tx.data,value:tx.value}),reason=logs[0].args.reasonHash;
  check(decoded?.name==='refund'&&decoded.args[0]===dealHash&&decoded.args[1]===reason&&tx.value===0n&&Number(tx.chainId)===deployment.chainId,'BUYER_REFUND_CALL_MISMATCH');
  check(same(escrow.buyer,deployment.buyer)&&block.timestamp>=Number(escrow.deadline)&&logs[0].args.amount===escrow.amount,'BUYER_REFUND_DEADLINE_MISMATCH');
  const funded=fund.logs.filter(l=>same(l.address,deployment.contract)).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).find(l=>l?.name==='Funded'&&l.args.dealHash===dealHash);
  check(funded&&same(funded.args.buyer,escrow.buyer)&&same(funded.args.seller,escrow.seller)&&funded.args.amount===escrow.amount&&funded.args.deadline===escrow.deadline,'BUYER_REFUND_ESCROW_MISMATCH');
  return {status:'CONFIRMED',actor:'buyer',txHash:tx.hash,receipt:{...normalizeReceipt(mined),finality},claim:{kind:'refund',deal_hash:dealHash,tx_hash:tx.hash,chain_id:Number(tx.chainId),contract:tx.to,sender:tx.from,nonce:tx.nonce,value_wei:'0',calldata_hash:hash(tx.data),attestation_hash:reason},proof:{schema_version:1,deal_hash:dealHash,funding_tx_hash:fund.hash,refund_tx_hash:tx.hash,buyer:escrow.buyer,seller:escrow.seller,amount_wei:escrow.amount.toString(),deadline:Number(escrow.deadline),refund_block_timestamp:block.timestamp,reason_hash:reason},escrow:{buyer:escrow.buyer,seller:escrow.seller,amount:escrow.amount.toString(),deadline:Number(escrow.deadline),status:3}};
}
