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
OUT = ROOT / 'artifacts/deal-escrow/source-film'
SOURCE_RUN = 'a2f6f4fa-9f1e-4892-8518-325b8762c4f2'
RECOVERY_RUN = '5b2ccb95-10b9-4f62-a51a-73761d51c336'
# Duration, captured frame, chapter, subtitle lines. Durations match the UI story.
SCENES = [
 (6,'01-top','01 의뢰',['외주 자료 한 건. 결과를 받기 전에 돈부터 보내야 할까요?','필요한 결과는 2025년 네 분기의 시설투자 수치입니다.']),
 (6,'01-top','01 승인',['작업 예산 3.00, 건별 상한 2.00 테스트 단위를 승인합니다.','공급자는 데모 시뮬레이터이며 실제 고객 거래는 아닙니다.']),
 (12,'02-top','02 AI의 선택',['Kiln Qwen3-32B가 실적·전망치·납기가 다른 견적을 비교합니다.','판매자의 가격 응답은 고정 규칙입니다.']),
 (11,'02-top','02 조건 확정',['선택한 가격은 1.80. 결과·단위·마감을 정형 계약에 고정합니다.','AI의 말만으로 결제할 수는 없습니다.']),
 (15,'03-top','03 예치',['코드가 예산·허용 판매자·기한·계약 변경 여부를 확인합니다.','대금은 에스크로에 잠깁니다. 판매자 수령액은 아직 0입니다.']),
 (10,'04-top','04 정상 납품',['실제 모델이 납품한 네 값을 원문 참조 자료와 대조했습니다.','조건을 통과한 납품에 Sepolia에서 1.80을 지급했습니다.']),
 (10,'04-bottom','04 검증 범위',['이 공개 실행의 모델 입력은 PDF에서 전사한 표입니다.','고정 참조표 검수이며, 새로운 문서의 진실성을 보증하지 않습니다.']),
 (13,'05-top','05 그럴듯한 오납품',['다른 의뢰에는 4행·JSON·공식 출처 링크가 모두 있습니다.','하지만 시설투자 3,014 대신 다른 현금흐름 3,441을 넣었습니다.']),
 (12,'05-bottom','05 환불',['코드가 승인한 지표와의 불일치를 찾아 구매자에게 환불했습니다.','이는 의도적인 오류 주입이며 자연 발생 모델 오류가 아닙니다.']),
 (11,'06-top','06 실패 이후',['검증된 실패는 같은 회사·공급자의 다음 의뢰에 연결됩니다.','고정된 추가 조건 REQUIRE_PREVIEW가 활성화됩니다.']),
 (9,'06-bottom','06 다음 예치 차단',['샘플 없이 다시 예치하려 하자 서명 전에 멈췄습니다.','실패 기록이 다음 거래에서 허용되는 행동을 바꿉니다.']),
 (10,'07-top','07 재구성 가능한 기록',['승인 → 계약 → 검수 → 정산이 한 영수증으로 이어집니다.','지급·환불·차단 각각의 기록을 확인할 수 있습니다.']),
 (10,'07-refund-detail','07 남는 신뢰',['저장 영수증을 별도 RPC의 확정된 체인 기록과 대조했습니다.','오프체인 승인·검수·기록 수집에는 controller 신뢰가 남습니다.']),
 (7,'08-top','08 실제 추론 사용',['견적 비교 2,118토큰, 표 추출 2,377토큰. 실제 호출은 2회입니다.','예산·검수·정산에는 추가 모델 호출이 없습니다.']),
 (8,'08-bottom','08 측정의 한계',['전력·TTFT·GPU 대비 절감률은 측정하지 않았습니다.','API 지연이나 토큰 수를 하드웨어 전력 측정으로 바꾸지 않습니다.']),
 (12,'09-top','09 별도 만료 의뢰',['마지막은 별도 거래입니다. 운영 앱을 실제로 종료했습니다.','미정산 의뢰의 마감이 지난 뒤 구매자가 직접 회수했습니다.']),
 (10,'09-bottom','09 구매자 직접 회수',['구매자 키와 공개 체인으로 원금을 회수하고 장부도 복구했습니다.','복구 중 운영자 송금 0건, AI 호출 0회. 지급 취소 기능은 아닙니다.']),
 (8,'09-detail','09 결론과 한계',['조건을 확인한 결과에 지급하고, 실패를 다음 거래의 제약으로.','테스트 자산·신뢰된 검수자 전제이며 실사용 수요·경제성은 미검증입니다.']),
]

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
    proofs=[ROOT/f'artifacts/deal-escrow/source-sepolia/{SOURCE_RUN}/independent-verification.json',ROOT/f'artifacts/deal-escrow/source-recovery/{RECOVERY_RUN}/independent-verification.json']
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
        draw=ImageDraw.Draw(canvas);draw.rectangle((0,720,1280,864),fill='#153d33');run=RECOVERY_RUN if frame.startswith('09') else SOURCE_RUN
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
    video=OUT/'source-demo-3min.webm'
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
    report={'schema_version':1,'created_at':datetime.now(timezone.utc).isoformat(),'kind':'captioned-still-evidence-storyboard','live':False,'audio':False,'duration_seconds':180,'dimensions':[1280,864],'fps':2,'source_run':SOURCE_RUN,'recovery_run':RECOVERY_RUN,'file':video.name,'sha256':digest(video),'bytes':video.stat().st_size,'source_proofs':[{'file':p.relative_to(ROOT).as_posix(),'sha256':digest(p)} for p in proofs],'capture_sha256':digest(OUT/'capture.json'),'renderer_sha256':digest(__file__),'font_sha256':digest(args.font),'frames':manifest,'validation':{'full_decode':True,'encoded_duration_seconds':180},'limitation':'Edited still screenshots from the saved public replay, with burned-in Korean captions; no live transaction capture, external supplier participation, human source review, production custody or energy measurement is claimed.'}
    (OUT/'video.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'file':str(video),'seconds':180,'bytes':report['bytes'],'full_decode':True}))

if __name__=='__main__': main()
