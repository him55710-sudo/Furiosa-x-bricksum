import test from 'node:test';
import assert from 'node:assert/strict';
import {request as rawRequest} from 'node:http';
import {REVOKE_TYPES} from '../shared/schema.mjs';
import {title} from './catalog.mjs';
import {lab,tokenFor,evidence} from './helpers.mjs';

export async function demo(l,http,{label='SYNTHETIC_MODEL_REAL_HTTP_AND_LOCAL_EVM'}={}){
  const user=await http.login(),id=await http.approve(user);
  const token=tokenFor(l.chain),before=await token.balanceOf(l.chain.deployment.vault);
  const r=await http.run(user,id);assert.equal(r.status,'SETTLED',r.reason);
  const exported=await http.request(`/api/runs/${r.id}/evidence`,{cookie:user.cookie});assert.equal(exported.status,200);
  assert.match(exported.headers.get('content-disposition'),/attachment/);
  assert.equal('tx' in exported.body.run,false);assert.equal('raw' in exported.body.run,false);
  const verified=await http.request('/api/verify',{method:'POST',body:exported.body});assert.equal(verified.body.status,'VALID',verified.body.reason);
  const receipt=await http.request(`/api/chain/transaction/${r.receipt.hash}`);assert.equal(receipt.body.status,1);
  assert.equal(before-await token.balanceOf(l.chain.deployment.vault),BigInt(r.offer.offer.total));
  const tampered=structuredClone(exported.body);tampered.run.offer.offer.total='1';
  assert.equal((await http.request('/api/verify',{method:'POST',body:tampered})).body.status,'INVALID');
  const replay=await http.run(user,id,'normal','repeat');
  assert.equal((await http.run(user,id,'normal','repeat')).id,replay.id);
  return {evidenceLevel:label,chain:l.chain.deployment,bundle:exported.body,verification:verified.body,receipt:receipt.body,stages:['wallet_login','signed_approval','model_proposal','policy_reservation','devnet_payment','evidence_download','independent_verification','tamper_rejection','idempotent_replay']};
}

test(title('E2E-001'),{timeout:60000},async t=>{
  const l=await lab(t),http=await l.http();await evidence('http-demo',await demo(l,http));
});

test(title('E2E-002'),{timeout:60000},async t=>{
  const l=await lab(t),http=await l.http(),a=await http.login(),b=await http.login(),id=await http.approve(a);
  assert.equal((await http.request('/api/dashboard')).status,401);
  assert.equal((await http.request('/api/auth/login',{method:'POST',body:a.loginBody})).status,401);
  for(const [route,method,body] of [[`/api/sessions/${id}/events`,'GET'],[`/api/sessions/${id}/run`,'POST',{}],[`/api/sessions/${id}/stop`,'POST',{signature:'0x'}]]){
    assert.equal((await http.request(route,{method,body,cookie:b.cookie})).status,403);
  }
  assert.equal((await http.request('/api/dashboard',{cookie:a.cookie,headers:{Origin:'https://attacker.invalid'}})).status,403);
  // Fetch may normalize Host. Send the attack header on the actual wire.
  const hostileHost=await new Promise((resolve,reject)=>{
    const req=rawRequest(http.origin+'/api/dashboard',{headers:{Host:'attacker.invalid',Cookie:a.cookie}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.end();
  });
  assert.equal(hostileHost,403);
  assert.match((await http.request('/api/config')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const bad=await http.request('/api/mandates/draft',{method:'POST',cookie:a.cookie,body:{totalCap:'-1'}});assert.equal(bad.status,400);
  assert.equal(JSON.stringify(bad.body).includes('stack'),false);
  assert.equal((await http.request('/api/dashboard',{cookie:b.cookie})).body.sessions.length,0);
});

test(title('E2E-003'),{timeout:60000},async t=>{
  const l=await lab(t),http=await l.http(),user=await http.login(),id=await http.approve(user),results=[];
  for(const scenario of ['hidden-fee','unlisted','expired']){
    const r=await http.run(user,id,scenario);assert.equal(r.status,'STOPPED');assert.equal(r.receipt,null);
    const bundle=await http.request(`/api/runs/${r.id}/evidence`,{cookie:user.cookie});
    const verified=await http.request('/api/verify',{method:'POST',body:bundle.body});assert.equal(verified.body.status,'VALID');
    results.push({scenario,status:r.status,reason:r.reason,verification:verified.body});
  }
  const signature=await user.owner.signTypedData(l.chain.domain,REVOKE_TYPES,{sessionId:id,owner:user.owner.address});
  const stop=await http.request(`/api/sessions/${id}/stop`,{method:'POST',cookie:user.cookie,body:{signature}});assert.equal(stop.status,200);
  assert.equal((await http.request(`/api/sessions/${id}/run`,{method:'POST',cookie:user.cookie,body:{}})).status,400);
  assert.equal(await l.chain.vault.spent(id),0n);assert.equal(await l.chain.vault.active(id),false);
  await evidence('http-stops',{evidenceLevel:'SYNTHETIC_MODEL_REAL_HTTP_AND_LOCAL_EVM',results});
});
