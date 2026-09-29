import {BrowserProvider,Contract,ContractFactory,Wallet,keccak256,toUtf8Bytes,getCreateAddress,randomBytes,hexlify} from 'ethers';
import artifact from '../../artifacts/deal-escrow/contract.json' with {type:'json'};
export const digest=value=>keccak256(toUtf8Bytes(JSON.stringify(value)));
let loading;
const progress=message=>globalThis.dispatchEvent?.(new CustomEvent('accord-operation-progress',{detail:message}));
export function loadGanache(){return loading??=new Promise((resolve,reject)=>{
 if(globalThis.Ganache){resolve(globalThis.Ganache);return;}
 const script=document.createElement('script');script.src='/vendor/ganache-7.9.2.min.js';script.onload=()=>resolve(globalThis.Ganache);script.onerror=()=>{loading=null;script.remove();reject(Error('The browser EVM could not load. Check your connection and retry.'));};document.head.append(script);
});}
export async function openBrowserChain(state,save,{ganacheLoader=loadGanache,dbPath='accord-lock-evm-v1'}={}){
 progress('Loading the private EVM runtime for this browser…');
 const Ganache=await ganacheLoader();
 if(!state.chain){state.chain={seed:hexlify(randomBytes(32)),contract:null,deployment:null};await save();}
 const transport=Ganache.provider({chain:{chainId:31338,networkId:31338,hardfork:'shanghai'},database:{dbPath},wallet:{seed:state.chain.seed,totalAccounts:4,defaultBalance:1000},logging:{quiet:true}});
 const provider=new BrowserProvider(transport,undefined,{cacheTimeout:-1});provider.pollingInterval=25;
 try{
  progress('Opening your saved private chain…');
  await transport.request({method:'eth_chainId',params:[]});
  const accounts=Object.values(transport.getInitialAccounts());const controller=new Wallet(accounts[0].secretKey,provider),buyer=new Wallet(accounts[1].secretKey).address,sellers={'seller-a':new Wallet(accounts[2].secretKey).address,'seller-b':new Wallet(accounts[3].secretKey).address};
  const signed=async request=>{const raw=await controller.signTransaction(await controller.populateTransaction(request));return {raw,hash:keccak256(raw),status:'PENDING'};};
  async function confirm(op){
   let receipt=await provider.getTransactionReceipt(op.hash);
   if(!receipt){await transport.request({method:'eth_sendRawTransaction',params:[op.raw]});receipt=await provider.getTransactionReceipt(op.hash);}
   if(!receipt)throw Error('The transaction is pending. Retry confirmation for the same task.');
   if(receipt.status!==1)throw Error('The EVM rejected this transaction. Funds were not paid.');
   return receipt;
  }
  if(!state.chain.contract){
   progress('Creating your escrow contract · first use only…');
   if(!state.chain.deployment){const factory=new ContractFactory(artifact.abi,artifact.bytecode,controller);const transaction=await factory.getDeployTransaction(controller.address);const nonce=await provider.getTransactionCount(controller.address);state.chain.deployment=await signed({...transaction,nonce});state.chain.expectedContract=getCreateAddress({from:controller.address,nonce});await save();}
   const deployed=await confirm(state.chain.deployment);state.chain.contract=deployed.contractAddress??state.chain.expectedContract;state.chain.deployment={...state.chain.deployment,status:'CONFIRMED',block:deployed.blockNumber};await save();
  }
  if(await provider.getCode(state.chain.contract)==='0x')throw Error('The browser chain is missing its escrow contract. Restore this site’s storage before continuing.');
  const contract=new Contract(state.chain.contract,artifact.abi,controller);
  const network={name:'Browser EVM',mode:'BROWSER_EVM',chainId:31338,contract:state.chain.contract,controller:controller.address,buyer,sellers,unit:'gwei',unitWei:'1000000000'};
  async function transact(job,kind){
   progress(`Checking the ${kind==='fund'?'escrow funding':kind==='release'?'seller payment':'buyer refund'} transaction…`);
   const records=state.operations[job.id]??=Object.create(null);let op=records[kind];
   if(!op){const value=BigInt(job.agreedPrice)*1000000000n;const args=kind==='fund'?[job.dealHash,buyer,sellers[job.selected],value,job.deliveryMinutes*60,job.agreement.expiresAt]:[job.dealHash,job.attestationHash];
    op=records[kind]=await signed({to:network.contract,data:contract.interface.encodeFunctionData(kind,args),value:kind==='fund'?value:0n});
    job.transactions.push({kind,status:'PENDING',hash:op.hash,block:null,amount:job.agreedPrice});await save();
   }
   progress(`Confirming ${op.hash.slice(0,12)}… on your browser EVM…`);
   const receipt=await confirm(op),escrow=await contract.escrows(job.dealHash);const expected={fund:1,release:2,refund:3}[kind];
   if(Number(escrow.status)!==expected)throw Error('The escrow outcome does not match the requested action.');
   op.status='CONFIRMED';op.receipt={transactionHash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:receipt.status,logs:receipt.logs.map(l=>({address:l.address,topics:[...l.topics],data:l.data}))};
   Object.assign(job.transactions.find(x=>x.kind===kind),{status:'CONFIRMED',block:receipt.blockNumber});job.deadline=Number(escrow.deadline);job.chainState={fund:'ESCROW_FUNDED',release:'SETTLED',refund:'REFUNDED'}[kind];await save();return escrow;
  }
  async function verify(job){
   const checks=[];const ensure=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
   try{
    ensure(digest(job.agreement)===job.dealHash,'Agreement hash matches the escrow');
    ensure(job.agreement.price===job.agreedPrice&&job.agreement.seller===job.selected,'Amount and seller match the agreement');
    ensure(job.agreement.sourceHash===digest(job.source),'Source table matches the committed input');
    const escrow=await contract.escrows(job.dealHash);ensure(escrow.amount===BigInt(job.agreedPrice)*1000000000n&&escrow.buyer===buyer&&escrow.seller===sellers[job.selected],'Exact principal and participants match the contract');
    ensure(Number(escrow.status)===({COMPLETED:2,REFUNDED:3}[job.status]??1),'Stored outcome matches the contract');
    for(const tx of job.transactions){ensure(tx.status==='CONFIRMED','Transaction is confirmed');const r=await provider.getTransactionReceipt(tx.hash);const op=state.operations[job.id]?.[tx.kind];ensure(r?.status===1&&r.blockHash===op?.receipt?.blockHash,'Canonical receipt matches the stored block');
     const log=r.logs.filter(l=>l.address.toLowerCase()===network.contract.toLowerCase()).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).find(l=>l?.name===({fund:'Funded',release:'Released',refund:'Refunded'}[tx.kind]));
     ensure(log&&log.args[0]===job.dealHash,'Contract event binds the deal');
     if(tx.kind!=='fund')ensure(log.args[1]===job.attestationHash&&digest(job.attestation)===job.attestationHash,'Settlement binds its evidence');
    }
    if(job.status==='COMPLETED')ensure(job.attestation.outputHash===digest(job.output)&&job.attestation.invoice===job.agreedPrice,'Paid result and invoice match the approved evidence');
    return {verdict:'VALID',scope:'Receipts and contract state on this browser’s private EVM. The browser controller is trusted; this is not public-chain consensus.',checks:[...new Set(checks)],checked_at:new Date().toISOString()};
   }catch(error){return {verdict:'INVALID',reason:error.message,checks:[...new Set(checks)],scope:'Browser EVM verification'};}
  }
  return {network,transact,verify,close:async()=>{provider.destroy();await transport.disconnect();}};
 }catch(error){provider.destroy();await transport.disconnect();throw error;}
}
