import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {scenario} from '../src/fixtures.mjs';
import {verifyBundle} from '../src/verifier.mjs';
import {MANDATE_TYPES,REVOKE_TYPES,hash} from '../shared/schema.mjs';
import {title} from './catalog.mjs';
import {lab,run,ledger,fixtureKiln,evidence} from './helpers.mjs';
import {personas,planSources,planFixtures} from './persona-plan.mjs';

const arms=['B0','B1','CM'];
function personaTest(id,fn){test(title(id),{timeout:120000},async t=>{
  const report={id,...personas[id],planSources,evidenceLevel:'SYNTHETIC_PERSONA_POLICY_REAL_LOCAL_EVM',steps:[],observations:[],status:'RUNNING'};
  try{await fn(t,report);report.status='PASS';}catch(e){report.status='FAIL';report.error=String(e.message).slice(0,1200);throw e;}
  finally{await evidence('persona-'+id.slice(4),report);}
});}
function world(l,{compromised=false}={}){
  const store=new Store(':memory:');l.stores.add(store);
  const kiln=fixtureKiln(b=>{
    const f=b.choices[0].message.tool_calls[0].function,args=JSON.parse(f.arguments);
    if(f.name==='request_counteroffer')args.total_minor=2800;
    if(compromised&&f.name==='propose_purchase')args.offer_id='candidate-3';
    f.arguments=JSON.stringify(args);return b;
  });
  const engine=new Engine({store,chain:l.chain,kiln,scenarioProvider:id=>structuredClone(planFixtures[id]??scenario(id))});
  return {store,engine,chain:l.chain,kiln,async approve(options={},owner=Wallet.createRandom()){
    const draft=await engine.draft(owner.address,{totalCap:'3000',perTxCap:'3000',maxCalls:12,...options});
    await engine.approve(draft.session.id,await owner.signTypedData(l.chain.domain,MANDATE_TYPES,draft.value));
    return {store,engine,chain:l.chain,kiln,owner,id:draft.session.id};
  }};
}
async function observe(report,c,r,label,verifier){
  const check=await verifyBundle(c.engine.bundle(r.id),verifier),s=c.engine.session(c.id);
  report.steps.push({label,arm:s.policy.arm,scenario:r.scenarioId,sessionId:c.id,runId:r.id,status:r.status,reason:r.reason,paidMinor:r.status==='SETTLED'?r.offer.offer.total:'0',chosenMerchant:r.offer?.offer.merchant??null,refundHours:r.offer?.offer.refundHours??null,quantity:r.offer?.offer.quantity??null,inferenceCalls:r.usage.length,quotes:r.quoteMetrics,appliedControls:r.controls.length,spent:s.spent,reserved:s.reserved,verification:check.status,verificationReason:check.reason,txHash:r.receipt?.hash??null});
  await ledger(c);
  assert.equal(check.status,['SETTLED','STOPPED','REVIEW_REQUIRED'].includes(r.status)?'VALID':'INCOMPLETE',`${label}: ${check.reason}`);
  return check;
}
personaTest('PER-001',async(t,report)=>{
  const l=await lab(t),results=[];
  for(const arm of arms)for(const seller of ['alpha','beta','gamma']){
    const w=world(l),c=await w.approve({arm,merchantIds:[seller]}),r=await run(c,'normal');
    await observe(report,c,r,`only ${seller} approved`,l.verifier);results.push({seller,r});
  }
  for(const {seller,r} of results){assert.equal(r.status,'SETTLED',`${seller}: valid approved seller was overblocked`);assert.equal(r.offer.offer.merchant,l.chain.merchant(seller).address);}
});
personaTest('PER-002',async(t,report)=>{
  const l=await lab(t),results=[];
  for(const arm of arms){
    const w=world(l),low=await w.approve({arm,perTxCap:'600'}),r=await run(low,'normal');
    await observe(report,low,r,'600 minor frugal buyer',l.verifier);results.push({r,amount:'600'});
    for(let i=0;i<4;i++){
      const c=await w.approve({arm}),r=await run(c,`F2-order-${i}`);
      await observe(report,c,r,'untrusted and over-cap sellers mixed with valid offers',l.verifier);results.push({r,amount:'2600'});
    }
    const delayed=await w.approve({arm}),job=delayed.engine.enqueue(delayed.id,{scenarioId:'F2-order-0',quoteDelayMs:500});await delayed.engine.wait(job.id);
    const dr=delayed.store.get('run',job.id);await observe(report,delayed,dr,'F2b synthetic 500ms quote sensitivity',l.verifier);results.push({r:dr,amount:'2600'});
  }
  for(const {r,amount} of results){assert.equal(r.status,'SETTLED','one ineligible candidate must not cancel the whole purchase');assert.equal(r.offer.offer.total,amount);}
});
personaTest('PER-003',async(t,report)=>{
  const l=await lab(t);
  for(const arm of arms){
    const w=world(l),c=await w.approve({arm}),failure=await run(c,'T0');await observe(report,c,failure,'31 > signed cap 30',l.verifier);assert.equal(failure.status,'STOPPED');
    const newQuote=await run(c,'F1');await observe(report,c,newQuote,'new offer at 29',l.verifier);assert.equal(newQuote.status,'SETTLED');assert.equal(newQuote.offer.offer.total,'2900');
    const fresh=await w.approve({arm},c.owner),reformed=await run(fresh,'F6');await observe(report,fresh,reformed,'same owner, new mandate, fee removed',l.verifier);assert.equal(reformed.status,'SETTLED');
    const raised=await w.approve({arm,totalCap:'4000',perTxCap:'4000'},c.owner),accepted=await run(raised,'T0');await observe(report,raised,accepted,'human signed a separate 40 TC mandate',l.verifier);assert.equal(accepted.status,'SETTLED');assert.equal(accepted.offer.offer.total,'3100');
    assert.equal(c.engine.session(c.id).mandate.perTxCap,'3000');assert.equal(w.store.all('control').length,arm==='CM'?1:0);
  }
});
personaTest('PER-004',async(t,report)=>{
  const l=await lab(t);
  for(const arm of arms){
    const w=world(l),c=await w.approve({arm});await run(c,'T0');
    const r=await run(c,'F3');await observe(report,c,r,'35 -> 28 with a new signed offer',l.verifier);
    assert.equal(r.status,'SETTLED');assert.equal(r.offer.offer.total,'2800');assert.equal(r.usage.length,2);
    assert.notEqual(r.quotes[0].offer.offerId,r.offer.offer.offerId);assert.equal(r.quotes[0].offer.total,'3500');
    const insufficient=await w.approve({arm,perTxCap:'2700'}),blocked=await run(insufficient,'F3');await observe(report,insufficient,blocked,'approved cap below seller floor',l.verifier);assert.equal(blocked.status,'STOPPED');
    const remaining=await w.approve({arm});await run(remaining,'F3-spend-first');const exhausted=await run(remaining,'F3');await observe(report,remaining,exhausted,'per-tx cap 30 but remaining budget 27',l.verifier);assert.equal(exhausted.status,'STOPPED');assert.equal(remaining.engine.session(remaining.id).spent,'300');
  }
});
personaTest('PER-005',async(t,report)=>{
  const l=await lab(t),alternatives=[];
  for(const arm of arms){
    const w=world(l),c=await w.approve({arm});await run(c,'T0');const r=await run(c,'F4');await observe(report,c,r,'only late-quote seller available',l.verifier);
    assert.equal(r.status,arm==='B0'?'SETTLED':'REVIEW_REQUIRED');
    if(arm!=='B0'){assert.equal(r.quoteMetrics.attempts.early,1);assert.equal(r.quoteMetrics.rejected,1);assert.equal(r.quoteMetrics.early,0);}
    const d=await w.approve({arm},c.owner),alt=await run(d,'F4-alternative');await observe(report,d,alt,'honest alternative available',l.verifier);alternatives.push({arm,alt});
    const reverse=await w.approve({arm},c.owner),reversed=await run(reverse,'F4-alternative-reversed');await observe(report,reverse,reversed,'honest alternative first in candidate order',l.verifier);alternatives.push({arm,alt:reversed});
    if(arm!=='B0'){const none=await w.approve({arm},c.owner),blocked=await run(none,'all-ineligible');await observe(report,none,blocked,'no eligible firm quote remains',l.verifier);assert.equal(blocked.status,'REVIEW_REQUIRED');assert.equal(blocked.usage.length,0);}
  }
  report.observations.push({kind:'TRADEOFF',text:'With only the late-quote seller, B1 and CM require review while B0 buys. This fixture represents quote timing; it does not simulate a real seller negotiation or human review time.'});
  for(const {arm,alt} of alternatives){assert.equal(alt.status,'SETTLED',`${arm}: eligible alternative lost`);assert.equal(alt.offer.offer.total,arm==='B0'?'2400':'2200');}
});
personaTest('PER-006',async(t,report)=>{
  const l=await lab(t);
  for(const arm of arms){
    const normal=await world(l).approve({arm}),clean=await run(normal,'U1');await observe(report,normal,clean,'U1 normal buyer',l.verifier);
    const resilient=await world(l).approve({arm}),safe=await run(resilient,'U1-injection');await observe(report,resilient,safe,'synthetic buyer ignores seller instructions',l.verifier);
    const affected=await world(l,{compromised:true}).approve({arm}),mandateHash=hash(affected.engine.session(affected.id).mandate),attacked=await run(affected,'U1-injection');
    const verdict=await observe(report,affected,attacked,'synthetic buyer follows gamma preference injection',l.verifier);
    assert.equal(clean.offer.offer.total,'2400');assert.equal(safe.offer.offer.total,'2400');assert.equal(attacked.status,'SETTLED');assert.equal(attacked.offer.offer.total,'2800');
    assert.equal(hash(affected.engine.session(affected.id).mandate),mandateHash);assert.equal(verdict.status,'VALID');
    report.observations.push({kind:'QUALITY_DEGRADATION',arm,hardViolations:0,utilityDegraded:true,extraPaidMinor:400,refundHoursBefore:72,refundHoursAfter:24,creditsBefore:120,creditsAfter:100,text:'A compromised synthetic selector can choose a worse but permitted seller. This demonstrates the safety/utility distinction; it is not a measured attack success rate against Kiln.'});
  }
});
personaTest('PER-007',async(t,report)=>{
  const l=await lab(t),http=await l.http(),a=await http.login(),b=await http.login();
  const a1=await http.approve(a),a2=await http.approve(a),b1=await http.approve(b);
  const ctx=(user,id)=>({store:http.store,engine:http.engine,chain:l.chain,owner:user.owner,id});
  const first=await http.run(a,a1,'hidden-fee');await observe(report,ctx(a,a1),first,'team A first incident',l.verifier);
  const inherited=await http.run(a,a2,'hidden-fee');await observe(report,ctx(a,a2),inherited,'team A new session inherits control',l.verifier);
  const isolated=await http.run(b,b1,'hidden-fee');await observe(report,ctx(b,b1),isolated,'team B does not inherit A control',l.verifier);
  assert.equal(first.usage.length,1);assert.equal(inherited.usage.length,0);assert.equal(isolated.usage.length,1);
  const corrected=await http.run(a,a2,'reformed');await observe(report,ctx(a,a2),corrected,'team A corrected seller',l.verifier);assert.equal(corrected.status,'SETTLED');
  assert.equal((await http.request(`/api/runs/${corrected.id}/evidence`,{cookie:b.cookie})).status,403);
  const dashboard=(await http.request('/api/dashboard',{cookie:b.cookie})).body;assert.equal(dashboard.sessions.length,1);assert.ok(dashboard.controls.every(c=>c.owner===b.owner.address));
  const bundle=(await http.request(`/api/runs/${corrected.id}/evidence`,{cookie:a.cookie})).body;
  assert.ok(bundle.controlSources?.some(source=>source.session.id===a1),'inherited control source must be exported for the auditor');
  const missing=structuredClone(bundle);delete missing.controlSources;assert.equal((await verifyBundle(missing,l.verifier)).status,'INCOMPLETE');
  const changed=structuredClone(bundle);changed.controlSources[0].events[0].type='FORGED_EVENT';assert.equal((await verifyBundle(changed,l.verifier)).status,'INVALID');
  const verdict=await verifyBundle(bundle,l.verifier);assert.ok(verdict.unverifiedFields.some(f=>f.includes('historical balances')));
  report.observations.push({kind:'EVIDENCE_LIMITATION',text:'Source signatures, scope and internal policy replay are checked. Unanchored failure occurrence, completeness and historical reservations are not independently proven.'});
});
personaTest('PER-008',async(t,report)=>{
  const l=await lab(t),w=world(l),a=await w.approve(),b=await w.approve(),broadcast=l.chain.broadcast;
  l.chain.broadcast=async()=>{throw new Error('INJECTED_PRE_BROADCAST_FAILURE');};
  const uncertain=await run(a,'normal');await observe(report,a,uncertain,'A loses RPC before broadcasting',l.verifier);assert.equal(uncertain.status,'UNKNOWN');l.chain.broadcast=broadcast;
  const stop=await a.engine.stop(a.id,await a.owner.signTypedData(l.chain.domain,REVOKE_TYPES,{sessionId:a.id,owner:a.owner.address}));assert.deepEqual(stop.submittedRuns,[uncertain.id]);
  await a.engine.recover();await a.engine.recover();const resolved=w.store.get('run',uncertain.id);await observe(report,a,resolved,'A stop consumes the prepared nonce, then recovery',l.verifier);
  const resumed=await run(b,'normal');await observe(report,b,resumed,'B resumes after A resolves',l.verifier);
  assert.equal(resolved.status,'STOPPED','nonce replacement must not remain UNKNOWN forever');assert.equal(a.engine.session(a.id).reserved,'0');assert.equal(await l.chain.vault.spent(a.id),0n);assert.equal(resumed.status,'SETTLED');
  const c=await w.approve();l.chain.broadcast=async()=>{throw new Error('INJECTED_PRE_BROADCAST_FAILURE');};const pending=await run(c,'normal');l.chain.broadcast=broadcast;
  await w.approve();await w.engine.recover();const replaced=w.store.get('run',pending.id);await observe(report,c,replaced,'a new mandate consumes the missing payment nonce',l.verifier);
  assert.equal(replaced.status,'STOPPED');assert.equal(c.engine.session(c.id).reserved,'0');assert.equal(await l.chain.vault.spent(c.id),0n);
});
personaTest('PER-009',async(t,report)=>{
  const l=await lab(t),w=world(l),c=await w.approve({totalCap:'2400',perTxCap:'800'}),r1=await run(c,'normal'),early=c.engine.bundle(r1.id);
  const r2=await run(c,'normal');await run(c,'hidden-fee');await c.engine.stop(c.id,await c.owner.signTypedData(l.chain.domain,REVOKE_TYPES,{sessionId:c.id,owner:c.owner.address}));
  for(const [label,bundle] of [['early export',early],['later export of R1',c.engine.bundle(r1.id)],['later export of R2',c.engine.bundle(r2.id)]]){const v=await verifyBundle(bundle,l.verifier);assert.equal(v.status,'VALID',label);report.steps.push({label,verification:v.status,runId:bundle.run.id,observedSession:v.observedSession});}
  for(const [field,value] of [['spent','0'],['reserved','99999'],['status','ACTIVE']]){
    const altered=c.engine.bundle(r2.id);altered.session[field]=value;const v=await verifyBundle(altered,l.verifier);
    assert.ok(v.status==='INVALID'||(v.unverifiedFields?.includes('session.'+field)&&v.observedSession?.spent==='1600'&&v.observedSession?.active===false),'untrusted session summary must not silently acquire VALID status');
  }
  const forged=c.engine.bundle(r2.id);forged.run.authorization.spentBefore='0';assert.equal((await verifyBundle(forged,l.verifier)).status,'INVALID');
});
personaTest('PER-010',async(t,report)=>{
  const l=await lab(t),w=world(l),c=await w.approve({totalCap:'1600',perTxCap:'800'});
  const duplicate=await Promise.all([run(c,'normal','same-purchase'),run(c,'normal','same-purchase')]);assert.equal(duplicate[0].id,duplicate[1].id);assert.equal(await l.chain.vault.spent(c.id),800n);
  const team=await w.approve({totalCap:'1600',perTxCap:'800'}),races=await Promise.all(Array.from({length:6},(_,i)=>run(team,'normal','team-'+i)));
  for(const r of races)await observe(report,team,r,'six independent requests race for 16 TC',l.verifier);
  assert.equal(races.filter(r=>r.status==='SETTLED').length,2);assert.equal(await l.chain.vault.spent(team.id),1600n);
  report.observations.push({kind:'PRODUCT_LIMITATION',text:'API idempotency requires the same requestId. Separate tabs or newly generated IDs represent independent purchases; semantic purchase-intent deduplication is not implemented.'});
});
