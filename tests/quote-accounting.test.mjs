import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Wallet} from 'ethers';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {MANDATE_TYPES,OFFER_TYPES,hash} from '../shared/schema.mjs';
import {quoteObservation,sumQuoteObservations} from '../shared/quote-metrics.mjs';
import {readBenchmark,benchmarkView} from '../src/benchmark.mjs';
const historical='2026-09-28T11-23-54-460Z/result.json';
const historicalFile='artifacts/experiments/'+historical;

test('legacy successful quotes must not silently become measured attempts or rejections',()=>{
  const row=quoteObservation({early:2,final:0,cacheHits:1,latencyMs:7});
  assert.equal(row.quoteSuccesses,2);assert.equal(row.quoteAttempts,null);assert.equal(row.quoteRejections,null);
  assert.equal(sumQuoteObservations([row]).quoteAttempts,null);
  assert.equal(row.quoteRejectedLatencyMs,null);assert.equal(row.quoteProviderCostUsd,null);
});

test('refusal counts one attempt and zero successes; cache reuse adds no attempt',async()=>{
  // In-memory simulator: real signatures and policy, no RPC, chain tx or external inference.
  const sellers=Object.fromEntries(['alpha','beta','gamma','outsider'].map(id=>[id,Wallet.createRandom()]));
  const domain={name:'ControlMemory',version:'1',chainId:31337,verifyingContract:Wallet.createRandom().address};
  const chain={domain,merchant:id=>sellers[id],vault:{nonces:async()=>0n},create:async()=>({status:1,hash:hash('synthetic-approval')}),
    signOffer:async(id,offer)=>({offer,signature:await sellers[id].signTypedData(domain,OFFER_TYPES,offer)})};
  const store=new Store(':memory:');
  const kiln={call:async({candidates})=>({tool:'propose_purchase',args:{offer_id:candidates[0].id,reason:'SYNTHETIC'}})};
  const engine=new Engine({store,chain,kiln,simulate:true}),owner=Wallet.createRandom();
  async function execute(scenarioId){const draft=await engine.draft(owner.address,{arm:'B1'});await engine.approve(draft.session.id,await owner.signTypedData(domain,MANDATE_TYPES,draft.value));const r=engine.enqueue(draft.session.id,{scenarioId});await engine.wait(r.id);return store.get('run',r.id);}
  try {
    const rejected=await execute('late-quote');assert.equal(rejected.status,'REVIEW_REQUIRED');
    assert.deepEqual(sumQuoteObservations([quoteObservation(rejected.quoteMetrics)]),{quoteSuccesses:0,quoteAttempts:1,quoteRejections:1,quoteCacheHits:0});
    const cached=await execute('normal');assert.equal(cached.status,'SIMULATED');
    assert.deepEqual(sumQuoteObservations([quoteObservation(cached.quoteMetrics)]),{quoteSuccesses:3,quoteAttempts:3,quoteRejections:0,quoteCacheHits:1});
    const unlisted=await execute('unlisted');assert.equal(unlisted.status,'STOPPED');
    assert.deepEqual(sumQuoteObservations([quoteObservation(unlisted.quoteMetrics)]),{quoteSuccesses:0,quoteAttempts:0,quoteRejections:0,quoteCacheHits:0});
  } finally {store.close();}
});

test('frozen pilot correction counts rejected quotes and separate training without rewriting raw data',async()=>{
  const bytes=await readFile(historicalFile),original=JSON.parse(bytes);
  const view=await readBenchmark('artifacts/experiments',historical);
  assert.equal(view.quoteAccounting.status,'OFFLINE_RECONSTRUCTION');
  assert.deepEqual(view.summary.map(r=>r.quoteAttempts),[16,27,16]);
  assert.deepEqual(view.summary.map(r=>r.quoteSuccesses),[16,25,14]);
  assert.deepEqual(view.summary.map(r=>r.quoteCacheHits),[0,9,8]);
  assert.equal(view.quoteAccounting.cmIncludingTraining.quoteAttempts,18);
  assert.equal(view.quoteAccounting.unknown.rejectedQuoteLatencyMs,null);
  assert.deepEqual(view.rows,original.rows);assert.deepEqual(await readFile(historicalFile),bytes);
});

test('missing correction preserves unknowns; new counters are reported as measured',async()=>{
  const original=JSON.parse(await readFile(historicalFile));
  const legacy=benchmarkView(original);assert.equal(legacy.quoteAccounting.status,'LEGACY_INCOMPLETE');assert.equal(legacy.summary[0].quoteAttempts,null);
  const observation=quoteObservation({early:0,final:0,attempts:{early:1,final:0},rejected:1,cacheHits:0,latencyMs:0});
  const measured=benchmarkView({id:'new',rows:[{arm:'B1',...observation}],training:[],summary:[{arm:'B1'}]});
  assert.equal(measured.quoteAccounting.status,'DIRECT_COUNTERS');assert.equal(measured.summary[0].quoteAttempts,1);
  assert.equal(measured.summary[0].quoteRejections,1);
});

test('correction is bound to exact source bytes and experiment identity',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'cm-quotes-'));
  try {
    const original=JSON.parse(await readFile(historicalFile));
    const correction=JSON.parse(await readFile(`artifacts/experiments/corrections/${original.id}-quotes.json`));
    await mkdir(path.join(dir,'corrections'));
    await writeFile(path.join(dir,'latest.json'),JSON.stringify({...original,conclusion:'changed'}));
    await writeFile(path.join(dir,'corrections',original.id+'-quotes.json'),JSON.stringify(correction));
    await assert.rejects(()=>readBenchmark(dir),/QUOTE_CORRECTION_SOURCE_MISMATCH/);
    assert.throws(()=>benchmarkView(original,{...correction,experimentId:'wrong'}),/EXPERIMENT_MISMATCH/);
  } finally {assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('cm-quotes-'));await rm(dir,{recursive:true,force:true});}
});
