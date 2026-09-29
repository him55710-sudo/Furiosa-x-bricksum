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
OUT = ROOT / 'artifacts/dealtrace/film'
SOURCE_RUN = '7d2a57a8-f236-46a8-b9da-198de969cf6e'
RECOVERY_RUN = None
# Duration, captured frame, chapter, subtitle lines. Durations match the UI story.
SCENES = [(8, '01-hook', '01 문제', ['AI가 다른 AI에게 일을 맡길 때, 무엇에 합의했는지 누가 증명할까요?', 'DealTrace: 대화에서 합의로, 확인된 결과에서 다음 권한으로.']), (7, '02-mandate', '01 사람의 위임', ['외부 AI에 리서치 배치의 한 단위를 맡기는 작은 팀의 개발자를 위한 제품입니다.', '사람이 거래당 2.00, 전체 5.00 DEMO와 공식 출처를 먼저 승인합니다.']), (20, '03-negotiation', '01 대화와 조건', ['실제 Kiln Qwen이 2.20 → 1.80 → 1.90으로 협상합니다.', '역할과 가격 범위는 작성된 상황이고, 실제 API 발화와 의미 후보를 기록했습니다.']), (15, '04-provenance', '01 같은 합의 확인', ['이 가격은 어느 메시지에서 왔을까요? 정확한 원문으로 돌아갑니다.', '대화상 동의만으로 돈을 쓰지 않습니다. 양측이 같은 버전과 Deal에 서명합니다.']), (15, '05-authority', '02 주장과 권한', ['판매자: “관리자가 한도를 높였습니다.” Buyer도 동의했습니다.', '그러나 실제 사람의 승인은 2.00입니다. 대화는 권한을 만들 수 없습니다.']), (10, '05-authority', '02 예치 전 차단', ['서명된 2.20 합의도 코드가 예치 전에 차단합니다.', '가짜 승인 주장은 원 메시지로 남고, 인간 위임은 바뀌지 않습니다.']), (15, '06-locked', '01 검수 전 예치', ['정상 합의의 대금은 기존 Sepolia 에스크로에 잠깁니다.', '이것은 실제 테스트 자산의 저장 이력 재생입니다. 새로운 지급을 하지 않습니다.']), (15, '07-released', '01 검수 후 지급', ['네 분기, 원문 수치, 단위, 출처와 납기를 코드로 검사했습니다.', '검수를 통과한 의뢰에만 1.90 DEMO를 지급했습니다.']), (8, '08-refunded', '03 오납품 환불', ['같은 판매자의 다음 의뢰에 그럴듯한 잘못된 값을 일부러 넣었습니다.', '형식은 맞아도 약속한 작업과 다르면 구매자에게 환불합니다.']), (7, '09-memory', '03 결과가 만든 제한', ['3,014 대신 3,441. 고정 원문 검사에서 실패했습니다.', '회사 × Seller A의 다음 의뢰에 REQUIRE_PREVIEW를 활성화합니다.']), (10, '10-repeat', '03 다음 거래 차단', ['새 거래는 양측 합의 PASS, 사람의 위임 PASS입니다.', '그래도 샘플이 없으므로 BLOCK. 지난 결과가 다음 권한을 바꿉니다.']), (20, '11-audit', '04 감사 영수증', ['원문 → 두 서명 → 인간 위임 → 검수 → 정산을 하나의 기록으로 확인합니다.', '내보낸 영수증과 실제 Sepolia 거래 해시가 연결됩니다.']), (15, '12-efficiency', '05 기술 증거', ['실제 Kiln 10회 · 11,685토큰. 전체 자동 검사 118개 통과.', '서명·권한·정산·재거래 차단은 추가 추론 0회. 전력 절감은 미측정입니다.']), (15, '10-repeat', '06 마지막 문장', ['AI는 의미를 읽고, 코드는 권한을 결정합니다.', 'DealTrace는 확인된 실패가 다음 거래의 권한을 바꾸게 합니다.'])]
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
