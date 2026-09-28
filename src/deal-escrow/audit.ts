import {Transaction,Interface} from 'ethers';
import {hash,ensure,validateDeal,validateMandate,policy,transitions} from './domain.ts';
import {validateDelivery,validatePreview,DELIVERY_VALIDATOR_VERSION} from './delivery.ts';
import type {DealEngine} from './engine.ts';
const financialEvents:Record<string,string>={fund:'ESCROW_FUNDED',release:'ESCROW_RELEASED',refund:'ESCROW_REFUNDED'};
const fundedStates=['ESCROW_FUNDED','DELIVERY_SUBMITTED','DELIVERY_VERIFIED','SETTLED','REFUNDED'];
const escrowEvents=new Interface(['event Funded(bytes32 indexed dealHash,address indexed buyer,address indexed seller,uint256 amount,uint64 deadline)','event Released(bytes32 indexed dealHash,bytes32 evidenceHash,uint256 amount)','event Refunded(bytes32 indexed dealHash,bytes32 reasonHash,uint256 amount)']);
const limitations=['Dataset factual truth and source relevance are not verified; source URLs are not fetched.','Controller remains trusted for off-chain authorization, timestamps and complete event capture.','Historical absence of controls and cross-Deal reservation completeness are not independently proven.','Transaction claims are public decoded summaries, not independently authenticated until RPC corroboration.','Demo native test asset scale is not USD; SQLite and blockchain are not distributed-atomic.'];
class Incomplete extends Error {}
function need(condition:unknown,code:string):asserts condition {if(!condition)throw new Incomplete(code);}
function same(a:any,b:any){return typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();}
function claim(engine:DealEngine,op:any){
  if(!op.raw)return null;
  const tx=Transaction.from(op.raw),decoded=engine.chain.contract.interface.parseTransaction({data:tx.data,value:tx.value});
  ensure(decoded,'UNDECODABLE_SIGNED_INTENT');
  return {kind:decoded.name,deal_hash:decoded.args[0],tx_hash:tx.hash,chain_id:Number(tx.chainId),contract:tx.to,sender:tx.from,nonce:tx.nonce,value_wei:tx.value.toString(),calldata_hash:hash(tx.data),
    ...(decoded.name==='fund'?{buyer:decoded.args[1],seller:decoded.args[2],amount_wei:decoded.args[3].toString(),delivery_window:Number(decoded.args[4]),deal_expiry:Number(decoded.args[5])}:{attestation_hash:decoded.args[1]})};
}
export function receipt(engine:DealEngine,id:string){
  const exportOne=(dealId:string,seen:Set<string>):any=>{
    ensure(!seen.has(dealId)&&seen.size<8,'CONTROL_SOURCE_CYCLE');const next=new Set(seen).add(dealId),r=engine.store.get(dealId),control=engine.gate(r);
    return {schema_version:2,product:'Agent Deal Escrow',exported_at:new Date().toISOString(),network:engine.chain.deployment,mandate:engine.store.mandate(r.mandateId),mandate_history:engine.store.events(r.mandateId),deal:r.deal,deal_hash:r.dealHash,state:r.state,evidence:r.details,events:engine.store.events(dealId),control,
      control_source:control&&control.origin_deal_id!==dealId?exportOne(control.origin_deal_id,next):null,
      transactions:Object.fromEntries(['fund','release','refund'].flatMap(kind=>{const op=engine.store.operation(dealId,kind);return op?[[kind,{status:op.status,tx_hash:op.txHash??null,original_tx_hash:op.originalTxHash??null,receipt:op.receipt??null,claim:claim(engine,op),reason:op.reason??null,replacement:op.replacement??null}]]:[];})),kiln:engine.store.usage(dealId),limitations};
  };return exportOne(id,new Set());
}
function checkEvents(events:any[],id:string){
  need(Array.isArray(events)&&events.length,'EVENT_HISTORY_MISSING');let previous=null;const ids=new Set();
  for(const event of events){const {event_hash,...body}=event;ensure(body.deal_id===id,'EVENT_DEAL_MISMATCH');ensure(!ids.has(body.event_id),'DUPLICATE_EVENT');ids.add(body.event_id);ensure(body.previous_event_hash===previous&&hash(body)===event_hash,'EVENT_HASH_MISMATCH');previous=event_hash;}
}
function recompute(raw:string,requirements:any,v:any){
  need(typeof raw==='string'&&v,'DELIVERY_EVIDENCE_MISSING');
  const version=v.validator_version??'delivery-v1';need(['delivery-v1',DELIVERY_VALIDATOR_VERSION,'delivery-reference-v1','delivery-source-v1','delivery-source-preview-v1'].includes(version),'VALIDATOR_VERSION_UNSUPPORTED');
  ensure(Number.isSafeInteger(v.submitted_at)&&Number.isSafeInteger(v.deadline),'VALIDATION_TIME_INVALID');
  const result=validateDelivery(raw,requirements,v.submitted_at,v.deadline,{version});if(v.source_evidence)need(result.source_evidence?.parser===v.source_evidence.parser&&result.source_evidence?.reader_sha256===v.source_evidence.reader_sha256,'SOURCE_READER_VERSION_UNAVAILABLE');ensure(hash(result)===hash(v),'VALIDATION_MISMATCH');return result;
}
async function rpc<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch{throw new Incomplete('RPC_UNAVAILABLE');}}
async function checkChainReceipt(chain:any,op:any,target=chain.deployment.contract){
  const tx:any=await rpc(()=>chain.provider.getTransactionReceipt(op.tx_hash));need(tx,'CHAIN_RECEIPT_UNAVAILABLE');
  ensure(tx.hash===op.tx_hash&&same(tx.to,target)&&same(tx.from,chain.deployment.controller),'CHAIN_TRANSACTION_MISMATCH');
  ensure(tx.status===op.receipt.status,'CHAIN_RECEIPT_MISMATCH');
  need(tx.blockNumber===op.receipt.blockNumber&&tx.blockHash===op.receipt.blockHash,'CHAIN_RECEIPT_REORG_OR_STALE');
  const block:any=await rpc(()=>chain.provider.getBlock(tx.blockNumber));need(block,'CHAIN_BLOCK_UNAVAILABLE');
  if(block.hash!==tx.blockHash)throw new Incomplete('CHAIN_REORG_DETECTED');
  const policy=chain.finalityPolicy??chain.deployment.finality??{mode:'confirmations',confirmations:chain.deployment.chainId===31338?1:2};
  ensure(['confirmations','finalized'].includes(policy.mode)&&(policy.mode==='finalized'||(Number.isSafeInteger(policy.confirmations)&&policy.confirmations>=(chain.deployment.chainId===31338?1:2))),'CHAIN_FINALITY_CONFIGURATION_INVALID');
  const head:any=await rpc(()=>chain.provider.getBlock(policy.mode==='finalized'?'finalized':'latest'));need(head,'CHAIN_FINALITY_UNAVAILABLE');
  need(policy.mode==='finalized'?head.number>=tx.blockNumber:head.number-tx.blockNumber+1>=policy.confirmations,'CHAIN_FINALITY_PENDING');
  if(op.claim){const actual:any=await rpc(()=>chain.provider.getTransaction(op.tx_hash));need(actual,'CHAIN_TRANSACTION_UNAVAILABLE');
    const decoded=chain.contract.interface.parseTransaction({data:actual.data,value:actual.value});ensure(decoded?.name===op.claim.kind&&decoded.args[0]===op.claim.deal_hash&&actual.nonce===op.claim.nonce&&actual.value.toString()===op.claim.value_wei&&Number(actual.chainId)===op.claim.chain_id&&hash(actual.data)===op.claim.calldata_hash,'CHAIN_CLAIM_MISMATCH');}
  return tx;
}
async function verify(r:any,chain:any,seen:Set<string>,checks:string[],quality:any[]){
  need(r&&r.deal&&r.mandate&&r.evidence&&r.transactions&&r.network,'RECEIPT_FIELDS_MISSING');
  need([1,2].includes(r.schema_version),'RECEIPT_VERSION_UNSUPPORTED');ensure(!seen.has(r.deal.deal_id)&&seen.size<8,'CONTROL_SOURCE_CYCLE');const next=new Set(seen).add(r.deal.deal_id);
  validateDeal(r.deal);validateMandate(r.mandate);ensure(Object.hasOwn(transitions,r.state),'INVALID_RECEIPT_STATE');ensure(hash(r.deal)===r.deal_hash,'DEAL_HASH_MISMATCH');checks.push('immutable Deal hash');
  checkEvents(r.events,r.deal.deal_id);checkEvents(r.mandate_history,r.mandate.mandate_id);
  need(r.mandate_history[0]?.event_type==='MANDATE_CREATED','MANDATE_ORIGIN_MISSING');const original=r.mandate_history[0].structured_payload;
  ensure(hash({...r.mandate,status:'ACTIVE'})===hash(original),'MANDATE_MUTATION');ensure((r.mandate_history.some((e:any)=>e.event_type==='MANDATE_REVOKED')?'REVOKED':'ACTIVE')===r.mandate.status,'MANDATE_STATUS_MISMATCH');
  const event=(name:string)=>r.events.find((e:any)=>e.event_type===name),proposed=event('DEAL_PROPOSED');need(proposed,'PROPOSAL_MISSING');ensure(hash(proposed.structured_payload.deal)===r.deal_hash&&proposed.structured_payload.deal_hash===r.deal_hash,'PROPOSAL_MISMATCH');
  need(event('NEGOTIATION_STARTED'),'NEGOTIATION_ORIGIN_MISSING');ensure(event('NEGOTIATION_STARTED').structured_payload.mandate_id===r.mandate.mandate_id,'MANDATE_BINDING_MISMATCH');
  const accepted=event('DEAL_ACCEPTED');if(fundedStates.includes(r.state)||['DEAL_ACCEPTED','PREVIEW_REQUIRED','PREVIEW_VERIFIED','POLICY_APPROVED'].includes(r.state))need(accepted,'ACCEPTANCE_MISSING');if(accepted)ensure(accepted.structured_payload.deal_hash===r.deal_hash,'ACCEPTANCE_MISMATCH');
  checks.push('hash-linked events bound to the Deal and mandate');
  if(r.evidence.validation){ensure(r.evidence.validation.validator_version!=='delivery-source-preview-v1','PREVIEW_IS_NOT_FULL_DELIVERY');const v=recompute(r.evidence.delivery,r.deal.requirements,r.evidence.validation);need(r.evidence.escrow,'ESCROW_EVIDENCE_MISSING');ensure(v.deadline===r.evidence.escrow.deadline,'DEADLINE_MISMATCH');
    need(event('DELIVERY_SUBMITTED')&&event('DELIVERY_VALIDATED'),'DELIVERY_EVENTS_MISSING');ensure(event('DELIVERY_SUBMITTED').structured_payload.content_hash===v.content_hash&&event('DELIVERY_SUBMITTED').structured_payload.submitted_at===v.submitted_at&&hash(event('DELIVERY_VALIDATED').structured_payload)===hash(v),'DELIVERY_EVENT_MISMATCH');
    const currentQuality=validateDelivery(r.evidence.delivery,r.deal.requirements,v.submitted_at,v.deadline);
    quality.push({deal_id:r.deal.deal_id,recorded_validator:r.evidence.validation.validator_version??'delivery-v1',current_validator:currentQuality.validator_version,current_checks_pass:currentQuality.verified,semantic_truth_verified:false});checks.push('versioned delivery structure and quality checks; no factual certification');
  }else if(['DELIVERY_SUBMITTED','DELIVERY_VERIFIED','SETTLED'].includes(r.state))throw new Incomplete('DELIVERY_EVIDENCE_MISSING');
  let previewIndex=-1;
  if(r.evidence.preview){const {raw,deal_hash,...v}=r.evidence.preview;ensure(deal_hash===r.deal_hash,'PREVIEW_DEAL_MISMATCH');const expected=validatePreview(raw,r.deal.requirements,v.submitted_at,v.deadline,v.validator_version??'delivery-v1');ensure(hash(expected)===hash(v),'PREVIEW_VALIDATION_MISMATCH');ensure(v.verified===true&&v.deadline===r.deal.expires_at,'PREVIEW_INVALID');previewIndex=r.events.findIndex((e:any)=>e.event_type==='PREVIEW_VALIDATED'&&hash(e.structured_payload)===hash(v));need(previewIndex>=0,'PREVIEW_EVENT_MISSING');checks.push('preview raw content revalidated and bound to the immutable Deal');}
  const control=r.control;
  if(r.control_source)ensure(control&&control.origin_deal_id!==r.deal.deal_id,'UNEXPECTED_CONTROL_SOURCE');
  if(control){ensure(control.rule==='REQUIRE_PREVIEW'&&control.status==='ACTIVE'&&control.company_id===r.mandate.company_id&&control.seller_id===r.deal.seller_id,'CONTROL_SCOPE_MISMATCH');
    const source=control.origin_deal_id===r.deal.deal_id?r:r.control_source;need(source,'CONTROL_SOURCE_MISSING');
    if(source!==r)await verify(source,chain,next,checks,quality);
    ensure(source.deal.deal_id===control.origin_deal_id&&source.state==='REFUNDED'&&source.deal.seller_id===control.seller_id&&source.mandate.company_id===control.company_id,'CONTROL_ORIGIN_MISMATCH');
    ensure(source.evidence.validation?.verified===false&&source.evidence.validation.failure_reason_code==='DELIVERY_REQUIREMENT_FAILED'&&control.failure_reason_code==='DELIVERY_REQUIREMENT_FAILED'&&hash(source.evidence.validation)===control.validation_hash,'CONTROL_VALIDATION_MISMATCH');
    const activation=source.events.find((e:any)=>e.event_type==='CONTROL_MEMORY_ADDED');need(activation,'CONTROL_ACTIVATION_MISSING');ensure(hash(activation.structured_payload)===hash(control),'CONTROL_ACTIVATION_MISMATCH');checks.push('seller/company control mapped to a recomputed failed-delivery refund');
  }
  for(const [index,e] of r.events.entries())if(['POLICY_CHECKED','FINAL_AUTHORIZATION'].includes(e.event_type)){
    const p=e.structured_payload;ensure(hash({...p.mandate,status:'ACTIVE'})===hash(original),'MANDATE_MUTATION');need(Array.isArray(p.checks),'POLICY_CHECKS_MISSING');const pc=p.checks.find((c:any)=>c.name==='PREVIEW_REQUIRED');need(pc,'PREVIEW_CHECK_MISSING');
    ensure(typeof pc.expected==='boolean'&&typeof pc.actual==='boolean','PREVIEW_CHECK_INVALID');if(pc.expected)need(control,'CONTROL_SOURCE_MISSING');
    const hasPreview=previewIndex>=0&&previewIndex<index;ensure(pc.actual===hasPreview,'PREVIEW_CLAIM_MISMATCH');
    // A control created after this Deal's settlement must not retroactively change its policy.
    if(control&&control.origin_deal_id!==r.deal.deal_id&&Date.parse(control.created_at)<=Date.parse(e.timestamp))ensure(pc.expected===true,'CONTROL_GATE_OMITTED');
    ensure(Number.isSafeInteger(p.accounting?.spent)&&p.accounting.spent>=0&&Number.isSafeInteger(p.accounting?.reserved)&&p.accounting.reserved>=0,'ACCOUNTING_INVALID');
    const expected=policy(p.mandate,r.deal,{time:p.time,...p.accounting,dealHash:r.deal_hash,previewRequired:pc.expected,previewVerified:hasPreview});ensure(hash(expected)===hash(p.checks),'POLICY_CHECK_MISMATCH');
  }
  checks.push('policy arithmetic; preview flags checked against actual preview evidence');
  for(const [kind,op] of Object.entries(r.transactions) as [string,any][]){
    ensure(Object.hasOwn(financialEvents,kind),'UNKNOWN_TRANSACTION_KIND');ensure(['PENDING','CONFIRMED','REVERTED','CANCELLED'].includes(op.status),'TRANSACTION_STATUS_INVALID');
    if(op.claim){const c=op.claim;ensure(c.kind===kind&&c.deal_hash===r.deal_hash&&c.tx_hash===(op.original_tx_hash??op.tx_hash)&&c.chain_id===r.network.chainId&&same(c.contract,r.network.contract)&&same(c.sender,r.network.controller),'TRANSACTION_CLAIM_MISMATCH');
      if(kind==='fund')ensure(c.amount_wei===(BigInt(r.deal.price_minor)*BigInt(r.network.unitWei)).toString()&&c.value_wei===c.amount_wei&&same(c.buyer,r.network.buyer)&&same(c.seller,r.network.sellers[r.deal.seller_id])&&c.delivery_window===r.deal.deadline&&c.deal_expiry===r.deal.expires_at,'FUND_CLAIM_MISMATCH');
      else {ensure(c.value_wei==='0','SETTLEMENT_VALUE_MISMATCH');if(op.status==='CONFIRMED')ensure(c.attestation_hash===r.evidence.attestation_hash,'SETTLEMENT_CLAIM_MISMATCH');}
    }else if(r.schema_version===2&&['CONFIRMED','REVERTED'].includes(op.status))throw new Incomplete('SIGNED_INTENT_CLAIM_MISSING');
    if(op.original_tx_hash){need(op.replacement&&op.claim,'REPLACEMENT_EVIDENCE_MISSING');ensure(op.status==='CONFIRMED'&&op.replacement.originalTxHash===op.original_tx_hash&&op.replacement.replacementTxHash===op.tx_hash&&op.replacement.nonce===op.claim.nonce,'REPLACEMENT_CLAIM_MISMATCH');}
    if(op.status==='CANCELLED'&&op.reason==='SIGNED_NONCE_REPLACED'){
      const rep=op.replacement;need(rep?.receipt&&op.claim,'REPLACEMENT_EVIDENCE_MISSING');ensure(rep.originalTxHash===op.tx_hash&&rep.nonce===op.claim.nonce&&rep.replacementTxHash===rep.receipt.transactionHash&&rep.replacementTxHash!==op.tx_hash,'REPLACEMENT_CLAIM_MISMATCH');
      const replacementEvent=r.events.find((e:any)=>e.event_type==='ESCROW_TRANSACTION_REPLACED'&&e.structured_payload.operation===kind);need(replacementEvent,'REPLACEMENT_EVENT_MISSING');const {operation,...proof}=replacementEvent.structured_payload;ensure(hash(proof)===hash(rep),'REPLACEMENT_EVENT_MISMATCH');ensure(rep.escrow?.status===({fund:0,release:1,refund:1} as any)[kind],'REPLACEMENT_OUTCOME_MISMATCH');
      if(chain){
        await checkChainReceipt(chain,{tx_hash:rep.replacementTxHash,receipt:rep.receipt},rep.receipt.to);const replacement:any=await rpc(()=>chain.provider.getTransaction(rep.replacementTxHash));need(replacement,'REPLACEMENT_TRANSACTION_UNAVAILABLE');ensure(replacement.nonce===op.claim.nonce&&same(replacement.from,chain.deployment.controller),'REPLACEMENT_NONCE_MISMATCH');
        const basis:any=await rpc(()=>chain.provider.getBlock(rep.basisBlockNumber));need(basis&&basis.hash===rep.basisBlockHash,'REPLACEMENT_BASIS_REORG');
        const prior:any=await rpc(()=>chain.inspect(r.deal_hash,rep.basisBlockNumber));ensure(prior.status===rep.escrow.status,'REPLACEMENT_ESCROW_MISMATCH');
      }
    }
    if(['CONFIRMED','REVERTED'].includes(op.status)){
      need(op.receipt&&op.tx_hash,'TRANSACTION_RECEIPT_MISSING');ensure(op.receipt.transactionHash===op.tx_hash&&same(op.receipt.to,r.network.contract)&&same(op.receipt.from,r.network.controller),'TRANSACTION_RECEIPT_MISMATCH');
      if(op.status==='CONFIRMED'){ensure(op.receipt.status===1,'TRANSACTION_STATUS_MISMATCH');const e=event(financialEvents[kind]);need(e,'FINANCIAL_EVENT_MISSING');const p=e.structured_payload;ensure(p.deal_hash===r.deal_hash&&p.tx_hash===op.tx_hash&&p.amount_minor===r.deal.price_minor&&p.chain_id===r.network.chainId&&same(p.contract,r.network.contract),'FINANCIAL_EVENT_MISMATCH');if(kind!=='fund')ensure(p.attestation_hash===r.evidence.attestation_hash,'FINANCIAL_ATTESTATION_MISMATCH');
        need(Array.isArray(op.receipt.logs),'TRANSACTION_LOGS_MISSING');const logs=op.receipt.logs.filter((l:any)=>same(l.address,r.network.contract)).map((l:any)=>{try{return escrowEvents.parseLog(l);}catch{return null;}}).filter((l:any)=>l?.name===({fund:'Funded',release:'Released',refund:'Refunded'} as any)[kind]);
        ensure(logs.length===1&&logs[0].args[0]===r.deal_hash,'RECEIPT_LOG_MISMATCH');const log=logs[0];ensure(log.args.amount===BigInt(r.deal.price_minor)*BigInt(r.network.unitWei),'RECEIPT_AMOUNT_MISMATCH');
        if(kind==='fund'){ensure(same(log.args.buyer,r.network.buyer)&&same(log.args.seller,r.network.sellers[r.deal.seller_id]),'RECEIPT_PARTY_MISMATCH');need(r.evidence.escrow,'ESCROW_EVIDENCE_MISSING');ensure(Number(log.args.deadline)===r.evidence.escrow.deadline,'RECEIPT_DEADLINE_MISMATCH');}else ensure(log.args[1]===r.evidence.attestation_hash,'RECEIPT_ATTESTATION_MISMATCH');
      }
      else {const failed=r.events.find((e:any)=>e.event_type==='ESCROW_TRANSACTION_REVERTED'&&e.structured_payload.operation===kind&&e.structured_payload.tx_hash===op.tx_hash);need(failed,'REVERT_EVENT_MISSING');ensure(op.receipt.status===0&&hash(failed.structured_payload.receipt)===hash(op.receipt),'REVERT_EVIDENCE_MISMATCH');}
    }
  }
  for(const [kind,name] of Object.entries(financialEvents))if(event(name)){need(r.transactions[kind],'FINANCIAL_OPERATION_MISSING');ensure(r.transactions[kind].status==='CONFIRMED','FINANCIAL_OPERATION_STATUS_MISMATCH');}
  if(r.transactions.release?.status==='CONFIRMED')ensure(r.state==='SETTLED','STATE_OUTCOME_MISMATCH');
  if(r.transactions.refund?.status==='CONFIRMED')ensure(r.state==='REFUNDED','STATE_OUTCOME_MISMATCH');
  if(r.transactions.fund?.status==='CONFIRMED')ensure(fundedStates.includes(r.state),'STATE_FUNDING_MISMATCH');
  if(['PREVIEW_VERIFIED'].includes(r.state))need(previewIndex>=0,'PREVIEW_EVIDENCE_MISSING');
  if(r.state==='REJECTED')need(event('DEAL_REJECTED'),'REJECTION_EVENT_MISSING');
  if(['BLOCKED','EXPIRED'].includes(r.state))need(event('TRANSACTION_BLOCKED'),'BLOCK_EVENT_MISSING');
  if(r.state==='POLICY_APPROVED')need(r.events.some((e:any)=>e.event_type==='POLICY_CHECKED'&&e.structured_payload.checks.every((c:any)=>c.pass)),'APPROVED_POLICY_MISSING');
  if(fundedStates.includes(r.state)){need(r.transactions.fund?.status==='CONFIRMED'&&r.evidence.escrow,'FUNDING_EVIDENCE_MISSING');need(r.events.some((e:any)=>e.event_type==='POLICY_CHECKED'&&e.structured_payload.checks.every((c:any)=>c.pass)),'APPROVED_POLICY_MISSING');}
  if(['SETTLED','REFUNDED'].includes(r.state)){
    need(r.transactions[r.state==='SETTLED'?'release':'refund']?.status==='CONFIRMED','SETTLEMENT_RECEIPT_MISSING');const a=r.evidence.attestation;need(a,'ATTESTATION_MISSING');ensure(hash(a)===r.evidence.attestation_hash,'ATTESTATION_HASH_MISMATCH');ensure(hash(a.deal)===r.deal_hash&&a.deal_hash===r.deal_hash&&hash(a.delivery)===hash(r.evidence.delivery??null)&&hash(a.validation)===hash(r.evidence.validation??null)&&hash(a.preview??null)===hash(r.evidence.preview??null),'ATTESTATION_CONTENT_MISMATCH');
    const final=r.events.find((e:any)=>e.event_hash===a.prior_event_hash);need(final,'FINAL_AUTHORIZATION_MISSING');ensure(final.event_type==='FINAL_AUTHORIZATION'&&hash(final.structured_payload.checks)===hash(a.final_checks)&&hash(final.structured_payload.mandate)===hash(a.mandate),'FINAL_AUTHORIZATION_MISMATCH');ensure(a.reason===r.evidence.settlement_reason,'SETTLEMENT_REASON_MISMATCH');
    if(r.state==='SETTLED')ensure(a.outcome==='release'&&a.validation.verified&&a.final_checks.every((c:any)=>c.pass)&&!r.transactions.refund,'UNSAFE_RELEASE');else ensure(a.outcome==='refund'&&r.transactions.release?.status!=='CONFIRMED','OUTCOME_MISMATCH');checks.push('settlement attestation binds Deal, mandate, delivery, preview and final checks');
  }
  if(Object.values(r.transactions).some((op:any)=>op.status==='PENDING'))throw new Incomplete('TRANSACTION_RECONCILIATION_PENDING');
  if(r.evidence.reconciliation_required)throw new Incomplete('CHAIN_RECONCILIATION_REQUIRED');
  if(chain){ensure(same(chain.deployment.contract,r.network.contract)&&chain.deployment.chainId===r.network.chainId,'UNTRUSTED_DEPLOYMENT');
    for(const [kind,op] of Object.entries(r.transactions) as [string,any][]){if(!['CONFIRMED','REVERTED'].includes(op.status))continue;const tx=await checkChainReceipt(chain,op);if(op.status==='REVERTED')continue;
      const log=tx.logs.filter((l:any)=>same(l.address,chain.deployment.contract)).map((l:any)=>{try{return chain.contract.interface.parseLog(l);}catch{return null;}}).find((l:any)=>l?.name===({fund:'Funded',release:'Released',refund:'Refunded'} as any)[kind]);ensure(log&&log.args[0]===r.deal_hash,'CHAIN_EVENT_MISMATCH');
      ensure(log.args.amount===BigInt(r.deal.price_minor)*BigInt(chain.deployment.unitWei),'CHAIN_AMOUNT_MISMATCH');
      if(kind==='fund'){ensure(same(log.args.buyer,chain.deployment.buyer)&&same(log.args.seller,chain.deployment.sellers[r.deal.seller_id]),'CHAIN_PARTY_MISMATCH');ensure(Number(log.args.deadline)===r.evidence.escrow.deadline,'CHAIN_DEADLINE_MISMATCH');}else ensure(log.args[1]===r.evidence.attestation_hash,'CHAIN_ATTESTATION_MISMATCH');
    }
    const e:any=await rpc(()=>chain.inspect(r.deal_hash)),expected=r.state==='SETTLED'?2:r.state==='REFUNDED'?3:r.transactions.fund?.status==='CONFIRMED'?1:0;ensure(e.status===expected,'CHAIN_OUTCOME_MISMATCH');checks.push('independent canonical/finalized RPC receipts, exact amounts, participants, deadlines and outcome');
  }
}
export async function verifyReceipt(r:any,chain?:any){const checks:string[]=[],delivery_quality:any[]=[];try{
  await verify(r,chain,new Set(),checks,delivery_quality);
  return {verdict:chain?'VALID':'STRUCTURALLY_VALID',scope:chain?'Stored evidence and independently read configured chain; controller trust remains':'Offline structural checks only; no independent chain authenticity claim',checks:[...new Set(checks)],delivery_quality,unverified:limitations,checked_at:new Date().toISOString()};
}catch(e){const unavailable=e instanceof Error&&(e.message==='SOURCE_DOCUMENT_NOT_IMPORTED'||('code' in e&&e.code==='ENOENT'));return {verdict:e instanceof Incomplete||unavailable?'INCOMPLETE':'INVALID',reason:e instanceof Error?e.message:'INVALID_EVIDENCE',checks:[...new Set(checks)],delivery_quality,unverified:limitations,checked_at:new Date().toISOString()};}}
export function efficiency(records:any[]){const flows=new Map<string,any>();for(const r of records){const f=flows.get(r.flow_name)??{flow_name:r.flow_name,calls:0,prompt_tokens:0,completion_tokens:0,total_tokens:0,latency_ms:0,missing_usage:false};f.calls++;for(const k of ['prompt_tokens','completion_tokens','total_tokens']){if(r[k]===null)f.missing_usage=true;else f[k]+=r[k];}f.latency_ms+=r.latency_ms;flows.set(r.flow_name,f);}return {generated_at:new Date().toISOString(),flows:[...flows.values()],calls:records.length,deterministic_operations:['schema validation','policy checks','delivery validation','escrow authorization'].map(operation=>({operation,llm_calls:0})),ttft:null,ttft_note:'Non-streaming API used; TTFT was not measured.',energy:{measured:false,joules:null,label:'Energy Estimate — Assumption Based',method:'If organizer supplies application-attributable average watts P, estimate E=P×sum(latency_ms)/1000. API latency includes queue/network; this is not hardware active time.',power_assumption_watts:null,source:'No organizer power assumption or application power telemetry supplied; no numerical estimate is presented.',limitations:'No application-measured energy, utilization, batching attribution, or verified baseline. Token/call totals are measured; reduction relative to another design is not yet measured.'}};}
