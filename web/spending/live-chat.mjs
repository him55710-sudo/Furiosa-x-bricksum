const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={atlas:'Atlas',nexus:'Nexus',orbit:'Orbit'};

export function roomMessageTurn(live){
 const current=live?.current,session=current?.session,seller=live?.seller??'atlas';
 const reason=live?.chatPending?'Waiting for the actual Kiln response…':session?.stopped?'Agents stopped. Start a new negotiation to send messages.':session?.agreement||current?.authorization?'Agreement locked. Approve the signed deal or start a new negotiation.':current?.pending?'A model request is running. Wait, refresh, or stop the agents.':current?.attempts>=8?'All 8 model calls have been used. Start a new negotiation.':!session&&(!live?.available||live?.remainingCalls===0)?'Connect the live service with available calls to send a message.':null;
 const last=session?.messages.filter(m=>m.seller===seller).at(-1);
 const action=!last?'live-offer':last.actor==='buyer'?'live-respond':'live-counter';
 return {action,target:action==='live-counter'?'Buyer':names[seller],reason};
}

export function roomComposer(live){
 const {target,reason}=roomMessageTurn(live);
 return `<form id="deal-room-message-form" class="deal-room-composer" aria-label="Message the live agents"><label for="deal-room-message">Message ${target}</label><p id="deal-room-message-help" role="status">${esc(reason??'Tell the agent what to negotiate. Your message goes to Kiln; your spending rules stay in force.')}</p><textarea id="deal-room-message" name="message" rows="3" maxlength="1200" required aria-describedby="deal-room-message-help" placeholder="Can you offer a lower price without reducing source coverage?" ${reason?'disabled':''}>${esc(live?.composer)}</textarea><div><span>LIVE · Kiln · qwen3-32b</span><button type="submit" class="button primary" ${reason?'disabled':''}>Send message →</button></div></form>`;
}

export function roomHumanMessage(text,status='Sent to Kiln'){
 return `<article class="deal-room-human-message"><strong>You <small>${esc(status)}</small></strong><p>${esc(text)}</p></article>`;
}

export async function sendRoomMessage(getLive,actions,text){
 const guidance=text.trim();
 if(!guidance||guidance.length>1200)throw Error('Enter a message between 1 and 1,200 characters.');
 let turn=roomMessageTurn(getLive());
 if(turn.reason)throw Error(turn.reason);
 if(!getLive()?.current?.session)await actions.start();
 turn=roomMessageTurn(getLive());
 if(turn.reason)throw Error(turn.reason);
 await actions.send(turn.action,guidance);
}
