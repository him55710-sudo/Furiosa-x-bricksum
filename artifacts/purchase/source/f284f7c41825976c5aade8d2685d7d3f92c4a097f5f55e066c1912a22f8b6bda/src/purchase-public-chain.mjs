import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Wallet,JsonRpcProvider,keccak256} from 'ethers';
import {attachPurchaseChain} from './purchase-chain.mjs';
export async function openSepoliaPurchaseChain(directory){
  const json=async file=>JSON.parse(await readFile(path.join(directory,file),'utf8'));
  const [deployment,identities]=await Promise.all([json('purchase-deployment.json'),json('identities.json')]);
  if(deployment.chainId!==11155111)throw new Error('SEPOLIA_ONLY');
  const rpcUrl=process.env.SEPOLIA_RPC_URL??deployment.rpcUrl;
  const provider=new JsonRpcProvider(rpcUrl,undefined,{cacheTimeout:-1});provider.pollingInterval=3000;
  const network=await provider.getNetwork();if(network.chainId!==11155111n){provider.destroy();throw new Error('SEPOLIA_ONLY');}
  const artifact=JSON.parse(await readFile('artifacts/contracts/PurchaseVault.json','utf8'));
  if(deployment.sourceSha256!==artifact.sourceSha256||keccak256(await provider.getCode(deployment.vault))!==deployment.vaultCodeHash){provider.destroy();throw new Error('PUBLIC_DEPLOYMENT_MISMATCH');}
  deployment.rpcUrl=rpcUrl;
  const signer=new Wallet(identities.executor,provider),sellers=Object.fromEntries(['alpha','beta','gamma','outsider'].map(id=>[id,new Wallet(identities[id])]));
  return {chain:attachPurchaseChain({provider,signer,deployment,artifact,sellers}),close:async()=>provider.destroy()};
}
