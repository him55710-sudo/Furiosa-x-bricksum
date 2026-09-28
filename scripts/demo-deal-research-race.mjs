import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {openChain} from '../src/deal-escrow/chain.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';
import {DealEngine} from '../src/deal-escrow/engine.ts';
import {now,hash} from '../src/deal-escrow/domain.ts';
import {fixtureDelivery} from '../src/deal-escrow/delivery.ts';
import {receipt,verifyReceipt} from '../src/deal-escrow/audit.ts';
import {verificationSource} from '../src/deal-escrow/verification-source.mjs';

if(!process.argv.includes('--local')){
  console.log('Use --local to create an isolated synthetic local-EVM settlement race. No model or public-chain calls.');
  process.exit(0);
}
const run=randomUUID(),directory=`data/private/deal-escrow/settlement-race/${run}`,output=`artifacts/deal-escrow/settlement-race/${run}`;
const source=verificationSource().sha256,chain=await openChain({directory,devnetRpc:null});
let store=new DealStore(path.join(directory,'state.sqlite')),engine=new DealEngine(store,chain);
try{
  const time=now(),mid=randomUUID(),id=randomUUID();
  engine.mandate({mandate_id:mid,company_id:'local-race-regression',buyer_id:'recovery-test-agent',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+1200});
  engine.propose({deal_id:id,buyer_id:'recovery-test-agent',seller_id:'seller-a',price_minor:180,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:60,created_at:time,expires_at:time+600,supersedes_deal_id:null},mid);
  engine.agentAction('accept_deal',{deal_id:id});await engine.fund(id);
  const broadcast=chain.broadcast;chain.broadcast=async()=>{throw new Error('SIMULATED_RPC_OFFLINE');};
  await assert.rejects(engine.deliver(id,fixtureDelivery()),/SIMULATED_RPC_OFFLINE/);
  const pendingHash=store.operation(id,'release').txHash,nonceBefore=await chain.provider.getTransactionCount(chain.wallet.address);
  await chain.provider.send('evm_increaseTime',[61]);await chain.provider.send('evm_mine',[]);
  const buyer=chain.contract.connect(await chain.provider.getSigner(chain.deployment.buyer));
  const buyerTx=await(await buyer.refund(store.get(id).dealHash,hash('BUYER_DEADLINE_REFUND'))).wait();
  await engine.recover();assert.equal(store.accounting(mid).reserved,180);
  const before={state:store.get(id).state,reserved:store.accounting(mid).reserved,controller_status:store.operation(id,'release').status};
  store.close();store=new DealStore(path.join(directory,'state.sqlite'));engine=new DealEngine(store,chain);chain.broadcast=broadcast;
  await engine.recover();await engine.recover();
  const bundle=receipt(engine,id),verdict=await verifyReceipt(bundle,chain),nonceAfter=await chain.provider.getTransactionCount(chain.wallet.address);
  assert.equal(verdict.verdict,'VALID');assert.equal(bundle.schema_version,4);assert.equal(bundle.state,'REFUNDED');
  assert.equal(bundle.transactions.refund.tx_hash,buyerTx.hash);assert.equal(bundle.controller_attempts[0].tx_hash,pendingHash);
  assert.equal(bundle.controller_attempts[0].status,'REVERTED');assert.equal(nonceAfter,nonceBefore+1);assert.equal(store.accounting(mid).reserved,0);
  const ending=verificationSource().sha256;assert.equal(ending,source);
  const report={schema_version:1,run,status:'PASS',network:'local-devnet',chain_id:chain.deployment.chainId,deal_id:id,completed_at:new Date().toISOString(),source_fingerprint:source,ending_source_fingerprint:ending,before,after:{state:bundle.state,reserved:0,controller_nonce_before:nonceBefore,controller_nonce_after:nonceAfter},transactions:{fund:bundle.transactions.fund.tx_hash,buyer_refund:buyerTx.hash,controller_revert:pendingHash},model_calls:0,public_chain_transactions:0,verification:verdict,limitations:['Synthetic local regression with a 61-second EVM time advance, not public testnet evidence.','Reopens the actual database; not a separate operating-system crash test.','The single already-signed controller transaction mined as a revert; its gas is not refunded.']};
  mkdirSync(output,{recursive:true});
  for(const [file,data] of [['receipt.json',bundle],['report.json',report]])writeFileSync(path.join(output,file),JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({run,directory,output,deal_id:id,status:report.status,verdict:verdict.verdict}));
}finally{store.close();await chain.close();}
