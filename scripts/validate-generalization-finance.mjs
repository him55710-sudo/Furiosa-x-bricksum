import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {laboratory} from '../verification/generalization/evm.mjs';
const argv=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const seed=Number(argv.seed??20260930),count=Number(argv.count??640);
assert(Number.isSafeInteger(seed)&&count>=500&&count<=10000,'Use at least 500 cases');
let state=seed>>>0;const next=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
const int=(min,max)=>min+Math.floor(next()*(max-min+1));
const kinds=['valid','overbill_below_budget','underbill','cap_exceeded','budget_consumed','unlisted_seller','expired_authority','revoked_authority','bad_buyer_signature','bad_agent_signature','bad_seller_signature','bad_claim_signature','bad_evaluator_signature','wrong_payee','expired_delivery','valid_other_seller'];
const cases=Array.from({length:count},(_,i)=>{
 const scale=[1,100,1000000000][int(0,2)],price=int(2,5000)*scale,cap=price+int(1,2000)*scale,budget=cap+price+int(1,2000)*scale;
 return {id:i+1,kind:kinds[i%kinds.length],price,cap,budget,scale,invoice:price+int(1,Math.floor((budget-price)/scale)-1)*scale,valid_for:int(1000,3000),delivery_window:int(30,500),duplicates:int(1,3)};
});
const run=randomUUID(),dir=`artifacts/generalization/financial/${run}`;mkdirSync(dir,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest={run,seed,count,created_at:new Date().toISOString(),scope:'Real local EVM V2 bytecode; synthetic authorizations and deliveries; no Kiln or public-chain claim.',cases,source_hashes:Object.fromEntries(['contracts/DealTraceVault.sol','artifacts/dealtrace/vault/contract.json','verification/generalization/evm.mjs','scripts/validate-generalization-finance.mjs'].map(p=>[p,sha(p)]))};
writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const lab=await laboratory(seed),results=[];
const save=()=>writeFileSync(`${dir}/report.json`,JSON.stringify({run,seed,status:results.length===count?'COMPLETE':'RUNNING',generated:count,executed:results.length,passed:results.filter(r=>r.pass).length,failures:results.filter(r=>!r.pass),mined_transactions:lab.transactions.length,results},null,2)+'\n');
try{for(const c of cases){
 const start=lab.transactions.length,checks=[];let error=null;
 const check=(label,actual,expected)=>{checks.push({label,actual,expected});assert.equal(actual,expected,label);};
 try{
  const seller=c.kind==='valid_other_seller'?'other':'seller';
  const a=await lab.open({budget:c.budget,cap:c.cap,validFor:c.valid_for,badSignature:c.kind==='bad_buyer_signature',seller});
  check('human signature',a.opened,c.kind!=='bad_buyer_signature');
  const amount=c.kind==='cap_exceeded'?c.cap+c.scale:c.price;
  const d=lab.deal(a,{amount,seller:c.kind==='unlisted_seller'?'other':seller,window:c.delivery_window,label:c.id});
  if(c.kind==='revoked_authority')check('revoke',await lab.send('revoke',[a.mandateId],0n,'buyer'),true);
  if(c.kind==='expired_authority')await lab.advance(c.valid_for+1);
  if(c.kind==='budget_consumed'){
   // Exhaust authority through prior signed commitments, including refunds if any.
   let left=c.budget,index=0;while(left>=c.price){const part=lab.deal(a,{amount:Math.min(left,c.cap),window:c.delivery_window,label:`prior-${c.id}-${index++}`});check('prior funding',await lab.fund(part),true);left-=Number(part.amount);}
  }
  const canFund=!['cap_exceeded','budget_consumed','unlisted_seller','expired_authority','revoked_authority','bad_buyer_signature','bad_agent_signature','bad_seller_signature'].includes(c.kind);
  check('funding',await lab.fund(d,{agent:c.kind==='bad_agent_signature'?'other':'agent',seller:c.kind==='bad_seller_signature'?'other':seller}),canFund);
  if(canFund){
   if(c.kind==='expired_delivery')await lab.advance(c.delivery_window+1);
   const invoice=c.kind==='overbill_below_budget'?c.invoice:c.kind==='underbill'?c.price-c.scale:c.price;
   const before=await lab.vault.credits(d.seller);
   const canSettle=['valid','valid_other_seller'].includes(c.kind);
   const claim={amount:invoice,seller:c.kind==='bad_claim_signature'?(seller==='seller'?'other':'seller'):seller,evaluator:c.kind==='bad_evaluator_signature'?'other':'evaluator',payee:c.kind==='wrong_payee'?lab.actors.buyer.address:d.seller};
   check('settlement',await lab.release(d,claim),canSettle);
   check('credit equals signed obligation',String(await lab.vault.credits(d.seller)-before),canSettle?String(c.price):'0');
   if(canSettle)for(let j=0;j<c.duplicates;j++)check('duplicate settlement',await lab.release(d,{...claim,label:j%2?'new-claim-id':'claim'}),false);
   if(['overbill_below_budget','underbill'].includes(c.kind)){
    check('corrected invoice',await lab.release(d,{seller}),true);
    check('corrected invoice replay',await lab.release(d,{seller}),false);
   }
  }
  const balance=await lab.provider.getBalance(lab.address),accounted=await lab.vault.totalLocked()+await lab.vault.totalCredits();check('conservation',String(balance),String(accounted));
 }catch(e){error=e.message;}
 results.push({id:c.id,kind:c.kind,pass:error===null,error,checks,transactions:lab.transactions.slice(start)});save();
 if(c.id%40===0)console.log(JSON.stringify({run,executed:c.id,passed:results.filter(r=>r.pass).length,mined:lab.transactions.length}));
 }}finally{save();await lab.close();}
console.log(JSON.stringify({report:`${dir}/report.json`,passed:results.filter(r=>r.pass).length,total:count}));
if(results.some(r=>!r.pass))process.exitCode=1;
