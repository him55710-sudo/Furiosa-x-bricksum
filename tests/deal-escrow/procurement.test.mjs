import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runProcurement} from '../../src/dealtrace/procurement/run.mjs';
import {verifyProcurement} from '../../src/dealtrace/procurement/verify.mjs';
import {verifyConversation,validateRfq,validateQuote,defaultRfq} from '../../src/dealtrace/procurement/protocol.mjs';
import {validateUsage} from '../../src/dealtrace/procurement/work.mjs';
import {connectProvider} from '../../src/dealtrace/procurement/client.mjs';

test('full procurement: three providers, bilateral EVM signing, successful-only billing and portable tamper rejection', {timeout:120000},async t=>{
 const report=await runProcurement({approved:true,metered:true});assert.equal(report.status,'PASS',report.error);assert.equal(report.verification.verdict,'VALID');assert.equal(report.network.metered,true);
 assert.equal(report.negotiation.providers.length,3);assert.equal(report.negotiation.sessions['seller-b'].reason,'PRICE_DEADLINE_OR_QUALITY');assert.equal(report.units.length,6);assert.equal(report.validation.failed,1);assert.equal(report.model_calls,0);assert(BigInt(report.refunded_wei)>0n);assert.equal(report.transactions.find(t=>t.label==='overbill-blocked').status,0);assert.equal(BigInt(report.paid_wei)+BigInt(report.refunded_wei),BigInt(report.plan.deal.amount));assert.equal(report.idempotent_retry.same_evidence,true);
 const check=copy=>verifyProcurement(copy,{trusted:report.network});
 await t.test('no RPC is incomplete, never a false settlement proof',async()=>assert.equal((await check(report)).verdict,'INCOMPLETE'));
 for(const [label,mutate] of [
  ['changed final price',r=>{r.plan.packet.terms.price_minor+=100;}],
  ['changed transcript',r=>{r.plan.packet.events[0].body.quote.message='We never agreed';}],
  ['different signer',r=>{r.plan.buyerSignature=r.plan.sellerSignature;}],
  ['forged successful usage',r=>{r.units.find(u=>u.body.status==='FAILED').body.status='SUCCESS';}],
  ['different delivery',r=>{r.units[0].body.output={rows:[]};}],
  ['changed bill',r=>{r.claims.correct.amount='1';}],
  ['changed unit price',r=>{r.plan.lines[0].unitPrice='1';}],
  ['changed human budget',r=>{r.plan.mandate.budget='1';}],
  ['different deployment',r=>{r.network.contract=r.plan.mandate.buyer;}]
 ])await t.test(label,async()=>{const copy=structuredClone(report);mutate(copy);assert.equal((await check(copy)).verdict,'INVALID');});
 await t.test('duplicate unit cannot add another billable success',()=>assert.throws(()=>validateUsage(report.plan.packet,[...report.units,report.units[0]]),/MISSING_USAGE/));
 await t.test('provenance must bind an actual offer',()=>{const p=structuredClone(report.plan.packet);p.provenance.delivery_seconds.event_hash='0x00';assert.throws(()=>verifyConversation(p),/TERMS_PROVENANCE/);});
});
test('live-compatible fixed mode uses original V2 and exact negotiated total', {timeout:120000},async()=>{
 const r=await runProcurement({approved:true});assert.equal(r.status,'PASS',r.error);assert.equal(r.network.metered,false);assert.equal(r.verification.verdict,'VALID');assert.equal(r.paid_wei,r.plan.deal.amount);assert.equal(r.refunded_wei,'0');assert.equal(r.transactions.find(t=>t.label==='overbill-blocked').status,0);
});
test('approval, schema and provider endpoint boundaries reject unsafe requests',async()=>{
 await assert.rejects(()=>runProcurement({approved:false}),/HUMAN_APPROVAL_REQUIRED/);
 for(const patch of [{budget_minor:-1},{failed_units_billable:true},{items:[]},{run:'../outside'}])assert.throws(()=>validateRfq({...defaultRfq(),...patch}));
 for(const url of ['http://example.com','file:///tmp/receipt','https://example.com/path','https://user:secret@example.com'])assert.throws(()=>connectProvider({id:'bad',url,address:'0x0',token:'test'}));
});
test('quantity negotiation cannot cross human-approved minimum and maximum units',()=>{
 const r=defaultRfq({metered:true,flexQuantity:true});validateRfq(r);
 const q={action:'offer',message:'A smaller optional package is available.',items:r.items.map(i=>({service:i.service,units:1,unit_price_minor:100})),delivery_seconds:300,quality:'ACTUAL_WITH_SOURCES'};
 validateQuote(q,r);assert.throws(()=>validateQuote(q,defaultRfq({metered:true})),/INVALID_INTEGER/);
 q.items[1].units=4;assert.throws(()=>validateQuote(q,r),/INVALID_INTEGER/);q.items[1].units=0;assert.throws(()=>validateQuote(q,r),/INVALID_INTEGER/);
});
test('stop before negotiation is a recorded terminal outcome with no financial funding',{timeout:30000},async()=>{
 const r=await runProcurement({approved:true,cancelled:()=>true,run:randomUUID()});assert.equal(r.status,'STOPPED');assert.equal(r.error,'HUMAN_STOPPED');assert(!r.transactions.some(t=>t.label==='fund'));
});
