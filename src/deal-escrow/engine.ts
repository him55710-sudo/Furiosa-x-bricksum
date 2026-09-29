import {ensure,exact,hash,now,policy} from './domain.ts';
import type {Deal,Mandate} from './domain.ts';
import {DealStore} from './store.ts';
import {validateDelivery,validatePreview} from './delivery.ts';
import {sourceDocument} from './source-document.ts';
import {agreementCheck} from '../dealtrace/ledger.mjs';
import {assertProfile,recordClaim,matchingClaim,claimHistory} from '../dealtrace/claims.mjs';

// Multiple facades in one process share the executor queue. Cross-process
// ownership is enforced by openChain's runtime lock, not by this WeakMap.
const executorQueues=new WeakMap<object,Promise<unknown>>();

export class DealEngine {
  store:DealStore;chain:any;clock:()=>number;queue:Promise<unknown>=Promise.resolve();
  constructor(store:DealStore,chain:any,clock=now){this.store=store;this.chain=chain;this.clock=clock;}
  serial<T>(fn:()=>Promise<T>):Promise<T>{const previous=executorQueues.get(this.chain)??Promise.resolve();const next=previous.then(fn,fn);this.queue=next.catch(()=>{});executorQueues.set(this.chain,this.queue);return next;}
  mandate(m:Mandate){return this.store.transaction(()=>this.store.createMandate(m));}
  propose(d:Deal,mandateId:string){ensure(this.chain.sellers[d.seller_id],'UNKNOWN_SELLER');ensure(d.created_at<=this.clock(),'FUTURE_DEAL');ensure(d.expires_at<=this.store.mandate(mandateId).expires_at,'DEAL_OUTLIVES_MANDATE');return this.store.transaction(()=>this.store.createDeal(d,mandateId));}
  // Only these actions are reachable by the model. No amount or authority is accepted.
  agentAction(name:string,args:any){
    ensure(['accept_deal','reject_deal'].includes(name),'FORBIDDEN_AGENT_TOOL');exact(args,['deal_id']);ensure(typeof args.deal_id==='string','SCHEMA_ID');
    return this.store.transaction(()=>{const r=this.store.get(args.deal_id);ensure(r.state==='DEAL_PROPOSED','INVALID_STATE_TRANSITION');this.store.move(args.deal_id,name==='accept_deal'?'DEAL_ACCEPTED':'REJECTED');this.store.event(args.deal_id,name==='accept_deal'?'DEAL_ACCEPTED':'DEAL_REJECTED',{deal_hash:r.dealHash},'agent',r.deal.buyer_id);
      if(name==='accept_deal'&&this.gate(r))this.store.move(args.deal_id,'PREVIEW_REQUIRED');return this.store.get(args.deal_id);});
  }
  gate(r:any){return this.store.control(this.store.mandate(r.mandateId).company_id,r.deal.seller_id);}
  checks(id:string,time=this.clock()){const r=this.store.get(id),m=this.store.mandate(r.mandateId);return [...agreementCheck(this.store,r),...policy(m,r.deal,{time,...this.store.accounting(r.mandateId,id),dealHash:r.dealHash,previewRequired:!!this.gate(r),previewVerified:r.details.preview?.verified===true&&r.details.preview?.deal_hash===r.dealHash})];}
  preview(id:string,raw:string){ensure(typeof raw==='string'&&Buffer.byteLength(raw)<=2_000_000,'DELIVERY_SIZE');return this.store.transaction(()=>{const r=this.store.get(id);ensure(r.state==='PREVIEW_REQUIRED','INVALID_STATE_TRANSITION');const result=validatePreview(raw,r.deal.requirements,this.clock(),r.deal.expires_at);this.store.event(id,'PREVIEW_VALIDATED',result);this.store.details(id,{preview_attempt:result});
    if(result.verified){this.store.details(id,{preview:{...result,raw,deal_hash:r.dealHash}});this.store.move(id,'PREVIEW_VERIFIED');}return this.store.get(id);});}
  approve(id:string){return this.store.transaction(()=>{
    const r=this.store.get(id);ensure(['DEAL_ACCEPTED','PREVIEW_REQUIRED','PREVIEW_VERIFIED','POLICY_APPROVED'].includes(r.state),'INVALID_STATE_TRANSITION');
    const time=this.clock(),checks=this.checks(id,time);this.store.details(id,{policy:checks});this.store.event(id,'POLICY_CHECKED',{checks,mandate:this.store.mandate(r.mandateId),accounting:this.store.accounting(r.mandateId,id),time});const failed=checks.find(c=>!c.pass);
    if(failed){if(failed.name==='PREVIEW_REQUIRED'){if(r.state!=='PREVIEW_REQUIRED')this.store.move(id,'PREVIEW_REQUIRED');}else this.store.move(id,failed.name.includes('EXPIRED')?'EXPIRED':'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:failed.name});return false;}
    this.store.ensureIntentFunding(id);
    if(r.state!=='POLICY_APPROVED')this.store.move(id,'POLICY_APPROVED');return true;
  });}
  async fund(id:string){return this.serial(async()=>{
    const existing=this.store.operation(id,'fund');if(existing&&existing.status!=='PENDING')return this.store.get(id);
    if(!existing){if(!this.approve(id))return this.store.get(id);this.store.transaction(()=>{ensure(!this.store.operation(id,'fund'),'DUPLICATE_OPERATION');this.store.saveOperation(id,'fund',{status:'PENDING',created_at:this.clock()});});}
    await this.execute(id,'fund');return this.store.get(id);
  });}
  async execute(id:string,kind:'fund'|'release'|'refund'){
    let op=this.store.operation(id,kind);ensure(op?.status==='PENDING','OPERATION_NOT_PENDING');const r=this.store.get(id);
    ensure(!this.store.list().some(row=>row.details.reconciliation_required),'CHAIN_RECONCILIATION_REQUIRED');
    const alreadySigned=!!op.raw;
    if(!op.raw){
      assertProfile(r.deal,this.chain.deployment);
      if(kind==='release'&&r.deal.assurance)ensure(matchingClaim(this.store,r,this.chain.deployment,this.clock()),'MATCHING_CLAIM_REQUIRED');
      if(kind!=='fund'&&await this.reconcileBuyerRefund(id))return;
      const unresolved=this.store.list().some(row=>['fund','release','refund'].some(action=>{const other=this.store.operation(row.deal.deal_id,action);return (row.deal.deal_id!==id||action!==kind)&&other?.status==='PENDING'&&other.raw;}));
      ensure(!unresolved,'CHAIN_PREDECESSOR_UNRESOLVED');
      // Last authorization re-check immediately before signing. Once signed, reconcile that exact tx.
      if(kind!=='refund'){const failure=this.checks(id).find(c=>!c.pass);if(failure){this.store.transaction(()=>{this.store.saveOperation(id,kind,{...op,status:'CANCELLED',reason:failure.name});if(kind==='fund')this.store.move(id,failure.name.includes('EXPIRED')?'EXPIRED':'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:failure.name,stage:'FINAL_AUTHORIZATION'});});throw new Error(failure.name);}}
      if(kind==='fund'&&r.deal.requirements.source_document_id){try{sourceDocument(r.deal.requirements.source_document_id);}catch(error){
        const sourceReason=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'SOURCE_READER_UNAVAILABLE';
        this.store.transaction(()=>{this.store.saveOperation(id,kind,{...op,status:'CANCELLED',reason:'SOURCE_NOT_VERIFIABLE'});this.store.move(id,'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:'SOURCE_NOT_VERIFIABLE',source_reason:sourceReason,stage:'BEFORE_SIGNING'});});
        throw new Error('SOURCE_NOT_VERIFIABLE');
      }}
      let signed;
      try{signed=await this.chain.prepare(kind,r.dealHash,r.deal,r.details.attestation_hash);}catch(error){
        if(error instanceof Error&&['DELIVERY_WINDOW_BELOW_FINALITY_BUDGET','DELIVERY_WINDOW_TRUNCATED','OPERATOR_GAS_BUDGET_EXCEEDED'].includes(error.message)&&kind==='fund')this.store.transaction(()=>{this.store.saveOperation(id,kind,{...op,status:'CANCELLED',reason:error.message});this.store.move(id,'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:error.message});});
        throw error;
      }
      op={...op,...signed};this.store.saveOperation(id,kind,op);
    }
    // Raw signed intent is durable before any broadcast. An ambiguous response stays PENDING.
    let receipt;
    try{
      const resolution=alreadySigned&&this.chain.reconcile?await this.chain.reconcile(op,r.dealHash,kind):null;
      if(resolution?.status==='REPLACED'){
        this.store.transaction(()=>{this.store.saveOperation(id,kind,{...op,status:'CANCELLED',reason:'SIGNED_NONCE_REPLACED',replacement:resolution.replacement});this.store.event(id,'ESCROW_TRANSACTION_REPLACED',{operation:kind,...resolution.replacement});if(kind==='fund'){this.store.move(id,'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:'ESCROW_FUND_REPLACED'});}});
        throw new Error('SIGNED_NONCE_REPLACED');
      }
      if(resolution?.status==='REVERTED')throw new Error('CHAIN_REVERTED');
      if(resolution?.status==='CONFIRMED'){
        receipt=resolution.receipt;
        if(resolution.replacement)op={...op,originalTxHash:op.txHash,txHash:receipt.transactionHash,replacement:resolution.replacement};
      }else receipt=await this.chain.broadcast(op);
    }catch(error){
      const reverted=await this.chain.revertedReceipt?.(op);
      if(reverted)this.store.transaction(()=>{
        this.store.saveOperation(id,kind,{...op,status:'REVERTED',receipt:reverted});
        this.store.event(id,'ESCROW_TRANSACTION_REVERTED',{operation:kind,tx_hash:op.txHash,reason:'CHAIN_REVERTED',receipt:reverted});
        if(kind==='fund'){this.store.move(id,'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:'ESCROW_FUND_REVERTED'});}
      });
      throw error;
    }
    // Reconstruct the operation at its own canonical block. The escrow can have
    // advanced after a lost response; a later settlement must not hide funding.
    const onchain=await this.chain.inspect(r.dealHash,receipt.blockNumber);
    const fundingTimestamp=kind==='fund'&&r.deal.assurance?(await this.chain.provider.getBlock(receipt.blockNumber)).timestamp:null;
    ensure(onchain.status===({fund:1,release:2,refund:3}[kind]),'CHAIN_STATE_MISMATCH');
    this.store.transaction(()=>{
      this.store.saveOperation(id,kind,{...op,status:'CONFIRMED',receipt});
      this.store.details(id,{escrow:onchain,[`${kind}_tx`]:receipt.transactionHash});
      if(fundingTimestamp!==null)this.store.details(id,{funding_block_timestamp:fundingTimestamp,delivery_window_intact:onchain.deadline===fundingTimestamp+r.deal.deadline});
      const target=kind==='fund'?'ESCROW_FUNDED':kind==='release'?'SETTLED':'REFUNDED';
      if(this.store.get(id).state!==target)this.store.move(id,target);
      this.store.event(id,kind==='fund'?'ESCROW_FUNDED':kind==='release'?'ESCROW_RELEASED':'ESCROW_REFUNDED',{deal_hash:r.dealHash,amount_minor:r.deal.price_minor,tx_hash:receipt.transactionHash,chain_id:this.chain.deployment.chainId,contract:this.chain.deployment.contract,reason:kind==='fund'?'POLICY_APPROVED':r.details.settlement_reason,attestation_hash:kind==='fund'?null:r.details.attestation_hash});
      if(kind==='refund'&&r.details.validation?.failure_reason_code==='DELIVERY_REQUIREMENT_FAILED')this.store.activate(this.store.mandate(r.mandateId).company_id,r.deal.seller_id,id,r.details.validation);
    });
  }
  async deliver(id:string,raw:string){return this.serial(async()=>{
    await this.reconcileBuyerRefund(id);
    ensure(typeof raw==='string'&&Buffer.byteLength(raw)<=2_000_000,'DELIVERY_SIZE');
    this.store.transaction(()=>{const r=this.store.get(id);ensure(r.state==='ESCROW_FUNDED','INVALID_STATE_TRANSITION');const result=validateDelivery(raw,r.deal.requirements,this.clock(),r.details.escrow.deadline);
      this.store.move(id,'DELIVERY_SUBMITTED');this.store.details(id,{delivery:raw,validation:result});this.store.event(id,'DELIVERY_SUBMITTED',{content_hash:result.content_hash,submitted_at:result.submitted_at},'seller',r.deal.seller_id);this.store.event(id,'DELIVERY_VALIDATED',result,'system','delivery-validator');if(result.verified)this.store.move(id,'DELIVERY_VERIFIED');});
    await this.settle(id);return this.store.get(id);
  });}
  async settle(id:string){
    if(await this.reconcileBuyerRefund(id))return;
    const r=this.store.get(id);ensure(['DELIVERY_SUBMITTED','DELIVERY_VERIFIED','ESCROW_FUNDED'].includes(r.state),'INVALID_STATE_TRANSITION');
    const time=this.clock(),checks=this.checks(id,time),failed=checks.find(c=>!c.pass);const expired=time>=r.details.escrow.deadline;
    const truncated=r.deal.assurance&&r.details.delivery_window_intact===false;
    ensure(r.details.validation||expired||truncated,'DELIVERY_REQUIRED');
    const releaseFailed=['REVERTED','CANCELLED'].includes(this.store.operation(id,'release')?.status);
    const kind=r.details.validation?.verified&&!failed&&!expired&&!releaseFailed&&!truncated?'release':'refund';
    const selectedClaim=kind==='release'&&r.deal.assurance?matchingClaim(this.store,r,this.chain.deployment,time):null;
    if(kind==='release'&&r.deal.assurance&&!selectedClaim){
      if(this.store.events(id).at(-1)?.event_type!=='SETTLEMENT_AWAITING_CLAIM')this.store.event(id,'SETTLEMENT_AWAITING_CLAIM',{reason:'MATCHING_CLAIM_REQUIRED',deal_hash:r.dealHash});
      return;
    }
    const opposite=this.store.operation(id,kind==='release'?'refund':'release');ensure(!opposite||['CANCELLED','REVERTED'].includes(opposite.status),'SETTLEMENT_ALREADY_CLAIMED');
    const reason=kind==='release'?'DELIVERY_VERIFIED':truncated?'DELIVERY_WINDOW_TRUNCATED':releaseFailed?(this.store.operation(id,'release')?.status==='REVERTED'?'ESCROW_RELEASE_REVERTED':'ESCROW_RELEASE_CANCELLED'):r.details.validation?.failure_reason_code??failed?.name??'DELIVERY_DEADLINE_EXPIRED';
    if(!this.store.operation(id,kind))this.store.transaction(()=>{
      this.store.event(id,'FINAL_AUTHORIZATION',{checks,time,mandate:this.store.mandate(r.mandateId),accounting:this.store.accounting(r.mandateId,id)});
      const attestation={deal:r.deal,deal_hash:r.dealHash,mandate:this.store.mandate(r.mandateId),delivery:r.details.delivery??null,validation:r.details.validation??null,final_checks:checks,reason,outcome:kind,prior_event_hash:this.store.events(id).at(-1)?.event_hash,preview:r.details.preview??null,...(r.deal.assurance?{settlement_claim_hash:selectedClaim?hash(selectedClaim):null,claim_history_hash:hash(claimHistory(this.store,id))}:{})};
      this.store.details(id,{settlement_reason:reason,attestation,attestation_hash:hash(attestation)});this.store.saveOperation(id,kind,{status:'PENDING',created_at:this.clock()});
    });
    try{await this.execute(id,kind);}catch(error){
      // Only never-signed cancellation or an exact mined revert permits a refund fallback.
      if(kind==='release'&&['CANCELLED','REVERTED'].includes(this.store.operation(id,kind)?.status))await this.settle(id);else throw error;
    }
  }
  async claim(id:string,input:any){return this.serial(async()=>{
    const result=this.store.transaction(()=>recordClaim(this,id,input));
    if(result.decision.verdict==='ACCEPTED'&&this.store.get(id).state==='DELIVERY_VERIFIED')await this.settle(id);
    return result;
  });}
  async reconcileBuyerRefund(id:string){
    const r=this.store.get(id),fund=this.store.operation(id,'fund');
    if(!this.chain.observeBuyerRefund||!['ESCROW_FUNDED','DELIVERY_SUBMITTED','DELIVERY_VERIFIED'].includes(r.state)||fund?.status!=='CONFIRMED')return false;
    const attempts=['release','refund'].flatMap(kind=>{const op=this.store.operation(id,kind);return op?[{kind,op}]:[];});
    if(attempts.some(({op})=>op.status==='CONFIRMED'))return false;
    const observed=await this.chain.observeBuyerRefund(r.dealHash,fund,{cursor:this.store.scan(id,'buyer-refund'),onProgress:(cursor:unknown)=>this.store.saveScan(id,'buyer-refund',cursor)});if(!observed)return false;
    // A buyer refund cannot consume the controller's signed nonce. Resolve the
    // exact transaction/replacement before archiving it or freeing the budget.
    if(attempts.some(({op})=>op.status==='PENDING'&&op.raw))return false;
    ensure(observed.proof.amount_wei===(BigInt(r.deal.price_minor)*BigInt(this.chain.deployment.unitWei)).toString(),'BUYER_REFUND_AMOUNT_MISMATCH');
    this.store.transaction(()=>{
      ensure(this.store.get(id).state===r.state,'STATE_CONFLICT');
      if(attempts.length||r.details.validation){
        const context={prior_state:r.state,attestation:r.details.attestation??null,attestation_hash:r.details.attestation_hash??null,settlement_reason:r.details.settlement_reason??null};
        const summaries=[];
        for(const {kind,op} of attempts){
          if(op.status==='PENDING')this.store.saveOperation(id,kind,{...op,status:'CANCELLED',reason:'BUYER_REFUND_CONFIRMED'});
          const resolved=this.store.operation(id,kind);
          this.store.archiveControllerOperation(id,kind);
          summaries.push({kind,status:resolved.status,tx_hash:resolved.txHash??null,reason:resolved.reason??null});
        }
        this.store.details(id,{controller_settlement:context,attestation:null});
        this.store.event(id,'BUYER_REFUND_SUPERSEDED_CONTROLLER',{context,operations:summaries});
      }
      const {escrow,proof,...operation}=observed;
      this.store.saveOperation(id,'refund',operation);
      this.store.saveScan(id,'buyer-refund',null);
      this.store.details(id,{escrow,buyer_refund:proof,refund_tx:observed.txHash,settlement_reason:'BUYER_DEADLINE_REFUND',attestation_hash:proof.reason_hash});
      this.store.event(id,'BUYER_REFUND_OBSERVED',proof,'buyer',proof.buyer);
      this.store.move(id,'REFUNDED');
      this.store.event(id,'ESCROW_REFUNDED',{deal_hash:r.dealHash,amount_minor:r.deal.price_minor,tx_hash:observed.txHash,chain_id:this.chain.deployment.chainId,contract:this.chain.deployment.contract,reason:'BUYER_DEADLINE_REFUND',attestation_hash:proof.reason_hash},'buyer',proof.buyer);
      if(r.details.validation?.failure_reason_code==='DELIVERY_REQUIREMENT_FAILED')this.store.activate(this.store.mandate(r.mandateId).company_id,r.deal.seller_id,id,r.details.validation);
    });
    return true;
  }
  async recover(){return this.serial(async()=>{const results=[];let observationUnavailable=false;
    // A previously observed receipt can disappear. Preserve its spent/reserved
    // accounting and require review instead of silently authorizing new money.
    for(const r of this.store.list())for(const kind of ['fund','release','refund']){
      const op=this.store.operation(r.deal.deal_id,kind);if(op?.status!=='CONFIRMED'||!this.chain.verifyStoredReceipt)continue;
      try{await this.chain.verifyStoredReceipt(op);}catch(error){
        const reason=error instanceof Error&&['CHAIN_REORG_DETECTED','CHAIN_FINALITY_PENDING'].includes(error.message)?error.message:'CHAIN_OBSERVATION_UNAVAILABLE';
        if(reason==='CHAIN_OBSERVATION_UNAVAILABLE'){observationUnavailable=true;results.push({id:r.deal.deal_id,kind,status:'PENDING_RECONCILIATION',reason});continue;}
        if(!r.details.reconciliation_required)this.store.transaction(()=>{this.store.details(r.deal.deal_id,{reconciliation_required:{reason,operation:kind,tx_hash:op.txHash}});this.store.event(r.deal.deal_id,'CHAIN_RECONCILIATION_REQUIRED',{reason,operation:kind,tx_hash:op.txHash});});
        results.push({id:r.deal.deal_id,kind,status:'REVIEW_REQUIRED',reason});
      }
    }
    if(observationUnavailable)return results;
    for(const r of this.store.list()){
    const id=r.deal.deal_id;
    try{if(await this.reconcileBuyerRefund(id)){results.push({id,kind:'refund',status:'BUYER_REFUND_RECONCILED'});continue;}}catch(error){results.push({id,kind:'refund',status:'PENDING_RECONCILIATION',reason:error instanceof Error?error.message:'BUYER_REFUND_OBSERVATION_UNAVAILABLE'});continue;}
    if(r.state==='POLICY_APPROVED'&&!this.store.operation(id,'fund')){
      this.store.transaction(()=>{this.store.move(id,'BLOCKED');this.store.event(id,'TRANSACTION_BLOCKED',{reason:'INTERRUPTED_BEFORE_FUNDING'});});
      results.push({id,kind:'fund',status:'CANCELLED_BEFORE_SIGNING'});continue;
    }
    for(const kind of ['fund','release','refund'] as const){if(this.store.operation(id,kind)?.status==='PENDING'){try{await this.execute(id,kind);results.push({id,kind,status:'RECOVERED'});}catch{results.push({id,kind,status:this.store.operation(id,kind)?.status==='REVERTED'?'REVERTED':'PENDING_RECONCILIATION'});}}}
    try{if(await this.reconcileBuyerRefund(id)){results.push({id,kind:'refund',status:'BUYER_REFUND_RECONCILED'});continue;}}catch(error){results.push({id,kind:'refund',status:'PENDING_RECONCILIATION',reason:error instanceof Error?error.message:'BUYER_REFUND_OBSERVATION_UNAVAILABLE'});continue;}
    // Also covers a restart between saving a mined revert and starting the refund.
    if(['REVERTED','CANCELLED'].includes(this.store.operation(id,'release')?.status)&&!this.store.operation(id,'refund')){
      try{await this.settle(id);results.push({id,kind:'refund',status:'RECOVERED'});}catch{results.push({id,kind:'refund',status:'PENDING_RECONCILIATION'});}
    }
    const current=this.store.get(id);
    if(['DELIVERY_SUBMITTED','DELIVERY_VERIFIED'].includes(current.state)&&!this.store.operation(id,'release')&&!this.store.operation(id,'refund')){
      try{await this.settle(id);results.push({id,kind:'settlement',status:'RECOVERED'});}catch{results.push({id,kind:'settlement',status:'PENDING_RECONCILIATION'});}
    }
  }return results;});}
  async expire(id:string){return this.serial(async()=>{if(await this.reconcileBuyerRefund(id))return this.store.get(id);const r=this.store.get(id);ensure(this.clock()>=r.details.escrow.deadline,'NOT_EXPIRED');await this.settle(id);return this.store.get(id);});}
}
