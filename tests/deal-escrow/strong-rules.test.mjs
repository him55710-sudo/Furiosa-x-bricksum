import test from 'node:test';import assert from 'node:assert/strict';import {ruleReview,strongFixedSelection} from '../../verification/deal-research-strong-rules.mjs';import {publicOffers,marketOffers} from '../../src/deal-escrow/research.ts';import {researchRequirements} from '../../src/deal-escrow/reference.ts';
test('expanded baseline handles explicit negations without turning unavailable actuals into a valid offer',()=>{
 assert.equal(ruleReview('Historical quarterly actuals are unavailable. Facility figures are annual guidance allocated to four periods.').match,false);
 assert.equal(ruleReview('Cash paid for plant and equipment during January–March, April–June, July–September and October–December of 2025. Not projections.').match,true);
 assert.equal(ruleReview('Actual quarterly facility spending for 2026.').match,false);
 assert.equal(ruleReview('Actual quarterly cash flows from total investing activities for 2025.').match,false);
});
test('expanded baseline uses only public offer fields and still enforces the same price and deadline policy',()=>{
 const t=100,m={mandate_id:'rules',company_id:'test',buyer_id:'buyer',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:0,expires_at:900,task_requirements:{...researchRequirements,max_delivery_seconds:180}};
 const offers=publicOffers(marketOffers);assert.equal(strongFixedSelection(m,offers,t).offer_id,'primary-reports');assert.equal(strongFixedSelection({...m,max_single_minor:90},offers,t).decision,'reject');
 const changed=offers.map(o=>({...o,expected_delivery:false,expected_offer_ids:['outlook-summary'],delivery_mode:'bad-value',preview_json:'untrusted'}));assert.deepEqual(strongFixedSelection(m,changed,t),strongFixedSelection(m,offers,t));
});
