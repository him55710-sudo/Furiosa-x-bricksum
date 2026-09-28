import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOffer,reserve,stopLocally} from '../src/policy.mjs';
import {verifyBundle} from '../src/verifier.mjs';
import {hash,nowSeconds} from '../shared/schema.mjs';
import {title} from './catalog.mjs';
import {lab,offer,ledger,run,random,seed,evidence} from './helpers.mjs';

test(title('INV-001'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session({totalCap:'3000',perTxCap:'2000'}),s=c.engine.session(c.id);
  const exact=await offer(c,{total:'2000'});assert.equal(checkOffer(s,exact,l.chain.domain).allowed,true);
  assert.equal(checkOffer(s,await offer(c,{total:'2001'}),l.chain.domain).reason,'PER_PURCHASE_LIMIT_EXCEEDED');
  assert.equal(checkOffer({...s,spent:'1000'},exact,l.chain.domain).allowed,true);
  assert.equal(checkOffer({...s,spent:'1001'},exact,l.chain.domain).reason,'ALL_IN_BUDGET_EXCEEDED');
  const invalid=['-1','1.5','1e3','01','',null,1,Number.MAX_SAFE_INTEGER,'9999999999999'];
  for(const field of ['quantity','refundHours','subtotal','fee','total','expiresAt'])for(const value of invalid){
    const bad=structuredClone(exact);bad.offer[field]=value;
    assert.equal(checkOffer(s,bad,l.chain.domain).allowed,false,`${field}:${value}`);
  }
  for(const overrides of [{subtotal:'1900',fee:'99'},{quantity:'99'},{refundHours:'23'},{sessionId:hash('other')},{purposeHash:hash('other')},{skuHash:hash('other')},{expiresAt:String(nowSeconds())}]){
    assert.equal(checkOffer(s,await offer(c,{total:'2000',...overrides}),l.chain.domain).allowed,false);
  }
  assert.equal(checkOffer(s,exact,l.chain.domain,{now:Number(s.mandate.expiresAt)}).reason,'DEADLINE_EXPIRED');
  assert.equal(checkOffer(s,exact,{...l.chain.domain,chainId:1}).allowed,false);
  await ledger(c);
});

test(title('INV-002'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session({totalCap:'3000',perTxCap:'700'}),rng=random(),trace=[];
  for(let i=0;i<80;i++){
    const amount=String(1+rng(1000)),id=hash({seed,i}),record=await offer(c,{total:amount});
    c.store.put('run',id,{id,sessionId:c.id,status:'RUNNING',arm:'B0'});
    const before=c.engine.session(c.id);
    const expected=BigInt(amount)<=700n&&BigInt(before.reserved)+BigInt(amount)<=3000n;
    if(expected){reserve(c.store,c.id,id,record,l.chain.domain);assert.throws(()=>reserve(c.store,c.id,id,record,l.chain.domain),/DUPLICATE_PAYMENT/);}
    else{assert.throws(()=>reserve(c.store,c.id,id,record,l.chain.domain),/LIMIT_EXCEEDED|BUDGET_EXCEEDED/);c.engine.block(id,'TEST_REJECTED');}
    if(expected&&rng(3)===0)c.engine.block(id,'TEST_RELEASED');
    trace.push({step:i,amount,expected,reserved:c.engine.session(c.id).reserved});
    await ledger(c);
  }
  stopLocally(c.store,c.id);await ledger(c);assert.equal(c.engine.session(c.id).reserved,'0');
  await evidence('invariant-seed-trace',{seed,trace});
});

test(title('INV-003'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session({totalCap:'1600',perTxCap:'800',maxCalls:8});
  const results=await Promise.all(Array.from({length:6},(_,i)=>run(c,'normal','parallel-'+i)));
  assert.equal(results.filter(r=>r.status==='SETTLED').length,2);
  assert.equal(await l.chain.vault.spent(c.id),1600n);await ledger(c);
  for(const r of results){
    const v=await verifyBundle(c.engine.bundle(r.id),l.verifier);
    assert.equal(v.status,'VALID',`parallel run ${r.status}: ${v.reason}`);
  }
});

test(title('INV-004'),async t=>{
  const l=await lab(t),c=await l.session(),events=c.store.events(c.id).length;
  assert.throws(()=>c.store.transaction(()=>{c.store.put('probe','rollback',{changed:true});c.store.event(c.id,'TEST_ROLLBACK',{});throw new Error('ROLLBACK_TEST');}),/ROLLBACK_TEST/);
  assert.equal(c.store.get('probe','rollback'),null);assert.equal(c.store.events(c.id).length,events);
  assert.throws(()=>c.store.transaction(async()=>{}),/ASYNC_SQL_TRANSACTION/);
  assert.doesNotThrow(()=>c.store.transaction(()=>c.store.put('probe','next',{ok:true})));
});
