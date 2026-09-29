import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWorkspace} from '../../src/accord/workspace.mjs';
import {presentationModel,runGuidedStory} from '../../web/spending/presentation-model.mjs';
import {renderPresentation} from '../../web/spending/presentation-view.mjs';

test('four presentation decisions execute the existing real private-EVM workflow, preserve proof and resume safely',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'accord-story-'));
 const workspace=await createWorkspace({directory});
 t.after(async()=>{await workspace.close();rmSync(directory,{recursive:true,force:true});});
 let job,receipt,verification;const frames=[];
 const io={getJob:()=>job,create:async()=>job=await workspace.create(workspace.sample()),mutate:async(action,fields)=>job=await workspace.act(job.id,action,{revision:job.revision,...fields}),checkpoint:async()=>frames.push(presentationModel({job,receipt,verification})),receipt:async()=>{receipt=workspace.export(job.id);verification=await workspace.verify(job.id);}};
 await runGuidedStory('delegate',io);
 assert.equal(job.status,'BLOCKED');assert.equal(frames.at(-1).proposed,35);assert.equal(frames.at(-1).price,null);assert.equal(frames.at(-1).funded,false);
 await runGuidedStory('negotiate',io);
 assert.deepEqual(frames.at(-1).packets.map(p=>Number(p.price)),[22,18,20]);assert.equal(frames.at(-1).price,null);
 const revisions=job.revision;await runGuidedStory('negotiate',io);assert.equal(job.revision,revisions,'retry does not duplicate negotiation');
 await runGuidedStory('approve',io);
 assert.equal(job.status,'REVIEW');assert.equal(job.agreedPrice,20);assert.equal(job.invoice,25);assert.equal(frames.at(-1).paid,false);assert.equal(frames.at(-1).mismatch,true);assert.equal(frames.at(-1).historicalAuthority,35);
 assert.ok(job.output.length===4&&job.validation.verified);
 await assert.rejects(workspace.act(job.id,'settle',{revision:job.revision}),/exactly match/);
 const blockedHtml=renderPresentation({job});assert.match(blockedHtml,/25 &lt; 40/);assert.match(blockedHtml,/25 ≠ 20/);assert.match(blockedHtml,/data-edge="agreement-settlement" data-confirmed="false"/);
 await runGuidedStory('pay',io);
 assert.equal(job.status,'COMPLETED');assert.equal(verification.verdict,'VALID');assert.equal(frames.at(-1).paid,true);assert.equal(frames.at(-1).verified,true);
 assert.equal(frames.at(-1).historicalInvoice,25);assert.equal(job.transactions.filter(x=>x.kind==='release').length,1);
 await runGuidedStory('pay',io);assert.equal(job.transactions.filter(x=>x.kind==='release').length,1,'retry never pays twice');
 assert.ok(frames.filter(f=>!f.funded).every(f=>!f.paid&&!f.receiptReady));
 for(const frame of frames){if(frame.mismatch)assert.equal(frame.paid,false);}
});

test('future financial visuals cannot be inferred from pending operations, prices, stale receipts or malformed signatures',()=>{
 const base={id:'one',demoMode:true,status:'FUNDING',budget:40,perDeal:30,offers:[],events:[],dealHash:'hash',agreedPrice:20,transactions:[{kind:'fund',status:'PENDING'}]};
 let m=presentationModel({job:base,receipt:{task:{id:'one'}},verification:{verdict:'VALID'}});
 assert.equal(m.price,null);assert.equal(m.funded,false);assert.equal(m.paid,false);assert.equal(m.signatures,false);assert.equal(m.receiptReady,false);
 m=presentationModel({job:{...base,status:'COMPLETED',transactions:[{kind:'fund',status:'CONFIRMED'},{kind:'release',status:'PENDING'}]}});assert.equal(m.paid,false);
 m=presentationModel({job:{...base,status:'COMPLETED',transactions:[{kind:'release',status:'CONFIRMED'}]},receipt:{task:{id:'another'}},verification:{verdict:'VALID'}});assert.equal(m.receiptReady,false);assert.equal(m.verified,false);
 assert.equal(presentationModel({job:{...base,agreementSignatures:{buyer:'address',seller:'address'}}}).signatures,false);
});

test('Live graph uses actual retained public messages, failures and stop, never Guided quotes or synthetic invoice correction',async()=>{
 const current=JSON.parse(readFileSync('artifacts/accord-lock/live/custom-negotiation.json','utf8'));
 const job={id:'test',liveSessionId:current.session.id,status:'DRAFT',offers:[],events:[],budget:40,perDeal:30};
 const live={current,seller:'atlas',available:true};
 let m=presentationModel({mode:'live',job,live});
 assert.equal(m.isLive,true);assert.equal(m.stopped,true);assert.equal(m.action,null);assert.equal(m.paid,false);
 assert.equal(m.quotes[0].price,35);assert.equal(m.quotes[1].price,40);assert.equal(m.quotes[2].price,null);
 const failed={...live,current:{...current,error:'LIVE_BUYER_AUTHORITY',session:{...current.session,stopped:false}}};
 m=presentationModel({mode:'live',job,live:failed});assert.equal(m.phase,'rejected');assert.equal(m.failureReason,'Outside authority');assert.equal(m.price,null);
 const switched=renderPresentation({mode:'live',job,live:{...failed,seller:'orbit',current:{...failed.current,error:null}}});assert.doesNotMatch(switched,/Three agents. Three proposals.|current offer within limit/);
 const html=renderPresentation({mode:'live',job,live:failed});assert.match(html,/LIVE · Kiln · qwen3-32b/);assert.doesNotMatch(html,/GUIDED DEMO/);assert.match(html,/PROPOSAL REJECTED/);assert.doesNotMatch(html,/chat-5dd0722/,'request IDs are secondary inspection content');
 assert.equal(presentationModel({mode:'guided',job,live}).job,null,'Live job never acquires Guided label');
 await assert.rejects(runGuidedStory('pay',{getJob:()=>job}),/Guided sample/);
 const liveReview={...job,transactions:[{kind:'fund',status:'CONFIRMED'}],status:'REVIEW',dealId:'deal',dealHash:'hash',agreedPrice:30,invoice:35,output:[],validation:{verified:true}};
 assert.equal(presentationModel({mode:'live',job:liveReview,live:{...live,current:{...current,session:{...current.session,stopped:false}}}}).action,undefined,'Live overcharge has no automatic correction/payment action');
});

test('projection respects invalid delivery, revoked authority and refunded execution',()=>{
 const job={id:'a',demoMode:true,status:'REVIEW',budget:40,perDeal:30,dealHash:'h',agreedPrice:20,invoice:20,output:[],validation:{verified:false},events:[],offers:[]};
 assert.equal(presentationModel({job}).matched,false);
 assert.equal(presentationModel({job:{...job,status:'REFUNDED'}}).phase,'refunded');
 assert.equal(presentationModel({job:{...job,status:'DRAFT',dealHash:null,authorityRevoked:true}}).action,null);
});

test('reduced motion retains graph semantics and both modes render the same graph component',()=>{
 const css=readFileSync('web/spending/presentation.css','utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/animation:none!important/);assert.match(css,/transition:none!important/);
 for(const mode of ['guided','live']){const html=renderPresentation({mode});assert.match(html,/class="transaction-graph"/);assert.match(html,/GATE 1 · AUTHORITY/);assert.match(html,/GATE 2 · AGREEMENT/);assert.match(html,/data-story-inspect="receipt"/);assert.match(html,/Historical Sepolia proof is separate/);}
});
