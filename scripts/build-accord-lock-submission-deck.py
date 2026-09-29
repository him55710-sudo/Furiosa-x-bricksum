"""Eight-page, evidence-linked Accord Lock submission deck."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
RUN = 'fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9'
BASE = f'artifacts/dealtrace/procurement/runs/{RUN}/'
def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8-sig'))

stops = read('artifacts/accord-lock/track-b-stops.json')
public = read(BASE + 'report.json')
proof = read(BASE + 'finalized-verification.json')
tests = read('artifacts/deal-escrow/tests.json')
assert [r['reason'] for r in stops['runs']] == ['MAX_SINGLE', 'SELLER_ALLOWED']
assert all(r['outcome'] == 'STOPPED' and r['kiln_calls'] == r['payment'] == r['funding'] == r['deal_financial_transactions'] == 0 for r in stops['runs'])
assert public['status'] == tests['status'] == 'PASS' and proof['verdict'] == 'VALID' and proof['checks'] == 47
assert len(public['usage']) == 5 and len(public['transactions']) == 5
assert [(t['label'], t['status']) for t in public['transactions']] == [('open-mandate', 1), ('fund', 1), ('overbill-blocked', 0), ('settle', 1), ('withdraw-seller', 1)]

W, H = 960, 540
NAVY, BLUE, SKY, INK, MUTED, RED, GREEN = '#102F43', '#2454ED', '#ECF3FF', '#163449', '#5A7180', '#B94C43', '#147A61'
OUT = ROOT / 'output/pdf/Accord-Lock-Submission.en.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Accord Lock | GWDC 2026 Challenge B')
c.setAuthor('Furiosa x Bricksum')

def rect(x, y, w, h, fill, radius=12):
    c.setFillColor(HexColor(fill))
    c.roundRect(x, H-y-h, w, h, radius, stroke=0, fill=1)

def text(s, x, y, w, size=16, color=INK, bold=False, leading=None):
    style = ParagraphStyle('slide', fontName='Helvetica-Bold' if bold else 'Helvetica', fontSize=size, leading=leading or size*1.35, textColor=HexColor(color))
    p = Paragraph(s, style)
    _, height = p.wrap(w, H)
    assert y + height <= H - 20, (s, y, height)
    p.drawOn(c, x, H-y-height)
    return height

def slide(number, label, title, subtitle=None):
    rect(0, 0, W, H, '#F5F8FB', 0)
    rect(0, 0, 12, H, BLUE, 0)
    text('ACCORD LOCK  /  GWDC 2026 CHALLENGE B', 48, 27, 730, 11, BLUE, True)
    text(label.upper(), 48, 66, 760, 11, MUTED, True)
    text(title, 48, 92, 860, 29, NAVY, True)
    if subtitle: text(subtitle, 49, 139, 860, 13, MUTED)
    c.setStrokeColor(HexColor('#D8E3EC'))
    c.line(48, 34, 912, 34)
    text('Accord Lock = product  |  DealTrace = signed agreement and public proof', 48, 506, 760, 10, MUTED)
    text(f'{number} / 8', 868, 506, 70, 10, MUTED, True)

def card(x, y, w, h, label, value, note, tone=BLUE):
    rect(x, y, w, h, '#FFFFFF')
    text(label, x+18, y+16, w-36, 12, MUTED, True)
    text(value, x+18, y+43, w-36, 31, tone, True)
    text(note, x+18, y+91, w-36, 11, MUTED)

def line(y, left, middle, right, width=(265, 185, 385), highlight=False):
    rect(48, y, 864, 48, '#EAF1FF' if highlight else '#FFFFFF', 8)
    x=61
    for s,w in zip((left,middle,right),width):
        text(s,x,y+14,w,12,INK,highlight)
        x+=w

# 1 — declaration
slide(1, 'Product', 'The agreement decides what gets paid.',
      'Accord Lock helps research teams pay worker agents for CAPEX table work only when the invoice matches the negotiated Deal and human authority.')
card(48, 206, 267, 155, 'HUMAN AUTHORITY', '40', 'Maximum delegated budget')
card(347, 206, 267, 155, 'KILN AGENTS AGREE', '20', 'Seller offer 22 to Deal 20')
card(646, 206, 267, 155, 'SELLER INVOICES', '25', 'Inside budget; outside Deal', RED)
rect(48, 392, 865, 69, NAVY)
text('25 &lt; 40, but 25 != 20  -&gt;  BLOCK / REVERT', 72, 411, 805, 23, '#FFFFFF', True)
c.showPage()

# 2 — user and boundary
slide(2, 'Problem', 'A broad budget is not a payment instruction.',
      'The first supported job normalizes four quarterly CAPEX rows with source references.')
for y,n,head,body in [
    (205,'01','Human sets authority','Budget 40; a per-deal cap limits any single purchase.'),
    (286,'02','Agents negotiate a Deal','A seller can offer 22; the buyer counters at 20; both sign terms.'),
    (367,'03','The bill is checked against the Deal','A signed 25 invoice is rejected even though it is below 40.')]:
    rect(48,y,864,65,'#FFFFFF')
    text(n,66,y+14,62,24,BLUE,True);text(head,133,y+9,735,17,NAVY,True);text(body,133,y+34,735,12,MUTED)
c.showPage()

# 3 — workflow
slide(3, 'Workflow', 'Negotiate in language. Enforce in code.',
      'The browser is a reproducible private-EVM demo. The DealTrace V2 run is separate actual Kiln + Sepolia proof.')
steps=[('1','Mandate','Budget, per-deal limit, seller list'),('2','Kiln','Seller offers; buyer counters'),('3','Deal','Both sides sign exact terms'),('4','Verify','Delivery and invoice checked'),('5','Escrow','Settle or refund; export proof')]
for i,(n,head,body) in enumerate(steps):
    x=48+i*175
    rect(x,215,160,181,'#FFFFFF')
    rect(x+14,230,34,34,BLUE,8);text(n,x+26,238,19,15,'#FFFFFF',True)
    text(head,x+14,283,138,16,NAVY,True);text(body,x+14,314,132,12,MUTED)
    if i<4:text('&gt;',x+162,280,22,18,BLUE,True)
text('Supported scope: source-linked CAPEX tables and bounded work bundles; not a general payment protocol.',48,433,860,13,MUTED)
c.showPage()

# 4 — stop runs
slide(4, 'Track B', 'Two out-of-scope runs. Two recorded stops.',
      'Exact engine state: BLOCKED. Submission outcome: STOPPED. Each retains POLICY_CHECKED then TRANSACTION_BLOCKED.')
for x,run,boundary,reason in [(48,'RUN 1','Offer 35 exceeds per-deal 30','MAX_SINGLE'),(489,'RUN 2','Seller D is outside A/B/C','SELLER_ALLOWED')]:
    rect(x,205,424,228,'#FFFFFF')
    text(run,x+20,222,170,13,BLUE,True)
    text('STOPPED',x+20,248,365,27,RED,True)
    text(boundary,x+20,295,380,16,NAVY,True)
    text('Reason: '+reason,x+20,328,380,13,MUTED)
    text('0 Kiln calls  ·  0 funding  ·  0 payment',x+20,378,380,12,GREEN,True)
text('Raw event chains: artifacts/accord-lock/track-b-stops.json',48,451,820,11,BLUE)
c.linkURL('https://github.com/him55710-sudo/Furiosa-x-bricksum/blob/main/artifacts/accord-lock/track-b-stops.json',(48,H-473,835,H-448),relative=0,thickness=0)
c.showPage()

# 5 — Kiln
slide(5, 'Kiln', 'Five real qwen3-32b calls formed the public Deal.',
      'Only language and negotiation used inference. Financial checks and verification used deterministic code.')
text('FLOW',61,197,270,11,MUTED,True);text('CALLS',361,197,90,11,MUTED,True)
text('INPUT',493,197,90,11,MUTED,True);text('OUTPUT',646,197,90,11,MUTED,True)
rows=[('Seller A: offer + response','2','1,730','1,648'),('Seller B: offer','1','793','658'),('Seller C: offer','1','797','923'),('Buyer: counteroffer','1','825','516'),('TOTAL','5','4,145','3,745')]
for i,(flow,calls,inp,out) in enumerate(rows):
    y=224+i*45;rect(48,y,864,40,'#EAF1FF' if i==4 else '#FFFFFF',7)
    for x,w,s in [(61,285,flow),(361,115,calls),(493,130,inp),(646,130,out)]:text(s,x,y+11,w,12,NAVY,i==4)
text('Raw request IDs, token records and timing: report.json / usage[]',48,466,850,11,BLUE)
c.linkURL('https://github.com/him55710-sudo/Furiosa-x-bricksum/blob/main/'+BASE+'report.json',(48,H-489,835,H-460),relative=0,thickness=0)
c.showPage()

# 6 — chain
slide(6, 'Blockchain', 'The 25 invoice is a mined revert, not a demo error.',
      'V2 Sepolia stores the mandate and escrow, requires claim amount = locked Deal amount, then credits and withdraws 20.')
text('STEP',61,194,260,11,MUTED,True);text('STATUS',326,194,180,11,MUTED,True);text('TX HASH (PREFIX)',516,194,365,11,MUTED,True)
labels=[('Human mandate','confirmed'),('Fund Deal 20','confirmed'),('Signed invoice 25','REVERTED'),('Corrected invoice 20','confirmed'),('Seller withdrawal','confirmed')]
for i,((label,status),tx) in enumerate(zip(labels,public['transactions'])):
    y=218+i*48;rect(48,y,864,42,'#FCEDEA' if i==2 else '#FFFFFF',7)
    text(label,61,y+12,257,12,NAVY,True);text(status,326,y+12,174,12,RED if i==2 else GREEN,True)
    text(tx['tx_hash'][:18]+'...',516,y+12,350,12,BLUE)
    c.linkURL('https://sepolia.etherscan.io/tx/'+tx['tx_hash'],(516,H-y-38,875,H-y-4),relative=0,thickness=0)
text('Independent finalized verification: VALID · 47 checks · block 11808905',48,474,850,12,GREEN,True)
c.showPage()

# 7 — reproducibility
slide(7, 'Reproduce', 'Source, logs and checks are directly inspectable.',
      'The one-page brief and previous films remain historical companion material; this is the current eight-page deck.')
for y,head,body in [
    (200,'Try the browser','pnpm install --frozen-lockfile  then  pnpm ade:spending:view'),
    (268,'Run the checks','pnpm ade:spending:test  then  pnpm ade:hosted:test  then  pnpm ade:test'),
    (336,'Inspect raw evidence','Track B event capture; public run usage[]; five tx hashes; finalized verifier')]:
    rect(48,y,864,56,'#FFFFFF');text(head,64,y+10,245,15,NAVY,True);text(body,307,y+14,570,12,MUTED)
rect(48,416,864,63,NAVY)
text(f"{tests['passed']} / {tests['passed']} escrow suite tests pass · 5 Kiln calls · 47 finalized checks",66,436,825,17,'#FFFFFF',True)
c.showPage()

# 8 — disclosure and close
slide(8, 'Scope and disclosure', 'A bounded testnet prototype with an auditable boundary.',
      'The initial repo commit after the event kickoff contained only a two-line README; the application and proof path appear in later commits.')
rect(48,202,423,221,'#FFFFFF');text('BUILT DURING THE EVENT',66,220,380,13,BLUE,True)
text('Accord Lock workspace; Kiln buyer/seller negotiation; DealTrace evidence; escrow contracts; Sepolia run; verifier, tests, demo and deck.',66,254,375,16,NAVY,leading=23)
rect(489,202,423,221,'#FFFFFF');text('LIMITS KEPT VISIBLE',507,220,380,13,RED,True)
text('Local workers are authored rules. Public V2 uses Kiln and Sepolia. No independent supplier, real first-time-user study, production custody review or measured NPU power.',507,254,374,15,NAVY,leading=22)
text('Accord Lock makes the negotiated agreement the boundary for agent payment.',48,451,865,19,BLUE,True)
c.linkURL('https://github.com/him55710-sudo/Furiosa-x-bricksum',(48,42,795,93),relative=0,thickness=0)
c.showPage()

c.save()
reader=PdfReader(str(OUT))
assert len(reader.pages)==8
all_text='\n'.join(page.extract_text() for page in reader.pages)
for needle in ('Accord Lock','STOPPED','MAX_SINGLE','SELLER_ALLOWED','4,145','3,745','Sepolia','47 checks',str(tests['passed'])):
    assert needle in all_text, needle
print(json.dumps({'file':str(OUT),'pages':len(reader.pages),'tests':tests['passed'],'public_run':RUN}))
