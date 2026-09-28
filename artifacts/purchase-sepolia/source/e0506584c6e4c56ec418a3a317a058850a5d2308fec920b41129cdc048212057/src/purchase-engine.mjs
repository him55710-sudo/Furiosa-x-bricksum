import {randomBytes} from 'node:crypto';
import {verifyTypedData,TypedDataEncoder} from 'ethers';
import {CONSENT_TYPES,PURCHASE_REVOKE_TYPES,QUOTE_TYPES,RESOURCE,QUESTION,PREVIEW,hash,sameAddress,uint,nowSeconds,merchantsHash,validateQuote,validateDelivery} from '../shared/purchase.mjs';
const id=()=>hash(randomBytes(24).toString('hex'));
const safeError=e=>/^[A-Z][A-Z0-9_]{1,90}$/.test(e?.message??'')?e.message:'REQUEST_INTERRUPTED';
export class PurchaseEngine {
  constructor({store,chain,model,seller,runtime=null}){Object.assign(this,{store,chain,model,seller,runtime});}
  get(purchaseId){const p=this.store.get('purchase',purchaseId);if(!p)throw new Error('PURCHASE_NOT_FOUND');return p;}
  update(purchaseId,fn){return this.store.transaction(()=>{const p=this.get(purchaseId);fn(p);p.updatedAt=new Date().toISOString();return this.store.put('purchase',purchaseId,p);});}
  event(p,type,data={},runId=null){return this.store.event(p,type,data,runId);}
  async draft(owner,{question=QUESTION,totalCap='2000',perTxCap='800',durationMinutes=30}={}){
    if(typeof question!=='string'||!question.trim()||question.length>1000)throw new Error('INVALID_QUESTION');
    if(uint(totalCap)<=0n||uint(perTxCap)<=0n||uint(perTxCap)>uint(totalCap))throw new Error('INVALID_CAP');
    if(!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>1440)throw new Error('INVALID_DURATION');
    const purchaseId=id(),merchants=['alpha','beta'].map(name=>this.chain.merchant(name).address),resource=structuredClone(RESOURCE);
    const consent={purchaseId,owner,resourceSpecHash:hash(resource),totalCap,perTxCap,expiresAt:String(nowSeconds()+60*durationMinutes),merchantsHash:merchantsHash(merchants),maxSettlements:'1',nonce:String(await this.chain.vault.nonces(owner))};
    const p={schemaVersion:3,id:purchaseId,consent,merchants,resource,question,preview:PREVIEW,signature:null,approval:null,payment:'NOT_SUBMITTED',delivery:'NONE',workflow:'AWAITING_APPROVAL',stopRequested:false,attempts:[],usage:[],modelCalls:0,quote:null,assessment:null,answer:null,tx:null,receipt:null,createdAt:new Date().toISOString()};
    this.store.put('purchase',purchaseId,p);this.event(purchaseId,'PURCHASE_DRAFTED',{consent,resource});return {purchase:p,domain:this.chain.domain,types:CONSENT_TYPES,value:consent};
  }
  async approve(purchaseId,signature){
    const p=this.get(purchaseId);
    if(!sameAddress(verifyTypedData(this.chain.domain,CONSENT_TYPES,p.consent,signature),p.consent.owner))throw new Error('OWNER_SIGNATURE');
    this.update(purchaseId,p=>{if(p.stopRequested)throw new Error('USER_STOPPED');p.signature=signature;p.workflow='APPROVAL_PENDING';});
    const approval=await this.chain.approve(p.consent,p.merchants,signature);
    this.update(purchaseId,p=>{p.approval=approval;if(!p.stopRequested)p.workflow='READY';});this.event(purchaseId,'HUMAN_APPROVED',{transactionHash:approval.hash,consentDigest:TypedDataEncoder.hash(this.chain.domain,CONSENT_TYPES,p.consent)});return this.view(purchaseId);
  }
  acquire(purchaseId){
    const token=id();this.store.transaction(()=>{const current=this.store.get('purchaseLease',purchaseId);if(current){let alive=true;try{process.kill(current.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)throw new Error('PURCHASE_BUSY');}
      this.store.put('purchaseLease',purchaseId,{pid:process.pid,token,startedAt:new Date().toISOString()});});return token;
  }
  release(purchaseId,token){this.store.transaction(()=>{if(this.store.get('purchaseLease',purchaseId)?.token===token)this.store.db.prepare('DELETE FROM docs WHERE kind=? AND id=?').run('purchaseLease',purchaseId);});}
  async sync(purchaseId){
    const p=this.get(purchaseId),state=await this.chain.state(p.consent.owner,purchaseId);
    if(state.settled){
      if(!p.quote||state.event.offerDigest!==TypedDataEncoder.hash(this.chain.domain,QUOTE_TYPES,p.quote.quote)||state.event.evidenceHash!==p.evidenceHash)throw new Error('PAYMENT_EVIDENCE_MISMATCH');
      this.update(purchaseId,p=>{p.payment=state.finalized?'SETTLED':'CONFIRMING';p.receipt=state.receipt;p.finalized=state.finalized;p.paidAmount=state.spent;if(p.delivery==='NONE')p.delivery='PENDING';});
    }else if(p.tx){
      const receipt=await this.chain.provider.getTransactionReceipt(p.tx.hash);
      if(!receipt&&['CONFIRMING','SETTLED'].includes(p.payment)){
        this.event(purchaseId,'PAYMENT_CONFIRMATION_LOST',{txHash:p.tx.hash,previousReceipt:p.receipt,reservationRetained:true});
        this.update(purchaseId,p=>{p.payment='UNKNOWN';p.workflow='PAYING';p.receipt=null;p.finalized=false;p.reason='PAYMENT_CONFIRMATION_PENDING';});
      }
      let finalBlock;
      try{finalBlock=await this.chain.provider.getBlock(this.chain.deployment.chainId===31337?'latest':'finalized');}catch{}
      if(receipt?.status===0&&finalBlock&&receipt.blockNumber<=finalBlock.number){this.update(purchaseId,p=>{p.payment='FAILED_FINAL';p.workflow='STOPPED';p.reason='TRANSACTION_REVERTED';p.failureProof={txHash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:0};});}
      else if(!receipt&&finalBlock){
        const nonce=await this.chain.provider.getTransactionCount(this.chain.deployment.executor,finalBlock.number);
        const settledAtBlock=await this.chain.vault.settled(this.chain.key(p.consent.owner,p.id),{blockTag:finalBlock.number});
        if(nonce>p.tx.nonce&&!settledAtBlock)this.update(purchaseId,p=>{p.payment='FAILED_FINAL';p.workflow='STOPPED';p.reason='TRANSACTION_REPLACED_WITHOUT_PURCHASE';p.failureProof={blockNumber:finalBlock.number,blockHash:finalBlock.hash,confirmedNonce:nonce,signedNonce:p.tx.nonce,settled:false};});
      }
    }
    if(p.signature&&!state.active&&!state.settled&&await this.chain.approval(p.consent))this.update(purchaseId,p=>{p.stopRequested=true;p.workflow='STOPPED';if(!p.tx||p.payment==='FAILED_FINAL')p.payment='REVOKED';p.reason='USER_REVOKED';});
    return state;
  }
  async ask(purchaseId,flow,input,runId){
    this.update(purchaseId,p=>{if(p.stopRequested)throw new Error('USER_STOPPED');if(p.modelCalls>=4)throw new Error('MODEL_CALL_LIMIT');p.modelCalls++;p.workflow=flow==='need-assessment'?'ASSESSING':'ANSWERING';});
    this.event(purchaseId,'KILN_REQUEST_STARTED',{flow},runId);
    return this.model.invoke(flow,input,record=>{this.update(purchaseId,p=>p.usage.push({...record,runId}));this.event(purchaseId,'KILN_RESPONSE',{flow,requestId:record.requestId??null,promptTokens:record.promptTokens,completionTokens:record.completionTokens,totalTokens:record.totalTokens,outcome:record.outcome},runId);});
  }
  async run(purchaseId,{scenario='normal'}={}){
    if(!['normal','drop-response','unrecoverable','over-budget','unlisted','expired'].includes(scenario))throw new Error('INVALID_SCENARIO');
    const lease=this.acquire(purchaseId),runId=id();
    try{
      let p=this.get(purchaseId);if(!p.signature)throw new Error('APPROVAL_REQUIRED');
      this.update(purchaseId,p=>{p.attempts.push({id:runId,pid:process.pid,scenario,sourceHash:this.runtime?.hash??null,startedAt:new Date().toISOString()});});this.event(purchaseId,'EXECUTION_STARTED',{pid:process.pid,scenario,sourceHash:this.runtime?.hash??null},runId);
      if(!p.approval){const found=await this.chain.approval(p.consent);if(!found)throw new Error('APPROVAL_PENDING');this.update(purchaseId,p=>{p.approval=found;});}
      await this.sync(purchaseId);p=this.get(purchaseId);
      if(p.stopRequested)throw new Error('USER_STOPPED');
      if(p.workflow==='COMPLETE'&&p.payment==='SETTLED'){this.event(purchaseId,'CACHED_RESULT_REUSED',{paymentTx:p.receipt.hash},runId);return this.view(purchaseId);}
      if(p.payment==='FAILED_FINAL'){
        this.event(purchaseId,'FINAL_NONPAYMENT_RETRY',{proof:p.failureProof,previousTxHash:p.tx.hash},runId);
        this.update(purchaseId,p=>{p.previousTransactions??=[];p.previousTransactions.push({hash:p.tx.hash,nonce:p.tx.nonce,proof:p.failureProof});p.tx=null;p.receipt=null;p.payment='NOT_SUBMITTED';p.preEvidence=null;p.evidenceHash=null;p.reason=null;});p=this.get(purchaseId);
      }
      if(!['SETTLED','CONFIRMING'].includes(p.payment)){
        if(!p.tx){
          if(Number(p.consent.expiresAt)<=nowSeconds())throw new Error('DEADLINE_EXPIRED');
          const quote=await this.seller.quote(p,scenario);
          this.update(purchaseId,p=>{p.quote=quote;p.reason=null;});this.event(purchaseId,'SIGNED_QUOTE',{quote},runId);
          validateQuote(p,quote,this.chain.domain);
          p=this.get(purchaseId);
          if(!p.assessment){const assessment=await this.ask(purchaseId,'need-assessment',{question:p.question,preview:p.preview,resource:p.resource},runId);this.update(purchaseId,p=>{p.assessment=assessment;});}
          p=this.get(purchaseId);if(!p.assessment.needs_retrieval){this.update(purchaseId,p=>{p.workflow='STOPPED';p.reason='NO_PURCHASE_NEEDED';});this.event(purchaseId,'NO_PURCHASE_NEEDED',{assessment:p.assessment},runId);return this.view(purchaseId);}
          await this.chain.serial(async()=>{
            const current=this.get(purchaseId);if(current.stopRequested)throw new Error('USER_STOPPED');
            const state=await this.chain.state(current.consent.owner,purchaseId);if(state.settled)throw new Error('PURCHASE_ALREADY_PAID');if(!state.active)throw new Error('PURCHASE_INACTIVE');
            validateQuote(current,current.quote,this.chain.domain);
            const preEvidence={schemaVersion:3,runtime:this.runtime,domain:this.chain.domain,consent:current.consent,signature:current.signature,merchants:current.merchants,resource:current.resource,question:current.question,quote:current.quote,assessment:current.assessment,usage:current.usage,events:this.store.events(purchaseId)};
            const evidenceHash=hash(preEvidence),tx=await this.chain.prepare(current.quote,evidenceHash);
            this.update(purchaseId,p=>{if(p.stopRequested)throw new Error('USER_STOPPED');if(p.tx)throw new Error('PAYMENT_ALREADY_PREPARED');p.preEvidence=preEvidence;p.evidenceHash=evidenceHash;p.tx=tx;p.payment='PREPARED';p.workflow='PAYING';});
            this.event(purchaseId,'SIGNED_TRANSACTION_DURABLE',{txHash:tx.hash,nonce:tx.nonce,evidenceHash},runId);
          });
        }
        p=this.get(purchaseId);
        this.update(purchaseId,p=>{if(p.stopRequested)throw new Error('USER_STOPPED');p.payment='SUBMITTED';});
        this.event(purchaseId,'PAYMENT_BROADCAST_ATTEMPT',{txHash:p.tx.hash,reusingSignedTransaction:true},runId);
        try{await this.chain.serial(()=>this.chain.broadcast(p.tx));}
        catch{this.update(purchaseId,p=>{p.payment='UNKNOWN';p.reason='PAYMENT_CONFIRMATION_PENDING';});}
        await this.sync(purchaseId);p=this.get(purchaseId);
        if(p.payment!=='SETTLED'){this.event(purchaseId,'PAYMENT_NOT_FINAL',{payment:p.payment,txHash:p.tx.hash,reservationRetained:!['FAILED_FINAL','REVOKED'].includes(p.payment)},runId);return this.view(purchaseId);}
        this.event(purchaseId,'PAYMENT_CONFIRMED',{txHash:p.receipt.hash,amount:p.paidAmount},runId);
      }
      p=this.get(purchaseId);if(p.payment!=='SETTLED')return this.view(purchaseId);
      if(p.delivery!=='RECEIVED_VALID'){
        if(p.stopRequested)throw new Error('USER_STOPPED');
        const dropResponse=scenario==='drop-response'&&!p.faultInjected;
        if(dropResponse){this.update(purchaseId,p=>{p.faultInjected=true;});this.event(purchaseId,'DEMO_DROP_RESPONSE_ARMED',{paymentTx:p.receipt.hash},runId);}
        try{
          const delivery=await this.seller.retrieve(p,{dropResponse});validateDelivery(p,delivery,this.chain.domain,p.quote.quote.merchant,p.receipt.hash);
          this.update(purchaseId,p=>{p.result=delivery;p.delivery='RECEIVED_VALID';p.workflow='DELIVERED';p.reason=null;});this.event(purchaseId,'DOCUMENT_RECEIVED',{contentHash:delivery.delivery.contentHash,paymentTx:p.receipt.hash,newPayment:false},runId);
        }catch(e){const reason=safeError(e);this.update(purchaseId,p=>{p.delivery=reason==='RESULT_UNRECOVERABLE'?'UNRECOVERABLE':'PENDING';p.workflow='WAITING_FOR_RESULT';p.reason=reason==='REQUEST_INTERRUPTED'?'RESULT_RESPONSE_LOST':reason;});this.event(purchaseId,'RESULT_NOT_RECEIVED',{reason,payment:'SETTLED',additionalPayment:false},runId);return this.view(purchaseId);}
      }
      p=this.get(purchaseId);if(!p.answer){const answer=await this.ask(purchaseId,'evidence-answer',{question:p.question,document:p.result.document},runId);this.update(purchaseId,p=>{if(p.stopRequested)throw new Error('USER_STOPPED');p.answer=answer;p.workflow='COMPLETE';p.reason=null;});this.event(purchaseId,'ANSWER_COMPLETED',{answer},runId);}
      return this.view(purchaseId);
    }catch(e){const reason=safeError(e);this.update(purchaseId,p=>{p.reason=reason;p.workflow=reason.startsWith('KILN_')||reason==='MODEL_CALL_LIMIT'?'REVIEW_REQUIRED':'STOPPED';});this.event(purchaseId,'EXECUTION_STOPPED',{reason},runId);return this.view(purchaseId);}
    finally{this.release(purchaseId,lease);}
  }
  async stop(purchaseId,signature){const p=this.get(purchaseId);const value={purchaseId,owner:p.consent.owner};if(!sameAddress(verifyTypedData(this.chain.domain,PURCHASE_REVOKE_TYPES,value,signature),p.consent.owner))throw new Error('OWNER_SIGNATURE');this.update(purchaseId,p=>{p.stopRequested=true;p.reason='USER_STOP_REQUESTED';});this.event(purchaseId,'USER_STOP_REQUESTED');const receipt=await this.chain.revoke(p.consent.owner,purchaseId,signature);this.update(purchaseId,p=>{p.revocation=receipt;p.workflow='STOPPED';p.reason='USER_REVOKED';});await this.sync(purchaseId);this.event(purchaseId,'PURCHASE_REVOKED',{transactionHash:receipt.hash});return this.view(purchaseId);}
  view(purchaseId){const p=structuredClone(this.get(purchaseId));if(p.tx)delete p.tx.raw;delete p.preEvidence;p.unobservedModelRequests=Math.max(0,p.modelCalls-p.usage.length);return p;}
  bundle(purchaseId){const p=this.get(purchaseId);return {schemaVersion:3,kind:'CONTROL_MEMORY_PURCHASE',domain:this.chain.domain,deployment:{...this.chain.deployment,rpcUrl:this.chain.deployment.chainId===31337?this.chain.deployment.rpcUrl:'REQUIRES_INDEPENDENT_RPC'},purchase:this.view(purchaseId),preEvidence:p.preEvidence??null,events:this.store.events(purchaseId),exportedAt:new Date().toISOString()};}
}
