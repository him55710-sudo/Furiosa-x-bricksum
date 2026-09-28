// Existing free Sepolia assets only. No faucet, purchases, or mainnet endpoints.
import {existsSync} from 'node:fs';import path from 'node:path';
import {Wallet,JsonRpcProvider,Transaction,keccak256,parseEther} from 'ethers';
import {readJson,saveJson} from '../src/deal-escrow/public-run.mjs';
import {acquireRuntimeLock} from '../src/deal-escrow/runtime-lock.mjs';
const source=process.env.ADE_EXISTING_PUBLIC_DIRECTORY;if(!source)throw new Error('EXISTING_PUBLIC_DIRECTORY_REQUIRED');
const directory='data/private/deal-escrow/source-sepolia',file=`${directory}/identities.json`;
if(!existsSync(file))saveJson(file,Object.fromEntries(['controller','buyer','seller-a','seller-b'].map(id=>[id,Wallet.createRandom().privateKey])));
const identities=readJson(file),sourceLock=acquireRuntimeLock(source),destinationLock=acquireRuntimeLock(directory);
const provider=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1});provider.pollingInterval=2000;
try{
  if((await provider.getNetwork()).chainId!==11155111n)throw new Error('SEPOLIA_ONLY');
  const from=new Wallet(readJson(path.join(source,'identities.json')).controller,provider);
  if(from.address!=='0xE3e6E3451Ef871546a08339F0da42A2C07a5a2A9')throw new Error('EXISTING_DEMO_WALLET_MISMATCH');
  const results=[];
  for(const [role,amount,intentName] of [['controller','0.001','controller'],['buyer','0.0001','buyer'],['controller','0.002','deployment-gas-topup']]){
    const to=new Wallet(identities[role]).address,journal=`${directory}/funding-${intentName}.json`;
    let intent=existsSync(journal)?readJson(journal):null;
    if(!intent){
      const nonce=await provider.getTransactionCount(from.address);
      if(nonce!==await provider.getTransactionCount(from.address,'pending'))throw new Error('SOURCE_HAS_PENDING_TRANSACTION');
      const request=await from.populateTransaction({to,value:parseEther(amount),nonce});
      if(await provider.getBalance(from.address)<request.value+request.gasLimit*(request.maxFeePerGas??request.gasPrice))throw new Error('INSUFFICIENT_FREE_TEST_ASSETS');
      const raw=await from.signTransaction(request);intent={txHash:keccak256(raw),raw};saveJson(journal,intent);
    }
    const tx=Transaction.from(intent.raw);
    if(tx.hash!==intent.txHash||tx.from!==from.address||tx.to!==to||tx.chainId!==11155111n||tx.value!==parseEther(amount))throw new Error('SIGNED_INTENT_MISMATCH');
    let r=await provider.getTransactionReceipt(intent.txHash);
    if(!r){if(!await provider.getTransaction(intent.txHash))await provider.broadcastTransaction(intent.raw);r=await provider.waitForTransaction(intent.txHash,2,120000);}
    if(!r||r.status!==1)throw new Error('FUNDING_UNCONFIRMED');
    results.push({role,destination:to,test_eth:amount,tx_hash:r.hash,block:r.blockNumber});
    console.log(JSON.stringify({stage:'FUNDED_DEMO_IDENTITY',...results.at(-1)}));
  }
  saveJson('artifacts/deal-escrow/source-sepolia/funding.json',{network:'sepolia',source:from.address,results,note:'Previously acquired free test assets. Operator-funded demo principal and gas; no user bank deposit.'});
}finally{provider.destroy();destinationLock.release();sourceLock.release();}
