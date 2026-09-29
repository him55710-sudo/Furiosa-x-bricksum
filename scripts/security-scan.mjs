import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

// Scan only Git-visible material; private ignored runtime data stays on the operator's machine.
// Findings contain locations and rule names, never credential values.
const files=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8',maxBuffer:10_000_000}).split('\0').filter(Boolean))];
const rules=[
 ['private-key-literal',/["']?(?:private_?key|secret_?key)["']?\s*[:=]\s*["'](?:0x)?[a-fA-F0-9]{64}["']/gi],
 ['private-key-block',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{64,}/g],
 ['service-token',/\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})/g]
];
let scanned=0;const findings=[];
for(const file of files){
 const stat=lstatSync(file,{throwIfNoEntry:false});if(!stat||!stat.isFile())continue;
 if(/(^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|identities\.json|state\.sqlite(?:-(?:shm|wal))?)$/.test(file)||/^(?:data|artifacts)\/private\//.test(file))findings.push({file,line:0,rule:'private-runtime-file'});
 if(!/\.(?:mjs|cjs|js|ts|tsx|json|md|yml|yaml|txt|html|py|ps1|sol)$/.test(file)||stat.size>15_000_000)continue;
 scanned++;const content=readFileSync(file,'utf8');
 for(const [rule,pattern] of rules)for(const match of content.matchAll(pattern))findings.push({file,line:content.slice(0,match.index).split('\n').length,rule});
}
const report={status:findings.length?'FAIL':'PASS',completed_at:new Date().toISOString(),scope:'Current Git-visible text files; pattern-based scan, not historical secret scanning',scanned_files:scanned,findings};
mkdirSync('artifacts/security',{recursive:true});writeFileSync('artifacts/security/secret-scan.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exitCode=findings.length?1:0;
