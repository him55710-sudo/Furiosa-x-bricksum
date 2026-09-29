import {randomBytes,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createLiveNegotiation} from '../src/accord/live-negotiation.mjs';
import {createLiveService} from '../src/accord/live-service.mjs';
import {sqliteLiveStore} from '../src/accord/live-store.mjs';
import {getBytes,verifyMessage,keccak256,toUtf8Bytes} from 'ethers';
import reference from '../data/reference/capex/lges-2025-v1.json' with {type:'json'};

mkdirSync('data/private/accord-live',{recursive:true});
const secretFile='data/private/accord-live/signing-secret';
if(!existsSync(secretFile))writeFileSync(secretFile,randomBytes(32).toString('hex'),{mode:0o600});
const store=sqliteLiveStore('data/private/accord-live/verification.sqlite');
const negotiation=createLiveNegotiation({secret:readFileSync(secretFile,'utf8')});
const service=createLiveService({store,negotiation,callBudget:12});
const owner=randomUUID(),request={title:'Quarterly CAPEX research',brief:'Normalize four quarterly CAPEX records and preserve their source references. Return JSON and CSV.',budget:40,perDeal:30,rows:4,sources:1,deliveryMinutes:10,sourceHash:keccak256(toUtf8Bytes(JSON.stringify(reference.records)))};
let current;
try{
 current=await service.execute(owner,{action:'start',operationId:randomUUID(),request});
 const actions=['offer','counter','respond'];
 for(let index=0;index<actions.length;index++){
  const action=actions[index];
  current=await service.execute(owner,{action,id:current.session.id,revision:current.revision,operationId:randomUUID(),seller:'atlas'});
  console.log(JSON.stringify({action,error:current.error,price:current.session.messages.at(-1)?.quote.price,model:current.session.messages.at(-1)?.model,requestId:current.session.messages.at(-1)?.requestId}));
  if(current.error)throw Error(current.error);
  if(action==='respond')actions.push(...(current.session.messages.at(-1).quote.price>request.perDeal&&current.attempts<7?['counter','respond']:['agree']));
 }
 const a=current.session.agreement;
 if(verifyMessage(getBytes(a.hash),a.buyerSignature)!==a.buyer||verifyMessage(getBytes(a.hash),a.sellerSignature)!==a.seller)throw Error('SIGNATURE_FAILED');
 mkdirSync('artifacts/accord-lock/live',{recursive:true});
 writeFileSync('artifacts/accord-lock/live/actual-negotiation.json',JSON.stringify({mode:'ACTUAL_KILN',recordedAt:new Date().toISOString(),verification:'BOTH_SIGNATURES_VALID',...current},null,2));
 console.log('ACTUAL_KILN_NEGOTIATION_AND_SIGNATURES_VERIFIED');
}finally{if(current){mkdirSync('data/private/accord-live',{recursive:true});writeFileSync('data/private/accord-live/last-verification.json',JSON.stringify(current,null,2));}store.close();}
