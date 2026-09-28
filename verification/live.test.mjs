import test from 'node:test';
import assert from 'node:assert/strict';
import {Kiln} from '../src/kiln.mjs';
import {title} from './catalog.mjs';
import {lab,evidence} from './helpers.mjs';

test(title('LIVE-001'),{timeout:150000},async t=>{
  assert.ok(process.env.KILN_API_KEY,'MISSING_KILN_API_KEY');
  const l=await lab(t),http=await l.http({kiln:new Kiln()}),user=await http.login();
  // A single approved inference. No live retries and no paid/mainnet assets.
  const id=await http.approve(user,{maxCalls:1});
  const r=await http.run(user,id,'normal','live-demo');
  const exported=await http.request(`/api/runs/${r.id}/evidence`,{cookie:user.cookie});
  const verified=await http.request('/api/verify',{method:'POST',body:exported.body});
  await evidence('live-demo',{evidenceLevel:'LIVE_KILN_REAL_HTTP_LOCAL_EVM',scope:'Real Kiln inference and local devnet test-token payment; not public testnet, delivery, physical NPU routing, or energy measurement.',chain:l.chain.deployment,bundle:exported.body,verification:verified.body});
  assert.equal(r.status,'SETTLED',r.reason);assert.equal(verified.body.status,'VALID',verified.body.reason);
  assert.equal(r.usage.length,1);assert.equal(r.usage[0].model,'qwen3-32b');assert.equal(r.usage[0].httpStatus,200);
  assert.ok(r.usage[0].totalTokens>0,'actual token accounting required');
  assert.equal(await l.chain.vault.spent(id),BigInt(r.offer.offer.total));
});
