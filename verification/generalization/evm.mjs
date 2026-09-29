// Test-only local chain. Deterministic keys MUST NEVER be used on a public network.
import ganache from 'ganache';
import {Wallet,BrowserProvider,ContractFactory,ZeroHash,id} from 'ethers';
import {readFileSync} from 'node:fs';
import {hash} from '../../src/deal-escrow/domain.ts';
import {vaultDomain,signTyped,digest,sellerListHash} from '../../src/dealtrace/vault.mjs';

export async function laboratory(seed,chainId=31338){
 const actors=Object.fromEntries(['relayer','buyer','agent','seller','other','evaluator'].map(n=>[n,new Wallet(id(`LOCAL-TEST-ONLY:${seed}:${n}`))]));
 const raw=ganache.provider({logging:{quiet:true},chain:{chainId,hardfork:'shanghai',time:new Date('2026-01-01T00:00:00Z')},miner:{timestampIncrement:1},wallet:{accounts:Object.values(actors).map(w=>({secretKey:w.privateKey,balance:'0x3635c9adc5dea00000'}))}});
 const provider=new BrowserProvider(raw,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 const artifact=JSON.parse(readFileSync('artifacts/dealtrace/vault/contract.json'));
 const signer=await provider.getSigner(actors.relayer.address),vault=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy();await vault.waitForDeployment();
 const address=await vault.getAddress(),domain=vaultDomain(chainId,address);let nonce=0;
 const sign=(name,type,body)=>signTyped(actors[name],domain,type,body);
 const transactions=[];
 async function send(method,args=[],value=0n,who='relayer'){
  // Explicit gas limit causes rejections to be mined, rather than only simulated.
  const c=vault.connect(await provider.getSigner(actors[who].address));
  const tx=await c[method](...args,{gasLimit:1500000,value});let receipt;
  try{receipt=await tx.wait();}catch(e){if(!e.receipt)throw e;receipt=e.receipt;}
  const r={method,hash:receipt.hash,block:receipt.blockNumber,status:receipt.status,gas_used:receipt.gasUsed.toString()};transactions.push(r);return r.status===1;
 }
 async function open({budget,cap,validFor=1000,badSignature=false,seller='seller',sellerAddress=actors[seller].address,agentAddress=actors.agent.address}){
  const time=Number((await raw.request({method:'eth_getBlockByNumber',params:['latest',false]})).timestamp);
  const sellers=[sellerAddress],m={buyer:actors.buyer.address,agent:agentAddress,evaluator:actors.evaluator.address,sellersHash:sellerListHash(sellers),budget:String(budget),maxPerDeal:String(cap),validUntil:time+validFor,nonce:++nonce};
  const signature=await sign(badSignature?'other':'buyer','Mandate',m),mandateId=digest(domain,'Mandate',m);
  return {m,mandateId,signature,opened:await send('openMandate',[m,sellers,signature])};
 }
 function deal(a,{amount,seller='seller',window=100,expiresAt=a.m.validUntil,label=''}){return {dealHash:hash({seed,nonce,label,amount,seller}),mandateId:a.mandateId,seller:actors[seller].address,amount:String(amount),deliveryWindow:window,expiresAt,termsHash:hash({label,amount}),previewHash:ZeroHash};}
 async function fund(d,{agent='agent',seller='seller',signedDeal=d}={}){return send('fund',[d,await sign(agent,'Deal',signedDeal),await sign(seller,'Deal',signedDeal),'0x'],BigInt(d.amount));}
 async function release(d,{amount=d.amount,payee=d.seller,seller='seller',evaluator='evaluator',label='claim'}={}){
  const c={dealHash:d.dealHash,claimId:hash({deal:d.dealHash,label}),payee,amount:String(amount),deliveryHash:hash('synthetic-delivery')},evidence=hash('synthetic-evaluator-approval');
  return send('release',[c,await sign(seller,'Claim',c),evidence,await sign(evaluator,'Validation',{dealHash:d.dealHash,claimHash:digest(domain,'Claim',c),evidenceHash:evidence})]);
 }
 const advance=async seconds=>{await raw.request({method:'evm_increaseTime',params:[seconds]});await raw.request({method:'evm_mine',params:[]});};
 return {actors,vault,provider,address,domain,open,deal,fund,release,send,advance,transactions,async close(){provider.destroy();await raw.disconnect();}};
}
