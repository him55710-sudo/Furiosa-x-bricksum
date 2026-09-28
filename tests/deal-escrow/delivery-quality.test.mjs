import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDelivery,fixtureDelivery} from '../../src/deal-escrow/delivery.ts';

const requirements={minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'};
const validate=rows=>validateDelivery(JSON.stringify(rows),requirements,100,200);
const rows=()=>JSON.parse(fixtureDelivery());
test('CAPEX delivery rejects empty and mistyped values, invalid quarters and invalid numeric amounts',()=>{
  assert.equal(validate(rows()).verified,true);
  for(const patch of [{company:null},{company:'  '},{quarter:'2024-Q4'},{quarter:'2026-Q5'},{capex:-1},{capex:'150'},{capex:null},{currency:'krw'},{currency:''},{source_url:{url:'https://example.org'}}]){
    const changed=rows();changed[0]={...changed[0],...patch};assert.equal(validate(changed).verified,false,JSON.stringify(patch));
  }
  const huge=fixtureDelivery().replace('"capex":100','"capex":1e309');assert.equal(validateDelivery(huge,requirements,100,200).verified,false);
});
test('economic row duplication cannot inflate delivery or five-row preview quantity',()=>{
  const changed=rows();changed[1]={...changed[0],capex:999,source_url:'https://different.example/source'};
  assert.equal(validate(changed).checks.find(c=>c.name==='UNIQUE_ECONOMIC_ROWS').pass,false);
  const disguised=rows();disguised[1]={...disguised[0],company:'  DEMO   BATTERY 1 '};assert.equal(validate(disguised).verified,false);
  const preview={...requirements,minimum_rows:5};assert.equal(validateDelivery(fixtureDelivery(10),preview,100,200).verified,true);
  assert.equal(validateDelivery(JSON.stringify(Array(5).fill(rows()[0])),preview,100,200).verified,false);
});
test('source coverage requires safe URL strings but never certifies remote content or semantic truth',()=>{
  for(const url of ['javascript:alert(1)','file:///tmp/data','https://user:password@example.org/source',' https://example.org/source','https://example.org/\nsource']){
    const changed=rows().map(row=>({...row,source_url:url}));const v=validate(changed);assert.equal(v.verified,false,url);
  }
  const unreachable=rows().map(row=>({...row,source_url:'https://example.invalid/not-fetched'})),v=validate(unreachable);
  assert.equal(v.verified,true);assert.equal(v.semantic_truth_verified,false);assert.match(v.url_validation_scope,/no retrieval/);
});
test('historical v1 delivery remains reproducible while stricter v2 reports its quality gap',()=>{
  const repeated=JSON.stringify(Array(40).fill({company:null,quarter:'wrong',capex:'fake',currency:null,source_url:'https://example.invalid'}));
  const legacy=validateDelivery(repeated,requirements,100,200,{version:'delivery-v1'});assert.equal(legacy.verified,true);assert.equal(legacy.validator_version,undefined);
  assert.equal(validateDelivery(repeated,requirements,100,200).verified,false);
});
