import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createWorkspace} from '../../src/accord/workspace.mjs';
import {renderHome,renderPurchase,policyForm} from '../../web/spending/product-view.mjs';
import {runGuidedStory,presentationModel} from '../../web/spending/presentation-model.mjs';

test('custom Demo authority controls actual outcomes; larger limits never manufacture a blocked offer',async t=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),'accord-product-'));
 const workspace=await createWorkspace({directory});t.after(async()=>{await workspace.close();rmSync(directory,{recursive:true,force:true});});
 let job;const io={getJob:()=>job,create:async()=>job=await workspace.create({...workspace.sample(),budget:80,perDeal:50}),mutate:async(action,fields)=>job=await workspace.act(job.id,action,{revision:job.revision,...fields}),checkpoint:async()=>{}};
 await runGuidedStory('delegate',io);assert.equal(job.status,'QUOTED');assert.equal(presentationModel({job}).authorityBlocked,false);
 await runGuidedStory('negotiate',io);
 const savedEventCount=job.events.length;
 job=await workspace.act(job.id,'edit',{revision:job.revision,...workspace.sample(),budget:80,perDeal:50});
 assert.equal(presentationModel({job}).negotiated,false,'an edited mandate cannot inherit old negotiation completion');
 await runGuidedStory('delegate',io);await runGuidedStory('negotiate',io);
 assert.ok(job.events.length>savedEventCount,'history is preserved while the new negotiation is recorded');
 assert.equal(job.events.filter(ev=>ev.title==='Counteroffer: 18 test units').length,2,'new policy gets a fresh counteroffer');
 let html=renderPurchase({job,story:{}});assert.match(html,/\$80/);assert.match(html,/\$50/);assert.doesNotMatch(html,/PAUSED · AUTHORITY/);
 await runGuidedStory('negotiate',io);await runGuidedStory('approve',io);
 assert.equal(job.invoice,25);assert.equal(job.agreedPrice,20);assert.equal(job.status,'REVIEW');
 html=renderPurchase({job,story:{}});assert.match(html,/PAUSED · AGREEMENT GATE/);assert.match(html,/\$25 ≠ \$20/);assert.match(html,/\$60/);assert.match(html,/Buyer spent/);assert.match(html,/Seller received/);
 const flow=renderPurchase({job,story:{view:'flow'}});assert.match(flow,/execution-grid/);assert.doesNotMatch(flow,/graph-connections/);assert.match(flow,/No payment/);
 job=await workspace.create({...workspace.sample(),budget:15,perDeal:12});
 await runGuidedStory('delegate',io);await runGuidedStory('negotiate',io);await runGuidedStory('approve',io);
 assert.equal(job.status,'BLOCKED');assert.equal(job.dealId,undefined);assert.equal(presentationModel({job}).funded,false);
});

test('home separates example and roadmap claims; workspace escapes human text and preserves unit/mode context',()=>{
 const home=renderHome();assert.match(home,/Try Demo/);assert.match(home,/Go Live/);assert.match(home,/Furiosa × Bricksum/);assert.match(home,/ILLUSTRATION/);assert.match(home,/not a claim of deployed integrations/);
 for(const mode of ['guided','live']){
  const html=renderPurchase({mode,story:{policy:{title:'<script>bad</script>',budget:99,perDeal:42,deliveryMinutes:12},composer:'<img src=x onerror=alert(1)>'}});
  assert.match(html,/\$99/);assert.match(html,/\$42/);assert.match(html,/test USD · No real funds/);assert.doesNotMatch(html,/<script>bad|<img src=x/);
  assert.match(html,/purchase-message-form/);assert.match(html,mode==='live'?/LIVE · Kiln/:/DEMO · Deterministic/);
 }
 assert.match(policyForm({job:{liveSessionId:'live',title:'Task',brief:'Immutable.',budget:40,perDeal:30,deliveryMinutes:10}}),/Use for a new purchase/);
});
