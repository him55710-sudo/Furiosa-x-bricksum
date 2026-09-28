import {isAddress,toQuantity} from 'ethers';

// Historical account nonces locate a candidate only. Callers must still verify
// its receipt, exact intent, finality and application state before settling.
export async function findMinedNonce(provider,{sender,nonce,fromBlock=0,basis}){
  const hash=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
  if(!isAddress(sender)||!Number.isSafeInteger(nonce)||nonce<0||!Number.isSafeInteger(fromBlock)||fromBlock<0||!Number.isSafeInteger(basis?.number)||basis.number<0||!hash(basis.hash))throw new Error('INVALID_NONCE_SEARCH');
  let nonceReads=0;
  async function count(block){
    nonceReads++;
    const value=await provider.getTransactionCount(sender,block);
    if(!Number.isSafeInteger(value)||value<0)throw new Error('INVALID_HISTORICAL_NONCE');
    return value;
  }
  if(await count(basis.number)<=nonce)return null;
  let low=Math.min(fromBlock,basis.number),high=basis.number;
  // A stale hint must not exclude the transaction. Historical nonce is
  // monotone on the pinned canonical chain, so search for its first increase.
  if(low>0)low=await count(low)>nonce?0:low+1;
  while(low<high){
    const middle=low+Math.floor((high-low)/2);
    if(await count(middle)>nonce)high=middle;else low=middle+1;
  }
  const block=await provider.send('eth_getBlockByNumber',[toQuantity(low),true]);
  if(!block||!hash(block.hash)||BigInt(block.number)!==BigInt(low)||!Array.isArray(block.transactions))throw new Error('NONCE_BLOCK_UNAVAILABLE');
  const matches=block.transactions.filter(tx=>tx&&typeof tx==='object'&&tx.from?.toLowerCase()===sender.toLowerCase()&&BigInt(tx.nonce)===BigInt(nonce));
  // An account nonce alone (including an EIP-7702 authorization) does not
  // establish a mined transaction from this sender. Fail closed when absent.
  if(matches.length!==1)throw new Error('NONCE_TRANSACTION_NOT_UNIQUE');
  const transaction=matches[0];
  if(!hash(transaction.hash)||transaction.blockHash!==block.hash||BigInt(transaction.blockNumber)!==BigInt(low))throw new Error('NONCE_TRANSACTION_BLOCK_MISMATCH');
  const canonical=await provider.getBlock(low),pinned=await provider.getBlock(basis.number);
  if(canonical?.hash!==block.hash||pinned?.hash!==basis.hash)throw new Error('CHAIN_REORG_DETECTED');
  return {transaction,blockNumber:low,blockHash:block.hash,basis,nonceReads,fullBlockReads:1};
}
