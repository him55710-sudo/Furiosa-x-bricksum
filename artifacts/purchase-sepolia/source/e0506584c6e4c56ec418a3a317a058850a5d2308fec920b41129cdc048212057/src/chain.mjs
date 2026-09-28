import ganache from 'ganache';
import {Wallet,JsonRpcProvider,Contract,ContractFactory,keccak256,TypedDataEncoder,Transaction} from 'ethers';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {OFFER_TYPES,MANDATE_TYPES} from '../shared/schema.mjs';
const json = async p=>JSON.parse(await readFile(p,'utf8'));
export const publicReceipt=r=>({hash:r.hash,blockHash:r.blockHash,blockNumber:r.blockNumber,status:r.status,gasUsed:r.gasUsed.toString(),index:r.index,logs:r.logs.map(l=>({address:l.address,topics:[...l.topics],data:l.data,index:l.index,transactionHash:l.transactionHash,blockNumber:l.blockNumber}))});

export async function startChain({directory='data/private/devnet',port=8545,persist=true}={}) {
  await mkdir(directory,{recursive:true});
  const keysPath=path.join(directory,'identities.json');let identities;
  try{identities=await json(keysPath);}catch(e){if(e.code!=='ENOENT')throw e;identities=Object.fromEntries(['executor','alpha','beta','gamma','outsider'].map(n=>[n,Wallet.createRandom().privateKey]));await writeFile(keysPath,JSON.stringify(identities),{mode:0o600});}
  const server=ganache.server({chain:{chainId:31337,networkId:31337,hardfork:'shanghai'},wallet:{accounts:Object.values(identities).map(secretKey=>({secretKey,balance:'0x3635c9adc5dea00000'})),lock:true},logging:{quiet:true},...(persist?{database:{dbPath:path.join(directory,'chain')}}:{})});
  await server.listen(port,'127.0.0.1');
  port=server.address().port;
  const provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,31337,{cacheTimeout:-1});provider.pollingInterval=150;
  const signer=new Wallet(identities.executor,provider);
  const sellers=Object.fromEntries(Object.entries(identities).filter(([n])=>n!=='executor').map(([n,k])=>[n,new Wallet(k)]));
  const artifacts={token:await json('artifacts/contracts/TestCredit.json'),vault:await json('artifacts/contracts/BudgetVault.json')};
  const manifestPath=path.join(directory,'deployment.json');let deployment;
  try{deployment=await json(manifestPath);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!deployment){
    const token=await new ContractFactory(artifacts.token.abi,artifacts.token.bytecode,signer).deploy(signer.address);await token.waitForDeployment();
    const vault=await new ContractFactory(artifacts.vault.abi,artifacts.vault.bytecode,signer).deploy(await token.getAddress(),signer.address);await vault.waitForDeployment();
    const funded=await token.transfer(await vault.getAddress(),50_000_000);await funded.wait();
    const receipt=await vault.deploymentTransaction().wait();
    deployment={schemaVersion:1,network:'local EVM devnet',chainId:31337,rpcUrl:`http://127.0.0.1:${port}`,vault:await vault.getAddress(),token:await token.getAddress(),executor:signer.address,deployBlock:receipt.blockNumber,deploymentTx:receipt.hash,createdAt:new Date().toISOString(),compiler:artifacts.vault.compiler,sourceSha256:artifacts.vault.sourceSha256,settings:artifacts.vault.settings,merchantRegistry:Object.entries(sellers).map(([id,w])=>({id,address:w.address,name:{alpha:'Alpha Compute',beta:'Beta Data',gamma:'Gamma Cloud',outsider:'Unknown Seller'}[id]}))};
    deployment.vaultCodeHash=keccak256(await provider.getCode(deployment.vault));deployment.tokenCodeHash=keccak256(await provider.getCode(deployment.token));
    await writeFile(manifestPath,JSON.stringify(deployment,null,2)+'\n');
  }
  if(deployment.sourceSha256!==artifacts.vault.sourceSha256)throw new Error('DEVNET_BUILD_CHANGED_USE_NEW_DATA_DIRECTORY');
  if(keccak256(await provider.getCode(deployment.vault))!==deployment.vaultCodeHash)throw new Error('DEVNET_CODE_MISMATCH');
  deployment.rpcUrl=`http://127.0.0.1:${port}`;
  const vault=new Contract(deployment.vault,artifacts.vault.abi,signer);
  const domain={name:'ControlMemory',version:'1',chainId:31337,verifyingContract:deployment.vault};
  let tail=Promise.resolve();
  const serial=fn=>{const job=tail.then(fn);tail=job.catch(()=>{});return job;};
  const chain={server,provider,signer,vault,domain,deployment,artifacts,sellers,serial,
    merchant:id=>deployment.merchantRegistry.find(x=>x.id===id),
    signOffer:async(id,offer)=>({offer,signature:await sellers[id].signTypedData(domain,OFFER_TYPES,offer)}),
    create:async(m,addresses,sig)=>serial(async()=>{
      // A lost approval response must not create a second allocation.
      const found=await provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:'latest',topics:[vault.interface.getEvent('MandateCreated').topicHash,m.sessionId]});
      if(found.length){
        const event=vault.interface.parseLog(found[0]);
        if(found.length!==1||event.args.mandateDigest!==TypedDataEncoder.hash(domain,MANDATE_TYPES,m))throw new Error('APPROVAL_CHAIN_MISMATCH');
        return publicReceipt(await provider.getTransactionReceipt(found[0].transactionHash));
      }
      return publicReceipt(await (await vault.createMandate(m,addresses,sig,{gasLimit:1_500_000})).wait());
    }),
    revoke:async(id,sig)=>serial(async()=>publicReceipt(await (await vault.revoke(id,sig,{gasLimit:200_000})).wait())),
    prepare:async(record,paymentKey,evidenceHash)=>{
      const tx={to:deployment.vault,data:vault.interface.encodeFunctionData('executePayment',[record.offer,record.signature,paymentKey,evidenceHash]),chainId:31337,nonce:await provider.getTransactionCount(signer.address,'pending'),gasLimit:600_000n,gasPrice:(await provider.getFeeData()).gasPrice,type:0};
      const raw=await signer.signTransaction(tx);return {raw,hash:keccak256(raw),nonce:tx.nonce};
    },
    broadcast:async tx=>{const prior=await provider.getTransactionReceipt(tx.hash);if(prior)return publicReceipt(prior);const sent=await provider.broadcastTransaction(tx.raw);const r=await sent.wait(1,20_000);return publicReceipt(r);},
    reconcile:async(tx,paymentKey)=>{
      const signed=Transaction.from(tx.raw);
      if(signed.hash!==tx.hash||signed.nonce!==tx.nonce||signed.from!==signer.address)throw new Error('JOURNALED_TRANSACTION_MISMATCH');
      const receipt=await provider.getTransactionReceipt(tx.hash);if(receipt)return {status:'RECEIPT',receipt:publicReceipt(receipt)};
      const block=await provider.getBlock('latest');if(!block)throw new Error('CHAIN_CONFIRMATION_PENDING');
      const confirmedNonce=await provider.getTransactionCount(signer.address,block.number);
      const used=await vault.usedPayments(paymentKey,{blockTag:block.number});
      // This is a local-devnet confirmation rule. An unmined pending nonce alone
      // is never proof of cancellation; require a mined replacement and no payment.
      if(confirmedNonce>signed.nonce&&!used)return {status:'NONCE_CONSUMED',transactionHash:tx.hash,nonce:signed.nonce,confirmedNonce,blockNumber:block.number,blockHash:block.hash,paymentKey,usedPayment:false};
      return {status:'PENDING'};
    },
    close:async()=>{provider.destroy();await server.close();},
  };
  return chain;
}
