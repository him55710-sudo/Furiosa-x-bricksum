import {spawnSync} from 'node:child_process';import {readdirSync,writeFileSync,mkdirSync} from 'node:fs';import {verificationSource} from '../src/deal-escrow/verification-source.mjs';
const files=readdirSync('tests/deal-escrow').filter(x=>x.endsWith('.test.mjs')).sort().map(x=>`tests/deal-escrow/${x}`);
const source=verificationSource();
const start=Date.now(),result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{encoding:'utf8',timeout:180000,maxBuffer:8_000_000});
const output=result.stdout??'',count=name=>Number(output.match(new RegExp(`# ${name} (\\d+)`))?.[1]??0),ending=verificationSource();
const sourceChanged=source.sha256!==ending.sha256,tests=count('tests'),passed=count('pass');
const pass=result.status===0&&tests>0&&tests===passed&&count('fail')===0&&count('cancelled')===0&&count('skipped')===0&&count('todo')===0&&!sourceChanged;
const report={schema_version:2,status:pass?'PASS':'FAIL',completed_at:new Date().toISOString(),duration_ms:Date.now()-start,runner:'node --test --test-reporter=tap',node:process.version,exit_code:result.status,tests,passed,failed:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),source_fingerprint:source.sha256,ending_source_fingerprint:ending.sha256,source_changed:sourceChanged,source_files:source.files.map(x=>x.path),source_manifest:source.files,output,stderr:result.stderr??'',runner_error:result.error?.code??null};
mkdirSync('artifacts/deal-escrow',{recursive:true});writeFileSync('artifacts/deal-escrow/tests.json',JSON.stringify(report,null,2));process.stdout.write(output);if(sourceChanged)console.error('SOURCE_CHANGED: rerun after source edits finish.');console.log(`Verification ${report.status}: ${passed}/${tests}`);process.exitCode=pass?0:1;
