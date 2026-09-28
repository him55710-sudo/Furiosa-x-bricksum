import test from 'node:test';
import assert from 'node:assert/strict';
import {backup} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {reserve,stopLocally} from '../src/policy.mjs';
import {verifyBundle} from '../src/verifier.mjs';
import {REVOKE_TYPES,hash} from '../shared/schema.mjs';
import {title} from './catalog.mjs';
import {lab,run,ledger,offer,fixtureKiln,evidence} from './helpers.mjs';

test(title('OPS-001'),{timeout:60000},async t=>{
  const l=await lab(t,{disk:true,persist:true}),c=await l.session(),original=l.chain.broadcast;
  l.chain.broadcast=async tx=>{await original(tx);throw new Error('INJECTED_RECEIPT_LOSS');};
  const r=await run(c);assert.equal(r.status,'UNKNOWN');assert.equal(c.engine.session(c.id).reserved,'800');await ledger(c);
  const txHash=r.tx.hash;c.store.close();l.stores.delete(c.store);
  c.chain=await l.restartChain();c.store=new Store(c.file);l.stores.add(c.store);
  c.engine=new Engine({store:c.store,chain:c.chain,kiln:fixtureKiln()});
  await c.engine.recover();await c.engine.recover();await ledger(c);
  const recovered=c.store.get('run',r.id);assert.equal(recovered.status,'SETTLED');assert.equal(recovered.receipt.hash,txHash);
  assert.equal(await c.chain.vault.spent(c.id),800n);assert.equal(c.engine.session(c.id).reserved,'0');
  assert.equal((await verifyBundle(c.engine.bundle(r.id),l.verifier)).status,'VALID');
  await evidence('restart-recovery',{before:'UNKNOWN',after:recovered.status,txHash,recoveryAttempts:2,spent:c.engine.session(c.id).spent,persistentChainRestart:true,sqliteReopened:true});
});

test(title('OPS-002'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session();
  for(const status of ['QUEUED','RUNNING','RESERVED']){
    const id=hash(status);c.store.put('run',id,{id,sessionId:c.id,status:status==='RESERVED'?'RUNNING':status,arm:'B0'});
    if(status==='RESERVED')reserve(c.store,c.id,id,await offer(c),l.chain.domain);
  }
  await c.engine.recover();assert.equal(c.engine.session(c.id).reserved,'0');
  assert.ok(c.store.all('run').every(r=>r.reason==='INTERRUPTED_BEFORE_SUBMISSION'));await ledger(c);
  const d=await l.session(),original=l.chain.broadcast;
  let entered,release;const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  l.chain.broadcast=async tx=>{entered();await gate;return original(tx);};
  const pending=d.engine.enqueue(d.id);await started;
  await d.engine.recover();assert.equal(d.store.get('run',pending.id).status,'SUBMISSION_STARTED','recovery must not interrupt a live worker');
  const stop=d.engine.stop(d.id,await d.owner.signTypedData(l.chain.domain,REVOKE_TYPES,{sessionId:d.id,owner:d.owner.address}));
  assert.equal(d.engine.session(d.id).status,'STOPPED');assert.equal(d.engine.session(d.id).reserved,'800');
  release();const stopped=await stop;await d.engine.wait(pending.id);l.chain.broadcast=original;
  assert.deepEqual(stopped.submittedRuns,[pending.id]);assert.equal(d.store.get('run',pending.id).status,'SETTLED');
  assert.equal(await l.chain.vault.active(d.id),false);await ledger(d);
});

test(title('OPS-003'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session(),broadcast=l.chain.broadcast,revoke=l.chain.revoke;
  l.chain.broadcast=async()=>{throw new Error('INJECTED_RPC_OUTAGE');};
  const r=await run(c);assert.equal(r.status,'UNKNOWN');await c.engine.recover();
  assert.equal(c.engine.session(c.id).reserved,'800');assert.equal(await l.chain.vault.spent(c.id),0n);await ledger(c);
  const whileUnknown=await run(c);assert.equal(whileUnknown.reason,'UNCONFIRMED_PAYMENT_PENDING');assert.equal(c.engine.session(c.id).reserved,'800');
  l.chain.broadcast=broadcast;await c.engine.recover();assert.equal(c.store.get('run',r.id).status,'SETTLED');
  l.chain.revoke=async()=>{throw new Error('INJECTED_RPC_OUTAGE');};
  const stopped=await c.engine.stop(c.id,await c.owner.signTypedData(l.chain.domain,REVOKE_TYPES,{sessionId:c.id,owner:c.owner.address}));
  assert.equal(stopped.revocation,null);assert.equal(c.store.get('revocation',c.id).status,'PENDING');
  assert.throws(()=>c.engine.enqueue(c.id),/MANDATE_INACTIVE/);
  l.chain.revoke=revoke;await c.engine.recover();assert.equal(c.store.get('revocation',c.id).status,'CONFIRMED');
  assert.equal(await l.chain.vault.active(c.id),false);await ledger(c);
});

test(title('OPS-004'),{timeout:60000},async t=>{
  const l=await lab(t,{disk:true}),c=await l.session(),r=await run(c);
  const file=path.join(l.dir,'backup.sqlite');await backup(c.store.db,file);
  const restored=new Store(file);l.stores.add(restored);
  assert.equal(restored.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  const engine=new Engine({store:restored,chain:l.chain,kiln:fixtureKiln()});
  assert.equal(hash(engine.bundle(r.id)),hash(c.engine.bundle(r.id)));
  assert.equal((await verifyBundle(engine.bundle(r.id),l.verifier)).status,'VALID');
  const source=await readFile('contracts/ControlMemory.sol');
  assert.equal(createHash('sha256').update(source).digest('hex'),l.chain.deployment.sourceSha256,'compile contract artifacts after source changes');
});

test(title('OPS-005'),{timeout:60000},async t=>{
  const l=await lab(t),http=await l.http();
  const healthy=await http.request('/api/health');assert.equal(healthy.status,200);assert.equal(healthy.body.status,'READY');
  const getBlock=l.chain.provider.getBlockNumber;
  l.chain.provider.getBlockNumber=async()=>{throw new Error('INJECTED_RPC_OUTAGE');};
  try{const degraded=await http.request('/api/health');assert.equal(degraded.status,503);assert.equal(degraded.body.status,'NOT_READY');}
  finally{l.chain.provider.getBlockNumber=getBlock;}
  assert.equal((await http.request('/api/health')).status,200);
});
