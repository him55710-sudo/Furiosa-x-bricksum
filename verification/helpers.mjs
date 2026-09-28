import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {Wallet,Contract} from 'ethers';
import {startChain} from '../src/chain.mjs';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {Kiln} from '../src/kiln.mjs';
import {createApp} from '../src/app.mjs';
import {MANDATE_TYPES,hash,nowSeconds,MODEL} from '../shared/schema.mjs';

export const seed=Number(process.env.CONTROL_VERIFY_SEED??20260928)>>>0;
export function random(seedValue=seed){let n=seedValue;return max=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%max;};}
export function responseFor(payload,mutate=x=>x){
  const input=JSON.parse(payload.messages[1].content),tool=payload.tools[0].function.name;
  const candidate=input.candidates.find(c=>c.seller==='beta')??input.candidates[0];
  const args={offer_id:candidate.id,reason:'OFFLINE_SYNTHETIC_FIXTURE',...(tool==='request_counteroffer'?{total_minor:Number(input.maximum_total_minor)}:{})};
  return mutate({model:MODEL,usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30},choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:tool,arguments:JSON.stringify(args)}}]}}]});
}
// Exercise the real adapter with a synthetic transport, including its schema checks.
export function fixtureKiln(mutate){
  return new Kiln({key:'verification-fixture-not-a-secret',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.bricksum.com/v1/chat/completions');
    return new Response(JSON.stringify(responseFor(JSON.parse(options.body),mutate)),{status:200,headers:{'x-neocloud-generation-id':'OFFLINE_SYNTHETIC_FIXTURE'}});
  }});
}
export async function lab(t,{disk=false,persist=false}={}){
  const dir=await mkdtemp(path.join(tmpdir(),'cm-verification-'));
  let chain;
  const stores=new Set(),servers=new Set();
  t.after(async()=>{
    for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    for(const store of stores)try{store.close();}catch{}
    await chain?.close();
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('cm-verification-'));
    await rm(dir,{recursive:true,force:true});
  });
  chain=await startChain({directory:path.join(dir,'chain'),port:0,persist});
  const context={dir,chain,stores,servers,
    verifier:{provider:chain.provider,deployment:chain.deployment,abi:chain.artifacts.vault.abi},
    async restartChain(){
      await chain.close();
      chain=await startChain({directory:path.join(dir,'chain'),port:0,persist:true});
      context.chain=chain;context.verifier={provider:chain.provider,deployment:chain.deployment,abi:chain.artifacts.vault.abi};
      return chain;
    },
    async session(options={},kiln=fixtureKiln()){
      const file=disk?path.join(dir,`store-${stores.size}.sqlite`):':memory:';
      const store=new Store(file);stores.add(store);
      const engine=new Engine({store,chain,kiln}),owner=Wallet.createRandom();
      const draft=await engine.draft(owner.address,options);
      await engine.approve(draft.session.id,await owner.signTypedData(chain.domain,MANDATE_TYPES,draft.value));
      return {file,store,engine,kiln,owner,id:draft.session.id,chain};
    },
    async http({kiln=fixtureKiln()}={}){
      const store=new Store(':memory:');stores.add(store);
      const engine=new Engine({store,chain,kiln});
      // Bind once to an OS-selected port, then attach the exact production app.
      const server=createServer();servers.add(server);
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const port=server.address().port,origin=`http://127.0.0.1:${port}`;
      server.on('request',createApp({chain,store,engine,port}));
      async function request(route,{method='GET',body,cookie,headers={}}={}){
        const r=await fetch(origin+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
        return {status:r.status,headers:r.headers,body:await r.json()};
      }
      async function login(owner=Wallet.createRandom()){
        const c=await request('/api/auth/challenge',{method:'POST',body:{address:owner.address}});assert.equal(c.status,200);
        const body={nonce:c.body.nonce,signature:await owner.signMessage(c.body.message)};
        const r=await request('/api/auth/login',{method:'POST',body});assert.equal(r.status,200);
        return {owner,cookie:r.headers.get('set-cookie').split(';')[0],loginBody:body};
      }
      async function approve(user,options={}){
        const d=await request('/api/mandates/draft',{method:'POST',cookie:user.cookie,body:options});assert.equal(d.status,200);
        const signature=await user.owner.signTypedData(d.body.domain,d.body.types,d.body.value);
        const a=await request(`/api/mandates/${d.body.session.id}/approve`,{method:'POST',cookie:user.cookie,body:{signature}});assert.equal(a.status,200);
        return d.body.session.id;
      }
      async function run(user,id,scenarioId='normal',requestId){
        const q=await request(`/api/sessions/${id}/run`,{method:'POST',cookie:user.cookie,body:{scenarioId,requestId}});assert.equal(q.status,202);
        const deadline=Date.now()+80000;
        while(Date.now()<deadline){
          const dashboard=await request('/api/dashboard',{cookie:user.cookie});assert.equal(dashboard.status,200);
          const r=dashboard.body.runs.find(r=>r.id===q.body.id);
          if(['SETTLED','STOPPED','REVIEW_REQUIRED','UNKNOWN'].includes(r?.status))return r;
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        throw new Error('HTTP_RUN_TIMEOUT');
      }
      return {store,engine,request,login,approve,run,origin,server};
    },
  };
  return context;
}
export async function run(c,scenarioId='normal',requestId){const r=c.engine.enqueue(c.id,{scenarioId,requestId});await c.engine.wait(r.id);return c.store.get('run',r.id);}
export async function offer(c,{total='200',merchant='alpha',...overrides}={}){
  const s=c.engine.session(c.id);
  return c.chain.signOffer(merchant,{sessionId:c.id,offerId:hash({nonce:Wallet.createRandom().address}),merchant:c.chain.merchant(merchant).address,purposeHash:s.mandate.purposeHash,skuHash:s.mandate.skuHash,quantity:'100',refundHours:'24',subtotal:total,fee:'0',total,expiresAt:String(nowSeconds()+600),...overrides});
}
export async function ledger(c){
  const s=c.engine.session(c.id),runs=c.store.all('run').filter(r=>r.sessionId===c.id);
  const reserved=runs.filter(r=>['RESERVED','SUBMISSION_STARTED','UNKNOWN'].includes(r.status)).reduce((n,r)=>n+BigInt(r.offer.offer.total),0n);
  const spent=runs.filter(r=>r.status==='SETTLED').reduce((n,r)=>n+BigInt(r.offer.offer.total),0n);
  assert.equal(BigInt(s.reserved),reserved,'reservation conservation');
  assert.equal(BigInt(s.spent),spent,'settlement conservation');
  assert.ok(reserved>=0n&&spent>=0n&&spent+reserved<=BigInt(s.mandate.totalCap),'all-in budget');
  // UNKNOWN may already have settled on chain; it must remain reserved locally.
  const observed=await c.chain.vault.spent(c.id);
  assert.ok(observed>=spent&&observed<=spent+reserved,'chain exposure bounded by local ledger');
  let previous=null;
  for(const [index,{hash:h,...e}] of c.store.events(c.id).entries()){
    assert.equal(e.seq,index+1);assert.equal(e.prevHash,previous);assert.equal(hash(e),h);previous=h;
  }
}
export const tokenFor=chain=>new Contract(chain.deployment.token,chain.artifacts.token.abi,chain.provider);
export async function evidence(name,value){
  const out=process.env.CONTROL_VERIFY_DIR;if(!out)return;
  assert.match(name,/^[a-z0-9-]+$/);
  await mkdir(path.join(out,'evidence'),{recursive:true});
  await writeFile(path.join(out,'evidence',name+'.json'),JSON.stringify(value,null,2)+'\n');
}
