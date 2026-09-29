"""Compose an explicitly labeled, silent storyboard from real CUA captures.

No browser control, network, wallet, model calls or application-state changes.
Requires Pillow, FFmpeg with MJPEG input / VP8 output, and a Korean font.
"""
import argparse
import hashlib
import io
import json
import os
import re
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/dealtrace/film-v3'
SOURCE_RUN = '34d1da0d-e842-4f44-acfd-4d97728c81f0'
RECOVERY_RUN = None
# Duration, captured frame, chapter, subtitle lines. Durations match the UI story.
SCENES = [(12, '01-hook', '01 문제', ['예산 40, 합의 26, 청구 31. 이 돈을 지급해도 될까요?', 'DealTrace는 합의하지 않은 돈이 나가지 않게 합니다.']), (18, '02-commit', '01 하나의 작업', ['외부 AI에 문서 처리를 맡기는 작은 리서치 팀을 위한 제품입니다.', '2025년 네 분기 실적과 공식 원문 근거를 요청했습니다.']), (25, '03-provenance', '01 대화 → 같은 거래', ['실제 Kiln Qwen의 대화: 30 → 25 → 26 DEMO, 납기 10 → 5분.', '각 조건의 원문을 남기고 별도 Buyer·Seller가 전체 거래에 서명합니다.']), (35, '04-block', '02 예산 안이어도 차단', ['31도 예산 40 안입니다. 그러나 양측이 확정한 총액은 26입니다.', '서명된 청구가 합의와 다르면, 예치금은 잠긴 채 지급 0을 유지합니다.']), (10, '05-claim-proof', '02 거절 근거', ['진짜 Seller 서명이 있어도 금액이 틀리면 거절합니다.', '금액뿐 아니라 수령인·자산·거래·납품 hash도 검사합니다.']), (22, '06-paid', '03 정정 청구 → 지급', ['납품은 검수를 통과했고, 판매자는 새 ID로 26을 정정 청구했습니다.', '두 조건이 모두 맞아야 Sepolia 테스트 자산을 딱 한 번 지급합니다.']), (20, '07-audit', '03 기록만으로 확인', ['원 대화, 양쪽 서명, 위임, 납품, 청구와 실제 거래가 연결됩니다.', '결과물과 영수증을 내려받아 모델 없이 별도 검증할 수 있습니다.']), (8, '08-conflict', '추가 검증 · 다른 작업', ['15 DEMO로 더 싸더라도 연간 전망치는 요청한 분기 실적이 아닙니다.', '의미 충돌이 남으면 Deal을 확정하지 않습니다.']), (10, '09-refund', '추가 검증 · 오납품', ['별도 의뢰에 그럴듯한 잘못된 값을 일부러 납품했습니다.', '고정 공식 자료 검수에 실패하면 예치금을 구매자에게 환불합니다.']), (10, '10-memory', '추가 검증 · 다음 권한', ['새 위임을 받아도 같은 판매자의 실패 기록은 사라지지 않습니다.', '검증한 샘플이 없으면 다음 합의의 예치를 막습니다.']), (10, '11-efficiency', '실측과 한계', ['실제 Qwen 10회 · 12,073토큰 · 자동 검사 129개 통과.', '권한·청구·정산은 추가 추론 0회. NPU 전력 절감은 미측정입니다.'])]

def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def stamp(seconds):
    return f'00:{seconds//60:02d}:{seconds%60:02d},000'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg',default=os.getenv('FFMPEG_BIN','ffmpeg'))
    parser.add_argument('--font',default=os.getenv('KOREAN_FONT','C:/Windows/Fonts/malgun.ttf'))
    args=parser.parse_args()
    assert sum(scene[0] for scene in SCENES)==180
    proofs=[ROOT/f'artifacts/dealtrace/runs/{SOURCE_RUN}/report.json', ROOT/'artifacts/deal-escrow/tests.json', ROOT/f'artifacts/dealtrace/runs/{SOURCE_RUN}/resume-proof.json']
    for proof in proofs:
        assert json.loads(proof.read_text(encoding='utf8'))['status']=='PASS'
    fonts={size:ImageFont.truetype(args.font,size) for size in [16,25]}
    slides=OUT/'slides';slides.mkdir(parents=True,exist_ok=True)
    manifest=[];subtitles=[];elapsed=0;encoded=[]
    for i,(duration,frame,chapter,lines) in enumerate(SCENES,1):
        original=OUT/f'frames/{frame}.png'
        shot=Image.open(original).convert('RGB')
        assert 1200<=shot.width<=1280 and 680<=shot.height<=720,f'Unexpected capture dimensions: {original}: {shot.size}'
        # Original screenshot pixels remain unchanged; captions occupy a new area.
        canvas=Image.new('RGB',(1280,864),'#f6f7f2');canvas.paste(shot,((1280-shot.width)//2,(720-shot.height)//2))
        draw=ImageDraw.Draw(canvas);draw.rectangle((0,720,1280,864),fill='#153d33');run=SOURCE_RUN
        label=f'{chapter}  |  RUN {run[:8]}  |  SEPOLIA 테스트 자산 · 기록 재생 · 정지 화면 편집'
        draw.text((30,733),label,font=fonts[16],fill='#b9d4c2')
        for j,line in enumerate(lines):
            assert draw.textlength(line,font=fonts[25])<1220,f'Caption overflow: {line}'
            draw.text((30,768+j*36),line,font=fonts[25],fill='white')
        png=slides/f'{i:02d}.png';canvas.save(png)
        buffer=io.BytesIO();canvas.save(buffer,format='JPEG',quality=96,subsampling=0)
        encoded.append((buffer.getvalue(),duration*2))
        manifest.append({'index':i,'start_seconds':elapsed,'duration_seconds':duration,'frame':original.relative_to(OUT).as_posix(),'frame_sha256':digest(original),'capture_dimensions':list(shot.size),'slide':png.relative_to(OUT).as_posix(),'slide_sha256':digest(png),'chapter':chapter,'caption':lines,'run':run})
        subtitles.append(f'{i}\n{stamp(elapsed)} --> {stamp(elapsed+duration)}\n'+ '\n'.join(lines)+'\n')
        elapsed+=duration
    (OUT/'captions.ko.srt').write_text('\n'.join(subtitles),encoding='utf8')
    video=OUT/'dealtrace-3min.ko.webm'
    command=[args.ffmpeg,'-hide_banner','-y','-f','image2pipe','-r','2','-c:v','mjpeg','-i','pipe:0','-r','2','-t','180','-c:v','libvpx','-b:v','1600k','-crf','10','-an',str(video)]
    with (OUT/'encode.log').open('wb') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
        try:
            for jpeg,count in encoded:
                for _ in range(count): process.stdin.write(jpeg)
            process.stdin.close();code=process.wait(timeout=120)
        except BaseException:
            process.kill();process.wait();raise
    assert code==0,'FFmpeg failed; see encode.log'
    # The bundled FFmpeg omits the null muxer. Decode every frame and discard
    # a small transcode through stdout; do not mistake container metadata for playback.
    decode=subprocess.run([args.ffmpeg,'-hide_banner','-i',str(video),'-c:v','libvpx','-b:v','128k','-f','webm','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=120)
    (OUT/'decode.log').write_bytes(decode.stderr)
    assert decode.returncode==0,'Video decode failed'
    assert b'Duration: 00:03:00.00' in decode.stderr,'Duration mismatch'
    assert re.search(rb'frame=\s*360\b',decode.stderr),'Not all 360 frames decoded'
    report={'schema_version':1,'created_at':datetime.now(timezone.utc).isoformat(),'kind':'captioned-still-evidence-storyboard','live':False,'audio':False,'duration_seconds':180,'dimensions':[1280,864],'fps':2,'source_run':SOURCE_RUN,'file':video.name,'sha256':digest(video),'bytes':video.stat().st_size,'source_proofs':[{'file':p.relative_to(ROOT).as_posix(),'sha256':digest(p)} for p in proofs],'capture_sha256':digest(OUT/'capture.json'),'renderer_sha256':digest(__file__),'font_sha256':digest(args.font),'frames':manifest,'validation':{'full_decode':True,'encoded_duration_seconds':180},'limitation':'Edited still screenshots from the saved public replay, with burned-in Korean captions; no live transaction capture, external supplier participation, human source review, production custody or energy measurement is claimed.'}
    (OUT/'video.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'file':str(video),'seconds':180,'bytes':report['bytes'],'full_decode':True}))

if __name__=='__main__': main()
