import ganache from 'ganache';
import {Wallet,BrowserProvider,JsonRpcProvider,Contract,ContractFactory,keccak256,Transaction,toQuantity} from 'ethers';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {acquireRuntimeLock} from './runtime-lock.mjs';
import {observeBuyerRefund} from './buyer-refund.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
export const UNIT_WEI=1_000_000_000n; // Test asset scale, NOT a USD conversion.
export function finalityConfiguration({publicNetwork=false,confirmations,finalityMode}={}){
  const mode=finalityMode??(publicNetwork?process.env.ADE_FINALITY_MODE:null)??'confirmations';
  const count=Number(confirmations??(publicNetwork?process.env.ADE_CHAIN_CONFIRMATIONS:null)??(publicNetwork?2:1));
  if(!['confirmations','finalized'].includes(mode)||!Number.isSafeInteger(count)||count<(publicNetwork?2:1)||count>10000)throw new Error('INVALID_FINALITY_POLICY');
  return {mode,confirmations:count};
}
// Only canonical receipts at the configured confirmation boundary authorize a
// local financial transition. RPC errors or reorgs never release reservations.
export async function confirmReceipt(provider,receipt,policy){
  const block=await provider.getBlock(receipt.blockNumber);
  if(!block||block.hash!==receipt.blockHash)throw new Error('CHAIN_REORG_DETECTED');
  const observed=await provider.getBlock(policy.mode==='finalized'?'finalized':'latest');
  if(!observed)throw new Error('CHAIN_FINALITY_PENDING');
  const confirmations=observed.number-receipt.blockNumber+1;
  if(confirmations<(policy.mode==='finalized'?1:policy.confirmations))throw new Error('CHAIN_FINALITY_PENDING');
  const canonical=await provider.getBlock(receipt.blockNumber);
  if(!canonical||canonical.hash!==receipt.blockHash)throw new Error('CHAIN_REORG_DETECTED');
  return {mode:policy.mode,confirmations,requiredConfirmations:policy.mode==='finalized'?1:policy.confirmations,observedBlock:observed.number,observedBlockHash:observed.hash};
}
export async function openChain({directory=null,publicNetwork=false,confirmations,finalityMode,devnetRpc=process.env.ADE_DEVNET_RPC_URL}={}){
  const runtimeLock=directory?acquireRuntimeLock(directory):null;
  let transport,provider;
  try{
  const finalityPolicy=finalityConfiguration({publicNetwork,confirmations,finalityMode});
  const artifact=read('artifacts/deal-escrow/contract.json');
  if(directory)mkdirSync(directory,{recursive:true});
  const keyFile=directory&&path.join(directory,'identities.json');
  const identities=keyFile&&existsSync(keyFile)?read(keyFile):Object.fromEntries(['controller','buyer','seller-a','seller-b'].map(id=>[id,Wallet.createRandom().privateKey]));
  if(keyFile&&!existsSync(keyFile))writeFileSync(keyFile,JSON.stringify(identities),{mode:0o600});
  if(publicNetwork){if(!process.env.SEPOLIA_RPC_URL)throw new Error('SEPOLIA_RPC_URL_REQUIRED');provider=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL,undefined,{cacheTimeout:-1});provider.pollingInterval=2000;if((await provider.getNetwork()).chainId!==11155111n)throw new Error('SEPOLIA_ONLY');}
  else if(devnetRpc){const url=new URL(devnetRpc);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('LOOPBACK_DEVNET_ONLY');provider=new JsonRpcProvider(url.href,undefined,{cacheTimeout:-1});provider.pollingInterval=50;if((await provider.getNetwork()).chainId!==31338n)throw new Error('DEVNET_CHAIN_MISMATCH');}
  else {transport=ganache.provider({logging:{quiet:true},chain:{chainId:31338,hardfork:'shanghai'},wallet:{accounts:Object.values(identities).map(secretKey=>({secretKey,balance:'0x8AC7230489E80000'}))},...(directory?{database:{dbPath:path.join(directory,'chain')}}:{})});provider=new BrowserProvider(transport,undefined,{cacheTimeout:-1});provider.pollingInterval=30;}
  const wallet=new Wallet(identities.controller,provider),sellers=Object.fromEntries(['seller-a','seller-b'].map(id=>[id,new Wallet(identities[id]).address]));
  const chainId=Number((await provider.getNetwork()).chainId),deploymentFile=directory&&path.join(directory,'deployment.json');let deployment,contract;
  if(deploymentFile&&existsSync(deploymentFile)){
    deployment=read(deploymentFile);if(deployment.chainId!==chainId||deployment.sourceSha256!==artifact.sourceSha256||keccak256(await provider.getCode(deployment.contract))!==deployment.runtimeHash)throw new Error('DEPLOYMENT_MISMATCH');contract=new Contract(deployment.contract,artifact.abi,wallet);
  }else{
    if(publicNetwork&&(await provider.getBalance(wallet.address))<100_000_000_000_000n){provider.destroy();const error=new Error('TEST_ETH_REQUIRED');error.address=wallet.address;throw error;}
    contract=await new ContractFactory(artifact.abi,artifact.bytecode,wallet).deploy(wallet.address);await contract.waitForDeployment();
    deployment={schemaVersion:1,chainId,network:publicNetwork?'sepolia':'local-devnet',contract:await contract.getAddress(),controller:wallet.address,buyer:new Wallet(identities.buyer??identities.controller).address,sellers,unitWei:UNIT_WEI.toString(),sourceSha256:artifact.sourceSha256,runtimeHash:keccak256(await provider.getCode(await contract.getAddress())),deploymentTx:contract.deploymentTransaction().hash,createdAt:new Date().toISOString()};
    if(deploymentFile)writeFileSync(deploymentFile,JSON.stringify(deployment,null,2)+'\n');
  }
  // This process owns the runtime directory; direct Engine instances still do
  // not constitute a distributed worker protocol.
  deployment.finality=finalityPolicy;
  if(deploymentFile)writeFileSync(deploymentFile,JSON.stringify(deployment,null,2)+'\n');
  async function prepare(kind,dealHash,deal,attestation){
    if(kind==='fund'&&publicNetwork){
      // Conservative planning estimate, not a guarantee of block timing.
      const confirmationSeconds=finalityPolicy.mode==='finalized'?900:(finalityPolicy.confirmations-1)*12;
      const latest=await provider.getBlock('latest');
      if(!latest||Math.min(deal.deadline,deal.expires_at-latest.timestamp)<=confirmationSeconds+30)throw new Error('DELIVERY_WINDOW_BELOW_FINALITY_BUDGET');
    }
    let request;if(kind==='fund')request=await contract.fund.populateTransaction(dealHash,deployment.buyer,sellers[deal.seller_id],BigInt(deal.price_minor)*UNIT_WEI,deal.deadline,deal.expires_at,{value:BigInt(deal.price_minor)*UNIT_WEI});
    else request=await contract[kind].populateTransaction(dealHash,attestation);
    const populated=await wallet.populateTransaction(request);const raw=await wallet.signTransaction(populated);return {txHash:keccak256(raw),raw,nonce:populated.nonce,preparedBlock:await provider.getBlockNumber(),chainId,contract:deployment.contract};
  }
  function signedIntent(op){const tx=Transaction.from(op.raw);if(tx.hash!==op.txHash||tx.from?.toLowerCase()!==wallet.address.toLowerCase()||tx.to?.toLowerCase()!==deployment.contract.toLowerCase()||Number(tx.chainId)!==chainId)throw new Error('SIGNED_INTENT_MISMATCH');return tx;}
  async function checkedReceipt(op,r){
    signedIntent(op);
    if(r.hash!==op.txHash||r.to?.toLowerCase()!==deployment.contract.toLowerCase()||r.from.toLowerCase()!==wallet.address.toLowerCase())throw new Error('CHAIN_RECEIPT_MISMATCH');
    return {...normalizeReceipt(r),finality:await confirmReceipt(provider,r,finalityPolicy)};
  }
  async function broadcast(op){signedIntent(op);let receipt=await provider.getTransactionReceipt(op.txHash);if(!receipt){try{await provider.broadcastTransaction(op.raw);}catch(e){if(!await provider.getTransaction(op.txHash))throw e;}receipt=await provider.waitForTransaction(op.txHash,1,45000);}if(!receipt)throw new Error('CHAIN_UNKNOWN');const checked=await checkedReceipt(op,receipt);if(receipt.status!==1)throw new Error('CHAIN_REVERTED');return checked;}
  async function inspect(dealHash,blockTag='latest'){const e=await contract.escrows(dealHash,{blockTag});return {buyer:e.buyer,seller:e.seller,amount:e.amount.toString(),deadline:Number(e.deadline),status:Number(e.status)};}
  async function revertedReceipt(op){
    const r=await provider.getTransactionReceipt(op.txHash);
    // A timeout/error string is not evidence of failure. Match the exact signed transaction.
    if(!r||r.status!==0||r.hash!==op.txHash||r.to?.toLowerCase()!==deployment.contract.toLowerCase()||r.from.toLowerCase()!==wallet.address.toLowerCase())return null;
    return checkedReceipt(op,r);
  }
  async function verifyStoredReceipt(op){
    const r=await provider.getTransactionReceipt(op.receipt?.transactionHash??op.txHash);
    if(!r||r.blockHash!==op.receipt?.blockHash)throw new Error('CHAIN_REORG_DETECTED');
    return confirmReceipt(provider,r,finalityPolicy);
  }
  async function reconcile(op,dealHash,kind){
    const signed=signedIntent(op),original=await provider.getTransactionReceipt(op.txHash);
    if(original){const receipt=await checkedReceipt(op,original);return {status:original.status===1?'CONFIRMED':'REVERTED',receipt};}
    const observed=await provider.getBlock(finalityPolicy.mode==='finalized'?'finalized':'latest');
    if(!observed)return {status:'PENDING'};
    const height=finalityPolicy.mode==='finalized'?observed.number:observed.number-finalityPolicy.confirmations+1;
    if(height<0)return {status:'PENDING'};
    const confirmed=await provider.getBlock(height);if(!confirmed)return {status:'PENDING'};
    if(await provider.getTransactionCount(wallet.address,height)<=signed.nonce)return {status:'PENDING'};
    // A higher account nonce is insufficient evidence: locate the exact mined
    // replacement and bind it to a canonical receipt at the finality boundary.
    const start=Number.isInteger(op.preparedBlock)?Math.max(0,op.preparedBlock):Math.max(0,height-2048);
    if(height-start>2048)return {status:'PENDING',reason:'REPLACEMENT_SEARCH_LIMIT'};
    for(let n=height;n>=start;n--){
      const block=await provider.send('eth_getBlockByNumber',[toQuantity(n),true]);
      const replacement=block?.transactions?.find(t=>t.from?.toLowerCase()===wallet.address.toLowerCase()&&Number(BigInt(t.nonce))===signed.nonce);
      if(!replacement)continue;
      const actual=await provider.getTransactionReceipt(replacement.hash);if(!actual)return {status:'PENDING'};
      const finality=await confirmReceipt(provider,actual,finalityPolicy);
      // The original may have appeared while reconciliation read the head.
      if(replacement.hash===op.txHash){const receipt=await checkedReceipt(op,actual);return {status:actual.status===1?'CONFIRMED':'REVERTED',receipt};}
      const escrow=await inspect(dealHash,height),basis=await provider.getBlock(height);
      if(!basis||basis.hash!==confirmed.hash)throw new Error('CHAIN_REORG_DETECTED');
      const decoded=replacement.to?.toLowerCase()===deployment.contract.toLowerCase()?contract.interface.parseTransaction({data:replacement.input??replacement.data,value:replacement.value}):null;
      if(actual.status===1&&decoded?.name===kind&&decoded.args[0]===dealHash){
        if((replacement.input??replacement.data)?.toLowerCase()!==signed.data.toLowerCase()||BigInt(replacement.value)!==signed.value)return {status:'PENDING',reason:'REPLACEMENT_INTENT_MISMATCH'};
        return {status:'CONFIRMED',receipt:{...normalizeReceipt(actual),finality},replacement:{originalTxHash:op.txHash,nonce:signed.nonce,replacementTxHash:replacement.hash}};
      }
      if(escrow.status!==({fund:0,release:1,refund:1}[kind])&&!(kind!=='fund'&&escrow.status===3))return {status:'PENDING',reason:'EXTERNAL_SETTLEMENT_REQUIRES_RECONCILIATION'};
      return {status:'REPLACED',replacement:{originalTxHash:op.txHash,nonce:signed.nonce,replacementTxHash:replacement.hash,receipt:{...normalizeReceipt(actual),finality},escrow,basisBlockNumber:height,basisBlockHash:confirmed.hash,observedBlock:finality.observedBlock,observedBlockHash:finality.observedBlockHash}};
    }
    return {status:'PENDING',reason:'REPLACEMENT_NOT_FOUND'};
  }
  return {provider,contract,wallet,sellers,deployment,finalityPolicy,prepare,broadcast,inspect,revertedReceipt,reconcile,verifyStoredReceipt,observeBuyerRefund:(dealHash,funding,search)=>observeBuyerRefund({provider,contract,deployment,finalityPolicy,confirmReceipt,normalizeReceipt},dealHash,funding,search),async close(){try{provider.destroy();if(transport)await transport.disconnect();}finally{runtimeLock?.release();}}};
  }catch(error){try{provider?.destroy();if(transport)await transport.disconnect();}finally{runtimeLock?.release();}throw error;}
}
export function normalizeReceipt(r){return {transactionHash:r.hash,blockNumber:r.blockNumber,blockHash:r.blockHash,status:r.status,from:r.from,to:r.to,logs:r.logs.map(l=>({address:l.address,topics:[...l.topics],data:l.data}))};}
