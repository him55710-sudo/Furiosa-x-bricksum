import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifyPriceChangedCopy} from '../../src/dealtrace/evidence-demo.mjs';
test('audit demonstration rejects a changed-price copy without mutating the exported receipt',async()=>{
 const file='artifacts/dealtrace/runs/34d1da0d-e842-4f44-acfd-4d97728c81f0/257c3ed4-2faa-4793-84f3-5dfae5978fe8.receipt.json';
 const bytes=readFileSync(file),receipt=JSON.parse(bytes),before=JSON.stringify(receipt);
 const result=await verifyPriceChangedCopy(receipt);
 assert.equal(result.verification.verdict,'INVALID');assert.equal(result.verification.reason,'DEAL_HASH_MISMATCH');
 assert.equal(result.original_price_minor,2600);assert.equal(result.copy_price_minor,3100);
 assert.notEqual(result.source_receipt_hash,result.copy_receipt_hash);
 assert.equal(JSON.stringify(receipt),before);assert.deepEqual(readFileSync(file),bytes);
 assert.deepEqual(receipt.transactions,JSON.parse(before).transactions);
});
