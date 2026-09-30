import {installLanguageUI} from './i18n.mjs';
import {mountPlayground} from './playground.mjs';
let disposePlayground;
import {renderHome,renderPurchase,policyForm,defaultPolicy,preparedDemoPrompt} from './product-view.mjs';
import {renderPresentation,presentationInspect} from './presentation-view.mjs';
import {runGuidedStory,presentationModel} from './presentation-model.mjs';
import {liveRequest} from './live-client.mjs';
import {leaveLiveSession,runLiveSessionRequest} from './live-session.mjs';
import {sendRoomMessage} from './live-chat.mjs';
import {parseSource,csv,normalizeRows} from './workspace-model.mjs';
import {renderWorkspace,briefForm,esc as e,amount,button} from './workspace-view.mjs';
import {request,executionMode} from './workspace-client.mjs';
const $=s=>document.querySelector(s),empty={title:'',brief:'',budget:40,perDeal:30,deliveryMinutes:10};
let proof=null;
let story={reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,mode:'guided',receipt:null,verification:null,pending:null,animate:false},storyRenderKey='',storyProjection=null;
const isStory=()=>route==='presentation'||route==='presentation-live';
const storyState=()=>({job,live,mode:story.mode,receipt:story.receipt,verification:story.verification,pending:story.pending,story});
function savedJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function loadNotes(){story.messages=job?savedJSON('accord-notes-'+job.id,[]):[];}
function saveNotes(){if(job)localStorage.setItem('accord-notes-'+job.id,JSON.stringify(story.messages??[]));}
function readPolicy(){return {...defaultPolicy,...savedJSON('accord-purchase-policy',{})};}
async function createStoryTask(){const sample=await api('/api/sample');job=await api('/api/tasks',{...sample,...(story.policy??readPolicy()),demoMode:story.mode!=='live'});if(story.mode!=='live')localStorage.setItem('accord-story-guided',job.id);loadNotes();}
let creating=false,live=null;
let renderedDeal=null,renderedStage=null;
let token='',network=null,tasks=[],job=null,busy=false,present=false,route='workspace',sourceText='',sourceName='',lastFocus=null,draft={...empty};
window.addEventListener('accord-operation-progress',event=>{if(busy&&$('#operation'))$('#operation').textContent=event.detail;});
async function api(url,body){return request(url,body,token);}
function announce(message){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>{$('#toast').hidden=true;},5500);}
function showError(message){const box=$('#error');if(box){box.textContent=message;box.hidden=false;box.scrollIntoView({block:'nearest'});}else announce(message);}
async function refreshList(){const state=await api('/api/workspace');token=state.token;network=state.network;tasks=state.tasks;}
async function operate(label,fn){if(busy)return;busy=true;story.error=null;const bar=$('#operation');bar.textContent=label;bar.hidden=false;const previousDisabled=new Map([...document.querySelectorAll('button:not([data-close])')].map(b=>[b,b.disabled]));previousDisabled.forEach((_was,b)=>b.disabled=true);document.querySelector('[data-action="live-stop"]')?.removeAttribute('disabled');try{await fn();await refreshList();render();}catch(err){story.error=err.message;if(job){try{job=await api('/api/tasks/'+job.id);}catch{}}render();showError(err.message);}finally{busy=false;story.pending=null;if(isStory()){render();document.querySelector('.story-actions .primary')?.focus({preventScroll:true});}previousDisabled.forEach((was,b)=>{if(b.isConnected)b.disabled=was;});}}
async function mutate(action,fields={}){job=await api(`/api/tasks/${job.id}/${action}`,{revision:job.revision,...fields});}
function captureDraft(form=$('#brief-form')){if(form){const d=new FormData(form);draft={demoMode:draft.demoMode===true,title:d.get('title'),brief:d.get('brief'),budget:Number(d.get('budget')),perDeal:Number(d.get('perDeal')),deliveryMinutes:Number(d.get('deliveryMinutes'))};}}
function render(){const changed=renderedDeal!==job?.id||renderedStage!==job?.status;renderedDeal=job?.id;renderedStage=job?.status;document.body.classList.toggle('presentation-mode',present);const storyKey=[job?.id,job?.revision,live?.current?.revision,story.receipt?.task?.id,story.verification?.verdict].join(':');const nextProjection=isStory()?presentationModel(storyState()):null;story.motionNodes=nextProjection&&storyProjection?Object.keys(nextProjection.nodes).filter(id=>nextProjection.nodes[id]&&(!storyProjection.nodes[id]||id==='invoice'&&nextProjection.invoice!==storyProjection.invoice||id==='negotiation'&&JSON.stringify(nextProjection.packets)!==JSON.stringify(storyProjection.packets)||id==='authority'&&nextProjection.proposed!==storyProjection.proposed)):[];story.animate=isStory()&&storyRenderKey!==storyKey;storyProjection=nextProjection;storyRenderKey=storyKey;$('#app').innerHTML=route==='home'?renderHome():isStory()?renderPurchase(storyState()):renderWorkspace({job,tasks,route,present,network,proof,draft,sourceText,sourceName,creating,live});if(isStory()&&story.error){$('#error').textContent=story.error;$('#error').hidden=false;}if(isStory()&&busy)document.querySelectorAll('.story-actions button:not([data-action="live-stop"])').forEach(b=>b.disabled=true);const stream=$('.purchase-transcript')??$('.negotiation-stream');if(stream)stream.scrollTop=stream.scrollHeight;if(changed&&!isStory())window.scrollTo({top:0,behavior:'instant'});if(job?.authorityRevoked){for(const action of ['edit','quotes','select','counter','negotiate','accept-counter',...(!job.dealId?['fund']:[])])document.querySelectorAll(`[data-action="${action}"]`).forEach(b=>b.disabled=true);document.querySelectorAll('[data-select],#counter-form button').forEach(b=>b.disabled=true);}if(!job&&route==='workspace'&&$('#brief-form'))bindForm();$('#counter-form')?.addEventListener('submit',ev=>{ev.preventDefault();operate('Sending your counteroffer…',()=>mutate('counter',{price:Number(new FormData(ev.currentTarget).get('price'))}));});$('#invoice-form')?.addEventListener('submit',ev=>{ev.preventDefault();const n=Number(new FormData(ev.currentTarget).get('amount'));operate('Checking the invoice against the agreement…',()=>mutate('invoice',{amount:n}));});}
function bindFile(scope=document){scope.querySelector('#source-file')?.addEventListener('change',async ev=>{const form=scope.querySelector('#brief-form');captureDraft(form);try{const file=ev.target.files[0];if(!file)return;if(file.size>1_000_000)throw Error('Choose a file smaller than 1 MB.');const raw=await file.text();parseSource(raw);draft.demoMode=false;sourceText=raw;sourceName=file.name;scope.querySelector('#source-name').textContent=sourceName;scope.querySelector('#source-count').textContent=`${parseSource(raw).length} rows · stored on this computer`;}catch(err){announce(err.message);}});}
function bindForm(){bindFile();$('#brief-form').addEventListener('submit',ev=>{ev.preventDefault();captureDraft();if(!sourceText){showError('Choose a source file, or use the sample task.');return;}const spec={...draft,sourceText,sourceName};operate('Saving your task and source table…',async()=>{job=await api('/api/tasks',spec);history.replaceState(null,'',`#task/${job.id}`);});});}
function modal(html,drawer=false){lastFocus=document.activeElement;$('#detail').classList.toggle('proof-detail',drawer);$('#dialog-content').innerHTML=`<button class="dialog-close" data-close aria-label="Close dialog">×</button>${html}`;if(!$('#detail').open)$('#detail').showModal();}
function download(name,value,type='application/json'){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function newTask(sample=false){job=null;draft={...empty};sourceText='';sourceName='';route='workspace';if(sample){present=true;const s=await api('/api/sample');draft=s;sourceText=s.sourceText;sourceName=s.sourceName;}history.replaceState(null,'','#workspace');}
function showEdit(){draft={...job};sourceText=JSON.stringify(job.source,null,2);sourceName=job.sourceName;modal(briefForm({draft,sourceText,sourceName},true));bindFile($('#detail'));$('#detail #brief-form').addEventListener('submit',ev=>{ev.preventDefault();captureDraft(ev.currentTarget);const fields={...draft,sourceText,sourceName};$('#detail').close();operate('Updating your brief…',()=>mutate('edit',fields));});}
async function loadLive(){
 const info=await liveRequest();live={...live,...info,seller:live?.seller??'atlas'};
 const saved=JSON.parse(localStorage.getItem('accord-live-current')??'null');
 if(job?.liveSessionId&&!job.dealId)live.current=await liveRequest(undefined,job.liveSessionId);
 else if(job&&!job.dealId)live.current=null;
 else if(saved&&!live.current){try{live.current=await liveRequest(undefined,saved.id);job=await api('/api/tasks/'+saved.taskId);}catch{localStorage.removeItem('accord-live-current');}}
}
async function liveAction(action,guidance){
 if(action==='live-refresh'){if(live?.current)live.current=await liveRequest(undefined,live.current.session.id);else await loadLive();return;}
 if(action==='live-new'){await leaveLiveSession(live?.current,()=>liveAction('live-stop'));live={...live,current:null};localStorage.removeItem('accord-live-current');job=null;return;}
 if(action==='live-start'){
  present=false;
  if(!job||job.dealId||job.authorityRevoked||!['DRAFT','QUOTED','BLOCKED'].includes(job.status)){const sample=await api('/api/sample');job=await api('/api/tasks',{...sample,demoMode:false});}
  const request=await api('/api/tasks/'+job.id+'/live-brief');
  live.current=await liveRequest({action:'start',request,operationId:crypto.randomUUID()});await mutate('live-bind',{id:live.current.session.id});
  localStorage.setItem('accord-live-current',JSON.stringify({id:live.current.session.id,taskId:job.id}));return;
 }
 const current=live.current;
 if(action==='live-fund'){
  live.current=await runLiveSessionRequest(current,()=>liveRequest({action:'authorize',id:current.session.id,revision:current.revision,operationId:crypto.randomUUID(),taskId:job.id}));
  if(!job.liveSession)await mutate('live-import',{id:current.session.id});if(!job.dealId||job.status==='FUNDING')await mutate('fund');route='workspace';history.replaceState(null,'','#task/'+job.id);return;
 }
 live.current=await runLiveSessionRequest(current,()=>liveRequest({action:action.slice(5),id:current.session.id,revision:current.revision,operationId:crypto.randomUUID(),seller:live.seller??'atlas',...(guidance?{guidance}: {})}));
}

async function loadStory(mode){
 story={reduceMotion:story.reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches,mode,receipt:null,verification:null,pending:null,animate:false,policy:readPolicy(),view:'chat'};storyRenderKey='';storyProjection=null;
 if(mode==='guided'){
  const id=localStorage.getItem('accord-story-guided');job=null;
  if(id){try{const saved=await api('/api/tasks/'+id);if(saved.demoMode&&!saved.liveSessionId)job=saved;}catch{localStorage.removeItem('accord-story-guided');}}
 }else{
  // Never relabel a Guided job as a Live transaction.
  if(!job?.liveSessionId)job=null;
  try{await loadLive();if(!job&&live?.current){const saved=JSON.parse(localStorage.getItem('accord-live-current')??'null');if(saved?.id===live.current.session.id)job=await api('/api/tasks/'+saved.taskId);}}catch(error){live={available:false,error:error.message};}
 }
 loadNotes();
 if(job?.status==='COMPLETED'){story.receipt=await api('/api/tasks/'+job.id+'/receipt');story.verification=await api('/api/tasks/'+job.id+'/verify');}
}
async function storyCheckpoint(){
 story.pending=null;render();
 if(!story.reduceMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,650));
}
async function storyReceipt(){
 story.receipt=await api('/api/tasks/'+job.id+'/receipt');
 story.verification=await api('/api/tasks/'+job.id+'/verify');
}
async function storyAction(action){
 if(action==='new'){
  if(story.mode==='live')await liveAction('live-new');else localStorage.removeItem('accord-story-guided');
  job=null;story.receipt=null;story.verification=null;story.messages=[];story.composer='';story.chosenSeller=null;story.demoStarted=false;story.view='chat';return;
 }
 const labels={delegate:'Creating your mandate and requesting offers…',negotiate:'Buyer and Atlas are exchanging terms…',approve:'Confirming signatures, escrow and delivery…',pay:'Checking the corrected invoice and confirming settlement…',receipt:'Verifying the actual receipt…','live-start':'Delegating your mandate…','live-offer':'Seller is preparing an offer…','live-counter':'Buyer is comparing the terms…','live-respond':'Seller is evaluating the counteroffer…','live-agree':'Verifying terms and creating both signatures…','live-execute':'Funding the approved agreement and executing the source-table worker…','live-pay':'Checking the actual invoice before settlement…'};
 story.pending={action,label:labels[action]??'Reading the current transaction…'};render();
 if(story.mode==='guided')return runGuidedStory(action,{
  getJob:()=>job,
  create:createStoryTask,seller:story.chosenSeller,
  mutate:async(name,fields)=>{story.pending={action:name,label:({quotes:'Requesting the three deterministic offers…',select:'Buyer is choosing Atlas…',counter:'Buyer and Atlas are exchanging terms…',fund:'Confirming both signatures and funding escrow…',run:'Reading the source table and validating delivery…',invoice:'Checking the corrected invoice against the signed deal…',settle:'Confirming the private-EVM settlement…'})[name]};render();await mutate(name,fields);},checkpoint:storyCheckpoint,receipt:storyReceipt
 });
 if(action==='receipt'){await storyReceipt();return;}
 if(action==='live-execute'){
  if(!job?.dealId||job.status==='FUNDING'){await liveAction('live-fund');route='presentation-live';history.replaceState(null,'','#presentation-live');await storyCheckpoint();}
  if(job.status==='LOCKED'){await mutate('run');await storyCheckpoint();}
 }else if(action==='live-pay'){
  await mutate('settle');await storyCheckpoint();if(job.status==='COMPLETED')await storyReceipt();
 }else {if(action==='live-start'&&!job)await createStoryTask();await liveAction(action);}
}
document.addEventListener('change',ev=>{if(ev.target.id==='story-motion'){story.reduceMotion=ev.target.checked;render();document.querySelector('#story-motion')?.focus();return;}if(ev.target.id==='story-seller'&&!busy){live.seller=ev.target.value;render();}});

document.addEventListener('input',ev=>{if(ev.target.id==='purchase-message')story.composer=ev.target.value;});
document.addEventListener('submit',async ev=>{
 if(ev.target.id==='purchase-policy-form'){
  ev.preventDefault();if(busy)return;const form=ev.target,d=new FormData(form);
  const p={title:String(d.get('title')).trim(),brief:String(d.get('brief')).trim(),budget:Number(d.get('budget')),perDeal:Number(d.get('perDeal')),deliveryMinutes:Number(d.get('deliveryMinutes'))};
  if(!Number.isSafeInteger(p.budget)||!Number.isSafeInteger(p.perDeal)||p.budget<1||p.perDeal<1||p.budget>1000000||p.perDeal>p.budget){form.querySelector('#policy-error').textContent='Use positive whole amounts. Max per deal cannot exceed total budget.';return;}
  await operate('Saving your spending policy…',async()=>{
   if(job?.liveSessionId||job?.dealId||job?.authorityRevoked)await storyAction('new');
   if(job)await mutate('edit',{...p,demoMode:true,sourceText:JSON.stringify(job.source),sourceName:job.sourceName});
   story.policy=p;if(!job&&story.demoStarted)story.composer=preparedDemoPrompt(p,document.documentElement.lang);localStorage.setItem('accord-purchase-policy',JSON.stringify(p));$('#detail').close();
  });return;
 }
 if(ev.target.id==='purchase-message-form'){
  ev.preventDefault();if(busy)return;const d=new FormData(ev.target),text=String(d.get('message')??'').trim(),counter=Number(d.get('counter'));
  if(!text&&!job){showError('Describe the task in at least 10 characters, or use Delegate task for the sample.');return;}
  if(!job&&text.length<10){showError('Describe the task in at least 10 characters.');return;}
  await operate(story.mode==='live'?'Sending your message to Kiln…':'Applying your instruction…',async()=>{
   if(!job){
    story.policy={...(story.policy??readPolicy()),brief:text};
    if(story.mode==='live'){
     await storyAction('live-start');story.pending={action:'live-offer',label:'Your task is with Atlas. Waiting for the actual Kiln response…'};render();await liveAction('live-offer');
    }else await storyAction('delegate');
   }else{
    const note={id:crypto.randomUUID(),at:new Date().toISOString(),text:text||(story.mode==='guided'?'Counteroffer: $'+counter+' test USD.':''),label:story.mode==='live'?'Sent to Kiln':'Human counteroffer',status:'submitted'};
    (story.messages??=[]).push(note);saveNotes();
    try{
     if(story.mode==='live'){
      const next=presentationModel(storyState()).action;
      if(!['live-offer','live-counter','live-respond'].includes(next))throw Error('No negotiation turn is available. Inspect the current agreement.');
      if(!text)throw Error('Enter a message for the agents.');
      story.pending={action:next,label:'Sending your instruction to '+(next==='live-counter'?'Buyer':sellerNamesForStory())+' through Kiln…'};render();await liveAction(next,text);
      note.status=live.current.error?'proposal_rejected':'response_recorded';
     }else{
      if(!Number.isSafeInteger(counter)||counter<1||counter>1000000)throw Error('Enter a positive whole counteroffer.');
      const seller=story.chosenSeller??'seller-a';if(job.selected!==seller)await mutate('select',{seller});
      story.pending={action:'counter',label:'Buyer is sending your counteroffer…'};render();await mutate('counter',{price:counter});note.status='response_recorded';
     }
    }catch(error){note.status='request_failed';throw error;}finally{saveNotes();}
   }
   story.composer='';
  });return;
 }
});
document.addEventListener('input',ev=>{if(ev.target.id==='deal-room-message'&&live)live.composer=ev.target.value;});
document.addEventListener('submit',async ev=>{
 if(ev.target.id!=='deal-room-message-form')return;
 ev.preventDefault();if(busy)return;
 const text=String(new FormData(ev.target).get('message')??'');
 await operate('Sending your message to the live agent through Kiln…',async()=>{
  await sendRoomMessage(()=>live,{
   start:()=>liveAction('live-start'),
   send:async(action,guidance)=>{
    live.chatPending=guidance;render();
    try{await liveAction(action,guidance);live.composer='';}
    finally{live.chatPending=null;}
   }
  },text);
 });
 const stream=document.querySelector('.live-message-stream');if(stream)stream.scrollTop=stream.scrollHeight;
 document.getElementById('deal-room-message')?.focus({preventScroll:true});
});
function sellerNamesForStory(){return {atlas:'Atlas',nexus:'Nexus',orbit:'Orbit'}[live?.seller??'atlas'];}

document.addEventListener('click',async ev=>{
 if(isStory()&&busy&&ev.target.closest('a[href^="#"]')){ev.preventDefault();return;}
 const homeSection=ev.target.closest('[data-home-section]');if(homeSection){ev.preventDefault();document.getElementById(homeSection.dataset.homeSection)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
 const view=ev.target.closest('[data-purchase-view]');if(view){story.view=view.dataset.purchaseView;render();document.querySelector('.purchase-inspection')?.focus({preventScroll:true});return;}
 const sellerChoice=ev.target.closest('[data-purchase-seller]');if(sellerChoice&&!busy){const id=sellerChoice.dataset.purchaseSeller;if(story.mode==='live'){live.seller=id;render();}else {story.chosenSeller=id;await operate('Selecting seller…',()=>mutate('select',{seller:id}));}return;}
 const inspection=ev.target.closest('[data-story-inspect]');if(inspection){if(isStory()){story.inspectSection=inspection.dataset.storyInspect;story.view='evidence';render();document.querySelector('.purchase-inspection')?.focus({preventScroll:true});}else modal(presentationInspect(inspection.dataset.storyInspect,storyState()),true);return;}

 if(ev.target.closest('[data-close]')){$('#detail').close();return;}
 if(ev.target.closest('[data-action="import-paste"]')){
  const form=ev.target.closest('#brief-form'),raw=form?.querySelector('#source-paste')?.value??'';
  try{if(new Blob([raw]).size>1_000_000)throw Error('Paste a table smaller than 1 MB.');const rows=parseSource(raw);captureDraft(form);draft.demoMode=false;sourceText=raw;sourceName='Pasted source table';form.querySelector('#source-name').textContent=sourceName;form.querySelector('#source-count').textContent=`${rows.length} rows · stored on this computer`;announce(`${rows.length} source rows ready. Create the task to continue.`);}catch(error){announce(error.message);}return;
 }
 const selected=ev.target.closest('[data-select]');if(selected&&!busy){await operate('Selecting this offer…',()=>mutate('select',{seller:selected.dataset.select}));return;}
 const task=ev.target.closest('[data-job]');if(task&&!busy){$('#detail').close();await operate('Opening task…',async()=>{job=await api('/api/tasks/'+task.dataset.job);route=job.liveSessionId&&!job.dealId?'live':'workspace';if(route==='live')await loadLive();history.replaceState(null,'',`#task/${job.id}`);});return;}
 const source=ev.target.closest('[data-source]');if(source&&job){const row=(job.output??job.source)[Number(source.dataset.source)]??{};const original=job.source[normalizeRows(job.source).findIndex(r=>r.quarter===row.quarter&&r.company===row.company)]??{};let url;try{const p=new URL(row.source_url);if(['http:','https:'].includes(p.protocol)&&!p.username&&!p.password)url=p.href;}catch{}modal(`<span class="eyebrow">ROW EVIDENCE</span><h2>${e(row.company)} · ${e(row.quarter)}</h2><div class="source-comparison"><div><span>Source value</span><strong>${e(original.capex)} ${e(original.unit)} ${e(original.currency)}</strong></div><div><span>Delivered value</span><strong>${e(row.capex)} ${e(row.unit)} ${e(row.currency)}</strong></div></div><p class="hash">${e(row.source_url||'No source URL provided.')}</p>${url?`<a class="button primary" target="_blank" rel="noopener noreferrer" href="${e(url)}">Open original source ↗</a>`:''}<p class="trust-note">A preserved citation is not an independent certification of the source's accuracy.</p>`);return;}
 const tx=ev.target.closest('[data-tx]');if(tx){const item=job.transactions.find(x=>x.kind===tx.dataset.tx);modal(`<span class="eyebrow">LOCAL EVM RECEIPT</span><h2>${item.kind==='fund'?'Escrow funding':item.kind==='release'?'Seller payment':'Buyer refund'}</h2><dl><dt>Amount</dt><dd>${amount(item.amount)}</dd><dt>Status</dt><dd>${e(item.status)}</dd><dt>Transaction</dt><dd class="hash">${e(item.hash)}</dd><dt>Block</dt><dd>${item.block??'Pending'}</dd><dt>Contract</dt><dd class="hash">${e(network.contract)}</dd></dl><p>Chain ${network.chainId}. Local transactions have no public explorer URL.</p>`);return;}
 const liveSeller=ev.target.closest('[data-live-seller]');if(liveSeller&&!busy){live.seller=liveSeller.dataset.liveSeller;render();return;}
 const liveMessage=ev.target.closest('[data-live-message]');if(liveMessage){const m=live.current.session.messages.find(m=>m.sequence===Number(liveMessage.dataset.liveMessage));modal(`<span class="eyebrow">ACTUAL MODEL RESPONSE</span><h2>${e(m.actor)} · ${e(m.model)}</h2><dl><dt>Request ID</dt><dd class="hash">${e(m.requestId)}</dd><dt>Input scope</dt><dd>${e(m.inputScope)}</dd></dl><h3>Public input</h3><pre>${e(JSON.stringify(m.input,null,2))}</pre><h3>Model output</h3><pre>${e(JSON.stringify(m.quote,null,2))}</pre><h3>Measured usage</h3><pre>${e(JSON.stringify(m.usage,null,2))}</pre>`,true);return;}
 let name=ev.target.closest('[data-action]')?.dataset.action;if(!name)return;
 if(name==='purchase-start-demo'){story.demoStarted=true;story.composer=preparedDemoPrompt(story.policy??readPolicy(),document.documentElement.lang);render();document.querySelector('#purchase-message')?.focus();return;}
 if(name==='purchase-expand'){story.chatExpanded=!story.chatExpanded;render();document.querySelector('.chat-expand')?.focus({preventScroll:true});return;}
 if(name==='purchase-policy'){modal(policyForm(storyState()));return;}
 if(name==='purchase-new'){await operate('Opening a new purchase…',()=>storyAction('new'));return;}
 if(name==='purchase-export'){download('accord-conversation-'+(job?.id??'draft')+'.json',{schema:'ACCORD_CONVERSATION_EXPORT_V1',exportedAt:new Date().toISOString(),mode:story.mode,displayCurrency:'test USD; no cash value',task:job,humanNotes:story.messages??[],live:story.mode==='live'?live?.current:null,receipt:story.receipt,verification:story.verification,note:'Human notes are local annotations, not signed agent messages. Original receipts and signed terms remain unchanged.'});return;}
 if(name==='story-inspect-proof')name=live?.current&&story.mode==='live'&&!job?.dealId?'live-proof':'proof';
 if(name.startsWith('story-')&&!busy){await operate('Applying your next transaction decision…',()=>storyAction(name.slice(6)));return;}

 if(name==='live-stop'&&live?.current){try{await liveAction(name);render();}catch(error){showError(error.message);}return;}
 if(busy)return;
 if(name==='live-proof'){modal(`<span class="eyebrow">LIVE AGREEMENT PROOF</span><h2>${live.current.session.agreement?'Both agents signed.':'No agreement signed yet.'}</h2><p>Actual model proposals. Separate operator-owned signing identities. Private-EVM funding requires your approval.</p><pre>${e(JSON.stringify(live.current.session.agreement??{session:live.current.session.id,signers:live.current.session.identities},null,2))}</pre><h3>Model attempts</h3><p>Every attempted call counts. Rejected responses cannot authorize funds.</p><pre>${e(JSON.stringify(live.current.attemptLog??[],null,2))}</pre>`,true);return;}
 if(name.startsWith('live-')){await operate({'live-offer':'Kiln is reading the brief and the seller’s private policy…','live-counter':'Buyer is comparing the public terms with your mandate…','live-respond':'The seller is evaluating the counteroffer against its own policy…','live-agree':'Checking both policies and creating two signatures…','live-fund':'Binding the live agreement to your task and funding its escrow…'}[name]??'Updating the live negotiation…',()=>liveAction(name));return;}
 if(name==='pause-scene'){const scene=document.querySelector('.hero-scene');const paused=scene.classList.toggle('scene-paused');const b=ev.target.closest('button');b.setAttribute('aria-pressed',String(paused));b.textContent=paused?'Play illustration':'Pause illustration';return;}
 if(name==='launch-demo'){location.hash='presentation';return;}
 if(name==='create-custom'){await operate('Preparing your mandate…',async()=>{await newTask();creating=true;});$('#brief-form')?.scrollIntoView({block:'start'});return;}
 if(name==='negotiate'){await operate('Opening negotiations with Atlas…',()=>mutate('select',{seller:'seller-a'}));return;}
 if(name==='accept-counter'){const offer=job.offers.find(o=>o.seller===job.selected);await operate('Confirming the revised terms…',()=>mutate('counter',{price:offer.counterPrice}));return;}
 if(name==='connect-live'){await operate('Checking the live agent service…',loadLive);return;}
 if(name==='proof'){if(!job){location.hash='evidence';return;}modal(`<section class="proof-drawer"><span class="eyebrow">DEAL PROOF</span><h2>Inspect the agreement.</h2><dl><div><dt>Agreement hash</dt><dd>${e(job.dealHash??'No agreement committed yet')}</dd></div><div><dt>Buyer / seller signatures</dt><dd>${job.agreementSignatures?'Buyer and seller workspace signatures bind this escrow agreement.':'No workspace signatures yet'}</dd></div><div><dt>Network</dt><dd>${e(network.name)} · Chain ${e(network.chainId)}</dd></div><div><dt>Contract</dt><dd>${e(network.contract??'Not deployed yet')}</dd></div></dl>${job.liveSession?`<h3>Live agent agreement</h3><pre>${e(JSON.stringify(job.liveSession.agreement,null,2))}</pre>`:job.agreementSignatures?`<h3>Workspace agreement signatures</h3><pre>${e(JSON.stringify(job.agreementSignatures,null,2))}</pre>`:''}<div class="proof-transactions">${(job.transactions??[]).map(tx=>`<button class="button" data-tx="${e(tx.kind)}">${e(tx.kind)} · ${e(tx.status)} · Block ${tx.block??'pending'}</button>`).join('')}</div><div class="review-tools">${button('receipt','Download receipt ↓')}${job.dealId?button('verify','Verify on local chain',true):''}</div><p>Application checks enforce authority and exact invoices before the trusted controller signs. This private chain is separate from the recorded public proof.</p><a class="button" data-proof-link href="#evidence">See public Sepolia proof ↗</a></section>`,true);return;}
 if(name==='tasks'){modal(`<span class="eyebrow">SAVED ON THIS COMPUTER</span><h2>Your tasks</h2>${tasks.length?tasks.map(t=>`<button class="task-item" data-job="${t.id}"><span>${e(t.title)}<small>${e(t.status)}</small></span></button>`).join(''):'<p>Create a task to start your work history.</p>'}`);return;}
 if(name==='new'||name==='sample'){await operate('Preparing your task…',()=>newTask(name==='sample'));return;}
 if(name==='correct-invoice'){await operate('Checking the corrected invoice…',()=>mutate('invoice',{amount:job.agreedPrice}));return;}
 if(name==='present'){captureDraft();present=!present;route='workspace';render();return;}
 if(name==='template'){download('accord-source-template.csv',csv([{company:'Example company',quarter:'2025-Q1',capex:100,currency:'USD',source_url:'https://example.com/source'}]),'text/csv');return;}
 if(name==='edit'){showEdit();return;}
 if(name==='delivery'){modal(`<span class="eyebrow">SELLER DELIVERY</span><h2>Inspect or replace the result</h2><p>Changing a value or removing a citation runs the same acceptance checks again.</p><form id="delivery-form"><label for="delivery-json">Delivery JSON</label><textarea id="delivery-json" rows="13">${e(JSON.stringify(job.output,null,2))}</textarea><button class="button primary" type="submit">Validate replacement</button></form>`);$('#delivery-form').onsubmit=ev=>{ev.preventDefault();const raw=$('#delivery-json').value;$('#detail').close();operate('Validating the replacement delivery…',()=>mutate('delivery',{raw}));};return;}
 if(name==='download-json'||name==='download-csv'){download(`${job.id}.${name.endsWith('csv')?'csv':'json'}`,name.endsWith('csv')?csv(job.output):job.output,name.endsWith('csv')?'text/csv':'application/json');return;}
 if(name==='receipt'){await operate('Preparing the task receipt…',async()=>download(`accord-${job.id}.receipt.json`,await api(`/api/tasks/${job.id}/receipt`)));return;}
 if(name==='verify'){await operate('Verifying the receipt against the local chain…',async()=>{const result=await api(`/api/tasks/${job.id}/verify`);modal(`<span class="eyebrow">RECEIPT VERIFICATION</span><h2>${e(result.verdict)}</h2><p>Checked the receipt against the current local chain.</p><pre>${e(JSON.stringify(result,null,2))}</pre>`);});return;}
 const labels={stop:'Revoking future spending authority for this task…',quotes:'Reading your brief and calculating offers…',fund:'Checking authority, then confirming the local escrow transaction…',run:'Reading source rows, normalizing the table and checking each output…',settle:'Rechecking the delivery and invoice, then confirming the local payment…',refund:'Submitting and confirming your local refund…'};
 if(Object.hasOwn(labels,name))await operate(labels[name],()=>mutate(name));
});
$('#detail').addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus();else document.querySelector('.story-actions .primary')?.focus({preventScroll:true});});
async function loadRoute(){disposePlayground?.();disposePlayground=null;const hash=location.hash.slice(1);if(hash==='playground'){route='playground';$('#detail').close();disposePlayground=mountPlayground($('#app'));return;}if(!network)await refreshList();if(!proof){try{const r=await fetch('/evidence/dealtrace-summary.json');if(r.ok)proof=await r.json();}catch{}}$('#detail').close();if(hash.startsWith('task/')){job=await api('/api/tasks/'+hash.slice(5));route=job.liveSessionId&&!job.dealId?'live':'workspace';}else{route=['home','presentation','presentation-live','overview','workspace','deals','agents','evidence','live'].includes(hash)?hash:'home';if(hash==='demo'){route='presentation';history.replaceState(null,'','#presentation');}}if(route==='workspace'&&job?.liveSessionId&&!job.dealId)route='live';if(hash==='guided'){job=null;route='workspace';present=false;creating=false;}if(isStory()){await loadStory(route==='presentation-live'?'live':'guided');}if(route==='live'){try{await loadLive();}catch(error){live={available:false,error:error.message};}}render();}
window.addEventListener('hashchange',()=>loadRoute().catch(err=>showError(err.message)));
async function init(){if(location.hash==='#playground'){await loadRoute();return;}if(!location.hash||location.hash==='#home')$('#app').innerHTML=renderHome();try{const clean=new URL(location.href);if(clean.searchParams.has('shem')){clean.searchParams.delete('shem');history.replaceState(null,'',clean.pathname+clean.search+clean.hash);}try{const r=await fetch('/evidence/dealtrace-summary.json');if(r.ok)proof=await r.json();}catch{}await refreshList();await loadRoute();}catch(err){$('#app').innerHTML=`<div class="boot"><span class="brand-symbol">a</span><h1>${executionMode==='browser'?'Open your browser workspace':'Start your Accord Lock workspace'}</h1>${executionMode==='browser'?'<p>Use a recent browser with site storage enabled. No local server is required.</p>':'<p>This workspace needs its local task and escrow service.</p><code>pnpm ade:spending:view</code>'}<p>${e(err.message)}</p><button class="button primary" id="retry">Retry connection</button></div>`;$('#retry').onclick=init;}}
installLanguageUI();
init();
