import {createHash} from 'node:crypto';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inference=new Set(['offer','counter','respond']);
const allowed=new Set(['start','offer','counter','respond','agree','stop','authorize']);
const idPattern=/^[a-zA-Z0-9-]{16,80}$/;

export function createLiveService({store,negotiation,callBudget=60,now=Date.now}){
 need(Number.isSafeInteger(callBudget)&&callBudget>=0&&callBudget<=10000,'LIVE_BUDGET_CONFIG');
 async function update(fn){
  for(let attempt=0;attempt<12;attempt++){
   const row=await store.read(),ledger=row?.value??{schema:1,calls:0,starts:0,sessions:{}};
   need(ledger.schema===1,'LIVE_STORE_VERSION');
   const result=await fn(ledger);
   if(await store.write(ledger,row?.etag))return result;
  }
  throw Error('LIVE_BUSY_TRY_AGAIN');
 }
 function owned(ledger,owner,id){const s=ledger.sessions[id];need(s&&s.owner===hash(owner),'LIVE_SESSION_NOT_FOUND');return s;}
 const view=s=>({session:s.envelope.state,revision:s.revision,attempts:s.attempts,pending:s.pending?{action:s.pending.action,startedAt:s.pending.startedAt}:null,error:s.error??null,authorization:s.authorization??null});
 function expirePending(s){if(s.pending&&now()>s.pending.startedAt+100000){s.pending=null;s.error='LIVE_INTERRUPTED_REQUEST';s.revision++;}}
 return {
  async state(owner,id){
   const info=negotiation.info();
   if(!id){const ledger=(await store.read())?.value;return {...info,remainingCalls:Math.max(0,callBudget-(ledger?.calls??0)),callBudget,sessionLimit:8};}
   return update(l=>{const s=owned(l,owner,id);expirePending(s);return view(s);});
  },
  async execute(owner,input){
   need(typeof owner==='string'&&idPattern.test(owner),'LIVE_OWNER_REQUIRED');
   const {action,operationId,id,revision,seller,request,taskId}=input;
   need(allowed.has(action)&&idPattern.test(operationId??''),'LIVE_ACTION_REQUEST');
   const fingerprint=hash({action,id,seller,request,taskId});
   if(action==='start'){
    return update(async ledger=>{
     const previous=Object.values(ledger.sessions).find(s=>s.owner===hash(owner)&&s.startId===operationId);
     if(previous){need(previous.startHash===fingerprint,'LIVE_OPERATION_CHANGED');return view(previous);}
     need(ledger.calls<callBudget,'LIVE_SERVICE_CALL_LIMIT');
     // Fixed lifetime budget and bounded storage; no paid calls are made on start.
     need(ledger.starts<Math.max(10,callBudget),'LIVE_SERVICE_SESSION_LIMIT');
     const recent=Object.values(ledger.sessions).filter(s=>s.owner===hash(owner)&&!s.envelope.state.stopped&&!s.authorization&&now()<s.envelope.state.expiresAt);
     need(recent.length<3,'LIVE_ACTIVE_SESSION_LIMIT');
     for(const [key,s] of Object.entries(ledger.sessions))if(now()>s.envelope.state.expiresAt+86400000)delete ledger.sessions[key];
     const envelope=await negotiation.execute({action:'start',input:request});
     const s={owner:hash(owner),startId:operationId,startHash:fingerprint,envelope,revision:0,attempts:0,operations:{},pending:null};
     ledger.sessions[envelope.state.id]=s;ledger.starts++;return view(s);
    });
   }
   const reservation=await update(async ledger=>{
    const s=owned(ledger,owner,id);expirePending(s);
    if(s.operations[operationId]){need(s.operations[operationId].fingerprint===fingerprint,'LIVE_OPERATION_CHANGED');return {done:true,result:view(s)};}
    if(s.pending?.id===operationId){need(s.pending.fingerprint===fingerprint,'LIVE_OPERATION_CHANGED');return {done:true,result:view(s)};}
    need(!s.envelope.state.stopped,'LIVE_AUTHORITY_REVOKED');need(now()<s.envelope.state.expiresAt,'LIVE_SESSION_EXPIRED');
    // Stop intentionally supersedes an in-flight model call, even at an older revision.
    if(action==='stop'){
     need(!s.authorization,'LIVE_ALREADY_AUTHORIZED');
     s.envelope=await negotiation.execute({action:'stop',session:s.envelope});s.pending=null;s.revision++;
     s.operations[operationId]={fingerprint};return {done:true,result:view(s)};
    }
    need(revision===s.revision,'LIVE_REVISION_CHANGED');need(!s.pending,'LIVE_REQUEST_IN_PROGRESS');
    need(Object.keys(s.operations).length<32,'LIVE_OPERATION_LIMIT');
    if(action==='authorize'){
     need(idPattern.test(taskId??'')&&s.envelope.state.agreement,'LIVE_AGREEMENT_REQUIRED');
     need(!s.authorization||s.authorization.taskId===taskId,'LIVE_AGREEMENT_ALREADY_USED');
     s.authorization??={taskId,agreementHash:s.envelope.state.agreement.hash,at:now()};s.revision++;
     s.operations[operationId]={fingerprint};return {done:true,result:view(s)};
    }
    need(!s.authorization,'LIVE_ALREADY_AUTHORIZED');
    if(inference.has(action)){need(s.attempts<8,'LIVE_SESSION_CALL_LIMIT');need(ledger.calls<callBudget,'LIVE_SERVICE_CALL_LIMIT');ledger.calls++;s.attempts++;}
    s.pending={id:operationId,fingerprint,action,startedAt:now()};s.error=null;s.revision++;
    return {done:false,envelope:s.envelope};
   });
   if(reservation.done)return reservation.result;
   let result,error;
   try{result=await negotiation.execute({action,session:reservation.envelope,seller});}
   catch(e){error=/^[A-Z0-9_]{3,100}$/.test(e.message)?e.message:'LIVE_REQUEST_FAILED';}
   return update(ledger=>{
    const s=owned(ledger,owner,id);
    if(s.pending?.id!==operationId||s.envelope.state.stopped)return view(s);
    if(result)s.envelope=result;
    s.error=error??null;s.operations[operationId]={fingerprint,error:error??null};s.pending=null;s.revision++;
    return view(s);
   });
  }
 };
}
