import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceTable,checkSourceRows,sourceRequirements,sourceDescriptor,sourcePolicyHash} from '../../src/deal-escrow/source-document.ts';
import {validateTaskRequirements} from '../../src/deal-escrow/domain.ts';
import {validateDelivery} from '../../src/deal-escrow/delivery.ts';

// Invented geometry and numbers: this unit fixture makes no issuer/PDF authenticity claim.
const descriptor={...sourceDescriptor('lges-2025-pdf'),company:'Synthetic Test Company'};
function fixture(){
 const words=[];const add=(id,text,x,y,width=20)=>words.push({id,text,box:[x,y,x+width,y+10]});
 add('year','2025',300,70,40);add('unit','billion KRW',20,100,95);
 ['Q1','Q2','Q3','Q4','FY'].forEach((q,i)=>add('q'+i,q,200+i*60,100));
 add('label','Investment in Facilities',20,150,130);
 [-11,-12,-13,-14,-50].forEach((n,i)=>add('v'+i,String(n),200+i*60,150));
 add('other-label','Investing Activities',20,190,130);
 [-21,-22,-23,-24,-90].forEach((n,i)=>add('o'+i,String(n),200+i*60,190));
 return {sha256:descriptor.sha256,page:descriptor.page,parser:'synthetic-unit-fixture',words};
}
function rowsFor(table){const d=table.document;return table.target_cells.map(c=>({company:d.company,quarter:c.period,capex:-c.value,currency:d.currency,unit:d.unit,source_url:d.url,source_page:d.page,source_sha256:d.sha256,source_label:d.row_label,source_value:c.value,source_cell_id:c.id}));}
const passed=result=>result.checks.every(c=>c.pass);
test('bounded source grammar reads changed values without an answer registry and rejects ambiguous layouts',()=>{
 const index=fixture(),table=parseSourceTable(index,descriptor);assert.deepEqual(table.target_cells.map(c=>c.value),[-11,-12,-13,-14]);
 const changed=structuredClone(index);changed.words.find(w=>w.id==='v0').text='-9,876';assert.equal(parseSourceTable(changed,descriptor).target_cells[0].value,-9876);
 for(const mutate of [
  i=>i.sha256='0'.repeat(64),i=>i.page++,i=>i.words.find(w=>w.id==='year').text='2027',
  i=>i.words.find(w=>w.id==='q1').text='Q1',i=>i.words.find(w=>w.id==='label').text='Facilities Outlook',
  i=>i.words.find(w=>w.id==='unit').text='million USD',i=>i.words.find(w=>w.id==='v0').text='11',
  i=>i.words.push({...i.words.find(w=>w.id==='v0'),id:'duplicate'})
 ]){const bad=structuredClone(index);mutate(bad);assert.throws(()=>parseSourceTable(bad,descriptor));}
});
test('source correspondence rejects wrong metric, amount, unit, period, citation and incomplete delivery',()=>{
 const table=parseSourceTable(fixture(),descriptor),rows=rowsFor(table);assert.equal(passed(checkSourceRows(rows,table)),true);
 for(const mutate of [r=>r[0].capex++,r=>r[0].source_value=-1,r=>Object.assign(r[0],{source_cell_id:'o0',source_value:-21,capex:21}),r=>r[0].quarter='2025-Q2',r=>r[0].source_page=15,r=>r[0].source_sha256='f'.repeat(64),r=>r[0].unit='million',r=>r[0].company='Other',r=>r[1]={...r[0]},r=>r[0]=null]){const bad=structuredClone(rows);mutate(bad);assert.equal(passed(checkSourceRows(bad,table)),false);}
 assert.equal(passed(checkSourceRows(rows.slice(0,1),table)),false);
 assert.equal(passed(checkSourceRows(rows.slice(0,1),table,true)),true);
 assert.equal(passed(checkSourceRows(rows,table,true)),false);
});
test('source policy is pinned at approval and cannot downgrade to the generic JSON validator',()=>{
 const requirements=sourceRequirements(descriptor.id);assert.equal(requirements.source_policy_hash,sourcePolicyHash(descriptor.id));
 assert.throws(()=>validateTaskRequirements({...requirements,source_policy_hash:'0x'+'0'.repeat(64)}),/SOURCE_POLICY_HASH_MISMATCH/);
 assert.throws(()=>validateTaskRequirements({...requirements,reference_dataset_id:'lges-2025-v1'}),/CONFLICTING_SOURCE_PROFILES/);
 assert.throws(()=>validateDelivery('[]',requirements,1,2,{version:'delivery-v2'}),/SOURCE_VALIDATOR_REQUIRED/);
 assert.throws(()=>{sourceDescriptor(descriptor.id).page=1;},TypeError);
});
