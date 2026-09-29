import express from 'express';
import {mkdirSync,readFileSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {createPrivateKey,sign} from 'node:crypto';
import {identity,signedMessage,signedConfirmation,verifyNegotiationPacket,expectedTerms,fields} from './ledger.mjs';
import {ConversationModel} from './kiln.mjs';
import {signClaim,assertProfile} from './claims.mjs';
import {ensure,hash,validateDeal} from '../deal-escrow/domain.ts';
import {referenceRows} from '../deal-escrow/reference.ts';

const directory=process.argv[2],role=process.argv[3],token=process.env.DEALTRACE_AGENT_TOKEN;
ensure(directory&&['buyer-agent','seller-a','seller-b'].includes(role)&&token,'AGENT_CONFIG');mkdirSync(directory,{recursive:true});
const stateFile=directory+'/state.json',keyFile=directory+'/identity.pem';
const fresh=identity(role);let actor=fresh;
if(existsSync(keyFile)){actor={id:role,private_key:createPrivateKey(readFileSync(keyFile)),public_key:readFileSync(directory+'/public-key.txt','utf8')};}
else{writeFileSync(keyFile,fresh.private_key.export({type:'pkcs8',format:'pem'}),{mode:0o600});writeFileSync(directory+'/public-key.txt',fresh.public_key);}
const state=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{role,sessions:{},reviews:[],model_calls:0};
function save(){writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));renameSync(stateFile+'.tmp',stateFile);}
let records=[],model=null;function liveModel(){if(!model){model=new ConversationModel(r=>{records.push(r);state.model_calls++;save();},6);model.calls=state.model_calls;}return model;}
function session(id){const s=state.sessions[id];ensure(s,'UNKNOWN_SESSION');return s;}
function acceptEvent(s,event){const old=s.events.find(e=>e.event_id===event.event_id);if(old){ensure(hash(old)===hash(event),'EVENT_ID_CONTENT_MISMATCH');return;}
 const packet={...s,events:[...s.events,event],revisions:[],audit:[],commit:null};ensure([s.buyer,s.seller].includes(event.sender_agent)&&event.recipient_agent===(event.sender_agent===s.buyer?s.seller:s.buyer),'MESSAGE_PARTICIPANTS');ensure(verifyNegotiationPacket(packet).verdict==='VALID','INBOUND_MESSAGE_INVALID');s.events.push(event);save();}
function review(packet){
 const s=session(packet.session_id),r=packet.revisions.at(-1);ensure(hash(packet.events)===hash(s.events),'LOCAL_TRANSCRIPT_DIVERGENCE');
 ensure(hash(packet.identities)===hash(s.identities)&&packet.mandate_hash===s.mandate_hash,'LOCAL_RFQ_DIVERGENCE');
 ensure(verifyNegotiationPacket(packet).verdict==='VALID','INVALID_NEGOTIATION_PACKET');ensure(r?.deal&&r.event_count===s.events.length&&!r.missing.length&&!r.conflicts.length,'INCOMPLETE_AGREEMENT');
 const d=validateDeal(r.deal),m=s.mandate_snapshot;const {version,max_delivery_seconds,...requirements}=m.task_requirements;
 ensure(hash(requirements)===hash(d.requirements)&&d.buyer_id===s.buyer&&d.seller_id===s.seller&&d.deal_id===s.deal_id&&d.created_at===s.created_at&&d.expires_at===m.expires_at&&d.currency_or_demo_asset==='DEMO','TASK_CHANGED');
 ensure(hash(d.assurance)===hash(s.assurance),'RFQ_PROFILE_CHANGED');assertProfile(d,s.network);
 ensure(fields.every(f=>Object.hasOwn(r.terms,f))&&Object.entries(expectedTerms).every(([k,v])=>hash(r.terms[k])===hash(v)),'TASK_CONFLICT');
 ensure(d.price_minor===r.terms.price_minor&&d.deadline===r.terms.deadline_seconds&&d.deadline<=max_delivery_seconds,'TERM_BINDING');
 ensure(m.status==='ACTIVE'&&Math.floor(Date.now()/1000)<m.expires_at,'LOCAL_AUTHORITY_EXPIRED');
 if(role==='buyer-agent'){ensure(d.price_minor<=m.max_single_minor&&d.price_minor<=m.task_budget_minor,'BUYER_BUDGET');ensure(m.allowed_sellers.length===0||m.allowed_sellers.includes(d.seller_id),'BUYER_SELLER');}
 else ensure(d.price_minor>=2600,'SELLER_PRICE_FLOOR');
 // A local transcript and complete independent policy review precede any signature.
 state.reviews.push({session_id:s.session_id,deal_hash:hash(d),reviewed_fields:Object.keys(d),reviewed_profile:d.assurance,role,time:Date.now()});s.confirmed_deal=d;save();return signedConfirmation(packet,r,actor);
}
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'3mb'}));
app.use((req,res,next)=>{if(!['127.0.0.1','localhost'].includes(req.hostname)||req.headers.authorization!=='Bearer '+token)return res.sendStatus(403);next();});
let queue=Promise.resolve();const handle=fn=>(req,res)=>{const run=queue.then(()=>fn(req.body));queue=run.catch(()=>{});run.then(v=>res.json(v)).catch(e=>res.status(400).json({error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'AGENT_REQUEST_FAILED'}));};
app.get('/identity',(_req,res)=>res.json({id:role,public_key:actor.public_key,pid:process.pid}));
app.post('/open',handle(input=>{ensure([input.buyer,input.seller].includes(role)&&input.identities[role]===actor.public_key,'ROLE_PIN');ensure(hash(input.mandate_snapshot)===input.mandate_hash,'RFQ_MANDATE_HASH');const old=state.sessions[input.session_id];if(old){ensure(old.mandate_hash===input.mandate_hash&&hash(old.assurance)===hash(input.assurance),'RFQ_REPLAY_CHANGED');return {opened:true};}state.sessions[input.session_id]={...input,events:[]};save();return {opened:true};}));
app.post('/receive',handle(({session_id,event})=>{acceptEvent(session(session_id),event);return {received:event.message_hash};}));
app.post('/speak',handle(async({session_id,instruction,scripted,live,request_id})=>{const s=session(session_id);s.outbox??={};const requestHash=hash({instruction,scripted,live});if(s.outbox[request_id]){ensure(s.outbox[request_id].request_hash===requestHash,'REQUEST_ID_CONTENT_MISMATCH');return s.outbox[request_id].result;}
 records=[];let content=scripted;try{if(live)content=(await liveModel().speak(role,instruction,s.events.map(e=>({sender:e.sender_agent,content:e.content})))).content;}catch(e){return {error:e.message,usage:records};}
 ensure(typeof content==='string'&&content.length<=4000,'MESSAGE_SIZE');const event=signedMessage(s,actor,role===s.buyer?s.seller:s.buyer,content,Math.floor(Date.now()/1000));acceptEvent(s,event);const result={event,usage:records};s.outbox[request_id]={request_hash:requestHash,result};save();return result;
}));
app.post('/confirm',handle(({packet})=>({ack:review(packet),review:state.reviews.at(-1)})));
app.post('/delivery',handle(({session_id,wrong=false})=>{ensure(role!=='buyer-agent','SELLER_ONLY');const s=session(session_id);ensure(s.confirmed_deal,'DEAL_NOT_CONFIRMED');const rows=referenceRows();if(wrong){rows[0].capex=3441;rows[0].source_value=-3441;}const raw=JSON.stringify(rows);s.deliveries??={};s.deliveries[hash(raw)]=raw;save();return {raw,hash:hash(raw),fixture:wrong?'CONTROLLED_WRONG_VALUE':'PINNED_REFERENCE'};}));
app.post('/claim',handle(({session_id,delivery_hash,amount_minor,claim_id})=>{ensure(role!=='buyer-agent','SELLER_ONLY');const s=session(session_id);ensure(s.confirmed_deal&&s.deliveries?.[delivery_hash],'LOCAL_DELIVERY_REQUIRED');s.claims??={};if(s.claims[claim_id]){ensure(s.claims[claim_id].amount_minor===amount_minor&&s.claims[claim_id].delivery_hash===delivery_hash,'CLAIM_ID_CONTENT_MISMATCH');return s.claims[claim_id];}const claim=signClaim(actor,s.confirmed_deal,s.deliveries[delivery_hash],{amount_minor,claim_id});s.claims[claim_id]=claim;save();return claim;}));
app.get('/evidence',(_req,res)=>res.json({role,pid:process.pid,reviews:state.reviews,session_ids:Object.keys(state.sessions),model_calls:state.model_calls,public_key:actor.public_key}));
const server=app.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port,pid:process.pid}));process.on('message',message=>{if(message==='shutdown')server.close(()=>process.exit(0));});
