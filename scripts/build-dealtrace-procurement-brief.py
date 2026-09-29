"""One-page English brief grounded in retained execution evidence."""
from pathlib import Path
import json, hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
PUBLIC='fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9'
BUNDLE='11ba8d29-1b86-4cb4-8758-3ccb95fb89e8'
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
base='artifacts/dealtrace/procurement/runs/'
public=read(base+PUBLIC+'/report.json')
proof=read(base+PUBLIC+'/finalized-verification.json')
bundle=read(base+BUNDLE+'/report.json')
tests=read('artifacts/deal-escrow/tests.json')
assert proof['verdict']=='VALID' and proof['block_tag']=='finalized'
assert public['status']==bundle['status']==tests['status']=='PASS'
assert len(public['usage'])==len(bundle['usage'])==5
def amount(v):return f"{int(v)/100000000000:.2f}"
out=ROOT/'output/pdf';out.mkdir(parents=True,exist_ok=True)
pdf=out/'DealTrace-Procurement.en.pdf'
W,H=A4;c=canvas.Canvas(str(pdf),pagesize=A4,pageCompression=1)
c.setTitle('DealTrace | The agreement decides what gets paid')
c.setAuthor('Furiosa x Bricksum')
def box(x,y,w,h,color,r=10):
 c.setFillColor(HexColor(color));c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
def p(text,x,y,w,size=11,color='#112F42',bold=False,leading=None):
 q=Paragraph(text,ParagraphStyle('text',fontName='Helvetica-Bold' if bold else 'Helvetica',fontSize=size,leading=leading or size*1.35,textColor=HexColor(color)))
 _,h=q.wrap(w,H);assert y+h<H-16,(text,y,h);q.drawOn(c,x,H-y-h)
box(0,0,W,H,'#F2F6F9',0)
p('DealTrace',40,34,510,23,bold=True)
p('AGENT DEAL ASSURANCE / GWDC CHALLENGE B',41,71,510,8.5,'#45718A',True)
p('The agreement decides<br/>what gets paid.',40,108,515,30,bold=True,leading=35)
p('For research teams whose agents buy changing digital work<br/>from other agents, without supervising every exchange.',41,198,505,11,'#466579')
for i,(label,value,color) in enumerate([('Human budget','40.00','#112F42'),('Agents agree','20.00','#112F42'),('Seller bills','25.00','#B74E2E')]):
 x=40+i*176;box(x,253,162,94,'#FFFFFF');p(label,x+14,267,135,10,'#5E7585');p(value,x+14,288,135,27,color,True);p('DEMO',x+14,325,135,8,'#5E7585')
p('Still under budget. Still rejected by the chain.',40,368,515,15,bold=True)
p('Real Kiln / Qwen calls formed the deal. Both agents signed it.<br/>Sepolia rejected the inflated, genuinely signed bill and paid 20.00.',40,399,515,11,'#466579')
for i,(title,body) in enumerate([
 ('Negotiate the work','Three provider agents offer terms. The buyer counters. Every final term links to its original signed message.'),
 ('Pay for successful units',f"The bundle run reserved {amount(bundle['plan']['deal']['amount'])} DEMO, paid {amount(bundle['paid_wei'])} and returned {amount(bundle['refunded_wei'])}. An injected failed request was not billed."),
 ('Carry the evidence out','Export one receipt. Recompute the work, verify both signatures, and check the exact chain calls without the app database.')]):
 y=463+i*65;box(40,y,28,28,'#1D5879',7);p(str(i+1),49,y+5,18,11,'#FFFFFF',True);p(title,81,y-1,470,11,bold=True);p(body,81,y+21,460,9.5,'#466579',leading=13)
box(40,671,515,64,'#112F42')
p(f"5 live Kiln calls / 5 Sepolia transactions / {proof['checks']} finalized checks",54,684,487,11,'#FFFFFF',True)
p(f"{tests['passed']} automated tests pass. Metered V3 also runs on a real local EVM.",54,707,487,9,'#D6E8F2')
p('A testnet prototype with explicit limits',40,752,515,9,bold=True)
p('Provider processes share one demo operator. Search uses a pinned corpus; compute uses CPU work, not rented GPUs. External business integration, human study and measured NPU power savings remain unverified.',40,770,515,8,'#466579',leading=11)
p('Inspect code, receipts and the new workbench',40,810,365,8.5,'#1D5879',True)
c.linkURL('https://github.com/him55710-sudo/Furiosa-x-bricksum',(40,H-829,380,H-813),relative=0,thickness=0)
p('2026.09.30',455,810,100,8,'#466579')
c.save();reader=PdfReader(str(pdf));assert len(reader.pages)==1
text=reader.pages[0].extract_text()
for word in ['DealTrace','25.00',str(tests['passed']),'Sepolia']:assert word in text
manifest={'pdf':pdf.name,'pages':1,'public_run':PUBLIC,'metered_run':BUNDLE,'tests':tests['passed'],'finalized_block':proof['block'],'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'scope':'Live fixed procurement on Sepolia; live success-unit bundle on hardened local V3.'}
(out/'dealtrace-procurement-brief-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest))
