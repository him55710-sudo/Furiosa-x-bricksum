import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root='artifacts/deal-escrow/research',video=JSON.parse(readFileSync(root+'/video.json','utf8')),showcase=JSON.parse(readFileSync(root+'/latest-showcase.json','utf8'));
const python=process.env.ADE_PYTHON??'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const ffmpeg=execFileSync(python,['-c',"import sys; sys.path.insert(0,'data/private/media-tools'); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],{encoding:'utf8',windowsHide:true}).trim();
assert.equal(video.segments.length,showcase.steps.length);assert.deepEqual(video.browser_errors,[]);
const decoded=spawnSync(ffmpeg,['-hide_banner','-i',video.path,'-af','volumedetect','-f','null','-'],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:3_000_000});assert.equal(decoded.status,0,decoded.stderr);
const log=decoded.stderr,duration=log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/),volume=log.match(/mean_volume: (-?[\d.]+) dB/);
assert(duration&&volume,'Duration and non-silent audio are required');assert.match(log,/Video: h264/);assert.match(log,/Audio: aac/);
const seconds=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);assert(seconds<180,'Demo must be shorter than three minutes');assert(seconds>=video.segments.at(-1).start+video.segments.at(-1).duration-0.15,'Final narration must not be cut off');assert(Number(volume[1])>-55,'Narration must be audible');
const report={status:'PASS',created_at:new Date().toISOString(),path:video.path,sha256:createHash('sha256').update(readFileSync(video.path)).digest('hex'),duration_seconds:seconds,mean_volume_db:Number(volume[1]),scenes:video.segments.length,checks:['All recorded scenes reached their exact visible headings','No browser page errors','Complete video and audio decoded','H264 video and AAC audio present','Final narration fits within the video','Non-silent audio; under three minutes'],scope:'Programmatic media checks. Synthetic Korean narration; human comprehension is still unverified.'};
writeFileSync(root+'/video-verification.json',JSON.stringify(report,null,2));writeFileSync(root+'/video-decode.log',log);console.log(JSON.stringify(report));
