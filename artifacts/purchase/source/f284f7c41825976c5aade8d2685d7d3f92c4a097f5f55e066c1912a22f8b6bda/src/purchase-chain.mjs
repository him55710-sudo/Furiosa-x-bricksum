import {Contract,ContractFactory,Wallet,JsonRpcProvider,keccak256,TypedDataEncoder,Transaction} from 'ethers';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {publicReceipt} from './chain.mjs';
import {CONSENT_TYPES,purchaseKey} from '../shared/purchase.mjs';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
export async function deployPurchaseChain(base,{directory='data/private/purchase-devnet'}={}){
  await mkdir(directory,{recursive:true});
  const artifact=await json('artifacts/contracts/PurchaseVault.json');
  const file=path.join(directory,'purchase-deployment.json');let deployment;
  try{deployment=await json(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!deployment){
    const vault=await new ContractFactory(artifact.abi,artifact.bytecode,base.signer).deploy(base.deployment.token,base.signer.address);await vault.waitForDeployment();
    const receipt=await vault.deploymentTransaction().wait();
    const token=new Contract(base.deployment.token,base.artifacts.token.abi,base.signer);
    await (await token.transfer(await vault.getAddress(),20_000_000)).wait();
    deployment={schemaVersion:3,network:base.deployment.network,chainId:base.deployment.chainId,rpcUrl:base.deployment.rpcUrl,token:base.deployment.token,tokenCodeHash:base.deployment.tokenCodeHash,vault:await vault.getAddress(),executor:base.signer.address,deployBlock:receipt.blockNumber,deploymentTx:receipt.hash,sourceSha256:artifact.sourceSha256,compiler:artifact.compiler,settings:artifact.settings,merchantRegistry:base.deployment.merchantRegistry,confirmationRule:base.deployment.chainId===31337?'LOCAL_ONE_BLOCK':'FINALIZED',createdAt:new Date().toISOString()};
    deployment.vaultCodeHash=keccak256(await base.provider.getCode(deployment.vault));
    await writeFile(file,JSON.stringify(deployment,null,2)+'\n');
  }
  deployment.rpcUrl=base.deployment.rpcUrl;
  if(deployment.sourceSha256!==artifact.sourceSha256)throw new Error('PURCHASE_BUILD_CHANGED_USE_NEW_DEPLOYMENT');
  if(keccak256(await base.provider.getCode(deployment.vault))!==deployment.vaultCodeHash)throw new Error('PURCHASE_CODE_MISMATCH');
  return attachPurchaseChain({provider:base.provider,signer:base.signer,deployment,artifact,sellers:base.sellers,serial:base.serial});
}
export function attachPurchaseChain({provider,signer,deployment,artifact,sellers={},serial}){
  let tail=Promise.resolve();serial??=fn=>{const promise=tail.then(fn);tail=promise.catch(()=>{});return promise;};
  const vault=new Contract(deployment.vault,artifact.abi,signer??provider);
  const domain={name:'ControlMemoryPurchase',version:'3',chainId:deployment.chainId,verifyingContract:deployment.vault};
  const key=(owner,id)=>purchaseKey(domain,owner,id);
  const logs=async(event,k)=>provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:'latest',topics:[vault.interface.getEvent(event).topicHash,k]});
  const api={provider,signer,deployment,artifact,sellers,vault,domain,serial,key,
    merchant:id=>deployment.merchantRegistry.find(m=>m.id===id),
    approval:async c=>{const events=await logs('PurchaseApproved',key(c.owner,c.purchaseId));if(!events.length)return null;if(events.length!==1||vault.interface.parseLog(events[0]).args.consentDigest!==TypedDataEncoder.hash(domain,CONSENT_TYPES,c))throw new Error('APPROVAL_CHAIN_MISMATCH');return publicReceipt(await provider.getTransactionReceipt(events[0].transactionHash));},
    approve:async(c,merchants,signature)=>serial(async()=>{const prior=await api.approval(c);return prior??publicReceipt(await(await vault.approvePurchase(c,merchants,signature,{gasLimit:1_000_000})).wait());}),
    state:async(owner,id)=>{const k=key(owner,id);const [active,settled,spent,events]=await Promise.all([vault.active(k),vault.settled(k),vault.spent(k),logs('PurchaseSettled',k)]);if(events.length>1)throw new Error('MULTIPLE_PURCHASE_SETTLEMENTS');const receipt=events.length?publicReceipt(await provider.getTransactionReceipt(events[0].transactionHash)):null;const event=events.length?vault.interface.parseLog(events[0]):null;let finalized=deployment.chainId===31337;
      if(receipt&&!finalized){try{const block=await provider.getBlock('finalized');finalized=!!block&&block.number>=receipt.blockNumber;}catch{}}
      return {active,settled,spent:spent.toString(),receipt,finalized,event:event?{purchaseId:event.args.purchaseId,merchant:event.args.merchant,resourceSpecHash:event.args.resourceSpecHash,offerDigest:event.args.offerDigest,evidenceHash:event.args.evidenceHash,amount:event.args.amount.toString()}:null};},
    prepare:async(record,evidenceHash)=>{
      const fees=await provider.getFeeData();const tx={to:deployment.vault,data:vault.interface.encodeFunctionData('pay',[record.quote,record.signature,evidenceHash]),chainId:deployment.chainId,nonce:await provider.getTransactionCount(signer.address,'pending'),gasLimit:500_000n,gasPrice:fees.gasPrice,type:0};
      const raw=await signer.signTransaction(tx);return {raw,hash:keccak256(raw),nonce:tx.nonce};
    },
    broadcast:async tx=>{const parsed=Transaction.from(tx.raw);if(parsed.hash!==tx.hash||parsed.chainId!==BigInt(deployment.chainId)||parsed.to?.toLowerCase()!==deployment.vault.toLowerCase()||parsed.from!==signer.address)throw new Error('JOURNAL_MISMATCH');const found=await provider.getTransactionReceipt(tx.hash);if(found)return publicReceipt(found);const sent=await provider.broadcastTransaction(tx.raw);return publicReceipt(await sent.wait(1,20000));},
    revoke:async(owner,id,signature)=>serial(async()=>publicReceipt(await(await vault.revokeWithSignature(owner,id,signature,{gasLimit:160000})).wait())),
  };return api;
}
export async function connectPurchaseWorker(directory){
  const config=await json(path.join(directory,'worker-config.json'));
  const identities=await json(path.join(directory,'identities.json'));
  const provider=new JsonRpcProvider(config.deployment.rpcUrl,config.deployment.chainId,{cacheTimeout:-1});provider.pollingInterval=150;
  const signer=new Wallet(identities.executor,provider),artifact=await json('artifacts/contracts/PurchaseVault.json');
  if(artifact.sourceSha256!==config.deployment.sourceSha256||keccak256(await provider.getCode(config.deployment.vault))!==config.deployment.vaultCodeHash)throw new Error('WORKER_BUILD_MISMATCH');
  return {config,chain:attachPurchaseChain({provider,signer,deployment:config.deployment,artifact})};
}
