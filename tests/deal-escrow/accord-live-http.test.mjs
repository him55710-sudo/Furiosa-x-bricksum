import test from 'node:test';
import assert from 'node:assert/strict';
import {liveHandler} from '../../src/accord/live-http.mjs';

test('live HTTP requires its signed HttpOnly cookie, same origin and request token before paid work',async()=>{
 let calls=0;
 const handler=liveHandler({secret:'test-http-secret-at-least-thirty-two-characters',service:{state:async()=>({available:true}),execute:async()=>{calls++;return {ok:true};}}});
 async function call(method,headers={},body={}){const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method,url:'/api/live',headers:{host:'accord.example',...headers},body},r);return r;}
 assert.equal((await call('POST',{origin:'https://evil.example'})).code,403);
 assert.equal((await call('POST',{origin:'https://accord.example'})).code,401);
 const initial=await call('GET');assert.equal(initial.code,200);assert.match(initial.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.match(initial.headers['Set-Cookie'],/Secure/);
 const cookie=initial.headers['Set-Cookie'].split(';')[0],csrf=initial.body.csrf;
 assert.equal((await call('POST',{cookie,origin:'https://accord.example','content-type':'application/json'})).code,403);
 assert.equal((await call('POST',{cookie:cookie+'x',origin:'https://accord.example','x-accord-live-token':csrf,'content-type':'application/json'})).code,401);
 assert.equal(calls,0);
 assert.equal((await call('POST',{cookie:cookie.split('.')[0]+'.'+'é'.repeat(64),origin:'https://accord.example'})).code,401);
 assert.equal((await call('POST',{cookie,origin:'https://accord.example','x-accord-live-token':'é'.repeat(64),'content-type':'application/json'})).code,403);
 const good=await call('POST',{cookie,origin:'https://accord.example','x-accord-live-token':csrf,'content-type':'application/json'},{action:'offer'});
 assert.equal(good.code,200);assert.equal(calls,1);assert.equal(good.headers['Cache-Control'],'private, no-store');
 assert.equal((await call('POST',{cookie,origin:'https://accord.example','x-accord-live-token':csrf,'content-type':'application/json'},{data:'x'.repeat(17000)})).code,413);
 assert.equal(calls,1);
});
