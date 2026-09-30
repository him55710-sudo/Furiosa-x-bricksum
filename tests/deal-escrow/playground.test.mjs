import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createPlaygroundService} from '../../src/accord/playground-service.mjs';
import {sqliteLiveStore} from '../../src/accord/live-store.mjs';
import {verifyPlaygroundEvidence} from '../../src/accord/playground-agents.mjs';
import {authorizePlaygroundPayment} from '../../src/accord/playground-enforcement.mjs';
import {nextNegotiationStep,renderPlayground,parseMoney,rejectedTerms} from '../../web/spending/playground.mjs';

const request={task:'Buy a market research report',budgetMinor:10000,perDealMinor:9000,currency:'USD',constraints:'Include sources',maxDeliveryMinutes:60,allowedSellers:['atlas','nexus','orbit']};
function fixture(t){
 const store=sqliteLiveStore(path.join(mkdtempSync(path.join(tmpdir(),'accord-playground-')),'test.sqlite'));t.after(()=>store.close());let count=0,fail=false,release,hold=false,time=Date.now();
 const service=createPlaygroundService({store,secret:'test-secret-not-used-outside-the-tests-12345',model:'qwen3-32b',now:()=>time,clientFactory:onRecord=>({payload:(system,input,tools)=>({system,input,tools}),async request(flow,p,validate){
  count++;if(hold)await new Promise(r=>{release=r;});if(fail)throw Error('KILN_INVALID_TOOL');
  const x=p.input,prev=x.conversation.at(-1)?.quote;
  let q={action:'offer',seller:x.seller,amountMinor:{atlas:4900,nexus:5100,orbit:11000}[x.seller],feeMinor:0,currency:'USD',deliveryMinutes:30,scope:x.mandate.task,message:'Source-backed research with full coverage.'};
  if(x.step==='counter')q={...prev,action:'counter',amountMinor:prev.amountMinor-100};
  if(x.step==='respond')q={...prev,action:'offer',amountMinor:prev.amountMinor+100};
  if(x.step==='select')q={...x.offers.nexus,action:'accept'};
  if(x.step==='invoice')q={...q,action:'invoice',amountMinor:x.lastDecision?x.agreement.amountMinor:x.agreement.amountMinor+700};
  const record={model:'qwen3-32b',request_id:'fixture-'+count,total_tokens:240};onRecord(record);validate('',q);return {args:q,model:'qwen3-32b',request_id:record.request_id};
 }})});
 const owner=randomUUID();let state;
 return {service,owner,store,get state(){return state;},get count(){return count;},fail:()=>{fail=true;},hold:()=>{hold=true;},release:()=>release(),expire:()=>{time+=21*60*1000;},start:async()=>state=await service.execute(owner,{action:'start',request,operationId:randomUUID()}),act:async(action,extra={})=>state=await service.execute(owner,{action,id:state.session.id,revision:state.revision,operationId:randomUUID(),...extra})};
}
async function deal(f){await f.start();for(const seller of request.allowedSellers)await f.act('offer',{seller});await f.act('counter',{seller:'nexus'});await f.act('respond',{seller:'nexus'});await f.act('select');await f.act('agree');}

test('real workflow contract: dynamic offers, bilateral deal, bad invoice blocked, corrected invoice paid once',async t=>{
 const f=fixture(t);await deal(f);assert.equal(f.state.session.agreement.body.amountMinor,5100);assert.equal(f.state.verification.verdict,'VALID');
 await f.act('invoice');await f.act('enforce');const d=f.state.session.decisions.at(-1);
 assert.equal(d.reason,'AGREEMENT_PRICE_MISMATCH');assert.equal(d.checks.find(c=>c.name==='BUDGET').pass,true);assert.equal(f.state.session.settlement,null);
 let blocked=await f.act('settle');assert.equal(blocked.error,'PLAYGROUND_PAYMENT_NOT_AUTHORIZED');assert.equal(blocked.session.settlement,null);
 await f.act('invoice');await f.act('enforce');assert.equal(f.state.session.decisions.at(-1).verdict,'PAYMENT_AUTHORIZED');await f.act('settle');
 assert.equal(f.state.session.settlement.amountMinor,5100);assert.equal(f.state.session.settlement.buyerRemainingMinor,4900);assert.equal(f.state.verification.verdict,'VALID');
 const calls=f.count,receipt=f.state.session.receipt;await f.act('settle');assert.equal(f.state.error,'PLAYGROUND_ALREADY_SETTLED');assert.equal(f.count,calls);assert.deepEqual(f.state.session.receipt,receipt);
 const tampered=structuredClone(f.state.session);tampered.decisions[0].verdict='PAYMENT_AUTHORIZED';assert.equal(verifyPlaygroundEvidence(tampered).verdict,'INVALID');
});
test('external payment requests use the same enforcement API; unsigned or changed invoices cannot spend',async t=>{
 const f=fixture(t);await deal(f);await f.act('invoice');const invoice=structuredClone(f.state.session.invoices[0]);invoice.body.amountMinor=5100;
 await f.act('enforce',{payment:invoice});assert.equal(f.state.session.decisions.at(-1).reason,'INVOICE_SIGNATURE');assert.equal(f.state.session.settlement,null);
 const s=f.state.session;
 for(const patch of [{currency:'EUR'},{recipient:s.identities.buyer.address},{dealHash:'0x00'},{scope:'Changed work'}]){
  const payment=structuredClone(s.invoices[0]);Object.assign(payment.body,patch);
  assert.equal(authorizePlaygroundPayment({mandate:s.request,agreement:s.agreement,invoice:payment,identities:s.identities}).verdict,'PAYMENT_BLOCKED');
 }
});
test('invalid model responses remain failures and consume calls; private policy is not model evidence',async t=>{
 const f=fixture(t);await f.start();f.fail();await f.act('offer',{seller:'atlas'});assert.equal(f.state.error,'KILN_INVALID_TOOL');assert.equal(f.state.session.messages.length,0);assert.equal(f.state.attempts,1);assert.equal(f.state.attemptLog[0].result,'KILN_INVALID_TOOL');
 assert.match(renderPlayground({current:f.state}),/PROPOSAL REJECTED/);
});
test('STOP wins over in-flight inference and expired authority cannot be reused',async t=>{
 const f=fixture(t);await f.start();f.hold();const command={action:'offer',id:f.state.session.id,revision:0,operationId:randomUUID(),seller:'atlas'};
 const pending=f.service.execute(f.owner,command);
 while(!(await f.service.state(f.owner,command.id)).pending)await new Promise(r=>setTimeout(r,1));
 await f.act('stop');f.release();const stopped=await pending;assert.equal(stopped.session.stopped,true);assert.equal(stopped.session.messages.length,0);
 const g=fixture(t);await g.start();g.expire();await assert.rejects(g.act('offer',{seller:'atlas'}),/LIVE_SESSION_EXPIRED/);
});
test('orchestration chooses only actual next turns; currency uses precise minor units and UI escapes messages',async t=>{
 assert.equal(parseMoney('51.05','USD'),5105);assert.equal(parseMoney('1000','KRW'),1000);assert.throws(()=>parseMoney('1.005','USD'));assert.throws(()=>parseMoney('1.5','KRW'));
 const f=fixture(t);await f.start();assert.deepEqual(nextNegotiationStep(f.state.session),{action:'offer',seller:'atlas'});await f.act('offer',{seller:'atlas'});assert.deepEqual(nextNegotiationStep(f.state.session),{action:'offer',seller:'nexus'});
 const copy=structuredClone(f.state);copy.session.messages[0].quote.message='<img src=x onerror=alert(1)>';const html=renderPlayground({current:copy});assert.doesNotMatch(html,/<img src=x/);assert.match(html,/LIVE · Kiln/);assert.match(html,/No real funds/);
});


test('canonical signatures remain compatible with DealTrace without its hosted filesystem dependencies',async()=>{
 const {hash,signed,verifySigned}=await import('../../src/accord/playground-crypto.mjs');
 const {hash:legacyHash}=await import('../../src/dealtrace/procurement/protocol.mjs');
 const {Wallet}=await import('ethers');const wallet=Wallet.createRandom(),body={price:5105,currency:'USD',terms:{b:2,a:1}};
 assert.equal(hash(body),legacyHash(body));const packet=await signed(wallet,body);assert.deepEqual(verifySigned(packet,wallet.address),body);
});
test('UI retains invalid form values and exposes refresh for a persisted in-flight request',async t=>{
 const draft={task:'<custom task>',budget:'500',perDeal:'200',currency:'EUR',constraints:'Citations',sellers:['nexus']};
 const setup=renderPlayground({draft,info:{available:true}});assert.match(setup,/&lt;custom task&gt;/);assert.match(setup,/value="500"/);assert.match(setup,/<option selected>EUR/);
 const f=fixture(t);await f.start();const current={...f.state,pending:{action:'offer'}};const html=renderPlayground({current});
 assert.match(html,/data-pg="refresh"[^>]*(?<!disabled)>/);assert.match(html,/A saved model request is running/);
 assert.equal(rejectedTerms({action:'offer',currency:'USD',scope:request.task,deliveryMinutes:30,amountMinor:10001,feeMinor:0},request),'OUTSIDE_AUTHORITY');
});
