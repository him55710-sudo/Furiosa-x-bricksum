import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadBuyerRecovery} from '../../src/deal-escrow/recovery-evidence.mjs';import {verifyReceipt} from '../../src/deal-escrow/audit.ts';
test('public application-off evidence is a distinct buyer refund with unchanged controller nonce and no model calls',async()=>{
  const source='a2f6f4fa-9f1e-4892-8518-325b8762c4f2',contract='0x04173D24864AD32fE791bd20ef5E97B4a3FC021B',e=await loadBuyerRecovery(source,contract);
  assert.ok(e);assert.notEqual(e.run,source);assert.equal(e.report.application_http_unavailable,true);assert.equal(e.report.early_buyer_refund_denied,true);assert.equal(e.report.unrelated_sender_denied,true);
  assert.equal(e.report.controller_nonce_before_recovery,e.report.controller_nonce_after_recovery);assert.equal(e.report.reservation_after,0);assert.equal(e.report.model_calls,0);
  assert.equal(e.report.buyer_helper.node_filesystem_permission_enforced,true);assert.equal(e.receipt.transactions.refund.actor,'buyer');assert.equal(e.receipt.evidence.validation,undefined);
  assert.equal((await verifyReceipt(e.receipt)).verdict,'STRUCTURALLY_VALID');
  assert.equal(await loadBuyerRecovery('unrelated-run',contract),null);await assert.rejects(loadBuyerRecovery(source,'0x'+'01'.repeat(20)),/RECOVERY_EVIDENCE_MISMATCH/);
  const funded=JSON.parse(readFileSync(`artifacts/deal-escrow/source-recovery/${e.run}/funded-receipt.json`,'utf8'));
  assert.equal(funded.state,'ESCROW_FUNDED');assert.equal(funded.deal_hash,e.receipt.deal_hash);assert.equal(funded.transactions.fund.tx_hash,e.packet.fund_tx);
  assert.equal(BigInt(e.report.buyer_helper.balance_after)-BigInt(e.report.buyer_helper.balance_before)+BigInt(e.report.buyer_helper.gas_fee_wei),BigInt(e.packet.amount_wei));
});
