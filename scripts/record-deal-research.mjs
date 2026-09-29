import {chromium} from 'playwright';import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import path from 'node:path';
const root=path.resolve('artifacts/deal-escrow/research'),showcase=JSON.parse(readFileSync(path.join(root,'latest-showcase.json'),'utf8')),python=process.env.ADE_PYTHON??'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const ffmpeg=execFileSync(python,['-c',"import sys; sys.path.insert(0,'data/private/media-tools'); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],{encoding:'utf8',windowsHide:true}).trim();
const durations=JSON.parse(execFileSync(python,['-c',"import wave,json; from pathlib import Path; print(json.dumps([round(wave.open(str(p)).getnframes()/wave.open(str(p)).getframerate(),3) for p in sorted(Path('artifacts/deal-escrow/research/narration').glob('step-*.wav'))]))"],{encoding:'utf8',windowsHide:true}));if(durations.length!==showcase.steps.length)throw new Error('NARRATION_STEP_MISMATCH');
const origin=process.env.ADE_ORIGIN??'http://127.0.0.1:3412',videoDir=path.join(root,'video');mkdirSync(videoDir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:videoDir,size:{width:1440,height:1000}}}),page=await context.newPage(),errors=[],segments=[];page.on('pageerror',e=>errors.push(e.message));const start=performance.now();let recording;
try{
  await page.goto(origin+'/?replay=1');
  for(let i=0;i<showcase.steps.length;i++){
    if(i)await page.getByRole('button',{name:`장면 ${i+1}: ${showcase.steps[i].title}`,exact:true}).click();
    await page.getByRole('heading',{name:showcase.steps[i].title,exact:true}).waitFor();
    const screenshot=path.join(videoDir,`scene-${i}.png`);await page.screenshot({path:screenshot,fullPage:true});const offset=(performance.now()-start)/1000;segments.push({index:i,title:showcase.steps[i].title,start:offset,duration:durations[i],screenshot,narration:'Microsoft Heami Desktop synthetic Korean voice'});
    console.log(JSON.stringify({recording_scene:i+1,seconds:durations[i]}));await page.waitForTimeout((durations[i]+1)*1000);
  }
  recording=page.video();await context.close();const raw=await recording.path();if(errors.length)throw new Error('BROWSER_ERRORS: '+errors.join(','));
  const args=['-y','-i',raw];segments.forEach(s=>args.push('-i',path.join(root,'narration',`step-${s.index}.wav`)));
  const filters=segments.map((s,i)=>`[${i+1}:a]adelay=${Math.round(s.start*1000)}:all=1[a${i}]`);filters.push(segments.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${segments.length}:duration=longest:normalize=0[audio]`);
  const output=path.join(root,'agent-deal-escrow-demo.ko.mp4');args.push('-filter_complex',filters.join(';'),'-map','0:v','-map','[audio]','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',output);
  execFileSync(ffmpeg,args,{stdio:'pipe',windowsHide:true,timeout:120000,maxBuffer:3_000_000});
  const report={status:'CREATED',created_at:new Date().toISOString(),path:output,raw_video:raw,kind:'Screen recording of labeled actual execution replay, narrated with synthetic Korean speech',live:false,segments,browser_errors:errors,expected_duration_seconds:segments.at(-1).start+segments.at(-1).duration+1};writeFileSync(path.join(root,'video.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:path.join(videoDir,'recording-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(path.join(root,'video-failure.json'),JSON.stringify({status:'FAIL',error:error.message,browser_errors:errors,segments},null,2));throw error;}finally{await browser.close();}
