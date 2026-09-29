import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ganache from 'ganache';
import solc from 'solc';
import {Wallet,BrowserProvider,ContractFactory,ZeroHash,ZeroAddress} from 'ethers';
import {hash} from '../../src/deal-escrow/domain.ts';
import {vaultDomain,signTyped,digest,sellerListHash} from '../../src/dealtrace/vault.mjs';

const artifact=JSON.parse(readFileSync('artifacts/dealtrace/vault/contract.json'));
const walletSource=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
contract TestWallet {
 address public owner; bool public valid = true; address public vault; bool public attempted; bool public reentered;
 constructor(address o) {owner=o;}
 function configure(bool v,address target) external {require(msg.sender==owner);valid=v;vault=target;}
 function isValidSignature(bytes32 h,bytes calldata s) external view returns(bytes4) {
  if(!valid||s.length!=65)return 0xffffffff;
  bytes32 r;bytes32 z;uint8 v;assembly {r:=calldataload(s.offset) z:=calldataload(add(s.offset,32)) v:=byte(0,calldataload(add(s.offset,64)))}
  return ecrecover(h,v,r,z)==owner?bytes4(0x1626ba7e):bytes4(0xffffffff);
 }
 function execute(address to,bytes calldata data) external {require(msg.sender==owner);(bool ok,bytes memory result)=to.call(data);if(!ok)assembly {revert(add(result,32),mload(result))}}
 receive() external payable {if(vault==address(0)) revert("REJECT_ETH");attempted=true;(reentered,)=vault.call(abi.encodeWithSignature("withdraw(address)",address(this)));}
}`;
function walletArtifact(){const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'TestWallet.sol':{content:walletSource}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));const a=result.contracts['TestWallet.sol'].TestWallet;return {abi:a.abi,bytecode:'0x'+a.evm.bytecode.object};}

test('v2 vault enforces signed authority even when the application is bypassed',async t=>{
 const actors=Object.fromEntries(['relayer','buyer','agent','seller','other','evaluator'].map(n=>[n,Wallet.createRandom()]));
 const raw=ganache.provider({logging:{quiet:true},chain:{chainId:31338,hardfork:'shanghai'},wallet:{accounts:Object.values(actors).map(w=>({secretKey:w.privateKey,balance:'0x8ac7230489e80000'}))}});
 const provider=new BrowserProvider(raw,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 for(const n of Object.keys(actors))actors[n]=actors[n].connect(provider);
 const {relayer,buyer,agent,seller,other,evaluator}=actors;
 const vault=await new ContractFactory(artifact.abi,artifact.bytecode,relayer).deploy();await vault.waitForDeployment();
 const address=await vault.getAddress(),domain=vaultDomain(31338,address);let serial=0;
 const sign=(who,type,body,d=domain)=>signTyped(who,d,type,body);
 const rejected=(fn,reason)=>assert.rejects(fn,new RegExp(reason));
 const invariant=async()=>assert.equal(await provider.getBalance(address),await vault.totalLocked()+await vault.totalCredits(),'balance = locked + withdrawal credits');
 async function mandate(patch={},signer=buyer){const until=(await provider.getBlock('latest')).timestamp+4000;const sellers=[seller.address,other.address];const m={buyer:buyer.address,agent:agent.address,evaluator:evaluator.address,sellersHash:sellerListHash(sellers),budget:'4000',maxPerDeal:'3000',validUntil:until,nonce:++serial,...patch};const signature=await sign(signer,'Mandate',m),id=digest(domain,'Mandate',m);return {m,sellers,signature,id};}
 async function open(patch={},signer){const a=await mandate(patch,signer);await(await vault.openMandate(a.m,a.sellers,a.signature)).wait();return a;}
 async function deal(a,patch={}){return {dealHash:hash('deal-'+(++serial)),mandateId:a.id,seller:seller.address,amount:'2600',deliveryWindow:300,expiresAt:a.m.validUntil,termsHash:hash('terms-'+serial),previewHash:ZeroHash,...patch};}
 async function signedDeal(d,s=seller){return [d,await sign(agent,'Deal',d),await sign(s,'Deal',d),'0x'];}
 async function fund(d,s=seller){await(await vault.fund(...await signedDeal(d,s),{value:d.amount})).wait();await invariant();}
 async function claim(d,patch={}){const c={dealHash:d.dealHash,claimId:hash('claim-'+(++serial)),payee:d.seller,amount:d.amount,deliveryHash:hash('delivery'),...patch};const evidence=hash('validation');return [c,await sign(seller,'Claim',c),evidence,await sign(evaluator,'Validation',{dealHash:c.dealHash,claimHash:digest(domain,'Claim',c),evidenceHash:evidence})];}
 try{
  await t.test('typed digests match Solidity; altered mandate/list/domain/version and nonce replay fail',async()=>{
   const a=await mandate();assert.equal(await vault.mandateDigest(a.m),a.id);
   await rejected(vault.openMandate.staticCall({...a.m,budget:'5000'},a.sellers,a.signature),'BUYER_SIGNATURE');
   await rejected(vault.openMandate.staticCall(a.m,[other.address],a.signature),'SELLER_LIST');
   for(const badDomain of [{...domain,chainId:1},{...domain,verifyingContract:other.address},{...domain,version:'1'}])await rejected(vault.openMandate.staticCall(a.m,a.sellers,await sign(buyer,'Mandate',a.m,badDomain)),'BUYER_SIGNATURE');
   await(await vault.openMandate(a.m,a.sellers,a.signature)).wait();await rejected(vault.openMandate.staticCall(a.m,a.sellers,a.signature),'NONCE_USED');
  });
  await t.test('a malicious relayer cannot invent a buyer, seller or agent signature',async()=>{
   const a=await open(),d=await deal(a),args=await signedDeal(d);assert.equal(await vault.dealDigest(d),digest(domain,'Deal',d));
   await rejected(vault.fund.staticCall(d,await sign(other,'Deal',d),args[2],'0x',{value:d.amount}),'AGENT_SIGNATURE');
   await rejected(vault.fund.staticCall(d,args[1],await sign(other,'Deal',d),'0x',{value:d.amount}),'SELLER_SIGNATURE');
   await rejected(vault.fund.staticCall({...d,amount:'2700'},args[1],args[2],'0x',{value:2700}),'AGENT_SIGNATURE');
   await rejected(vault.fund.staticCall({...d,seller:evaluator.address},args[1],args[2],'0x',{value:d.amount}),'SELLER_NOT_ALLOWED');
   await rejected(vault.fund.staticCall(...args,{value:2601}),'EXACT_AMOUNT_OR_LIMIT');
   await rejected(vault.fund.staticCall(...await signedDeal({...d,amount:'3100'}),{value:3100}),'EXACT_AMOUNT_OR_LIMIT');
   await fund(d);await rejected(vault.fund.staticCall(...args,{value:d.amount}),'DUPLICATE_DEAL');
  });
  await t.test('40 budget, 26 agreed: even a real seller signature plus evaluator approval cannot pay 31',async()=>{
   const a=await open(),d=await deal(a);await fund(d);const bad=await claim(d,{amount:'3100'});await rejected(vault.release.staticCall(...bad),'CLAIM_MISMATCH');
   const good=await claim(d);assert.equal(await vault.claimDigest(good[0]),digest(domain,'Claim',good[0]));
   await rejected(vault.release.staticCall(good[0],good[1],good[2],await sign(other,'Validation',{dealHash:d.dealHash,claimHash:digest(domain,'Claim',good[0]),evidenceHash:good[2]})),'EVALUATOR_SIGNATURE');
   await rejected(vault.release.staticCall({...good[0],payee:other.address},good[1],good[2],good[3]),'CLAIM_MISMATCH');
   await rejected(vault.release.staticCall({...good[0],deliveryHash:hash('substitution')},good[1],good[2],good[3]),'CLAIM_SIGNATURE');
   await rejected(vault.release.staticCall(good[0],good[1],hash('other evidence'),good[3]),'EVALUATOR_SIGNATURE');
   const before=await vault.credits(seller.address);await(await vault.release(...good)).wait();assert.equal(await vault.credits(seller.address)-before,2600n);
   await rejected(vault.release.staticCall(...good),'NOT_LOCKED');await rejected(vault.refund.staticCall(d.dealHash,2,hash('late')),'NOT_LOCKED');await invariant();
  });
  await t.test('aggregate budget is atomic across deals; refund does not reset spending authority',async()=>{
   const a=await open(),d=await deal(a);await fund(d);const second=await deal(a,{amount:'1500'});
   await rejected(vault.fund.staticCall(...await signedDeal(second),{value:1500}),'SESSION_BUDGET');
   await provider.send('evm_increaseTime',[301]);await provider.send('evm_mine',[]);await(await vault.refund(d.dealHash,2,hash('timeout'))).wait();
   await rejected(vault.fund.staticCall(...await signedDeal(second),{value:1500}),'SESSION_BUDGET');assert.equal((await vault.mandates(a.id)).allocated,2600n);await invariant();
  });
  await t.test('revocation is buyer-only, blocks new funding and preserves already contracted work',async()=>{
   const a=await open(),d=await deal(a,{amount:'1000'});await fund(d);await rejected(vault.revoke.staticCall(a.id),'BUYER_ONLY');await(await vault.connect(buyer).revoke(a.id)).wait();
   const next=await deal(a);await rejected(vault.fund.staticCall(...await signedDeal(next),{value:next.amount}),'AUTHORITY_INACTIVE');
   await(await vault.release(...await claim(d))).wait();assert.equal((await vault.escrows(d.dealHash)).status,2n);await invariant();
  });
  await t.test('expired or truncated windows fail before locking; at the deadline only a refund can win',async()=>{
   const a=await open(),d=await deal(a,{expiresAt:(await provider.getBlock('latest')).timestamp+10});await rejected(vault.fund.staticCall(...await signedDeal(d),{value:d.amount}),'FULL_DELIVERY_WINDOW');
   const short=await deal(a,{deliveryWindow:2});await fund(short);await rejected(vault.refund.staticCall(short.dealHash,2,hash('early')),'TIMEOUT_REQUIRED');
   await provider.send('evm_increaseTime',[3]);await provider.send('evm_mine',[]);await rejected(vault.release.staticCall(...await claim(short)),'EXPIRED');
   // The unrelated observer has no authority or key belonging to the buyer/server.
   await(await vault.connect(other).refund(short.dealHash,2,hash('timeout'))).wait();assert.equal((await vault.escrows(short.dealHash)).status,3n);await invariant();
  });
  await t.test('delivery mismatch installs buyer×seller memory that survives a new mandate',async()=>{
   const a=await open(),d=await deal(a);await fund(d);await rejected(vault.refund.staticCall(d.dealHash,1,hash('bad delivery')),'EVALUATOR_ONLY');
   await(await vault.connect(evaluator).refund(d.dealHash,1,hash('bad delivery'))).wait();assert.equal(await vault.requiresPreview(buyer.address,seller.address),true);
   const b=await open(),next=await deal(b);await rejected(vault.fund.staticCall(...await signedDeal(next),{value:next.amount}),'PREVIEW_REQUIRED');
   const ready={...next,previewHash:hash('verified preview')},args=await signedDeal(ready),p={dealHash:ready.dealHash,previewHash:ready.previewHash};
   await rejected(vault.fund.staticCall(args[0],args[1],args[2],await sign(other,'Preview',p),{value:ready.amount}),'PREVIEW_REQUIRED');
   await rejected(vault.fund.staticCall(args[0],args[1],args[2],await sign(evaluator,'Preview',{...p,dealHash:d.dealHash}),{value:ready.amount}),'PREVIEW_REQUIRED');
   await(await vault.fund(args[0],args[1],args[2],await sign(evaluator,'Preview',p),{value:ready.amount})).wait();await invariant();
  });
  await t.test('ERC-1271 signing wallets can reject ETH without blocking settlement or alternate withdrawal',async()=>{
   const wa=walletArtifact(),smart=await new ContractFactory(wa.abi,wa.bytecode,seller).deploy(seller.address);await smart.waitForDeployment();const target=await smart.getAddress();
   const a=await mandate({sellersHash:sellerListHash([target])});await(await vault.openMandate(a.m,[target],a.signature)).wait();const d=await deal(a,{seller:target});
   await(await smart.configure(false,ZeroAddress)).wait();await rejected(vault.fund.staticCall(...await signedDeal(d),{value:d.amount}),'SELLER_SIGNATURE');await(await smart.configure(true,ZeroAddress)).wait();await fund(d);
   await(await vault.release(...await claim(d))).wait();assert.equal(await vault.credits(target),2600n);
   await rejected(smart.execute.staticCall(address,vault.interface.encodeFunctionData('withdraw',[target])),'TRANSFER_FAILED');assert.equal(await vault.credits(target),2600n);
   const before=await provider.getBalance(other.address);await(await smart.execute(address,vault.interface.encodeFunctionData('withdraw',[other.address]))).wait();assert.equal(await provider.getBalance(other.address)-before,2600n);assert.equal(await vault.credits(target),0n);await invariant();
  });
  await t.test('reentrant withdrawal cannot steal any other beneficiary credit',async()=>{
   const wa=walletArtifact(),smart=await new ContractFactory(wa.abi,wa.bytecode,seller).deploy(seller.address);await smart.waitForDeployment();const target=await smart.getAddress();await(await smart.configure(true,address)).wait();
   const a=await mandate({sellersHash:sellerListHash([target])});await(await vault.openMandate(a.m,[target],a.signature)).wait();const d=await deal(a,{seller:target});await fund(d);await(await vault.release(...await claim(d))).wait();const buyerCredit=await vault.credits(buyer.address);
   await(await smart.execute(address,vault.interface.encodeFunctionData('withdraw',[target]))).wait();assert.equal(await smart.attempted(),true);assert.equal(await smart.reentered(),false);assert.equal(await vault.credits(buyer.address),buyerCredit);assert.equal(await vault.credits(target),0n);await invariant();
  });
  await t.test('only a credited beneficiary can choose a withdrawal destination',async()=>{
   await rejected(vault.connect(agent).withdraw.staticCall(agent.address),'NO_CREDIT');await rejected(vault.connect(seller).withdraw.staticCall(ZeroAddress),'ZERO_DESTINATION');
   const due=await vault.credits(seller.address),before=await provider.getBalance(other.address);await(await vault.connect(seller).withdraw(other.address)).wait();assert.equal(await provider.getBalance(other.address)-before,due);
   await rejected(vault.connect(seller).withdraw.staticCall(other.address),'NO_CREDIT');await invariant();
  });
  await t.test('gas sponsorship cannot redirect buyer refunds or withdraw twice',async()=>{
   const due=await vault.credits(buyer.address),before=await provider.getBalance(buyer.address);assert(due>0n);
   await(await vault.connect(other).withdrawFor(buyer.address)).wait();assert.equal(await provider.getBalance(buyer.address)-before,due);
   await rejected(vault.withdrawFor.staticCall(buyer.address),'NO_CREDIT');await invariant();
  });
 }finally{provider.destroy();await raw.disconnect();}
});
