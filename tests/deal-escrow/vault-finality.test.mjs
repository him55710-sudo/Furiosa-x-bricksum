import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifyVaultProof} from '../../src/dealtrace/vault-audit.mjs';
test('a finalized boundary before deployment is INCOMPLETE, never a false contract substitution',async()=>{
 const pointer=JSON.parse(readFileSync('artifacts/dealtrace/vault/public-latest.json')),report=JSON.parse(readFileSync(pointer.report));
 const provider={getNetwork:async()=>({chainId:11155111n}),getBlock:async()=>({number:report.transactions[0].block-1}),getCode:async()=>{throw new Error('MUST_NOT_READ_PREDEPLOYMENT_CODE');}};
 const result=await verifyVaultProof(report,{provider,trusted:report.network});assert.equal(result.verdict,'INCOMPLETE');assert.equal(result.reason,'FINALITY_PENDING');
});
