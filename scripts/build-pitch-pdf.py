"""Two-page Korean pitch, drawn from retained evidence (no inference or payments)."""
from pathlib import Path
import hashlib
import json
import os

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
RUN = ROOT / 'artifacts/deal-escrow/fiction/e33869e3-ffb2-4e1f-9956-30a5634dd3be'
report = json.loads((RUN / 'report.json').read_text(encoding='utf-8'))
tests = json.loads((ROOT / 'artifacts/deal-escrow/tests.json').read_text(encoding='utf-8'))
assert report['summary']['passed'] == 12 and report['summary']['failed'] == 0
assert tests['passed'] == 102 and tests['failed'] == 0
font = Path(os.environ.get('PITCH_FONT', 'C:/Windows/Fonts/malgun.ttf'))
bold = Path(os.environ.get('PITCH_FONT_BOLD', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFont(TTFont('Korean', str(font)))
pdfmetrics.registerFont(TTFont('KoreanBold', str(bold)))
pdfmetrics.registerFontFamily('Korean', normal='Korean', bold='KoreanBold')
W, H = A4
INK, TEAL, MUTED = '#142B35', '#087F72', '#52666F'
BG, LINE, PALE = '#F5F7F4', '#D8E2DE', '#E3F2EC'
PDF = OUT / 'Agent-Deal-Escrow-brief.ko.pdf'
c = canvas.Canvas(str(PDF), pagesize=A4, pageCompression=1)
c.setTitle('Agent Deal Escrow | AI가 맡긴 일, 돈은 약속대로')
c.setAuthor('Furiosa x Bricksum')
c.setSubject('GWDC Challenge B - 구현한 기능과 검증 결과를 설명하는 2쪽 소개서')

def box(x, top, w, h, fill, radius=12):
    c.setFillColor(HexColor(fill))
    c.roundRect(x, H-top-h, w, h, radius, fill=1, stroke=0)

def para(text, x, top, w, size=11, color=INK, bold=False, leading=None):
    style = ParagraphStyle('p', fontName='KoreanBold' if bold else 'Korean',
                           fontSize=size, leading=leading or size*1.48,
                           textColor=HexColor(color), wordWrap='CJK')
    p = Paragraph(text, style)
    _, h = p.wrap(w, H)
    assert top+h < H-16, (text, top, h)
    p.drawOn(c, x, H-top-h)
    return h

def foot(n):
    c.setStrokeColor(HexColor(LINE)); c.line(42, 43, W-42, 43)
    para('2026.09.29  |  GWDC Challenge B  |  테스트넷 프로토타입', 42, H-34, 450, 7.5, MUTED)
    para(str(n)+'/2', W-68, H-34, 26, 7.5, MUTED)

def link(label, url, x, top, width):
    para(label, x, top, width, 9, TEAL, True)
    c.linkURL(url, (x,H-top-17,x+width,H-top+1), relative=0, thickness=0)

# Page 1: one user, one problem, one memorable mechanism.
box(0, 0, W, H, BG, 0)
para('AGENT DEAL ESCROW', 42, 37, 500, 11, TEAL, True)
para('AI에게 일을 맡겨도,<br/>돈은 약속대로.', 42, 75, 505, 31, INK, True, 43)
para('틀린 납품은 환불하고,<br/>다음 주문에는 먼저 샘플을 요구합니다.', 44, 185, 495, 15, MUTED)

box(42, 259, W-84, 112, '#FFFFFF')
para('누구에게 필요한가요?', 59, 275, 460, 12, TEAL, True)
para('외부 AI에 재무보고서의 숫자 추출을 맡기는 리서치 개발자.', 59, 301, 461, 12, INK, True)
para('출처가 붙어 있어도 값은 틀릴 수 있습니다.<br/>업무 조건을 확인한 뒤에 돈이 지급되도록 만들었습니다.', 59, 329, 461, 10.5)

para('딱 한 가지 일을 끝까지', 42, 398, 500, 17, INK, True)
steps = [
    ('01', '사람이 선을 긋습니다', '예산, 공급자, 마감을 승인합니다.'),
    ('02', '납품을 확인하고 정산합니다', '테스트 자산을 맡겨 두고, 맞으면 지급 / 틀리면 환불합니다.'),
    ('03', '실수가 다음 주문을 바꿉니다', '오납품한 공급자에게는 샘플부터 요구합니다.'),
]
for i, (num, title, desc) in enumerate(steps):
    top=437+i*77
    box(42, top, 35, 35, TEAL, 9)
    para(num, 48, top+7, 26, 11, '#FFFFFF', True)
    para(title, 92, top, 440, 12, INK, True)
    para(desc, 92, top+26, 440, 10.5, MUTED)
box(42, 682, W-84, 85, PALE)
para('실패 기록이 다음 거래의 조건이 됩니다.', 59, 698, 462, 15, TEAL, True)
para('경고만 보여주지 않습니다. 조건이 없으면 다음 예치가 멈춥니다.<br/>조건을 지키면 같은 공급자와 다시 거래할 수 있습니다.', 59, 726, 462, 10)
foot(1)
c.showPage()

# Page 2: evidence, explicit roles and material limits.
box(0, 0, W, H, BG, 0)
para('말로만 설명하지 않았습니다.', 42, 38, 510, 23, INK, True)
para('가상 업무를 실제 코드와 로컬 체인에서 실행했습니다.', 42, 81, 510, 11, MUTED)
for x, value, label in [(42,'12 / 12','가상 상황 통과'),(216,'102 / 102','자동 검사 통과'),(390,'3 지급 · 3 환불','가상 업무 정산')]:
    box(x, 116, 163, 75, '#FFFFFF')
    para(value, x+13, 130, 141, 17 if x<390 else 13, TEAL, True)
    para(label, x+13, 164, 142, 9, MUTED)

shot=RUN/'ui/desktop.png'
iw, ih=Image.open(shot).size
image_w=W-84; image_h=image_w*ih/iw
assert image_h <= 294
c.drawImage(str(shot),42,H-211-image_h,width=image_w,height=image_h,mask='auto')
top=211+image_h+10
para('실제 데모 화면: 3,014를 3,441로 바꾸자 환불과 다음 주문의 샘플 조건이 생겼습니다.', 42, top, 511, 9, MUTED)
top += 41
para('AI는 제안하고, 코드는 검사하고, 체인은 돈을 보관합니다.', 42, top, 511, 12, INK, True)
para('Kiln Qwen3-32B가 견적을 비교합니다. 예산·마감·중복 지급은 코드가 검사합니다.<br/>스마트 계약은 예치·지급·환불을 기록합니다. 영수증에서 승인과 거래를 함께 확인합니다.', 42, top+29, 511, 10)
top += 84
para('공개 테스트넷에서도 지급·환불·앱 종료 후 직접 회수를 확인했습니다.', 42, top, 511, 10.5, INK, True)
link('Sepolia 지급 기록 ↗'.replace(' ↗',''), 'https://sepolia.etherscan.io/tx/0xeb9d63ca0c71be068cdd85a224d1ace286838ecdcf099c33c511c9be5d4eaecc',42,top+26,125)
link('환불 기록', 'https://sepolia.etherscan.io/tx/0x845a4ed742759a5f2fb70a4fd9fcec9aa45b0e99f43b076d315245c27aaf3ca8',182,top+26,90)
link('코드·검증 보고서', 'https://github.com/him55710-sudo/Furiosa-x-bricksum/pull/1',296,top+26,160)
box(42, 713, W-84, 64, '#E9EDEB')
para('현재 범위', 54, 724, 75, 9, INK, True)
para('가상 참여자이며, 공개 테스트넷 실증은 별도 실행입니다. 납품 판정에는 서버 신뢰가 남습니다.<br/>실제 고객 수요·최저가 선택·NPU 전력 절감은 아직 입증하지 않았습니다.',54,743,488,8.1,MUTED,False,11.5)
foot(2)
c.save()
reader=PdfReader(str(PDF))
assert len(reader.pages)==2
text='\n'.join(p.extract_text() or '' for p in reader.pages)
for phrase in ['AI에게 일을 맡겨도', '12 / 12', '102 / 102', 'Qwen3-32B', '3,441', '현재 범위']:
    assert phrase in text, phrase
links=sum(len(p.get('/Annots', [])) for p in reader.pages)
assert links==3
manifest={'pdf':PDF.name,'pages':2,'links':links,'sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),
          'fiction_report_sha256':hashlib.sha256((RUN/'report.json').read_bytes()).hexdigest(),
          'test_report_sha256':hashlib.sha256((ROOT/'artifacts/deal-escrow/tests.json').read_bytes()).hexdigest(),
          'screenshot_sha256':hashlib.sha256(shot.read_bytes()).hexdigest(),
          'font_sha256':hashlib.sha256(font.read_bytes()).hexdigest(),
          'builder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'scope':'Two-page summary of retained evidence, not a new transaction or human study.'}
(OUT/'pitch-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pdf':str(PDF),'pages':2,'links':links,'sha256':manifest['sha256']}))
