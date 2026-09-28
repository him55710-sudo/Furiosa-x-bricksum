import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync} from 'node:fs';import path from 'node:path';import {tmpdir} from 'node:os';
import {openChain} from '../../src/deal-escrow/chain.mjs';import {DealStore} from '../../src/deal-escrow/store.ts';import {DealEngine} from '../../src/deal-escrow/engine.ts';import {hash,now} from '../../src/deal-escrow/domain.ts';import {receipt,verifyReceipt} from '../../src/deal-escrow/audit.ts';

test('buyer deadline refund survives an app restart, preserves uncertain reservations, and is audited as buyer action',async()=>{
  const chain=await openChain(),file=path.join(mkdtempSync(path.join(tmpdir(),'ade-buyer-refund-')),'state.sqlite');let store=new DealStore(file),engine=new DealEngine(store,chain);
  try{
    const t=now(),m={mandate_id:randomUUID(),company_id:'buyer-recovery',buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+1200};engine.mandate(m);
    const d={deal_id:randomUUID(),buyer_id:m.buyer_id,seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:4,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:1,format:'JSON'},deadline:60,created_at:t,expires_at:t+600,supersedes_deal_id:null};
    engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});await engine.fund(d.deal_id);
    const dealHash=hash(d),buyer=chain.contract.connect(await chain.provider.getSigner(chain.deployment.buyer)),controllerNonce=await chain.provider.getTransactionCount(chain.wallet.address),reason=hash('BUYER_DEADLINE_REFUND');
    await assert.rejects(buyer.refund.staticCall(dealHash,reason),/REFUND_UNAUTHORIZED|revert/);
    store.close();await chain.provider.send('evm_increaseTime',[61]);await chain.provider.send('evm_mine',[]);
    const refund=await(await buyer.refund(dealHash,reason)).wait();
    store=new DealStore(file);engine=new DealEngine(store,chain);assert.equal(store.get(d.deal_id).state,'ESCROW_FUNDED');assert.equal(store.accounting(m.mandate_id).reserved,180);
    const observer=chain.observeBuyerRefund;chain.observeBuyerRefund=async()=>{throw new Error('RPC_OFFLINE');};
    assert.equal((await engine.recover()).at(-1).status,'PENDING_RECONCILIATION');assert.equal(store.accounting(m.mandate_id).reserved,180);assert.equal(store.operation(d.deal_id,'refund'),null);
    chain.observeBuyerRefund=observer;chain.finalityPolicy.confirmations=100;
    await assert.rejects(engine.reconcileBuyerRefund(d.deal_id),/CHAIN_FINALITY_PENDING/);assert.equal(store.accounting(m.mandate_id).reserved,180);chain.finalityPolicy.confirmations=1;
    assert.equal((await engine.recover()).at(-1).status,'BUYER_REFUND_RECONCILED');await engine.recover();
    assert.equal(store.get(d.deal_id).state,'REFUNDED');assert.equal(store.accounting(m.mandate_id).reserved,0);assert.equal(store.operation(d.deal_id,'refund').raw,undefined);
    assert.equal(store.events(d.deal_id).filter(e=>e.event_type==='ESCROW_REFUNDED').length,1);assert.equal(await chain.provider.getTransactionCount(chain.wallet.address),controllerNonce);
    const evidence=receipt(engine,d.deal_id);assert.equal(evidence.schema_version,3);assert.equal(evidence.transactions.refund.tx_hash,refund.hash);assert.equal(evidence.transactions.refund.claim.sender,chain.deployment.buyer);
    assert.equal((await verifyReceipt(evidence)).verdict,'STRUCTURALLY_VALID');const audited=await verifyReceipt(evidence,chain);assert.equal(audited.verdict,'VALID',JSON.stringify(audited));
    for(const mutate of [r=>r.transactions.refund.actor='controller',r=>r.transactions.refund.claim.sender=r.network.controller,r=>r.evidence.buyer_refund.amount_wei='1',r=>r.schema_version=2,r=>r.evidence.buyer_refund.refund_block_timestamp=r.evidence.buyer_refund.deadline-1]){const bad=structuredClone(evidence);mutate(bad);assert.equal((await verifyReceipt(bad,chain)).verdict,'INVALID');}
    const fake=structuredClone(evidence);fake.evidence.buyer_refund.refund_block_timestamp++;
    for(const e of fake.events)if(e.event_type==='BUYER_REFUND_OBSERVED')e.structured_payload=structuredClone(fake.evidence.buyer_refund);
    let previous=null;for(const event of fake.events){event.previous_event_hash=previous;const {event_hash,...body}=event;event.event_hash=hash(body);previous=event.event_hash;}
    assert.equal((await verifyReceipt(fake,chain)).reason,'CHAIN_BUYER_REFUND_DEADLINE_MISMATCH');
    const impersonated=JSON.parse(JSON.stringify(evidence).replaceAll(chain.deployment.controller,chain.sellers['seller-b']));
    assert.equal((await verifyReceipt(impersonated,chain)).reason,'CHAIN_DEPLOYMENT_IDENTITY_MISMATCH');
  }finally{store.close();await chain.close();}
});
