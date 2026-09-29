import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import ganache from 'ganache';import {Wallet,BrowserProvider,ContractFactory,ZeroHash,TypedDataEncoder} from 'ethers';
import {hash,meteredDomain,executionTypes,linesHash} from '../../src/dealtrace/procurement/protocol.mjs';
import {sellerListHash} from '../../src/dealtrace/vault.mjs';
const artifact=JSON.parse(readFileSync('artifacts/dealtrace/metered-vault/contract.json'));
test('metered vault binds rates, caps, evidence and a single terminal settlement',{timeout:90000},async t=>{
 const keys=Array.from({length:4},()=>Wallet.createRandom()),raw=ganache.provider({logging:{quiet:true},chain:{chainId:31339,hardfork:'shanghai'},wallet:{accounts:keys.map(w=>({secretKey:w.privateKey,balance:'0x8ac7230489e80000'}))}}),provider=new BrowserProvider(raw,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 const [buyer,agent,seller,evaluator]=keys.map(w=>w.connect(provider));
 try{
  const vault=await new ContractFactory(artifact.abi,artifact.bytecode,buyer).deploy();await vault.waitForDeployment();const address=await vault.getAddress(),domain=meteredDomain(31339,address),sign=(who,type,body)=>who.signTypedData(domain,executionTypes(type),body),digest=(type,body)=>TypedDataEncoder.hash(domain,executionTypes(type),body);
  const until=(await provider.getBlock('latest')).timestamp+4000,allowed=[seller.address],mandate={buyer:buyer.address,agent:agent.address,evaluator:evaluator.address,sellersHash:sellerListHash(allowed),budget:4000,maxPerDeal:4000,validUntil:until,nonce:1};
  await(await vault.openMandate(mandate,allowed,await sign(buyer,'Mandate',mandate))).wait();
  const deal={dealHash:hash('meter-test'),mandateId:digest('Mandate',mandate),seller:seller.address,amount:3000,deliveryWindow:300,expiresAt:until,termsHash:hash('packet'),previewHash:ZeroHash};
  const lines=[{lineId:hash('search'),unitPrice:500,maxUnits:4},{lineId:hash('compute'),unitPrice:1000,maxUnits:1}],meter={dealHash:deal.dealHash,linesHash:linesHash(lines)};
  const a=await sign(agent,'Deal',deal),s=await sign(seller,'Deal',deal),am=await sign(agent,'Metering',meter),sm=await sign(seller,'Metering',meter),args=[deal,a,s,'0x',lines,am,sm];
  await t.test('changing a cap/rate invalidates the dual unit schedule',async()=>{
   const bad=structuredClone(lines);bad[0].unitPrice=501;
   await assert.rejects(vault.fundMetered.staticCall(deal,a,s,'0x',bad,am,sm,{value:3000}),/METER_MAXIMUM/);
   const changed=structuredClone(lines);changed[0].lineId=hash('other');await assert.rejects(vault.fundMetered.staticCall(deal,a,s,'0x',changed,am,sm,{value:3000}),/METER_SIGNATURES/);
  });
  await t.test('the same signed deal cannot be downgraded through ordinary funding',async()=>{
   await assert.rejects(vault.fund.staticCall(deal,a,s,'0x',{value:3000}),/METERED_FUNDING_REQUIRED/);
   assert.equal((await vault.escrows(deal.dealHash)).status,0n);
   assert.equal(await vault.totalLocked(),0n);
  });
  await(await vault.fundMetered(...args,{value:3000})).wait();
  const claim={dealHash:deal.dealHash,claimId:hash('invoice'),payee:seller.address,amount:2000,deliveryHash:hash('signed successful and failed calls')},evidence=hash('validation');
  const claimArgs=async c=>[c,await sign(seller,'Claim',c),evidence,await sign(evaluator,'Validation',{dealHash:c.dealHash,claimHash:digest('Claim',c),evidenceHash:evidence})];
  await t.test('cannot bypass metering through the original release entry point',async()=>await assert.rejects(vault.release.staticCall(...await claimArgs({...claim,amount:3000})),/METERED_SETTLEMENT_REQUIRED/));
  await t.test('overcap, wrong counts and excessive invoice fail even with genuine signatures',async()=>{
   await assert.rejects(vault.settleMetered.staticCall(...await claimArgs(claim),lines,[5,0]),/METER_CAP/);
   await assert.rejects(vault.settleMetered.staticCall(...await claimArgs(claim),lines,[2]),/METER_COUNTS/);
   await assert.rejects(vault.settleMetered.staticCall(...await claimArgs({...claim,amount:3000}),lines,[2,1]),/CLAIM_MISMATCH/);
  });
  await(await vault.settleMetered(...await claimArgs(claim),lines,[2,1])).wait();
  assert.equal(await vault.credits(seller.address),2000n);assert.equal(await vault.credits(buyer.address),1000n);assert.equal(await vault.totalLocked(),0n);assert.equal(await vault.totalCredits(),3000n);
  await t.test('duplicate settlement and refund cannot pay twice',async()=>{await assert.rejects(vault.settleMetered.staticCall(...await claimArgs(claim),lines,[2,1]),/NOT_LOCKED_OR_EXPIRED/);await assert.rejects(vault.connect(evaluator).refund.staticCall(deal.dealHash,1,evidence),/NOT_LOCKED/);});
  await(await vault.withdrawFor(seller.address)).wait();await(await vault.withdrawFor(buyer.address)).wait();assert.equal(await provider.getBalance(address),0n);assert.equal(await vault.totalCredits(),0n);
 }finally{provider.destroy();await raw.disconnect();}
});
