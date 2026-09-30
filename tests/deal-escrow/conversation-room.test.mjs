import test from 'node:test';
import assert from 'node:assert/strict';
import {displayText,translate} from '../../web/spending/i18n.mjs';
import {preparedDemoPrompt,guidedDialogue,purchaseInspection,renderPurchase} from '../../web/spending/product-view.mjs';

test('seller aliases are clear in every display language without changing canonical text',()=>{
 const original='Buyer ↔ Atlas · Nexus · Orbit';
 assert.equal(displayText(original,'en'),'Buyer agent ↔ Seller agent 1 · Seller agent 2 · Seller agent 3');
 for(const language of ['ko','zh-CN'])assert.doesNotMatch(displayText(original,language),/Atlas|Nexus|Orbit/);
 assert.equal(original,'Buyer ↔ Atlas · Nexus · Orbit');
 assert.equal(displayText('Buyer agent','en'),'Buyer agent');
});
test('demo prepares a localized editable request before any delegation',()=>{
 for(const language of ['en','ko','zh-CN']){
  const prompt=preparedDemoPrompt({budget:85,perDeal:44,deliveryMinutes:12},language);
  assert.match(prompt,/\$85/);assert.match(prompt,/\$44/);assert.match(prompt,/12/);assert.doesNotMatch(prompt,/\{\d+\}/);
 }
 const initial=renderPurchase({story:{}});
 assert.match(initial,/data-action="purchase-start-demo"/);
 assert.doesNotMatch(initial,/data-action="story-delegate"/);
 assert.match(initial,/data-purchase-view="details"/);
 assert.doesNotMatch(initial,/href="#workspace"/);
 const started=renderPurchase({story:{demoStarted:true,composer:'Prepared request'}});
 assert.doesNotMatch(started,/data-action="purchase-start-demo"/);
 assert.match(started,/Send to Buyer agent/);
});
test('narration uses recorded values; original event remains available and escaped',()=>{
 const ev={id:'ev-quote',at:'2026-09-30T00:00:00Z',actor:'seller-b',title:'Nexus offered 35 test units',detail:'<script>unaltered</script>'};
 const before=JSON.stringify(ev);
 assert.equal(guidedDialogue(ev,{}),'I prioritize fast delivery. My offer is $35 test USD for the complete task.');
 const requested={title:'Requested offers',detail:'4 source rows; 30 test units per-deal limit.'};
 assert.match(guidedDialogue(requested,{budget:100,perDeal:80}),/\$30/);
 const html=purchaseInspection({job:{id:'task-1',events:[ev],offers:[],budget:40,perDeal:30,status:'QUOTED'}},'all');
 assert.match(html,/ev-quote/);assert.match(html,/View original record/);assert.match(html,/\$35 test USD/);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.equal(JSON.stringify(ev),before);
});

test('specific narration templates outrank generic financial templates in all locales',()=>{
 for(const lang of ['ko','zh-CN']){
  for(const text of ['I prioritize fast delivery. My offer is $35 test USD for the complete task.','View original record','Guided narration · recorded event']){
   const output=translate(text,lang);assert.notEqual(output,text);assert.doesNotMatch(output,/I prioritize|My offer|View original|Guided narration/);
  }
 }
});

test('evidence is recorded history while detailed room is current terms and execution',()=>{
 const job={id:'room',budget:40,perDeal:30,status:'QUOTED',offers:[],events:[{id:'record-1',actor:'buyer',at:'2026-09-30T00:00:00Z',title:'Requested offers',detail:'4 source rows; 30 test units per-deal limit.'}]};
 const state={job};const evidence=purchaseInspection(state,'all'),detail=purchaseInspection(state,'details');
 assert.match(evidence,/record-list/);assert.match(evidence,/record-1/);assert.doesNotMatch(evidence,/execution-grid|current-terms/);
 assert.match(detail,/current-terms/);assert.match(detail,/execution-grid/);assert.doesNotMatch(detail,/record-list|record-1/);
 assert.match(detail,/purchase-policy/);assert.match(evidence,/purchase-export/);
});
