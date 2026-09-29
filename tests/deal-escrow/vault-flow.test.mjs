import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
test('conversation compiler to v2 funding, genuine reverted attacks, withdrawal and independent tamper rejection',()=>{
 const child=spawnSync(process.execPath,['scripts/demo-dealtrace-vault.mjs','--self-check'],{encoding:'utf8',timeout:60000,maxBuffer:2_000_000});
 assert.equal(child.status,0,child.stderr+'\n'+child.stdout);
 const result=JSON.parse(child.stdout.trim().split('\n').at(-1));assert.equal(result.status,'PASS');assert.equal(result.transactions,14);assert.equal(result.verification.verdict,'VALID');
 const directory=`artifacts/dealtrace/vault/runs/${result.run}`,report=JSON.parse(readFileSync(`${directory}/report.json`)),tamper=JSON.parse(readFileSync(`${directory}/tamper-cases.json`));
 assert.equal(report.model_calls,0);assert.equal(report.transactions.filter(t=>t.status===0).length,3);
 assert.equal(report.final_state.locked,'0');assert.equal(report.final_state.credits,'0');assert.equal(tamper.cases.length,4);assert(tamper.cases.every(c=>c.verdict==='INVALID'));
});
