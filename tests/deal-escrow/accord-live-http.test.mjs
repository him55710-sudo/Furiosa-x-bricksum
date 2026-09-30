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


test('evidence downloads remain owner-scoped and never export the request token',async()=>{
 let ownerSeen;const handler=liveHandler({secret:'test-download-secret-at-least-thirty-two-characters',service:{state:async(owner,id)=>{ownerSeen=owner;return id?{session:{id},attemptLog:[]}:{};}}});
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 const initial=response();await handler({method:'GET',url:'/api/live?playground=1',headers:{host:'accord.example'}},initial);
 const owner=ownerSeen,cookie=initial.headers['Set-Cookie'].split(';')[0],download=response();
 await handler({method:'GET',url:'/api/live?playground=1&id=example-session&download=1',headers:{host:'accord.example',cookie}},download);
 assert.equal(ownerSeen,owner);assert.equal(download.code,200);assert.match(download.headers['Content-Disposition'],/attachment/);assert.equal(download.headers['Cache-Control'],'private, no-store');assert.equal(download.body.session.id,'example-session');assert.equal(Object.hasOwn(download.body,'csrf'),false);
});
