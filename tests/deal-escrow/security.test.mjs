import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import {localBoundary,localSession} from '../../src/deal-escrow/http-security.mjs';
import {exact,policy,now} from '../../src/deal-escrow/domain.ts';
import {KilnClient} from '../../src/deal-escrow/kiln.ts';

function request(port,{method='GET',headers={},body=''}={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/api/test',method,headers},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:data}));});req.on('error',reject);req.end(body);});}

test('local signing API rejects DNS rebinding and CSRF before mutation',async t=>{
 const app=express(),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const port=server.address().port,token='a'.repeat(64),origin=`http://127.0.0.1:${port}`;let mutations=0;
 app.use(localBoundary({port}));app.use('/api',localSession(token));app.use(express.json({limit:'2mb',inflate:false}));app.get('/api/test',(_q,r)=>r.json({ok:true}));app.post('/api/test',(_q,r)=>{mutations++;r.json({ok:true});});
 for(const headers of [{host:'attacker.example'},{host:'localhost:1'},{origin:'https://attacker.example'},{'sec-fetch-site':'cross-site'}])assert.equal((await request(port,{headers})).status,403);
 for(const headers of [{},{origin},{origin,'x-ade-token':'b'.repeat(64)}])assert.equal((await request(port,{method:'POST',headers,body:'{}'})).status,403);
 assert.equal(mutations,0);
 assert.equal((await request(port,{method:'POST',headers:{origin,'x-ade-token':token,'content-type':'application/json'},body:'{}'})).status,200);
 assert.equal(mutations,1);
});

test('schema rejects delimiter collisions and empty seller allowlist grants no authority',()=>{
 assert.throws(()=>exact({'a|b':1},['a','b']),/SCHEMA_FIELDS/);
 assert.throws(()=>exact(Object.assign(Object.create({authority:true}),{deal_id:'x'}),['deal_id']),/SCHEMA_OBJECT/);
 const time=now(),m={mandate_id:'security',company_id:'company',buyer_id:'buyer',task_budget_minor:300,max_single_minor:200,allowed_sellers:[],category:'RESEARCH_DATA',status:'ACTIVE',created_at:time,expires_at:time+600};
 const d={deal_id:'order',buyer_id:'buyer',seller_id:'seller-a',price_minor:30,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:1,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:1,format:'JSON'},deadline:180,created_at:time,expires_at:time+300,supersedes_deal_id:null};
 assert.equal(policy(m,d).find(c=>c.name==='SELLER_ALLOWED').pass,false);
 assert.equal(policy({...m,allowed_sellers:['seller-a']},d).every(c=>c.pass),true);
});

test('Kiln rejects endpoint drift and oversized bodies without logging provider text',async()=>{
 for(const base of ['https://api.bricksum.com:444/v1','https://api.bricksum.com/v1?redirect=x','https://api.bricksum.com/other','https://api.bricksum.com.attacker.example/v1'])assert.throws(()=>new KilnClient({model:'model',key:'synthetic',base}),/ENDPOINT_NOT_ALLOWED/);
 for(const factory of [()=>new Response('{"SENSITIVE_SHORT_TEXT"'),()=>new Response('redirect',{status:302}),()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2_000_001));c.close();}}))]){
  const records=[];let options;const client=new KilnClient({model:'model',key:'synthetic',fetchImpl:async(_u,o)=>{options=o;return factory();},onRecord:r=>records.push(r)});
  await assert.rejects(client.call('security','buyer',{deal_id:'x'},'accept_deal'),/KILN_/);assert.equal(options.redirect,'error');assert.equal(records.length,1);assert(!JSON.stringify(records).includes('SENSITIVE_SHORT_TEXT'));
 }
});
