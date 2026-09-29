import test from 'node:test';
import assert from 'node:assert/strict';
import {boundaryPanel} from '../../web/spending/workspace-view.mjs';
const base={id:'task-one',budget:40,perDeal:30,status:'BLOCKED',selected:'seller-b',offers:[{seller:'seller-b',price:35}],events:[{id:'stop-one',at:'2026-09-30T00:00:00Z',title:'Sample offer blocked'}]};
test('presentation exposes recorded stop identity and distinguishes unfunded and locked money',()=>{
 const limit=boundaryPanel(base);assert.match(limit,/STOP RECORDED/);assert.match(limit,/stop-one/);assert.match(limit,/Funding signatures: 0/);
 const bill={...base,id:'task-two',status:'REVIEW',agreedPrice:20,invoice:25,events:[{id:'stop-two',at:'2026-09-30T00:01:00Z',title:'Sample overcharge blocked'}]};
 const mismatch=boundaryPanel(bill);assert.match(mismatch,/25 requested vs 20 agreed/);assert.match(mismatch,/Existing escrow remains locked/);assert.match(mismatch,/stop-two/);
 const corrected=boundaryPanel({...bill,invoice:20});assert.doesNotMatch(corrected,/STOP RECORDED/);
 const paid=boundaryPanel({...bill,invoice:20,status:'COMPLETED'});assert.match(paid,/PAID · EXACT AGREEMENT/);assert.doesNotMatch(paid,/Payout signatures: 0/);
});
test('presentation does not invent a stop receipt when there is no recorded event',()=>{
 assert.doesNotMatch(boundaryPanel({...base,events:[]}),/STOP RECORDED/);
 assert.match(boundaryPanel({...base,id:'<script>',events:[]}),/&lt;script&gt;/);
});
