import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {assembleReplay,loadReplay} from '../../src/deal-escrow/replay-evidence.mjs';
const run='a2f6f4fa-9f1e-4892-8518-325b8762c4f2',reportFile=`artifacts/deal-escrow/source-sepolia/${run}/report.json`;
const report=JSON.parse(readFileSync(reportFile,'utf8')),receipts=report.results.map(r=>JSON.parse(readFileSync(`${report.evidence_directory}/${r.id}.json`,'utf8')));
test('actual source workflow keeps same-shape wrong-metric refund, independent buyer and measured calls together',async()=>{
  const replay=await loadReplay(reportFile);
  assert.notEqual(replay.network.buyer,replay.network.controller);assert.equal(replay.efficiency.calls,2);
  assert.equal(replay.a.evidence.validation.validator_version,'delivery-reference-v1');
  assert.equal(replay.a.evidence.validation.row_count,4);assert.equal(replay.b.evidence.validation.row_count,4);
  assert.equal(replay.b.evidence.validation.checks.find(c=>c.name==='REFERENCE_VALUES').pass,false);
  assert.equal(replay.denied.control.origin_deal_id,replay.b.deal.deal_id);assert.equal(Object.keys(replay.denied.transactions).length,0);
  assert.equal(replay.energy_estimate.measured,false);assert.equal(replay.energy_estimate.actual_joules,null);
});
test('an old synthetic receipt cannot substitute for the source-backed public proof',async()=>{
  const other=JSON.parse(readFileSync('artifacts/deal-escrow/runs/d07e8650-bc47-4ecd-b138-8885d8288a04/5d130778-f7dc-434a-9bbe-26355c0a2ab2.json','utf8'));
  const mixed=structuredClone(receipts);mixed[0]=other;
  await assert.rejects(assembleReplay(report,mixed),/REPLAY_RESULT_MISMATCH/);
  const tampered=structuredClone(receipts);const rows=JSON.parse(tampered[0].evidence.delivery);rows[0].capex=3441;tampered[0].evidence.delivery=JSON.stringify(rows);
  await assert.rejects(assembleReplay(report,tampered),/REPLAY_RECEIPT_INVALID/);
});
