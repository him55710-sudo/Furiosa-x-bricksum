// UI recovery only: expiry never extends a signed mandate or replays an action.
export const expiredSessionMessage = 'This Live session expired after 20 minutes. Start a new negotiation to continue. Previous conversation and proof remain available in the saved task.';
export function liveSessionExpired(current, now = Date.now()) {
 const expiresAt=current?.session?.expiresAt;
 return !!current?.expired || Number.isFinite(expiresAt) && now >= expiresAt;
}
export async function runLiveSessionRequest(current, request) {
 try {
  if(liveSessionExpired(current))throw Error('LIVE_SESSION_EXPIRED');
  return await request();
 } catch(error) {
  if(error.code==='LIVE_SESSION_EXPIRED'||error.message==='LIVE_SESSION_EXPIRED') {
   current.expired=true;
   throw Object.assign(Error(expiredSessionMessage),{code:'LIVE_SESSION_EXPIRED'});
  }
  throw error;
 }
}
export async function leaveLiveSession(current, stop) {
 if(!current||current.session.stopped||current.authorization||liveSessionExpired(current))return;
 try { await stop(); }
 catch(error) {
  // Expiry may occur between the local check and the server's STOP check.
  if(error.code!=='LIVE_SESSION_EXPIRED'&&error.message!=='LIVE_SESSION_EXPIRED')throw error;
 }
}
export function expiredSessionNotice(action='live-new') {
 return `<section class="notice" role="status"><strong>Live session expired</strong><p>${expiredSessionMessage}</p><button class="button primary" data-action="${action}">Start a new negotiation →</button></section>`;
}
