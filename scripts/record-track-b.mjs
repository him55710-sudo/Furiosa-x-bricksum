import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import path from 'node:path';
const record=process.argv.includes('--record'),out=path.resolve('artifacts/accord-lock/submission'),origin=process.env.ADE_SPENDING_ORIGIN??'http://127.0.0.1:3443';
const python=process.env.ADE_PYTHON??'python';
const scenes=JSON.parse(readFileSync('docs/track-b-narration.ko.json','utf8'));
mkdirSync(path.join(out,'capture'),{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1920,height:1080},...(record?{recordVideo:{dir:path.join(out,'capture'),size:{width:1920,height:1080}}}:{})});
const captureStart=performance.now(),page=await context.newPage(),errors=[],shots=[],jobs=[];page.on('pageerror',e=>errors.push(e.message));
let start,raw,offset;
const at=async second=>{if(!record)return;const wait=second*1000-(performance.now()-start);if(wait<-5000)throw Error('TIMING_OVERRUN:'+second);if(wait>0)await page.waitForTimeout(wait);console.log('Timeline '+second+'s');};
async function click(locator){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});await page.waitForTimeout(130);await locator.click();await page.locator('#operation').waitFor({state:'hidden'});await page.waitForTimeout(180);}
const action=name=>click(page.locator(`[data-action="${name}"]`));
async function screenshot(name){await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);const file=path.join(out,name+'.png');await page.screenshot({path:file});shots.push({name,path:file});}
async function currentJob(){return page.evaluate(async()=>{const id=location.hash.split('/')[1];return (await fetch('/api/tasks/'+id)).json();});}
async function sample(title){if(!await page.locator('[data-action="sample"]').count())await action('new');await action('sample');await page.locator('[name="title"]').fill(title);await click(page.locator('#brief-form button[type="submit"]'));}
try{
 await page.goto(origin+'/#demo');await page.locator('#brief-form').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'#capture-pointer{position:fixed;width:17px;height:17px;border:3px solid #2454ed;background:#2454ed22;border-radius:50%;z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:left .1s,top .1s}#capture-pointer.down{background:#e94974aa;border-color:#e94974;scale:1.5}'});
 await page.evaluate(()=>{const p=document.createElement('div');p.id='capture-pointer';document.body.append(p);document.addEventListener('mousemove',e=>{p.style.left=e.clientX+'px';p.style.top=e.clientY+'px';});document.addEventListener('mousedown',()=>p.classList.add('down'));document.addEventListener('mouseup',()=>p.classList.remove('down'));});
 offset=(performance.now()-captureStart)/1000;start=performance.now();await screenshot('00-problem');
 await at(12);await sample('RUN 1 — Budget boundary');await action('quotes');
 let job=await currentJob();if(job.status!=='BLOCKED'||job.transactions?.length)throw Error('RUN1_NOT_STOPPED');jobs.push(job);
 await screenshot('01-run1-stop');await at(36);
 await at(43);await sample('RUN 2 — Agreement boundary');await action('quotes');
 await click(page.locator('[data-select="seller-a"]'));await click(page.locator('#counter-form button'));
 await screenshot('02-agreement');await at(75);await action('fund');await screenshot('03-locked');
 await at(82);await action('run');job=await currentJob();
 if(job.id===jobs[0].id||job.invoice!==25||job.agreedPrice!==20||job.status!=='REVIEW'||job.transactions.some(x=>x.kind==='release'))throw Error('RUN2_NOT_STOPPED');
 jobs.push(job);await screenshot('04-run2-stop');
 if(!await page.locator('[data-action="settle"]').isDisabled())throw Error('PAYOUT_NOT_DISABLED');
 await at(108);await page.locator('.invoice').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'05-invoice-comparison.png')});
 await at(120);await action('correct-invoice');await action('settle');await screenshot('06-paid');
 await at(130);await action('verify');await page.locator('#dialog-content h2').filter({hasText:'VALID'}).waitFor();await page.screenshot({path:path.join(out,'07-verified.png')});
 await at(135);await click(page.locator('[data-close]'));
 const downloaded=page.waitForEvent('download');await action('receipt');const download=await downloaded;await download.saveAs(path.join(out,'run2-receipt.json'));
 const final=await currentJob();jobs.push(final);
 await at(140);await page.locator('a[href="#evidence"]').first().click();await page.locator('.proof-panel').waitFor();await screenshot('08-public-proof');
 await at(151);await page.locator('.proof-transactions').count().then(async count=>{if(count)await page.locator('.proof-transactions').scrollIntoViewIfNeeded();});
 await at(165);if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(path.join(out,'track-b-runs.json'),JSON.stringify({mode:'LIVE_LOCAL_EVM',kiln_calls_in_browser:0,run1:jobs[0],run2_stop:jobs[1],run2_final:jobs[2]},null,2));
 writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({status:'PASS',errors,shots,run1:jobs[0].id,run2:jobs[1].id,checks:['distinct task IDs','run1 no funding','run2 no payout at stop','payment button disabled','corrected exact payment','VALID local verification','receipt export','separate public proof']},null,2));
 if(record){const video=page.video();await page.waitForTimeout(600);await context.close();raw=await video.path();}
}finally{await browser.close();}
if(!record){console.log('PASS: two independent local runs, correction, verification and export');process.exit(0);}
const ffmpeg=process.env.ADE_FFMPEG??execFileSync(python,['-c',"import sys;sys.path.insert(0,'data/private/media-tools');import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],{encoding:'utf8',windowsHide:true}).trim();
const durations=JSON.parse(execFileSync(python,['-c',"import wave,json;print(json.dumps([(w:=wave.open('artifacts/accord-lock/submission/narration/scene-'+str(i)+'.wav')).getnframes()/w.getframerate() for i in range(7)]))"],{encoding:'utf8',windowsHide:true}));
const rates=scenes.map((s,i)=>Math.max(1,durations[i]/(s.end-s.at-.4)));if(rates.some(r=>r>1.15))throw Error('NARRATION_TOO_FAST');
const output=path.join(out,'accord-lock-track-b-165s.ko.mp4'),args=['-y','-ss',String(offset),'-i',raw];
scenes.forEach((s,i)=>args.push('-i',path.join(out,'narration',`scene-${i}.wav`)));
const filters=scenes.map((s,i)=>`[${i+1}:a]atempo=${rates[i].toFixed(5)},adelay=${s.at*1000}:all=1[a${i}]`);
filters.push(scenes.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${scenes.length}:duration=longest:normalize=0,apad[audio]`);
args.push('-filter_complex',filters.join(';'),'-map','0:v','-map','[audio]','-t','165','-r','30','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',output);
await new Promise((resolve,reject)=>{const p=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let log='';p.stderr.on('data',d=>log+=d);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(log.slice(-3000))));});
writeFileSync(path.join(out,'video.json'),JSON.stringify({status:'CREATED',path:output,duration_seconds:165,resolution:'1920x1080',kind:'Continuous recording of two live local EVM tasks, then separate historical Kiln/Sepolia proof',synthetic_voice:'Microsoft Heami Desktop',cursor:'visual click highlight',raw,offset,rates,scenes},null,2));
console.log(JSON.stringify({status:'CREATED',path:output}));
