"""One-page Korean DealTrace brief from a retained, explicitly selected run."""
from pathlib import Path
import json, hashlib, sys
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
run=ROOT/'artifacts/dealtrace/runs'/sys.argv[1]
report=json.loads((run/'report.json').read_text(encoding='utf-8'))
tests=json.loads((ROOT/'artifacts/deal-escrow/tests.json').read_text(encoding='utf-8'))
assert report['status']=='PASS' and report['mode']=='LIVE_KILN_LOCAL_EVM'
assert tests['failed']==0
before={f['path']:f['sha256'] for f in report['source_manifest']}
changed=[f['path'] for f in tests['source_manifest'] if before.get(f['path'])!=f['sha256']]
assert set(changed)<= {'src/dealtrace/server.mjs'},changed  # Documented post-run download-only fix.
pdfmetrics.registerFont(TTFont('Korean','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Korean',normal='Korean',bold='KoreanBold')
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
PDF=OUT/'DealTrace-brief.ko.pdf'; W,H=A4
c=canvas.Canvas(str(PDF),pagesize=A4,pageCompression=1)
c.setTitle('DealTrace | 대화는 합의가 아닙니다')
c.setAuthor('Furiosa x Bricksum')
def box(x,y,w,h,color,r=12):
    c.setFillColor(HexColor(color)); c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
def p(text,x,y,w,size=11,color='#18352D',bold=False,leading=None):
    para=Paragraph(text,ParagraphStyle('p',fontName='KoreanBold' if bold else 'Korean',fontSize=size,leading=leading or size*1.48,textColor=HexColor(color),wordWrap='CJK'))
    _,h=para.wrap(w,H); assert y+h<H-20,(text,y,h); para.drawOn(c,x,H-y-h); return h
box(0,0,W,H,'#F5F4EE',0)
p('DealTrace',40,32,400,23,bold=True)
p('FROM AGENT CONVERSATION TO VERIFIABLE DEAL',41,69,500,8.5,'#417365',True)
p('AI끼리 대화했다고,<br/>돈을 써도 되는 건 아닙니다.',40,105,515,27,bold=True,leading=38)
p('누가 어떤 조건에 동의했는지 남기고,<br/>지난 실패가 다음 거래의 권한을 바꾸게 합니다.',41,197,510,13,'#526B62')
box(40,255,W-80,87,'#FFFFFF')
p('누구를 위해 만들었나요?',56,269,480,11,'#287258',True)
p('다른 AI에게 리서치 데이터를 구매하는 에이전트 개발자.',56,294,480,12,bold=True)
p('데모는 2025년 분기별 실제 시설투자액 네 값과 공식 출처를 사는 일에 집중합니다.',56,320,480,9)
for i,(title,desc) in enumerate([
    ('대화를 합의로','2.20 → 1.80 → 1.90 DEMO. 조건마다 원문 근거를 붙이고, 양쪽이 같은 거래에 서명합니다.'),
    ('합의를 지출 통제로','싸도 연간 전망치라면 거절합니다. 합의해도 사람의 예산과 권한을 넘으면 예치하지 않습니다.'),
    ('결과를 다음 권한으로','틀린 납품은 환불합니다. 같은 공급자의 다음 합의는 샘플 없이는 예치되지 않습니다.')]):
    y=365+i*72
    box(40,y,31,31,'#237659',8); p(str(i+1),50,y+6,20,12,'#FFFFFF',True)
    p(title,86,y-1,460,12,bold=True); p(desc,86,y+24,460,10,'#526B62')
box(40,594,W-80,80,'#183F32')
summary=report['summary']
p(f"실제 Qwen {summary['model_calls']}회 · 시나리오 {summary['passed']}/{summary['checks']} 통과",56,609,480,14,'#FFFFFF',True)
p(f"자동 검사 {tests['passed']}개 통과 · 로컬 체인 지급 1건 / 환불 1건<br/>서명·예산·정산·재거래 차단에는 추가 AI 호출 0회",56,638,480,9,'#DEEBE3')
p('지금 확인한 범위',40,694,490,10,bold=True)
p('시뮬레이션 공급자와 로컬 역할 키를 사용한 개발용 데모입니다. 실제 고객 검증·외부 Agent 인증·NPU 전력 절감은 아직 확인하지 않았습니다. 기존 Sepolia 증거는 이전 정산 계층의 별도 실행입니다. 앞선 실패 실행도 보존했습니다.',40,715,515,8.6,'#526B62',leading=12.5)
url='https://github.com/him55710-sudo/Furiosa-x-bricksum/pull/1'
p('코드와 실제 검증 기록 보기',40,776,460,9,'#287258',True)
c.linkURL(url,(40,H-794,270,H-774),relative=0,thickness=0)
p('2026.09.29  |  GWDC Challenge B  |  1 / 1',40,806,500,7,'#526B62')
c.save()
reader=PdfReader(str(PDF)); assert len(reader.pages)==1
text=reader.pages[0].extract_text()
for word in ['DealTrace','지난 실패','샘플','Qwen',str(tests['passed'])]: assert word in text
manifest={'pdf':PDF.name,'pages':1,'run':report['run'],'live_source_fingerprint':report['source_fingerprint'],'test_source_fingerprint':tests['source_fingerprint'],'post_run_source_changes':changed,'sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'report_sha256':hashlib.sha256((run/'report.json').read_bytes()).hexdigest(),'test_report_sha256':hashlib.sha256((ROOT/'artifacts/deal-escrow/tests.json').read_bytes()).hexdigest(),'scope':'A summary of retained local tests and simulated negotiation, not production validation. Download-only server fix is later than the real model run.'}
(OUT/'dealtrace-brief-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
