import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Wallet,JsonRpcProvider,ContractFactory,formatEther,keccak256} from 'ethers';
import {deployPurchaseChain} from '../src/purchase-chain.mjs';
const directory=path.resolve('data/private/purchase-sepolia');await mkdir(directory,{recursive:true});
const json=async file=>JSON.parse(await readFile(file,'utf8'));
let identities;try{identities=await json(path.join(directory,'identities.json'));}catch(e){if(e.code!=='ENOENT')throw e;identities=Object.fromEntries(['executor','alpha','beta','gamma','outsider','owner'].map(id=>[id,Wallet.createRandom().privateKey]));await writeFile(path.join(directory,'identities.json'),JSON.stringify(identities),{mode:0o600});}
const rpcUrl=process.env.SEPOLIA_RPC_URL??'https://ethereum-sepolia-rpc.publicnode.com';
const provider=new JsonRpcProvider(rpcUrl,undefined,{cacheTimeout:-1});provider.pollingInterval=3000;
try{
  const network=await provider.getNetwork();if(network.chainId!==11155111n)throw new Error('SEPOLIA_ONLY');
  const signer=new Wallet(identities.executor,provider),balance=await provider.getBalance(signer.address);
  console.log(JSON.stringify({network:'Ethereum Sepolia',chainId:11155111,address:signer.address,balanceTestETH:formatEther(balance),privateKeys:'stored locally; never exported'},null,2));
  if(process.argv.includes('--deploy')){
    if(balance===0n)throw new Error('SEPOLIA_TEST_ETH_REQUIRED');
    const tokenArtifact=await json('artifacts/contracts/TestCredit.json');let tokenDeployment;
    const tokenFile=path.join(directory,'token-deployment.json');try{tokenDeployment=await json(tokenFile);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!tokenDeployment){const token=await new ContractFactory(tokenArtifact.abi,tokenArtifact.bytecode,signer).deploy(signer.address);await token.waitForDeployment();tokenDeployment={token:await token.getAddress(),transactionHash:token.deploymentTransaction().hash};await writeFile(tokenFile,JSON.stringify(tokenDeployment,null,2)+'\n');}
    const sellers=Object.fromEntries(['alpha','beta','gamma','outsider'].map(id=>[id,new Wallet(identities[id])]));
    const base={provider,signer,sellers,artifacts:{token:tokenArtifact},deployment:{network:'Ethereum Sepolia testnet',chainId:11155111,rpcUrl,token:tokenDeployment.token,tokenCodeHash:keccak256(await provider.getCode(tokenDeployment.token)),merchantRegistry:Object.entries(sellers).map(([id,w])=>({id,address:w.address,name:id==='beta'?'Research Data Demo':id}))}};
    const chain=await deployPurchaseChain(base,{directory});
    await mkdir('artifacts/purchase-sepolia',{recursive:true});await writeFile('artifacts/purchase-sepolia/deployment.json',JSON.stringify({...chain.deployment,rpcUrl:'REQUIRES_INDEPENDENT_RPC'},null,2)+'\n');
    console.log(JSON.stringify({deployed:chain.deployment.vault,transactionHash:chain.deployment.deploymentTx,sourceSha256:chain.deployment.sourceSha256},null,2));
  }
}finally{provider.destroy();}
