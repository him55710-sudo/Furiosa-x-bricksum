import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {sourceDescriptor,sourceDocument,sourcePath,pdfPython,sourceRequirements,citedSourceRows,parseSourceTable} from '../../src/deal-escrow/source-document.ts';
import {validateDelivery,validatePreview} from '../../src/deal-escrow/delivery.ts';import {now,policy} from '../../src/deal-escrow/domain.ts';
import {DealStore} from '../../src/deal-escrow/store.ts';import {DealEngine} from '../../src/deal-escrow/engine.ts';import {openChain} from '../../src/deal-escrow/chain.mjs';import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';import {dealFromOffer,documentOffers,deliverResearch} from '../../src/deal-escrow/research.ts';
const id='lges-2025-pdf',requirements=sourceRequirements(id);
const index=()=>JSON.parse(execFileSync(pdfPython(),['scripts/read-deal-research-pdf.py',sourcePath(id),'16'],{encoding:'utf8',windowsHide:true}));

test('PDF geometry parser uses source tokens; changed input values are not compared with an answer registry',()=>{
 const original=index(),d=sourceDescriptor(id),table=parseSourceTable(original,d),copy=structuredClone(original),cell=table.target_cells[0];
 copy.words.find(w=>w.id===cell.id).text='-9,876';const changed=parseSourceTable(copy,d);assert.equal(changed.target_cells[0].value,-9876);
 for(const mutate of [i=>i.sha256='0'.repeat(64),i=>i.words.find(w=>w.text==='2025').text='2027',i=>i.words.find(w=>w.id===table.columns.find(c=>c.period==='2025-Q2').header_id).text='Q1',i=>i.words.find(w=>w.text==='Facilities').text='Financing']){const bad=structuredClone(original);mutate(bad);assert.throws(()=>parseSourceTable(bad,d));}
});
test('a plausible value and a genuine citation fail when they belong to another row, period or document',()=>{
 const rows=citedSourceRows(id),table=sourceDocument(id),check=value=>validateDelivery(JSON.stringify(value),requirements,10,20);
 assert.equal(check(rows).verified,true);assert.equal(check(rows).source_evidence.reference_values_registered,false);
 const otherRow=table.rows.find(r=>r.label.includes('Investing')).cells.find(c=>c.period==='2025-Q1');
 for(const mutate of [r=>r[0].capex++,r=>r[0].source_value=-1,r=>r[0].source_cell_id=otherRow.id,r=>Object.assign(r[0],{source_cell_id:otherRow.id,source_value:otherRow.value,capex:-otherRow.value}),r=>r[0].quarter='2025-Q2',r=>r[0].source_page=15,r=>r[0].source_sha256='f'.repeat(64),r=>r[0].unit='million',r=>r[0].company='Other Company',r=>r[1]={...r[0]},r=>r[0]=null]){const bad=structuredClone(rows);mutate(bad);assert.equal(check(bad).verified,false);}
 assert.equal(check(rows.slice(0,1)).verified,false);assert.equal(validatePreview(JSON.stringify(rows.slice(0,1)),requirements,10,20).verified,true);assert.equal(validatePreview(JSON.stringify(rows),requirements,10,20).verified,false);
 assert.throws(()=>validateDelivery(JSON.stringify(rows),requirements,10,20,{version:'delivery-v2'}),/SOURCE_VALIDATOR_REQUIRED/);
});
test('one-quarter sample restores funding but cannot release payment for an incomplete full delivery',async()=>{
 const chain=await openChain(),store=new DealStore(':memory:'),engine=new DealEngine(store,chain),t=now();
 const m=engine.mandate({mandate_id:'source-task',company_id:'source-team',buyer_id:'research-agent-07',task_budget_minor:900,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+1800,task_requirements:requirements});
 const rows=citedSourceRows(id),offer=documentOffers(id)[0];
 const ids={};const install=name=>{const intent=store.getOrCreateIntent(m.mandate_id,offer.seller_id,'new-'+name);ids[name]=intent.deal_id;engine.propose(dealFromOffer(m,offer,intent.deal_id,180),m.mandate_id);store.details(intent.deal_id,{purchase_intent_id:intent.id});engine.agentAction('accept_deal',{deal_id:intent.deal_id});store.updateIntent(intent.id,{status:'COMPLETED'});};
 try{
  install('source-failure');await engine.fund(ids['source-failure']);const bad=structuredClone(rows);bad[0].capex++;await engine.deliver(ids['source-failure'],JSON.stringify(bad));assert.equal(store.get(ids['source-failure']).state,'REFUNDED');
  install('sample-not-full');assert.equal(store.get(ids['sample-not-full']).state,'PREVIEW_REQUIRED');engine.preview(ids['sample-not-full'],JSON.stringify(rows.slice(0,1)));assert.equal(store.get(ids['sample-not-full']).state,'PREVIEW_VERIFIED');await engine.fund(ids['sample-not-full']);await engine.deliver(ids['sample-not-full'],JSON.stringify(rows.slice(0,1)));assert.equal(store.get(ids['sample-not-full']).state,'REFUNDED');
  install('source-complete');engine.preview(ids['source-complete'],JSON.stringify(rows.slice(0,1)));await engine.fund(ids['source-complete']);
  await deliverResearch(engine,ids['source-complete'],{clientFactory:()=>{throw new Error('UNEXPECTED_PAID_EXTRACTION_CALL');}});
  const complete=store.get(ids['source-complete']);assert.equal(complete.state,'SETTLED');assert.equal(complete.details.extraction_method,'deterministic PDF cell selection');assert.equal(complete.details.extracted_delivery.model_calls,0);assert.deepEqual(JSON.parse(complete.details.delivery),rows);
  const audit=await verifyReceipt(receipt(engine,ids['source-complete']),chain);assert.equal(audit.verdict,'VALID');assert.equal(audit.delivery_quality[0].current_validator,'delivery-source-v1');
  const unavailable=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',"import {readFileSync} from 'node:fs'; import {verifyReceipt} from './src/deal-escrow/audit.ts'; console.log(JSON.stringify(await verifyReceipt(JSON.parse(readFileSync(0,'utf8')))));"],{input:JSON.stringify(receipt(engine,ids['source-complete'])),encoding:'utf8',windowsHide:true,env:{...process.env,ADE_PYTHON:'missing-python-for-audit-test'},timeout:10000}));
  assert.equal(unavailable.verdict,'INCOMPLETE');assert.match(unavailable.reason,/ENOENT/);
  const weakened=dealFromOffer(m,offer,'weakened',180);delete weakened.requirements.source_document_id;delete weakened.requirements.source_policy_hash;assert.equal(policy(m,weakened).find(c=>c.name==='TASK_SOURCE_DOCUMENT').pass,false);
 }finally{store.close();await chain.close();}
});
