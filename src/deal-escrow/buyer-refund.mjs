import {hash} from './domain.ts';

const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const check=(condition,reason)=>{if(!condition)throw new Error(reason);};

// A cursor is only a read optimization. Bind it to the original funding and a
// canonical block; never treat scanning progress as proof that money returned.
export async function findBuyerRefundEvent({provider,contract},dealHash,fund,{cursor=null,onProgress=()=>{},blockSpan=1024,maxPages=4}={}){
  check(Number.isSafeInteger(blockSpan)&&blockSpan>=1&&blockSpan<=2048&&Number.isSafeInteger(maxPages)&&maxPages>=1&&maxPages<=16,'BUYER_REFUND_SCAN_CONFIGURATION');
  const head=await provider.getBlock('latest');
  check(head&&head.number>=fund.blockNumber,'BUYER_REFUND_HEAD_UNAVAILABLE');
  const identity={schema_version:1,deal_hash:dealHash,funding_tx_hash:fund.hash,funding_block_hash:fund.blockHash};
  let anchor=cursor;
  if(anchor){
    check(Object.entries(identity).every(([key,value])=>anchor[key]===value)&&Number.isSafeInteger(anchor.through_block)&&anchor.through_block>=fund.blockNumber&&/^0x[0-9a-f]{64}$/i.test(anchor.through_block_hash),'BUYER_REFUND_CURSOR_INVALID');
    const block=anchor.through_block<=head.number?await provider.getBlock(anchor.through_block):null;
    if(!block||block.hash!==anchor.through_block_hash){await onProgress(null);anchor=null;}
  }
  let start=anchor?anchor.through_block+1:fund.blockNumber;
  for(let page=0;page<maxPages&&start<=head.number;page++){
    const end=Math.min(start+blockSpan-1,head.number),before=await provider.getBlock(end);
    check(before,'BUYER_REFUND_BLOCK_UNAVAILABLE');
    const logs=await contract.queryFilter(contract.filters.Refunded(dealHash),start,end);
    const after=await provider.getBlock(end),prior=anchor?await provider.getBlock(anchor.through_block):null;
    if(!after||after.hash!==before.hash||(anchor&&prior?.hash!==anchor.through_block_hash)){
      await onProgress(null);throw new Error('CHAIN_REORG_DETECTED');
    }
    check(Array.isArray(logs)&&logs.length<=1,'BUYER_REFUND_EVENT_AMBIGUOUS');
    if(logs.length){
      check(logs[0].blockNumber>=start&&logs[0].blockNumber<=end,'BUYER_REFUND_EVENT_RANGE_MISMATCH');
      return logs[0];
    }
    anchor={...identity,through_block:end,through_block_hash:after.hash};
    await onProgress(anchor);start=end+1;
  }
  // Maintenance will resume from the persisted cursor. No new signing occurs.
  throw new Error(start<=head.number?'BUYER_REFUND_SEARCH_PENDING':'BUYER_REFUND_EVENT_MISSING');
}

// Read-only observation. A finalized buyer transaction, never a timeout or a
// reported balance, is the authority for releasing the application's reservation.
export async function observeBuyerRefund({provider,contract,deployment,finalityPolicy,confirmReceipt,normalizeReceipt},dealHash,funding,search={}){
  const escrow=await contract.escrows(dealHash);
  if(Number(escrow.status)!==3)return null;
  check(!same(deployment.buyer,deployment.controller),'BUYER_CONTROLLER_NOT_SEPARATE');
  const fund=await provider.getTransactionReceipt(funding.txHash);
  check(fund?.status===1&&same(fund.to,deployment.contract)&&same(fund.from,deployment.controller),'BUYER_REFUND_FUNDING_MISMATCH');
  check(fund.blockHash===funding.receipt.blockHash,'CHAIN_REORG_DETECTED');
  await confirmReceipt(provider,fund,finalityPolicy);
  const log=await findBuyerRefundEvent({provider,contract},dealHash,fund,search);
  const mined=await provider.getTransactionReceipt(log.transactionHash),tx=await provider.getTransaction(log.transactionHash);
  check(mined?.status===1&&tx&&same(mined.to,deployment.contract)&&same(mined.from,deployment.buyer)&&same(tx.from,deployment.buyer),'BUYER_REFUND_SENDER_MISMATCH');
  check(mined.hash===log.transactionHash&&tx.hash===log.transactionHash&&mined.blockNumber===log.blockNumber&&mined.blockHash===log.blockHash,'BUYER_REFUND_EVENT_RECEIPT_MISMATCH');
  const finality=await confirmReceipt(provider,mined,finalityPolicy),block=await provider.getBlock(mined.blockNumber);
  check(block?.hash===mined.blockHash,'CHAIN_REORG_DETECTED');
  const decoded=contract.interface.parseTransaction({data:tx.data,value:tx.value}),reason=log.args.reasonHash;
  check(decoded?.name==='refund'&&decoded.args[0]===dealHash&&decoded.args[1]===reason&&tx.value===0n&&Number(tx.chainId)===deployment.chainId,'BUYER_REFUND_CALL_MISMATCH');
  check(same(escrow.buyer,deployment.buyer)&&block.timestamp>=Number(escrow.deadline)&&log.args.amount===escrow.amount,'BUYER_REFUND_DEADLINE_MISMATCH');
  const confirmedLogs=mined.logs.filter(l=>same(l.address,deployment.contract)).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).filter(l=>l?.name==='Refunded'&&l.args.dealHash===dealHash);
  check(confirmedLogs.length===1&&confirmedLogs[0].args.reasonHash===reason&&confirmedLogs[0].args.amount===escrow.amount,'BUYER_REFUND_EVENT_RECEIPT_MISMATCH');
  const funded=fund.logs.filter(l=>same(l.address,deployment.contract)).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).find(l=>l?.name==='Funded'&&l.args.dealHash===dealHash);
  check(funded&&same(funded.args.buyer,escrow.buyer)&&same(funded.args.seller,escrow.seller)&&funded.args.amount===escrow.amount&&funded.args.deadline===escrow.deadline,'BUYER_REFUND_ESCROW_MISMATCH');
  return {status:'CONFIRMED',actor:'buyer',txHash:tx.hash,receipt:{...normalizeReceipt(mined),finality},claim:{kind:'refund',deal_hash:dealHash,tx_hash:tx.hash,chain_id:Number(tx.chainId),contract:tx.to,sender:tx.from,nonce:tx.nonce,value_wei:'0',calldata_hash:hash(tx.data),attestation_hash:reason},proof:{schema_version:1,deal_hash:dealHash,funding_tx_hash:fund.hash,refund_tx_hash:tx.hash,buyer:escrow.buyer,seller:escrow.seller,amount_wei:escrow.amount.toString(),deadline:Number(escrow.deadline),refund_block_timestamp:block.timestamp,reason_hash:reason},escrow:{buyer:escrow.buyer,seller:escrow.seller,amount:escrow.amount.toString(),deadline:Number(escrow.deadline),status:3}};
}
