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
test_path='artifacts/dealtrace/integration/pre-merge-tests.json'
tests=json.loads((ROOT/test_path).read_text(encoding='utf-8'))
assert report['status']=='PASS' and report['mode']=='LIVE_KILN_SEPOLIA'
assert tests['failed']==0
before={f['path']:f['sha256'] for f in report['source_manifest']}
changed=[f['path'] for f in tests['source_manifest'] if before.get(f['path'])!=f['sha256']]
if changed:
    normalization=json.loads((run/'post-run-ui-change.json').read_text(encoding='utf-8'))
    assert set(changed)=={f['path'] for f in normalization['files']},changed
    for f in normalization['files']:
        original=(ROOT/f['original_snapshot']).read_bytes()
        assert hashlib.sha256(original).hexdigest()==before[f['path']]==f['original_sha256']
        assert f['path']=='web/dealtrace/app.js'
        assert hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['current_sha256']
assert report['summary']['public_chain_transactions']==4
pdfmetrics.registerFont(TTFont('Korean','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Korean',normal='Korean',bold='KoreanBold')
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
PDF=OUT/'DealTrace-brief.ko.pdf'; W,H=A4
c=canvas.Canvas(str(PDF),pagesize=A4,pageCompression=1)
c.setTitle('DealTrace | 합의한 만큼만 지급합니다')
c.setAuthor('Furiosa x Bricksum')
def box(x,y,w,h,color,r=12):
    c.setFillColor(HexColor(color)); c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
def p(text,x,y,w,size=11,color='#18352D',bold=False,leading=None):
    para=Paragraph(text,ParagraphStyle('p',fontName='KoreanBold' if bold else 'Korean',fontSize=size,leading=leading or size*1.48,textColor=HexColor(color),wordWrap='CJK'))
    _,h=para.wrap(w,H); assert y+h<H-20,(text,y,h); para.drawOn(c,x,H-y-h); return h
box(0,0,W,H,'#F5F4EE',0)
p('DealTrace',40,32,400,23,bold=True)
p('FROM AGENT CONVERSATION TO VERIFIABLE DEAL',41,69,500,8.5,'#417365',True)
p('예산이 남아 있어도,<br/>합의하지 않은 돈은 안 나갑니다.',40,105,515,26,bold=True,leading=38)
p('예산 40 · 합의 26 · 청구 31 → 지급 차단<br/>합의대로 납품하고 26으로 고쳐 청구하면 지급합니다.',41,197,510,13,'#526B62')
box(40,255,W-80,87,'#FFFFFF')
p('누구를 위해 만들었나요?',56,269,480,11,'#287258',True)
p('외부 AI에게 일을 맡기는 작은 리서치 팀의 개발자.',56,294,480,12,bold=True)
p('데모는 리서치 배치 중 한 건: 네 분기의 실제 시설투자액과 공식 출처를 맡깁니다.',56,320,480,9)
for i,(title,desc) in enumerate([
    ('대화를 같은 약속으로','30 → 25 → 26 DEMO. 가격과 납기가 바뀐 원문을 남기고, 별도 Buyer·Seller 프로세스가 전체 거래를 검토해 서명합니다.'),
    ('약속대로만 지급','31도 예산 안입니다. 그래도 합의는 26이므로 막습니다. 결과물과 정정 청구가 모두 맞아야 딱 한 번 지급합니다.'),
    ('왜 지급했는지 증명','대화·양쪽 서명·청구·검수·체인 거래를 한 영수증으로 받습니다. 오납품은 환불하고 다음 거래에는 샘플을 요구합니다.')]):
    y=365+i*72
    box(40,y,31,31,'#237659',8); p(str(i+1),50,y+6,20,12,'#FFFFFF',True)
    p(title,86,y-1,460,12,bold=True); p(desc,86,y+24,460,10,'#526B62')
box(40,594,W-80,80,'#183F32')
summary=report['summary']
p(f"실제 Qwen {summary['model_calls']}회 · 시나리오 {summary['passed']}/{summary['checks']} 통과",56,609,480,14,'#FFFFFF',True)
p(f"자동 검사 {tests['passed']}개 통과 · Sepolia 지급 1건 / 환불 1건<br/>실제 12,073토큰 · 청구 비교·서명·정산·재검증은 추가 추론 0회",56,638,480,9,'#DEEBE3')
p('지금 확인한 범위',40,694,490,10,bold=True)
p('실제 API와 테스트넷을 연결한 프로토타입입니다. 공급자·가격·공격은 작성된 상황이며 고정 자료로 검수합니다. 별도 표현 시험은 Qwen 7/8, 규칙 8/8이었습니다. 외부 조직 인증·고객 수요·NPU 전력 절감은 미검증입니다.',40,715,515,8.6,'#526B62',leading=12.5)
url='https://github.com/him55710-sudo/Furiosa-x-bricksum/pull/2'
p('코드와 실제 검증 기록 보기',40,776,460,9,'#287258',True)
c.linkURL(url,(40,H-794,270,H-774),relative=0,thickness=0)
p('2026.09.29  |  GWDC Challenge B  |  1 / 1',40,806,500,7,'#526B62')
c.save()
reader=PdfReader(str(PDF)); assert len(reader.pages)==1
text=reader.pages[0].extract_text()
for word in ['DealTrace','청구','샘플','Qwen',str(tests['passed'])]: assert word in text
manifest={'pdf':PDF.name,'pages':1,'run':report['run'],'live_source_fingerprint':report['source_fingerprint'],'test_source_fingerprint':tests['source_fingerprint'],'post_run_source_changes':changed,'sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'report_sha256':hashlib.sha256((run/'report.json').read_bytes()).hexdigest(),'test_report_path':test_path,'test_report_sha256':hashlib.sha256((ROOT/test_path).read_bytes()).hexdigest(),'scope':'Actual Kiln plus Sepolia settlement, with the archived 129-test presentation version. The later main integration has its own 137-test report. Original UI bytes and change mapping retained. Controlled counterparties, not production validation.'}
(OUT/'dealtrace-brief-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
