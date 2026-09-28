// Render saved, real browser frames into a 180-second evidence walkthrough.
// This is a silent storyboard, not a claim of live transaction recording.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const directory='artifacts/deal-escrow/public-ui',durations=[15,30,25,20,25,20,20,15,10];
const files=durations.map((duration,i)=>({file:`${String(i+1).padStart(2,'0')}.png`,duration}));
writeFileSync(`${directory}/frames.txt`,files.map(x=>`file '${x.file}'\nduration ${x.duration}`).join('\n')+"\nfile '09.png'\n");
const output=path.resolve(`${directory}/demo-3min.webm`),ffmpeg=process.env.FFMPEG_BIN??'ffmpeg';
// JPEG copies permit the small Playwright FFmpeg build; a full build reads PNG.
const jpeg=files.every(x=>existsSync(`${directory}/${x.file.replace('.png','.jpg')}`));
const result=spawnSync(ffmpeg,['-hide_banner','-y','-f','image2pipe','-r','2','-c:v',jpeg?'mjpeg':'png','-i','pipe:0','-vf','scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=0xf6f7f2','-r','2','-t','180','-c:v','libvpx','-b:v','1000k','-crf','12','-an',output],{encoding:'utf8',timeout:120000,maxBuffer:2_000_000,input:Buffer.concat(files.flatMap(x=>Array(x.duration*2).fill(readFileSync(`${directory}/${jpeg?x.file.replace('.png','.jpg'):x.file}`))))});
if(result.status!==0)throw new Error(`VIDEO_RENDER_FAILED:${result.error?.code??''}:${result.stderr}`);
writeFileSync(`${directory}/video.json`,JSON.stringify({created_at:new Date().toISOString(),run:'d07e8650-bc47-4ecd-b138-8885d8288a04',file:'demo-3min.webm',duration_seconds:180,live:false,audio:false,method:'Silent evidence storyboard assembled from actual browser screenshots. No live transaction execution is depicted.',frames:files.map(x=>({...x,sha256:createHash('sha256').update(readFileSync(`${directory}/${x.file}`)).digest('hex')})),sha256:createHash('sha256').update(readFileSync(output)).digest('hex')},null,2)+'\n');console.log(output);
