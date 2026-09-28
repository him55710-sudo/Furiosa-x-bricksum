import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS} from '../src/fixtures.mjs';
import {verifyBundle} from '../src/verifier.mjs';
import {title} from './catalog.mjs';
import {lab,run,ledger,evidence} from './helpers.mjs';

test(title('SIM-001'),{timeout:90000},async t=>{
  const l=await lab(t),rows=[];
  for(const arm of ['B0','B1','CM'])for(const scenario of SCENARIOS){
    const options=scenario.id==='negotiation'?{totalCap:'3000',perTxCap:'3000'}:{};
    const c=await l.session({...options,arm}),r=await run(c,scenario.id);
    const expected={normal:'SETTLED','hidden-fee':'STOPPED',unlisted:'STOPPED',expired:'STOPPED',negotiation:'SETTLED',injection:'SETTLED',reformed:'SETTLED','late-quote':arm==='B1'?'REVIEW_REQUIRED':'SETTLED'}[scenario.id];
    assert.equal(r.status,expected,`${arm}/${scenario.id}: ${r.reason}`);await ledger(c);
    const verification=await verifyBundle(c.engine.bundle(r.id),l.verifier);assert.equal(verification.status,'VALID',verification.reason);
    rows.push({arm,scenario:scenario.id,status:r.status,reason:r.reason,inferenceCalls:r.usage.length,quoteMetrics:r.quoteMetrics,spent:c.engine.session(c.id).spent,verification:verification.status});
  }
  await evidence('scenario-matrix',{evidenceLevel:'SYNTHETIC_MODEL_REAL_LOCAL_EVM',conclusion:'Functional coverage only; not a measured Kiln efficiency experiment.',rows});
});

test(title('SIM-002'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session();
  const first=await run(c,'hidden-fee'),second=await run(c,'hidden-fee');
  assert.equal(first.usage.length,1);assert.equal(second.usage.length,0);
  assert.equal(c.store.all('control').length,1);assert.equal(second.controls.length,1);
  const corrected=await run(c,'reformed');assert.equal(corrected.status,'SETTLED');
  const friction=await run(c,'late-quote');assert.equal(friction.status,'REVIEW_REQUIRED');assert.equal(friction.usage.length,0);
  const other=await l.session(),isolated=await run(other,'hidden-fee');assert.equal(isolated.usage.length,1);
  await ledger(c);
  await evidence('memory-sequence',{evidenceLevel:'SYNTHETIC_MODEL_REAL_LOCAL_EVM',runs:[first,second,corrected,friction].map(r=>c.engine.publicRun(r))});
});

test(title('SIM-003'),{timeout:60000},async t=>{
  const l=await lab(t),c=await l.session({arm:'B0',maxCalls:1});
  const a=c.engine.enqueue(c.id,{scenarioId:'hidden-fee',requestId:'same'}),b=c.engine.enqueue(c.id,{scenarioId:'normal',requestId:'same'});
  assert.equal(a.id,b.id);await c.engine.wait(a.id);
  const next=await run(c,'normal');assert.equal(next.reason,'INFERENCE_BUDGET_EXHAUSTED');
  assert.equal(next.usage.length,0);assert.equal(c.engine.session(c.id).llmCalls,1);await ledger(c);
});
