// Offline adapter simulation. No RPC, funded wallet, model request or broadcast.
import {Wallet,Interface,keccak256} from 'ethers';
import {writeFileSync} from 'node:fs';
import {DealStore} from './source/src/deal-escrow/store.ts';
import {DealEngine} from './source/src/deal-escrow/engine.ts';
import {receipt,verifyReceipt} from './source/src/deal-escrow/audit.ts';
const wallet=Wallet.createRandom(),seller=Wallet.createRandom().address;
const iface=new Interface(['function fund(bytes32 dealHash,address buyer,address seller,uint256 amount,uint32 deliveryWindow,uint64 dealExpiry)']);
const deployment={chainId:31338,contract:'0x1111111111111111111111111111111111111111',controller:wallet.address,buyer:wallet.address,sellers:{'seller-a':seller},unitWei:'1000000000'};
const store=new DealStore(':memory:');
const chain={sellers:deployment.sellers,deployment,contract:{interface:iface}};
const engine=new DealEngine(store,chain,()=>200);
try{
  const mandate={mandate_id:'offline-m',company_id:'offline-company',buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:100,expires_at:1200};
  const deal={deal_id:'offline-deal',buyer_id:mandate.buyer_id,seller_id:'seller-a',price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:100,expires_at:1000,supersedes_deal_id:null};
  engine.mandate(mandate);engine.propose(deal,mandate.mandate_id);engine.agentAction('accept_deal',{deal_id:deal.deal_id});engine.approve(deal.deal_id);
  const dealHash=store.get(deal.deal_id).dealHash,value=150n*1000000000n;
  const request={type:0,chainId:31338,to:deployment.contract,nonce:0,gasLimit:300000,value,data:iface.encodeFunctionData('fund',[dealHash,wallet.address,seller,value,180,1000])};
  const raw=await wallet.signTransaction({...request,gasPrice:1n});
  const replacementRaw=await wallet.signTransaction({...request,gasPrice:2n});
  const originalHash=keccak256(raw),replacementHash=keccak256(replacementRaw);
  store.saveOperation(deal.deal_id,'fund',{status:'PENDING',created_at:200,raw,txHash:originalHash,nonce:0});
  chain.reconcile=async()=>({status:'CONFIRMED',receipt:{transactionHash:replacementHash,status:1,blockNumber:1,blockHash:'0x'+'a'.repeat(64),from:wallet.address,to:deployment.contract,logs:[]},replacement:{originalTxHash:originalHash,replacementTxHash:replacementHash,nonce:0}});
  chain.inspect=async()=>({buyer:wallet.address,seller,amount:value.toString(),deadline:380,status:1});
  await engine.execute(deal.deal_id,'fund');
  const bundle=receipt(engine,deal.deal_id),op=bundle.transactions.fund;
  const result={scope:'Offline same-intent fee replacement simulation; no transaction was broadcast',state:bundle.state,operationHash:op.tx_hash,claimHash:op.claim.tx_hash,hashesMatch:op.tx_hash===op.claim.tx_hash,verification:await verifyReceipt(bundle)};
  if(result.hashesMatch||result.verification.reason!=='TRANSACTION_CLAIM_MISMATCH')throw new Error('Expected mismatch not reproduced');
  writeFileSync(new URL('./replacement-reproduction.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{store.close();}
