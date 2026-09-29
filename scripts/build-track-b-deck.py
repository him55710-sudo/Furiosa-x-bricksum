"""Create the eight-page PDF pitch from the canonical spending proof."""
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/accord-lock-track-b.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
QA = ROOT / 'tmp/pdfs/track-b'
QA.mkdir(parents=True, exist_ok=True)
BASE = ROOT / 'artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9'
read = lambda name: json.loads((BASE / f'{name}.json').read_text(encoding='utf-8'))
repo = 'https://github.com/him55710-sudo/Furiosa-x-bricksum'
W,H = 960,540
BLUE,INK,MUTED,RED = map(HexColor,['#2454ed','#162741','#586981','#bd2850'])
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Accord Lock | Track B | GWDC 2026 x Bricksum')
c.setAuthor('Accord Lock')
def text(x,y,s,size=20,color=INK,bold=False):
    c.setFillColor(color);c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,s)
def lines(x,y,s,width=820,size=20,color=INK,leading=29):
    words=s.split();line=''
    for word in words:
        candidate=f'{line} {word}'.strip()
        if stringWidth(candidate,'Helvetica',size)>width and line:
            text(x,y,line,size,color);y-=leading;line=word
        else:line=candidate
    if line:text(x,y,line,size,color)
    return y-leading
def page(n,title,kicker):
    c.setFillColor(HexColor('#f8faff'));c.rect(0,0,W,H,fill=1,stroke=0)
    text(48,499,'accord lock',18,BLUE,True);text(48,454,kicker.upper(),12,MUTED)
    text(48,402,title,36,INK,True)
    text(48,25,'GWDC 2026 x Bricksum  /  Track B  /  Recorded Sepolia proof',10,MUTED)
    text(887,25,f'{n} / 8',10,MUTED)
def source(label,path):
    text(48,53,label,10,BLUE);c.linkURL(repo+'/blob/main/'+path,(48,48,880,64),relative=0)
def finish():c.showPage()

page(1,'Accord Lock','Agreement-bound agent payments')
lines(48,328,'Budget 40. Agree 20. Block 25.',width=440,size=42,leading=51)
lines(48,177,'Pay worker agents only for CAPEX table work that matches the agreement and buyer authority.',width=438,size=21,leading=30)
c.drawImage(ImageReader(str(ROOT/'artifacts/accord-lock/submission/00-problem.png')),520,130,400,225,preserveAspectRatio=True)
source('One-sentence declaration, build disclosure and run instructions','README.md');finish()

page(2,'A spending limit does not define the deal','Problem and first user')
text(48,324,'The buyer permits 40. The agents agree on 20.',29,INK,True)
text(48,256,'The seller invoices 25.',38,RED,True)
lines(48,185,'A budget-only check can accept that bill. Accord Lock checks the agreement before payment.',size=25,leading=35)
text(48,105,'First user hypothesis: research teams buying short-lived data work.',19,MUTED)
text(48,78,'Paid demand and independent supplier acceptance remain unvalidated.',17,MUTED)
source('Product scope and first user','README.md');finish()

page(3,'How the payment boundary works','Implemented workflow')
steps=[('Human authority','Budget, per-deal cap, permitted sellers and deadline.'),('Kiln negotiation','Three providers; 22 quote, 20 counteroffer and acceptance.'),('Signed agreement','Buyer and seller commit to the same terms.'),('Settlement checks','Match delivery and billing to the agreement before payout.')]
for i,(label,detail) in enumerate(steps):
 y=328-i*63;text(48,y,f'{i+1:02d}  {label}',23,BLUE,True);text(95,y-28,detail,19)
text(48,75,'Local demo: authored workers. Public proof: actual Kiln and Sepolia V2.',17,MUTED)
source('Architecture, signed terms and the two execution paths','README.md');finish()

page(4,'RUN 1: an offer exceeds spending authority','Independent task 1')
text(48,314,'35 requested  >  30 per-deal limit',38,RED,True)
text(48,240,'STOP RECORDED',30,RED,True)
text(48,190,'No funding signature. No seller payment.',24)
lines(48,140,'The task stays blocked. Its task ID, event ID and timestamp remain visible while a new task starts Run 2.',size=21,leading=30)
source('Two live local runs and their original recorded events','artifacts/accord-lock/submission/track-b-runs.json');finish()

page(5,'RUN 2: an invoice exceeds the agreement','Independent task 2')
text(48,324,'40 budget    30 per-deal cap    20 agreed',27,INK,True)
text(48,254,'25 invoiced: STOP',42,RED,True)
lines(48,183,'Within both spending limits, outside the agreement. The payout is blocked and 20 stays in escrow.',size=23,leading=33)
text(48,102,'Correct to 20, then pay, verify and export the receipt.',22,BLUE,True)
text(48,75,'The earlier stop remains recorded. Run 1 and Run 2 have different task IDs.',17,MUTED)
source('Two live local runs and the corrected local receipt','artifacts/accord-lock/submission/track-b-runs.json');finish()

page(6,'Actual Kiln calls and public chain enforcement','Separate recorded Sepolia proof')
r=read('report');total=sum(x['total_tokens'] for x in r['usage'])
text(48,323,f"{len(r['usage'])} Kiln calls   /   {total:,} tokens   /   47 finalized checks",28,BLUE,True)
labels={'overbill-blocked':'Signed invoice 25: contract revert','settle':'Correct invoice 20: settlement','withdraw-seller':'Seller withdrawal'}
for i,t in enumerate(x for x in r['transactions'] if x['label'] in labels):
 y=255-i*57;text(48,y,labels[t['label']],20,INK,True);text(48,y-23,t['tx_hash'],12,MUTED);c.linkURL('https://sepolia.etherscan.io/tx/'+t['tx_hash'],(48,y-30,908,y-7),relative=0)
text(48,73,'Historical public execution; not the local video task. Test ETH, gas separate.',17,MUTED)
source('Raw per-flow Kiln usage, signed terms and all five transactions','artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json');finish()

page(7,'The negotiated agreement becomes executable','Agent-specific contribution')
lines(48,322,'Autonomous negotiation can change the price. The agreed terms must survive through delivery, billing and settlement.',size=26,leading=36)
text(48,211,'Enforced',22,BLUE,True)
lines(48,174,'The public V2 contract checks signed terms and exact amount. Model output does not hold the signing key.',size=21,leading=30)
text(48,108,'Still trusted',22,BLUE,True)
text(48,75,'The selected evaluator attests off-chain outcomes; signatures do not prove truth.',18)
source('Public V2 enforcement and stated limitations','docs/DEALTRACE-PROCUREMENT.en.md');finish()

page(8,'What is proven, and what comes next','Submission and validation')
text(48,328,'Working evidence',23,BLUE,True)
lines(48,286,'Two separate stopped tasks, explicit reasons and receipts. A Kiln-negotiated public agreement that rejects overbilling.',size=23,leading=32)
text(48,185,'Next customer test',23,BLUE,True)
lines(48,143,'Find research teams that buy machine work, measure invoice disputes, and test supplier acceptance of the settlement rules.',size=21,leading=30)
text(48,78,'Author declaration: no previous-project code or assets reused.',17,MUTED)
source('Public repository, 165-second demo and event build disclosure','README.md');finish()
c.save()
doc=fitz.open(OUT);assert len(doc)==8
for i,p in enumerate(doc):p.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(str(QA/f'slide-{i+1}.png'))
from PIL import Image
contact=Image.new('RGB',(960,1080),'#e5e9f0')
for i in range(8):
 im=Image.open(QA/f'slide-{i+1}.png');im.thumbnail((480,270));contact.paste(im,((i%2)*480,(i//2)*270))
contact.save(QA/'contact.png')
assert not [(i+1,l['bbox']) for i,p in enumerate(doc) for b in p.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] if l['bbox'][2]>W or l['bbox'][3]>H]
print(json.dumps({'pdf':str(OUT),'pages':len(doc),'contact':str(QA/'contact.png')}))
