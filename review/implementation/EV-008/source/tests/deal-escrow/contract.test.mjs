import test from 'node:test';import assert from 'node:assert/strict';import {Wallet,ZeroHash} from 'ethers';
import {openChain,UNIT_WEI} from '../../src/deal-escrow/chain.mjs';import {hash} from '../../src/deal-escrow/domain.ts';
test('real EVM escrow enforces amount, roles, single outcome, expiry, and buyer refund',async()=>{
 const c=await openChain();try{
 const block=await c.provider.getBlock('latest'),until=block.timestamp+1000,h=hash('success'),bad=hash('bad'),expired=hash('expired');
 await assert.rejects(c.contract.fund(h,c.wallet.address,c.sellers['seller-a'],180n*UNIT_WEI,180,until,{value:1n}),/revert|EXACT_AMOUNT/);
 const stranger=c.contract.connect(Wallet.createRandom().connect(c.provider));await assert.rejects(stranger.release.staticCall(h,hash('fake')),/CONTROLLER_ONLY|revert/);
 await (await c.contract.fund(h,c.wallet.address,c.sellers['seller-a'],180n*UNIT_WEI,180,until,{value:180n*UNIT_WEI})).wait();
 await assert.rejects(c.contract.release(h,ZeroHash),/revert|EVIDENCE_REQUIRED/);
 await (await c.contract.release(h,hash('validated'))).wait();assert.equal((await c.inspect(h)).status,2);
 await assert.rejects(c.contract.release(h,hash('again')),/revert|NOT_LOCKED/);await assert.rejects(c.contract.refund(h,hash('refund')),/revert|NOT_LOCKED/);
 await (await c.contract.fund(bad,c.wallet.address,c.sellers['seller-b'],150n*UNIT_WEI,180,until,{value:150n*UNIT_WEI})).wait();await (await c.contract.refund(bad,hash('invalid delivery'))).wait();assert.equal((await c.inspect(bad)).status,3);await assert.rejects(c.contract.release(bad,hash('fake')),/revert|NOT_LOCKED/);
 await (await c.contract.fund(expired,c.wallet.address,c.sellers['seller-a'],UNIT_WEI,1,until,{value:UNIT_WEI})).wait();await c.provider.send('evm_increaseTime',[2]);await c.provider.send('evm_mine',[]);await assert.rejects(c.contract.release(expired,hash('late')),/revert|EXPIRED/);await (await c.contract.refund(expired,hash('expired'))).wait();assert.equal((await c.inspect(expired)).status,3);
 const escape=hash('buyer-escape'),buyer=c.contract.connect(await c.provider.getSigner(c.sellers['seller-b']));await (await c.contract.fund(escape,c.sellers['seller-b'],c.sellers['seller-a'],UNIT_WEI,2,until,{value:UNIT_WEI})).wait();await assert.rejects(buyer.refund.staticCall(escape,hash('early')),/REFUND_UNAUTHORIZED|revert/);await assert.rejects(stranger.refund.staticCall(escape,hash('intruder')),/REFUND_UNAUTHORIZED|revert/);await c.provider.send('evm_increaseTime',[3]);await c.provider.send('evm_mine',[]);await (await buyer.refund(escape,hash('deadline'))).wait();assert.equal((await c.inspect(escape)).status,3);
 }finally{await c.close();}
});
