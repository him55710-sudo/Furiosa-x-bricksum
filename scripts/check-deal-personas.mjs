import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from 'playwright';
import {createPersonaDemo} from './seed-deal-personas.mjs';
import {fixtureDelivery} from '../src/deal-escrow/delivery.ts';
import {verificationSource} from '../src/deal-escrow/verification-source.mjs';

const source=verificationSource();
for(const args of [['node_modules/typescript/bin/tsc','--project','tsconfig.deal-escrow.json'],['node_modules/vite/bin/vite.js','build','--config','vite.deal-escrow.config.ts']])execFileSync(process.execPath,args,{stdio:'pipe',timeout:60000});
const demo=await createPersonaDemo(),listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const env={...process.env,ADE_DATA_DIR:demo.directory,ADE_PORT:String(port)};delete env.KILN_API_KEY;delete env.ADE_NETWORK;
const server=spawn(process.execPath,['src/deal-escrow/server.mjs'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
const exit=new Promise(resolve=>server.once('exit',(code,signal)=>resolve({code,signal})));
let browser;const errors=[];let report;
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('PERSONA_SERVER_START_TIMEOUT')),20000);server.stdout.on('data',data=>{if(String(data).includes('Agent Deal Escrow:')){clearTimeout(timer);resolve();}});server.once('exit',()=>{clearTimeout(timer);reject(new Error('PERSONA_SERVER_EXITED'));});server.once('error',reject);});
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),origin=`http://127.0.0.1:${port}`;page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/?legacy=1');await page.getByRole('heading',{name:'Let agents negotiate.',exact:false}).waitFor();
  await page.getByLabel('Minimum rows',{exact:true}).fill('52');await page.getByLabel('Source URLs (%)',{exact:true}).fill('95');await page.getByLabel('Maximum delivery (seconds)',{exact:true}).fill('120');
  await page.getByRole('button',{name:'Approve task mandate',exact:false}).click();await page.getByRole('button',{name:'Continue with Seller A',exact:true}).waitFor();
  const api=await page.evaluate(async()=>{const s=await(await fetch('/api/state')).json(),health=await fetch('/api/health'),noToken=await fetch('/api/mandates',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return {mandate:s.mandates[0],healthStatus:health.status,health:await health.json(),noToken:noToken.status};});
  assert.equal(api.mandate.task_requirements.minimum_rows,52);assert.equal(api.mandate.task_requirements.minimum_source_coverage,.95);assert.equal(api.mandate.task_requirements.max_delivery_seconds,120);assert.equal(api.healthStatus,200);assert.equal(api.noToken,403);
  await page.getByRole('button',{name:'Deals',exact:false}).first().click();await page.locator('.deal-select button').filter({hasText:'Preview required'}).click();
  await page.getByLabel('Preview JSON',{exact:true}).fill('[{}]');await page.getByRole('button',{name:'Validate preview',exact:true}).click();await page.getByText('Preview failed. Correct the sample and submit again.',{exact:true}).waitFor();
  await page.getByLabel('JSON sample file',{exact:true}).setInputFiles({name:'seller-reformed-preview.json',mimeType:'application/json',buffer:Buffer.from(fixtureDelivery(10))});
  await page.getByRole('button',{name:'Validate preview',exact:true}).click();await page.getByRole('button',{name:'Resume funding',exact:true}).waitFor();
  await page.screenshot({path:path.join(demo.out,'preview-verified.png'),fullPage:true});
  await page.getByRole('button',{name:'Resume funding',exact:true}).click();await page.getByText('Money locked. Seller not paid yet.',{exact:true}).waitFor();
  await page.getByLabel('Delivery JSON',{exact:true}).fill(fixtureDelivery());await page.getByRole('button',{name:'Validate delivery & settle',exact:true}).click();await page.getByText('Delivery verified. Seller paid.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open Audit Receipt',exact:false}).click();await page.getByRole('button',{name:'Verify stored evidence + chain',exact:true}).click();await page.getByText('VALID ·',{exact:false}).waitFor();
  const after=await page.evaluate(async id=>{const state=await(await fetch('/api/state')).json(),r=await(await fetch('/api/audit/'+id)).json(),v=await(await fetch('/api/audit/'+id+'/verify')).json();return {state:state.deals.find(d=>d.deal.deal_id===id).state,r,v,calls:state.efficiency.calls};},demo.preview_id);
  assert.equal(after.state,'SETTLED');assert.equal(after.v.verdict,'VALID');assert.equal(after.calls,0);assert.ok(after.r.control_source);assert.equal(after.r.evidence.preview.verified,true);
  await writeFile(path.join(demo.out,'browser-reformed-receipt.json'),JSON.stringify(after.r,null,2));await page.screenshot({path:path.join(demo.out,'audit-verified.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/?legacy=1');await page.getByRole('heading',{name:'Let agents negotiate.',exact:false}).waitFor();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(demo.out,'mobile.png'),fullPage:true});
  const ending=verificationSource();assert.equal(ending.sha256,source.sha256,'SOURCE_CHANGED');report={status:'PASS',checked_at:new Date().toISOString(),source,ending_source:ending,demo_id:demo.id,evidence_level:demo.evidence_level,stages:['human quality approval','unauthorized request denied','health dependency probe','invalid preview rejected','file preview verified','funding resumed','reformed seller valid delivery','anchored control source audit','mobile overflow'],browser_errors:errors,model_calls:0,public_chain_transactions:0,health:api.health,receipt_verdict:after.v.verdict};
  await writeFile(path.join(demo.out,'browser.json'),JSON.stringify(report,null,2));await writeFile('artifacts/deal-escrow/personas/latest-browser.json',JSON.stringify({id:demo.id,status:'PASS',out:demo.out,report:path.join(demo.out,'browser.json')},null,2));console.log(JSON.stringify({status:report.status,out:demo.out,stages:report.stages}));
}catch(error){await writeFile(path.join(demo.out,'browser.json'),JSON.stringify({status:'FAIL',reason:String(error.message),errors},null,2));throw error;}
finally{await browser?.close();if(server.exitCode===null)server.kill('SIGTERM');await exit;}
