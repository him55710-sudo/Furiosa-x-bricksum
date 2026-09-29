// Permissionless timeout recovery to the immutable buyer. Never changes an invoice,
// creates a new deal, or sends funds to a caller-selected recipient.
import {JsonRpcProvider,Contract,Wallet,keccak256} from 'ethers';
import {readJson} from '../src/deal-escrow/public-run.mjs';
import {saveJson} from '../src/dealtrace/procurement/storage.mjs';
import {acquireRuntimeLock} from '../src/deal-escrow/runtime-lock.mjs';
import {openExecution} from '../src/dealtrace/procurement/chain.mjs';
import {ensure,hash} from '../src/dealtrace/procurement/protocol.mjs';

const run=process.argv[2];ensure(/^[a-f0-9-]{36}$/.test(run),'RUN_ID');
const directory=`data/private/dealtrace/procurement/${run}`,out=`artifacts/dealtrace/procurement/runs/${run}`,lock=acquireRuntimeLock(directory);
let chain;
try{
 const journal=readJson(directory+'/journal.json'),original=readJson(out+'/report.json');ensure(journal.config.publicNetwork&&journal.plan&&journal.operations.fund,'FUNDED_PUBLIC_RUN_REQUIRED');
 const p=journal.plan,report={...original,transactions:structuredClone(original.transactions)},persist=()=>saveJson(directory+'/journal.json',journal);
 chain=await openExecution({directory,journal,report,persist,publicNetwork:true,metered:journal.config.metered,onProgress:()=>{}});
 const e=await chain.contract.escrows(p.deal.dealHash),latest=await chain.provider.getBlock('latest');
 if(e.status===1n&&latest.timestamp<Number(e.deadline)){console.log(JSON.stringify({status:'WAITING_FOR_DEADLINE',deadline:Number(e.deadline),current:latest.timestamp,transactions_sent:0}));process.exitCode=2;}
 else{
  if(e.status===1n)await chain.tx('refund-expiry',await chain.call('refund',[p.deal.dealHash,2,hash({run,reason:'SIGNED_DEADLINE_EXPIRED'})]));
  const state=await chain.contract.escrows(p.deal.dealHash);ensure(state.status===2n||state.status===3n,'TERMINAL_ESCROW_REQUIRED');const beneficiary=state.status===3n?p.mandate.buyer:p.deal.seller;
  if(await chain.contract.credits(beneficiary)>0n)await chain.tx('recovery-withdraw',await chain.call('withdrawFor',[beneficiary]));
  const evidence={run,kind:'PERMISSIONLESS_TIMEOUT_OR_WITHDRAWAL',state:Number(state.status),beneficiary,transactions:report.transactions.filter(t=>['refund-expiry','recovery-withdraw'].includes(t.label)),checked_at:new Date().toISOString(),note:'Original transcript and execution report preserved; these recovery operations use the same durable signed-intent journal.'};
  saveJson(out+'/recovery.json',evidence);console.log(JSON.stringify(evidence));
 }
}finally{await chain?.close();lock.release();}
