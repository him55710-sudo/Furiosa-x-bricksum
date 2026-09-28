import {randomBytes,randomUUID} from 'node:crypto';
import {verifyTypedData} from 'ethers';
import {MANDATE_TYPES,REVOKE_TYPES,hash,textHash,merchantsHash,sameAddress,uint,nowSeconds,scopeKey,MODEL,PURPOSE,SKU,POLICY_VERSION} from '../shared/schema.mjs';
import {checkOffer,reserve,startSubmission,stopLocally,deriveControl} from './policy.mjs';
import {scenario} from './fixtures.mjs';
const identifier=()=> '0x'+randomBytes(32).toString('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const terminal=new Set(['SETTLED','STOPPED','REVIEW_REQUIRED','SIMULATED']);
const failureCode=e=>/^[A-Z][A-Z0-9_]{1,80}$/.test(e?.message??'')?e.message:'EXECUTION_FAILED';
export class Engine {
  constructor({store,chain,kiln,simulate=false,scenarioProvider=scenario}) {Object.assign(this,{store,chain,kiln,simulate,scenarioProvider});this.jobs=new Map();}
  session(id){const s=this.store.get('session',id);if(!s)throw new Error('SESSION_NOT_FOUND');return s;}
  async draft(owner,input={}){
    const totalCap=String(input.totalCap??'2000'),perTxCap=String(input.perTxCap??'800');
    if(uint(totalCap)<1n||uint(totalCap)>100000n||uint(perTxCap)<1n||uint(perTxCap)>uint(totalCap))throw new Error('INVALID_BUDGET');
    const duration=Number(input.durationMinutes??60);if(!Number.isInteger(duration)||duration<1||duration>1440)throw new Error('INVALID_DEADLINE');
    const maxCalls=Number(input.maxCalls??5);if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>20)throw new Error('INVALID_CALL_LIMIT');
    const ids=input.merchantIds??['alpha','beta','gamma'];if(!Array.isArray(ids)||!ids.length||ids.length>3||new Set(ids).size!==ids.length||ids.some(x=>!['alpha','beta','gamma'].includes(x)))throw new Error('INVALID_MERCHANT_LIST');
    const arm=input.arm??'CM';if(!['B0','B1','CM'].includes(arm))throw new Error('INVALID_ARM');
    const metadata={name:String(input.name??'Research Agent').slice(0,80),team:String(input.team??'AI Platform').slice(0,80),costCenter:String(input.costCenter??'ENG-042').slice(0,40)};
    const policy={version:POLICY_VERSION,purposeId:PURPOSE,sku:SKU,minQuantity:'100',minRefundHours:'24',autoHarden:input.autoHarden!==false,maxCalls,negotiationRounds:2,preference:'refund_then_unit_price',gasSponsored:true,arm,metadata};
    const addresses=ids.map(id=>this.chain.merchant(id).address),id=identifier();
    const mandate={sessionId:id,owner,totalCap,perTxCap,expiresAt:String(nowSeconds()+duration*60),purposeHash:hash({purposeId:PURPOSE,sku:SKU,minQuantity:'100',minRefundHours:'24'}),skuHash:textHash(SKU),minQuantity:'100',minRefundHours:'24',merchantsHash:merchantsHash(addresses),policyHash:hash(policy),nonce:String(await this.chain.vault.nonces(owner))};
    const s={id,mandate,merchants:addresses,policy,signature:null,status:'AWAITING_APPROVAL',spent:'0',reserved:'0',llmCalls:0,createdAt:new Date().toISOString(),approvalReceipt:null};
    this.store.put('session',id,s);this.store.event(id,'APPROVAL_REQUESTED',{mandate,policy,merchants:addresses});
    return {session:s,domain:this.chain.domain,types:MANDATE_TYPES,value:mandate};
  }
  async approve(id,signature){
    let s=this.session(id);if(s.status==='ACTIVE')return s;
    if(s.status!=='AWAITING_APPROVAL')throw new Error('MANDATE_INACTIVE');
    if(!sameAddress(verifyTypedData(this.chain.domain,MANDATE_TYPES,s.mandate,signature),s.mandate.owner))throw new Error('OWNER_SIGNATURE');
    s.signature=signature;this.store.put('session',id,s);
    const receipt=await this.chain.create(s.mandate,s.merchants,signature);
    if(receipt.status!==1)throw new Error('APPROVAL_REVERTED');
    s=this.session(id);if(s.status==='ACTIVE'&&s.approvalReceipt)return s;
    // Revocation can arrive while createMandate is awaiting its receipt.
    if(s.status!=='STOPPED')s.status='ACTIVE';s.approvalReceipt=receipt;this.store.put('session',id,s);
    this.store.event(id,'HUMAN_APPROVED',{signature,txHash:receipt.hash,mandateDigest:hash(s.mandate)});return s;
  }
  async stop(id,signature){
    const s=this.session(id);
    if(!sameAddress(verifyTypedData(this.chain.domain,REVOKE_TYPES,{sessionId:id,owner:s.mandate.owner},signature),s.mandate.owner))throw new Error('OWNER_SIGNATURE');
    const stopped=stopLocally(this.store,id);
    this.store.put('revocation',id,{sessionId:id,signature,status:'PENDING'});
    try{const receipt=await this.chain.revoke(id,signature);this.store.put('revocation',id,{sessionId:id,signature,status:'CONFIRMED',receipt});this.store.event(id,'REVOCATION_CONFIRMED',{txHash:receipt.hash});return {...stopped,revocation:receipt};}
    catch{this.store.event(id,'REVOCATION_PENDING',{reason:'CHAIN_CONFIRMATION_UNAVAILABLE'});return {...stopped,revocation:null};}
  }
  enqueue(id,{scenarioId='normal',requestId=randomUUID(),quoteDelayMs=0}={}){
    if(typeof requestId!=='string'||requestId.length>100)throw new Error('INVALID_REQUEST_ID');this.scenarioProvider(scenarioId);
    const s=this.session(id),runId=hash({id,requestId});
    const existing=this.store.get('run',runId);if(existing)return existing;
    if(s.status!=='ACTIVE')throw new Error('MANDATE_INACTIVE');
    const run={id:runId,sessionId:id,scenarioId,arm:s.policy.arm,status:'QUEUED',reason:null,createdAt:new Date().toISOString(),usage:[],quotes:[],quoteMetrics:{early:0,final:0,cacheHits:0,latencyMs:0,syntheticDelayMs:quoteDelayMs},proposal:null,offer:null,authorization:null,tx:null,receipt:null,paymentKey:hash({runId,purpose:'one-payment'}),controls:[],transitions:0};
    this.store.put('run',runId,run);this.store.event(id,'RUN_QUEUED',{scenarioId,arm:run.arm},runId);
    const job=Promise.resolve().then(()=>this.execute(runId,quoteDelayMs)).finally(()=>this.jobs.delete(runId));this.jobs.set(runId,job);return run;
  }
  wait(id){return this.jobs.get(id)??Promise.resolve(this.store.get('run',id));}
  assertRunning(id){const r=this.store.get('run',id),s=this.session(r.sessionId);if(r.status==='STOPPED'||s.status!=='ACTIVE')throw new Error('USER_REVOKED');if(nowSeconds()>=Number(s.mandate.expiresAt))throw new Error('DEADLINE_EXPIRED');return {r,s};}
  updateRun(id,fn){const r=this.store.get('run',id);fn(r);this.store.put('run',id,r);return r;}
  async call(runId,args){
    this.store.transaction(()=>{const {s}=this.assertRunning(runId);if(s.llmCalls>=s.policy.maxCalls)throw new Error('INFERENCE_BUDGET_EXHAUSTED');s.llmCalls++;this.store.put('session',s.id,s);this.store.event(s.id,'KILN_REQUESTED',{flow:args.flow,model:MODEL,attempt:s.llmCalls},runId);});
    const response=await this.kiln.call({...args,onUsage:u=>{const run=this.updateRun(runId,r=>r.usage.push(u));this.store.event(run.sessionId,'KILN_USAGE',u,runId);}});
    this.assertRunning(runId);return response;
  }
  async execute(runId,quoteDelayMs=0){
    try{
      let {r,s}=this.assertRunning(runId);r.status='RUNNING';this.store.put('run',runId,r);
      const specs=this.scenarioProvider(r.scenarioId);
      const cache=new Map(),ads=specs.map((v,i)=>({...v,id:`candidate-${i+1}`,merchant:this.chain.merchant(v.merchantId).address}));
      const quote=async(ad,phase,counterTotal)=>{
        const cacheKey=ad.id+':'+(counterTotal??'initial');if(cache.has(cacheKey)){this.updateRun(runId,r=>r.quoteMetrics.cacheHits++);return cache.get(cacheKey);}
        this.updateRun(runId,r=>{r.quoteMetrics.attempts??={early:0,final:0};r.quoteMetrics.attempts[phase]++;});
        if(phase==='early'&&ad.lateQuote){
          this.updateRun(runId,r=>{r.quoteMetrics.rejected=(r.quoteMetrics.rejected??0)+1;});
          this.store.event(s.id,'QUOTE_REJECTED',{candidateId:ad.id,merchant:ad.merchant,phase,reason:'ALL_IN_PRICE_REQUIRED'},runId);
          throw new Error('ALL_IN_PRICE_REQUIRED');
        }
        this.assertRunning(runId);const start=performance.now();if(quoteDelayMs)await sleep(quoteDelayMs);
        const total=counterTotal??(ad.base+ad.fee);
        const offer={sessionId:s.id,offerId:identifier(),merchant:ad.merchant,purposeHash:s.mandate.purposeHash,skuHash:s.mandate.skuHash,quantity:String(ad.quantity),refundHours:String(ad.refund),subtotal:String(counterTotal?total:ad.base),fee:String(counterTotal?0:ad.fee),total:String(total),expiresAt:String(nowSeconds()+(ad.expired?-60:600))};
        const record=await this.chain.signOffer(ad.merchantId,offer);cache.set(cacheKey,record);
        const r=this.updateRun(runId,r=>{r.quotes.push({phase,...record});r.quoteMetrics[phase]++;r.quoteMetrics.latencyMs+=Math.round(performance.now()-start);});
        this.store.event(s.id,'SIGNED_QUOTE',{phase,...record},r.id);return record;
      };
      const candidates=[],excluded=[];
      const exclude=(ad,reason,record=null)=>{excluded.push({reason,record});this.store.event(s.id,'CANDIDATE_REJECTED',{candidateId:ad.id,merchant:ad.merchant,reason},runId);};
      for(const ad of ads){
        if(!s.merchants.some(a=>sameAddress(a,ad.merchant))){exclude(ad,'MERCHANT_NOT_ALLOWED');continue;}
        if(ad.base>Number(s.mandate.perTxCap)&&!ad.negotiable){exclude(ad,'KNOWN_BASE_PRICE_EXCEEDS_LIMIT');continue;}
        const control=this.store.get('control',scopeKey(s.mandate.owner,s.policy.purposeId,ad.merchant));
        const early=r.arm==='B1'||(r.arm==='CM'&&control?.status==='ACTIVE');
        let firm=null;
        if(early){
          if(control&&r.arm==='CM'){this.updateRun(runId,r=>r.controls.push(control));this.store.event(s.id,'CONTROL_APPLIED',{controlId:control.id,sourceEventHash:control.sourceEventHash,merchant:ad.merchant,rule:control.rule},runId);}
          try{firm=await quote(ad,'early');}catch(e){if(e.message!=='ALL_IN_PRICE_REQUIRED')throw e;exclude(ad,e.message);continue;}
          const verdict=checkOffer(this.session(s.id),firm,this.chain.domain);
          if(!verdict.allowed&&!(['PER_PURCHASE_LIMIT_EXCEEDED','ALL_IN_BUDGET_EXCEEDED'].includes(verdict.reason)&&ad.negotiable)){
            this.store.event(s.id,'EARLY_CANDIDATE_REJECTED',{merchant:ad.merchant,reason:verdict.reason},runId);
            exclude(ad,verdict.reason,firm);continue;
          }
        }
        candidates.push({id:ad.id,seller:ad.merchantId,description:ad.description,credits:ad.quantity,refund_hours:ad.refund,base_minor:ad.base,all_in_minor:firm?Number(firm.offer.total):null,negotiable:!!ad.negotiable});
      }
      if(!candidates.length){
        const rejection=excluded.find(x=>x.reason==='ALL_IN_PRICE_REQUIRED')??excluded[0];
        const reason=rejection&&(excluded.every(x=>x.reason===rejection.reason)||rejection.reason==='ALL_IN_PRICE_REQUIRED')?rejection.reason:'NO_ELIGIBLE_CANDIDATE';
        this.block(runId,reason,rejection?.record??null);return;
      }
      const proposal=await this.call(runId,{flow:'offer_selection',task:{purpose:s.policy.purposeId,minimumCredits:100,minimumRefundHours:24,budgetMinor:s.mandate.totalCap,perPurchaseMinor:s.mandate.perTxCap},candidates});
      this.updateRun(runId,r=>{r.proposal=proposal;r.transitions++;});this.store.event(s.id,'AGENT_PROPOSED',{decision:'PROPOSE_BUY',...proposal},runId);
      const selected=ads.find(x=>x.id===proposal.args.offer_id);let record=await quote(selected,'final');
      let verdict=checkOffer(this.session(s.id),record,this.chain.domain);
      if(!verdict.allowed&&selected.negotiable&&['PER_PURCHASE_LIMIT_EXCEEDED','ALL_IN_BUDGET_EXCEEDED'].includes(verdict.reason)){
        const current=this.session(s.id);const remaining=BigInt(current.mandate.totalCap)-BigInt(current.spent)-BigInt(current.reserved);const max=BigInt(current.mandate.perTxCap)<remaining?BigInt(current.mandate.perTxCap):remaining;
        if(max<BigInt(selected.floor)){this.block(runId,verdict.reason,record);return;}
        const counter=await this.call(runId,{flow:'negotiation',tool:'request_counteroffer',maxTotal:max.toString(),task:'Request an acceptable lower inclusive price. Seller floor is '+selected.floor+' minor units.',candidates:[{id:selected.id,current_total:record.offer.total,seller_floor:selected.floor}]});
        const agreed=Math.max(counter.args.total_minor,selected.floor);record=await quote(selected,'final',agreed);
        this.store.event(s.id,'SELLER_COUNTER_ACCEPTED',{counter,newOfferId:record.offer.offerId,allInTotal:record.offer.total},runId);this.updateRun(runId,r=>r.transitions++);
        verdict=checkOffer(this.session(s.id),record,this.chain.domain);
      }
      if(!verdict.allowed){this.block(runId,verdict.reason,record);return;}
      const reserved=reserve(this.store,s.id,runId,record,this.chain.domain);
      const captureEvidence=()=>this.store.transaction(()=>{
        const {r:current,s:session}=this.assertRunning(runId);
        // A preceding serialized payment may have settled since reservation.
        // Anchor the accounting snapshot at submission, excluding our own hold.
        if(this.store.all('run').some(x=>x.id!==runId&&['SUBMISSION_STARTED','UNKNOWN'].includes(x.status)))throw new Error('UNCONFIRMED_PAYMENT_PENDING');
        const reservedBefore=(BigInt(session.reserved)-BigInt(record.offer.total)).toString();
        const final=checkOffer({...session,reserved:reservedBefore},record,this.chain.domain);
        if(!final.allowed)throw new Error(final.reason);
        current.authorization={...current.authorization,at:nowSeconds(),spentBefore:session.spent,reservedBefore};
        this.store.event(s.id,'SUBMISSION_REVALIDATED',current.authorization,runId);
        const preEvidence={schemaVersion:1,domain:this.chain.domain,session:{mandate:session.mandate,signature:session.signature,merchants:session.merchants,policy:session.policy},runId,paymentKey:current.paymentKey,offer:record,authorization:current.authorization,proposal:current.proposal,usage:current.usage,controls:current.controls,events:this.store.events(s.id)};
        const evidenceHash=hash(preEvidence);current.preEvidence=preEvidence;current.evidenceHash=evidenceHash;this.store.put('run',runId,current);return evidenceHash;
      });
      if(this.simulate){captureEvidence();this.settle(runId,null);return;}
      await this.chain.serial(async()=>{
        const evidenceHash=captureEvidence();
        const tx=await this.chain.prepare(record,reserved.paymentKey,evidenceHash);
        startSubmission(this.store,runId,tx);
        try{const receipt=await this.chain.broadcast(tx);this.settle(runId,receipt);}
        catch{this.updateRun(runId,r=>{r.status='UNKNOWN';r.reason='CHAIN_CONFIRMATION_PENDING';});this.store.event(s.id,'PAYMENT_UNKNOWN',{txHash:tx.hash,reservationRetained:true},runId);}
      });
    }catch(e){this.block(runId,failureCode(e));}
  }
  block(runId,reason,record=null){
    this.store.transaction(()=>{
      const r=this.store.get('run',runId);if(!r||terminal.has(r.status)||['SUBMISSION_STARTED','UNKNOWN'].includes(r.status))return;
      const s=this.session(r.sessionId);
      if(r.status==='RESERVED')s.reserved=(BigInt(s.reserved)-BigInt(r.offer.offer.total)).toString();
      r.status=reason==='ALL_IN_PRICE_REQUIRED'?'REVIEW_REQUIRED':'STOPPED';r.reason=reason;r.offer=record??r.offer;r.completedAt=new Date().toISOString();
      this.store.put('run',runId,r);this.store.put('session',s.id,s);
      const event=this.store.event(s.id,'POLICY_BLOCKED',{reason,offerId:record?.offer.offerId??null,amount:record?.offer.total??null,policyContext:{spent:s.spent,reserved:s.reserved,at:nowSeconds()}},runId);
      if(record&&r.arm==='CM')deriveControl(this.store,s,record,event);
    });
  }
  settle(runId,receipt){
    this.store.transaction(()=>{
      const r=this.store.get('run',runId);if(terminal.has(r.status))return;
      const s=this.session(r.sessionId);s.reserved=(BigInt(s.reserved)-BigInt(r.offer.offer.total)).toString();
      if(!receipt||receipt.status===1){s.spent=(BigInt(s.spent)+BigInt(r.offer.offer.total)).toString();r.status=receipt?'SETTLED':'SIMULATED';r.reason=receipt?'PAYMENT_CONFIRMED':'SIMULATION_NO_CHAIN';}
      else{r.status='STOPPED';r.reason='CHAIN_REVERTED';}
      r.receipt=receipt;r.completedAt=new Date().toISOString();this.store.put('run',runId,r);this.store.put('session',s.id,s);
      this.store.event(s.id,r.status==='SETTLED'?'PAYMENT_CONFIRMED':r.status,{reason:r.reason,txHash:receipt?.hash??null,amount:r.offer.offer.total},runId);
    });
  }
  async recover(){
    for(const s of this.store.all('session').filter(s=>s.status==='AWAITING_APPROVAL'&&s.signature)){
      try{await this.approve(s.id,s.signature);}catch{/* Keep the signed draft pending; never activate without a receipt. */}
    }
    for(const r of this.store.all('run')){
      if(this.jobs.has(r.id))continue;
      if(['SUBMISSION_STARTED','UNKNOWN'].includes(r.status)&&r.tx){try{await this.chain.serial(async()=>{
        const resolution=await this.chain.reconcile(r.tx,r.paymentKey);
        if(resolution.status==='NONCE_CONSUMED'){
          this.store.transaction(()=>{
            const current=this.store.get('run',r.id);if(!['SUBMISSION_STARTED','UNKNOWN'].includes(current.status))return;
            const s=this.session(current.sessionId);s.reserved=(BigInt(s.reserved)-BigInt(current.offer.offer.total)).toString();
            current.status='STOPPED';current.reason='SUBMISSION_NONCE_CONSUMED';current.completedAt=new Date().toISOString();current.cancellation=resolution;
            this.store.put('session',s.id,s);this.store.put('run',r.id,current);this.store.event(s.id,'POLICY_BLOCKED',{reason:current.reason,resolution},r.id);
          });
        }else{const receipt=resolution.receipt??await this.chain.broadcast(r.tx);this.settle(r.id,receipt);}
      });}catch{this.updateRun(r.id,r=>{r.status='UNKNOWN';r.reason='CHAIN_CONFIRMATION_PENDING';});}}
      else if(['QUEUED','RUNNING','RESERVED'].includes(r.status))this.block(r.id,'INTERRUPTED_BEFORE_SUBMISSION');
    }
    for(const v of this.store.all('revocation').filter(v=>v.status==='PENDING')){try{const receipt=await this.chain.revoke(v.sessionId,v.signature);this.store.put('revocation',v.sessionId,{...v,status:'CONFIRMED',receipt});this.store.event(v.sessionId,'REVOCATION_CONFIRMED',{txHash:receipt.hash});}catch{}}
  }
  publicRun(r){const {tx,preEvidence,...publicData}=r;return {...publicData,txHash:tx?.hash??null};}
  bundle(runId){
    const r=this.store.get('run',runId);if(!r)throw new Error('RUN_NOT_FOUND');const s=this.session(r.sessionId);
    const controlSources=(r.controls??[]).map(control=>{
      const session=this.store.get('session',control.sourceSession),events=this.store.events(control.sourceSession);
      const sourceEvent=events.find(e=>e.hash===control.sourceEventHash),sourceRun=sourceEvent?this.store.get('run',sourceEvent.runId):null;
      return {controlId:control.id,session,events,runId:sourceRun?.id??null,offer:sourceRun?.offer??null};
    });
    return {schemaVersion:1,deployment:this.chain.deployment,domain:this.chain.domain,session:s,run:this.publicRun(r),preEvidence:r.preEvidence??null,controlSources,events:this.store.events(s.id),revocation:this.store.get('revocation',s.id)};
  }
}
