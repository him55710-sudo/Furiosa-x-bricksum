import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assembleReplay} from '../../src/deal-escrow/replay-evidence.mjs';
const report=JSON.parse(readFileSync('artifacts/deal-escrow/runs/d07e8650-bc47-4ecd-b138-8885d8288a04/report.json','utf8'));
const original=report.results.map(r=>JSON.parse(readFileSync(`${report.evidence_directory}/${r.id}.json`,'utf8')));
test('public replay binds the released, refunded and denied receipts to the same evidence set',async()=>{
 const replay=await assembleReplay(report,original);
 assert.equal(replay.denied.control.origin_deal_id,replay.b.deal.deal_id);
 assert.equal(replay.efficiency.calls,6);assert.equal(Object.keys(replay.denied.transactions).length,0);
 assert.ok(replay.a.evidence.validation.validator_version==='delivery-v2');
});
test('replay refuses missing records, changed outcomes and unrelated usage totals',async()=>{
 await assert.rejects(assembleReplay(report,original.slice(0,-1)),/REPLAY_RECEIPT_MISSING/);
 const changed=structuredClone(original);changed[0].state='REFUNDED';
 await assert.rejects(assembleReplay(report,changed),/REPLAY_RESULT_MISMATCH/);
 const fake=structuredClone(report);fake.efficiency.calls++;
 await assert.rejects(assembleReplay(fake,original),/REPLAY_USAGE_MISMATCH/);
});
test('replay refuses a tampered control origin or a receipt from another deployment',async()=>{
 const control=structuredClone(original);control[2].control.origin_deal_id=control[0].deal.deal_id;
 await assert.rejects(assembleReplay(report,control),/REPLAY_RECEIPT_INVALID/);
 const wrongChain=structuredClone(original);wrongChain[0].network.contract='0x0000000000000000000000000000000000000001';
 await assert.rejects(assembleReplay(report,wrongChain),/REPLAY_DEPLOYMENT_MISMATCH/);
});
