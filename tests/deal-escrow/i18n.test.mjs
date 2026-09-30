import test from 'node:test';
import assert from 'node:assert/strict';
import {messages} from '../../web/spending/i18n-catalog.mjs';
import {translate,languages} from '../../web/spending/i18n.mjs';

test('every catalog message has both translations with the same value placeholders',()=>{
  const seen=new Map(),keys=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
  assert.deepEqual(Object.keys(languages),['en','ko','zh-CN']);
  for(const row of messages){
    assert.equal(row.length,3,row[0]);
    assert.ok(row.every(s=>s.trim().length),row[0]);
    assert.deepEqual(keys(row[1]),keys(row[0]),row[0]);
    assert.deepEqual(keys(row[2]),keys(row[0]),row[0]);
    if(seen.has(row[0]))assert.deepEqual(row,seen.get(row[0]),'Conflicting translation: '+row[0]);
    seen.set(row[0],row);
  }
});

test('financial incident translations keep exact amounts and distinguish both gates',()=>{
  assert.equal(translate('$35 exceeds your $30 limit.','ko'),'$35가 한도 $30를 초과합니다.');
  assert.equal(translate('$35 exceeds your $30 limit.','zh-CN'),'$35 超出您的 $30 限额。');
  for(const lang of ['ko','zh-CN']){
    assert.notEqual(translate('Authority Gate',lang),translate('Agreement Gate',lang));
    const source='Authored demo invoice: $25 test USD; agreement: $20. Payment blocked by the application before signing. Escrow remains locked.';
    const translated=translate(source,lang);
    assert.notEqual(source,translated);
    assert.deepEqual(translated.match(/\$\d+/g),['$25','$20']);
    const settled=translate('$20 test USD paid once to Atlas on this browser’s private EVM.',lang);
    assert.match(settled,/\$20/);assert.match(settled,/Atlas/);assert.match(settled,/EVM/);
    assert.equal(translate('$25 ≠ $20',lang),'$25 ≠ $20');
  }
});

test('navigation, errors and proof boundary labels are covered in both languages',()=>{
  const required=['Try Demo','Go Live','Your policy','Edit your policy','Total budget','Send task','Expand conversation','Detailed Deal Room','Historical proof','Inspect technical proof','Verify receipt','Download receipt','New negotiation','Stop agents','LIVE_SERVICE_UNAVAILABLE','The source table has invalid values, duplicate rows or missing HTTP(S) citations. Use 2025–2026 quarters and three-letter currencies.','This is a saved public-chain execution, separate from your current purchase and browser-private EVM. DEMO is a test accounting unit, not USD. Delivery quality still relies on an evaluator.'];
  for(const lang of ['ko','zh-CN'])for(const text of required)assert.notEqual(translate(text,lang),text,lang+': '+text);
  assert.equal(translate('⤢ Expand conversation','ko'),'⤢ 대화 크게 보기');
  assert.equal(translate('Send →','zh-CN'),'发送 →');
});

test('English, unknown values and technical identifiers are preserved',()=>{
  for(const text of ['Accord Lock','Atlas','qwen3-32b','0xdeadbeef1234','$25 ≠ $20','An unrecognized diagnostic','  Your policy  ']){
    assert.equal(translate(text,'en'),text);
    assert.equal(translate(text,'unsupported'),text);
  }
  assert.equal(translate('0xdeadbeef1234','ko'),'0xdeadbeef1234');
  assert.equal(translate('qwen3-32b','zh-CN'),'qwen3-32b');
  assert.match(translate('LIVE_SERVICE_UNAVAILABLE','ko'),/\[LIVE_SERVICE_UNAVAILABLE\]/);
});
