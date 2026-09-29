"""A short V2 brief; refuses to label a pending public observation as finalized."""
from pathlib import Path
import json, hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
pointer=json.loads((ROOT/'artifacts/dealtrace/vault/public-latest.json').read_text(encoding='utf-8'))
run=ROOT/'artifacts/dealtrace/vault/runs'/pointer['run']
report=json.loads((run/'report.json').read_text(encoding='utf-8'))
verified=json.loads((run/'finalized-verification.json').read_text(encoding='utf-8'))
tests=json.loads((ROOT/'artifacts/deal-escrow/tests.json').read_text(encoding='utf-8'))
source=json.loads((run/'source-verification.json').read_text(encoding='utf-8'))
assert verified['verdict']=='VALID' and verified['block_tag']=='finalized'
assert source['contract']['runtimeMatch']=='exact_match' and tests['failed']==0
assert len(report['transactions'])==14 and sum(t['status']==0 for t in report['transactions'])==3

pdfmetrics.registerFont(TTFont('Korean','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Korean',normal='Korean',bold='KoreanBold')
OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
PDF=OUT/'DealTrace-V2-upgrade.ko.pdf';W,H=A4
c=canvas.Canvas(str(PDF),pagesize=A4,pageCompression=1)
c.setTitle('DealTrace V2 | 서버를 속여도, 합의한 만큼만')
c.setAuthor('Furiosa x Bricksum')
def box(x,y,w,h,color,r=12):
 c.setFillColor(HexColor(color));c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
def p(text,x,y,w,size=11,color='#163B37',bold=False,leading=None):
 paragraph=Paragraph(text,ParagraphStyle('p',fontName='KoreanBold' if bold else 'Korean',fontSize=size,leading=leading or size*1.5,textColor=HexColor(color),wordWrap='CJK'))
 _,h=paragraph.wrap(w,H);assert y+h<H-18,(text,y,h);paragraph.drawOn(c,x,H-y-h)
box(0,0,W,H,'#F4F5EF',0)
p('DealTrace / V2',40,30,500,21,bold=True)
p('AGREEMENTS THAT CONSTRAIN MONEY',41,68,500,8.5,'#4D7864',True)
p('서버를 속여도,<br/>합의한 금액만 나갑니다.',40,107,515,27,bold=True,leading=38)
p('외부 AI에게 문서 처리를 맡기는 작은 리서치 팀을 위한 거래 통제.',41,196,510,11,'#526D63')
for i,(label,value,color) in enumerate([('사람의 예산','40','#173E37'),('양측의 합의','26','#173E37'),('서명된 청구','31','#B24C33')]):
 x=40+i*176;box(x,237,162,92,'#FFFFFF');p(label,x+15,251,133,10,'#63796F');p(value,x+15,276,95,29,color,True);p('DEMO',x+82,294,62,9,'#63796F')
p('31도 예산 안입니다. 그래도 체인이 직접 거절했습니다.',40,349,515,14,bold=True)
p('판매자와 검수자 모두 31에 서명한 공격 요청을 보냈습니다.<br/>컨트랙트는 이미 확정된 26과 비교해 막고, 정정한 26만 지급했습니다.',40,382,515,11,'#526D63')
for i,(title,body) in enumerate([
 ('서명이 실행 조건으로','사람의 예산과 허용 판매자, 양측 거래 서명을 체인이 검사합니다.'),
 ('실패가 다음 권한으로','오납품은 환불합니다. 새 위임을 만들어도 같은 판매자는 검수된 샘플이 필요합니다.'),
 ('누구나 기록으로 확인','청구 차단, 정정 지급, 환불, 권한 철회를 거래 해시와 독립 검증기로 확인합니다.')]):
 y=441+i*63;box(40,y,28,28,'#235F4F',7);p(str(i+1),49,y+5,18,11,'#FFFFFF',True);p(title,81,y-1,470,11,bold=True);p(body,81,y+22,470,9.5,'#526D63')
box(40,646,515,76,'#153D36')
p(f"Sepolia 실제 거래 14건 / 의도한 공격 3건 거절",55,658,480,13,'#FFFFFF',True)
p(f"finalized 검증 {verified['checks']}개 통과 · 자동 테스트 {tests['passed']}개 통과<br/>Sourcify 소스·배포 코드 정확히 일치 · 예치·인출 대기 잔액 0",55,686,480,9,'#D3E5D8')
p('검증한 범위도 분명하게',40,740,500,9.3,bold=True)
p('V2는 작성된 대화로 체인 통제를 시험했고 추가 추론은 0회입니다. 실제 Kiln Qwen 10회·12,073토큰 기록은 기존 데모에 따로 남아 있습니다. 검수자·고정 자료·같은 운영자의 역할 키를 신뢰하는 테스트넷 프로토타입이며 실서비스 보안 감사는 아직입니다.',40,760,515,8,'#526D63',leading=11)
p('코드와 공개 증거 보기 ↗',40,807,300,8.5,'#28674F',True)
c.linkURL('https://github.com/him55710-sudo/Furiosa-x-bricksum/blob/main/docs/DEALTRACE-VAULT-V2.en.md',(40,H-823,270,H-805),relative=0,thickness=0)
p('2026.09.29 | GWDC Challenge B',340,807,215,7.5,'#526D63')
c.save();reader=PdfReader(str(PDF));assert len(reader.pages)==1
text=reader.pages[0].extract_text()
for word in ['DealTrace','31',str(tests['passed']),'Sourcify']:assert word in text
manifest={'pdf':PDF.name,'pages':1,'run':report['run'],'finalized_block':verified['block'],'checks':verified['checks'],'tests':tests['passed'],'sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'test_source_fingerprint':tests['source_fingerprint'],'scope':'Separate V2 authored-dialogue chain proof; actual Kiln evidence remains the V1 run.'}
(OUT/'dealtrace-vault-brief-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
