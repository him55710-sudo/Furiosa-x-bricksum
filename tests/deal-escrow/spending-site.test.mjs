import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {simulatePolicy,minorToWei,formatNativeAmount,gweiInputToMinor} from '../../web/spending/policy-simulator.mjs';
import {PROCUREMENT_RUN} from '../../scripts/accord-public-proof.mjs';
import {buildSpendingSite,PUBLIC_EVIDENCE} from '../../scripts/build-deal-escrow-spending.mjs';
const proposal={priceMinor:180,remainingMinor:300,perDealMinor:200,allowedSeller:true,active:true,previewRequired:false,previewPassed:false};
test('native currency display matches the recorded funding principal without inventing balances',()=>{
 const receipt=JSON.parse(readFileSync('artifacts/deal-escrow/spending-proof/normal.json'));
 assert.equal(minorToWei(receipt.deal.price_minor,receipt.network.unitWei).toString(),receipt.transactions.fund.claim.amount_wei);
 assert.equal(formatNativeAmount(180,'1000000000','gwei'),'180');
 assert.equal(formatNativeAmount(180,'1000000000','ETH'),'0.00000018');
 assert.equal(formatNativeAmount(1000,'1000000000','gwei'),'1,000');
 assert.equal(formatNativeAmount(1,'1','ETH'),'0.000000000000000001');
 assert.throws(()=>formatNativeAmount(1,'1000000000','USD'),/UNSUPPORTED/);
 assert.throws(()=>minorToWei(-1,'1000000000'),/INVALID/);
});
test('gwei proposals preserve exact internal units and reject unrepresentable amounts',()=>{
 assert.equal(gweiInputToMinor('201','1000000000'),201);
 assert.equal(gweiInputToMinor('0.000000001','1'),1);
 for(const input of ['0.1','1e3','-1','NaN','9007199254740992'])assert.ok(Number.isNaN(gweiInputToMinor(input,'1000000000')));
 assert.equal(simulatePolicy({...proposal,priceMinor:gweiInputToMinor('201','1000000000')}).allowed,false);
});
test('public policy lab rejects invalid values and never creates financial authority',()=>{
 for(const value of [NaN,Infinity,-1,0,1.1,Number.MAX_SAFE_INTEGER+1])assert.equal(simulatePolicy({...proposal,priceMinor:value}).allowed,false);
 const allowed=simulatePolicy(proposal);assert.equal(allowed.allowed,true);assert.equal(allowed.mode,'LOCAL_SIMULATION');assert.equal(allowed.signedTransactions,0);
});
test('public policy lab separates per-deal, remaining authority, revocation and seller restrictions',()=>{
 for(const change of [{priceMinor:201},{remainingMinor:179},{active:false},{allowedSeller:false}])assert.equal(simulatePolicy({...proposal,...change}).allowed,false);
 assert.equal(simulatePolicy({...proposal,priceMinor:200,remainingMinor:200}).allowed,true);
});
test('passing a preview cannot override a financial restriction',()=>{
 assert.equal(simulatePolicy({...proposal,previewRequired:true}).allowed,false);
 assert.equal(simulatePolicy({...proposal,previewRequired:true,previewPassed:true}).allowed,true);
 assert.equal(simulatePolicy({...proposal,priceMinor:201,previewRequired:true,previewPassed:true}).allowed,false);
});
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'spending-site-'));t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'spending-site-'));rmSync(root,{recursive:true,force:true});});cpSync('web/spending',path.join(root,'web/spending'),{recursive:true});mkdirSync(path.join(root,'artifacts/deal-escrow/spending-proof'),{recursive:true});for(const name of PUBLIC_EVIDENCE)cpSync(`artifacts/deal-escrow/spending-proof/${name}.json`,path.join(root,`artifacts/deal-escrow/spending-proof/${name}.json`));writeFileSync(path.join(root,'artifacts/deal-escrow/tests.json'),JSON.stringify({status:'PASS',tests:1,passed:1}));const dir=`artifacts/dealtrace/procurement/runs/${PROCUREMENT_RUN}`;mkdirSync(path.join(root,dir),{recursive:true});for(const name of ['report.json','finalized-verification.json'])cpSync(path.join(dir,name),path.join(root,dir,name));cpSync('artifacts/dealtrace/procurement/usage-audit.json',path.join(root,'artifacts/dealtrace/procurement/usage-audit.json'));return root;}
test('deployment publishes an explicit file allowlist, never private files or arbitrary evidence',t=>{
 const root=fixture(t);writeFileSync(path.join(root,'artifacts/deal-escrow/spending-proof/private-key.json'),'DO_NOT_PUBLISH');writeFileSync(path.join(root,'web/spending/.env'),'DO_NOT_PUBLISH');
 const manifest=buildSpendingSite(root);assert.equal(manifest.files.length,31);for(const file of ['presentation.css','presentation-model.mjs','presentation-view.mjs'])assert.ok(manifest.files.some(f=>f.path===file),'Explicitly publish '+file);assert.equal(manifest.files.some(f=>/private|\.env/.test(f.path)),false);assert.equal(readdirSync(path.join(root,'dist-spending/evidence')).includes('private-key.json'),false);assert.equal(manifest.files.every(f=>f.sha256.length===64),true);
});

test('public test summary excludes host paths while preserving the full local report',t=>{
 const root=fixture(t),file=path.join(root,'artifacts/deal-escrow/tests.json');
 const local={status:'PASS',tests:1,passed:1,source_fingerprint:'fixture',output:'C:\\Users\\fixture\\private-input',stderr:'private diagnostic'};
 writeFileSync(file,JSON.stringify(local));buildSpendingSite(root);
 const published=JSON.parse(readFileSync(path.join(root,'dist-spending/evidence/tests.json')));
 assert.equal(published.source_fingerprint,'fixture');assert.equal(published.output,undefined);assert.equal(published.stderr,undefined);
 assert.deepEqual(JSON.parse(readFileSync(file)),local);
});
test('public build refuses inconsistent failure origins instead of showing a successful memory loop',t=>{
 const root=fixture(t),file=path.join(root,'artifacts/deal-escrow/spending-proof/preview-first.json'),bundle=JSON.parse(readFileSync(file));bundle.control.origin_deal_id='unrelated';writeFileSync(file,JSON.stringify(bundle));assert.throws(()=>buildSpendingSite(root),/MEMORY_ORIGIN_MISMATCH/);
});

test('public proof refuses inconsistent settlement amounts',t=>{const root=fixture(t),file=path.join(root,`artifacts/dealtrace/procurement/runs/${PROCUREMENT_RUN}/report.json`),report=JSON.parse(readFileSync(file));report.paid_wei='1';writeFileSync(file,JSON.stringify(report));assert.throws(()=>buildSpendingSite(root),/PROCUREMENT_PROOF_BINDING/);});
