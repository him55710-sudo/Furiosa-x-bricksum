"""Assemble a portable, credential-free replay packet from explicit public files."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/submission'
PACK = OUT / 'Agent-Deal-Escrow-demo'
PACK.mkdir(parents=True, exist_ok=True)
RUN = 'e33869e3-ffb2-4e1f-9956-30a5634dd3be'
selected = set()

def put(name, data):
    target = PACK / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data.encode('utf-8') if isinstance(data,str) else data)
    selected.add(name)

def copy(source, dest):
    p = ROOT / source
    assert p.is_file() and not p.is_symlink(), source
    put(dest, p.read_bytes())

for p in (ROOT / f'artifacts/deal-escrow/fiction/{RUN}').rglob('*'):
    if p.is_file() and p.suffix in {'.json','.html','.png'}:
        copy(p.relative_to(ROOT).as_posix(), 'fiction/'+p.relative_to(ROOT/f'artifacts/deal-escrow/fiction/{RUN}').as_posix())
for source, dest in [
    ('output/pdf/Agent-Deal-Escrow-brief.ko.pdf','brief.ko.pdf'),
    ('output/pdf/pitch-manifest.json','pitch-manifest.json'),
    ('artifacts/deal-escrow/tests.json','evidence/tests.json'),
    ('artifacts/deal-escrow/ci/36483923356.json','evidence/ci.json'),
    ('artifacts/deal-escrow/ci/36483923356-tests.json','evidence/ci-tests.json'),
    ('artifacts/deal-escrow/source-film/source-demo-3min.webm','video/source-demo-3min.webm'),
    ('artifacts/deal-escrow/source-film/captions.ko.srt','video/captions.ko.srt'),
    ('artifacts/deal-escrow/source-film/video.json','video/original-video-manifest.json'),
    ('artifacts/deal-escrow/source-film/preview.png','video/preview.png'),
]:
    copy(source,dest)
for folder, dest in [
    ('source-sepolia/a2f6f4fa-9f1e-4892-8518-325b8762c4f2','evidence/sepolia'),
    ('source-recovery/5b2ccb95-10b9-4f62-a51a-73761d51c336','evidence/buyer-recovery'),
]:
    for name in ['report.json','independent-verification.json','public-packet.json','reconciled-receipt.json','buyer-refund.json','energy-estimate.json']:
        p=ROOT/'artifacts/deal-escrow'/folder/name
        if p.is_file(): copy(p.relative_to(ROOT).as_posix(),dest+'/'+name)
    if dest=='evidence/sepolia':
        for p in (ROOT/'artifacts/deal-escrow'/folder).glob('????????-????-????-????-????????????.json'):
            copy(p.relative_to(ROOT).as_posix(),dest+'/'+p.name)

style='''*{box-sizing:border-box}body{margin:0;background:#f5f7f4;color:#142b35;font:16px/1.65 system-ui,sans-serif;word-break:keep-all}main{max-width:1080px;margin:auto;padding:42px 24px 64px}h1{font-size:clamp(30px,5vw,52px);line-height:1.22;max-width:840px}h2{font-size:23px}p{max-width:870px}.label{font-weight:700;color:#087f72;letter-spacing:.08em;font-size:13px}.lead{font-size:20px;color:#52666f}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:32px 0}.card,.panel{background:white;border:1px solid #d8e2de;border-radius:14px;padding:24px}.card a{font-size:20px;font-weight:700}.card p{font-size:14px}.panel{margin:20px 0}a{color:#087f72;text-underline-offset:4px}a:focus-visible{outline:3px solid #d18e30;outline-offset:5px}li{margin:8px 0}code{overflow-wrap:anywhere}nav{display:flex;gap:22px;flex-wrap:wrap}video{width:100%;background:#142b35;border-radius:12px}.muted{color:#52666f;font-size:14px}footer{border-top:1px solid #d8e2de;margin-top:32px;padding-top:20px;font-size:13px;color:#52666f}@media(max-width:650px){.grid{grid-template-columns:1fr}main{padding:25px 18px}h1{font-size:34px}}'''
put('index.html',f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent Deal Escrow | 제출 데모</title><style>{style}</style><main>
<div class="label">GWDC CHALLENGE B · AGENT DEAL ESCROW</div><h1>틀린 납품은 환불하고,<br>다음 주문에는 샘플부터.</h1><p class="lead">외부 AI에 재무보고서 숫자 추출을 맡기는 개발자를 위한 지출 통제와 거래 기록.</p>
<p>이 묶음은 실제 실행에서 저장한 결과를 보여줍니다. 여기서 누르는 버튼은 새 결제나 AI 호출을 만들지 않습니다.</p>
<section class="grid" aria-label="자료 선택"><article class="card"><div class="label">01 · 1분 소개</div><h2><a href="brief.ko.pdf" download>2쪽 PDF 받기</a></h2><p>누구를 위해 무엇을 만들었는지, 어떤 결과를 확인했는지 쉽게 설명합니다.</p></article><article class="card"><div class="label">02 · 직접 살펴보기</div><h2><a href="fiction/index.html">12개 가상 상황 열기</a></h2><p>정상 지급부터 오납품 환불, 샘플 요구, 예산 초과와 기록 변조까지.</p></article><article class="card"><div class="label">03 · 공개 테스트넷</div><h2><a href="video/index.html">3분 영상 보기</a></h2><p>실제 Sepolia 기록 화면에 자막을 붙였습니다. 무음 기록 재생이며 별도 실행입니다.</p></article></section>
<section class="panel"><h2>발표는 이 순서로</h2><ol><li><b>0:00-0:30</b> - “재무보고서 숫자 네 개를 맡겼는데, 출처가 있어도 값이 틀릴 수 있습니다.”</li><li><b>0:30-1:15</b> - 데모의 <b>03</b> 선택. Q1 3,014가 3,441로 바뀌면 검수 실패와 환불을 보여줍니다.</li><li><b>1:15-2:00</b> - <b>04 → 05 → 06</b>. 샘플 없는 재주문은 중지. 샘플 한 줄로 전체 납품을 대신해도 환불. 전체 납품이 맞으면 지급.</li><li><b>2:00-2:40</b> - <b>08 · 11 · 12</b>. 위임 철회, 중복 지급 방지, 변조 영수증 탐지를 보여줍니다.</li><li><b>2:40-3:00</b> - “AI는 제안하고, 코드는 검사하고, 체인은 예치와 정산을 기록합니다.” 공개 거래 링크를 엽니다.</li></ol></section>
<section class="panel"><h2>확인 가능한 결과</h2><p><b>가상 상황 12/12 · 자동 검사 102/102</b>. 가상 실행의 지급 3건·환불 3건, 마지막 예치 잔액 0. 최종 가상 실행의 실제 Kiln 견적 비교는 1회·2,315토큰이며 나머지 입력은 작성된 시나리오입니다.</p><nav><a href="fiction/report.json">가상 실행 원본</a><a href="evidence/ci-tests.json">Ubuntu 검사 원본</a><a href="evidence/sepolia/report.json">Sepolia 실행 원본</a><a href="manifest.json">파일 해시 목록</a></nav><p class="muted">첫 실제 모델 실행은 가능한 협상을 놓쳐 실패했습니다. 수정 전 8/12와 수정 후 12/12 기록은 저장소에 분리 보존했습니다. 최저가 선택을 입증하지 않았습니다.</p></section>
<section class="panel"><h2>블록체인에서 확인하기</h2><nav><a href="https://sepolia.etherscan.io/tx/0xeb9d63ca0c71be068cdd85a224d1ace286838ecdcf099c33c511c9be5d4eaecc">정상 지급</a><a href="https://sepolia.etherscan.io/tx/0x845a4ed742759a5f2fb70a4fd9fcec9aa45b0e99f43b076d315245c27aaf3ca8">오납품 환불</a><a href="https://sepolia.etherscan.io/tx/0x7387cdedf14644687700a45c6d10cfe24c78940d70230b96495a037f9ec245f8">앱 종료 후 별도 회수</a><a href="evidence/buyer-recovery/report.json">회수 실행 원본</a></nav><p class="muted">외부 거래 탐색기에는 인터넷이 필요합니다. 공개 기록과 가상 로컬 체인 실행을 하나의 거래처럼 합치지 않습니다.</p></section>
<footer>2026.09.29 · 테스트넷 프로토타입. 가상 참여자이며 실제 고객 수요·사람의 이해도·미관측 문서·전력 절감은 미검증입니다. 납품 판단에는 운영 서버 신뢰가 남습니다. <a href="https://github.com/him55710-sudo/Furiosa-x-bricksum/pull/1">코드와 전체 보고서</a></footer></main></html>''')
put('video/index.html',f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>공개 실증 3분 영상</title><style>{style}</style><main><a href="../index.html">자료 목록으로</a><h1>공개 테스트넷 실증 · 3분 영상</h1><p>기존 실제 화면에 한국어 자막을 붙인 무음 기록 재생입니다. 실시간 거래 화면이 아닙니다.</p><video controls playsinline preload="metadata" poster="preview.png"><source src="source-demo-3min.webm" type="video/webm"></video><nav><a href="source-demo-3min.webm" download>영상 내려받기</a><a href="captions.ko.srt" download>한국어 발표 대본</a></nav><section class="panel"><p>0:00-2:30: 원문 실행 a2f6f4fa, 실제 Kiln 2회·4,495토큰. 전사 표 입력과 고정 참조 검수.</p><p>2:30-3:00: 별도 회수 실행 5b2ccb95. 앱이 꺼진 뒤 미정산 거래의 마감이 지나 구매자가 회수했습니다. 이미 지급한 돈의 취소가 아닙니다.</p><p class="muted">공급자는 시뮬레이터입니다. 원본 영상 manifest의 제작 경로는 원래 저장소 경로이며, 이 묶음의 실제 파일은 최상위 manifest.json에 연결됩니다.</p></section></main></html>''')
put('START-HERE.txt','''Agent Deal Escrow - portable evidence replay\n\n1. Unzip the entire folder.\n2. Open index.html in a modern browser. No API key or wallet is needed.\n3. If local-file viewing is restricted, run: python -m http.server 3419 --bind 127.0.0.1\n   Then open http://127.0.0.1:3419/\n4. External GitHub and Sepolia links need internet.\n5. The package replays retained evidence; it cannot create payments or AI calls.\n\nSHA256 file manifest: manifest.json. Compare the external ZIP digest from the repository to verify the archive.\nOriginal records are preserved byte-for-byte. Some source/renderer paths inside historical records refer to the original repository, not this portable folder.\n''')

# Validate only navigable relative URLs. Historical provenance paths are not rewritten.
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ('href','src','poster') and v: self.links.append(v)
checked=0
for name in selected.copy():
    if not name.endswith('.html'): continue
    parser=Links(); parser.feed((PACK/name).read_text(encoding='utf-8'))
    for url in parser.links:
        u=urlsplit(url)
        if u.scheme or u.netloc or not u.path: continue
        target=(PACK/name).parent/unquote(u.path)
        assert target.resolve().is_relative_to(PACK.resolve()), (name,url)
        # manifest is created after content validation.
        assert target.is_file() or target.resolve()==(PACK/'manifest.json').resolve(), (name,url)
        checked+=1
items=[]
for name in sorted(selected):
    b=(PACK/name).read_bytes()
    assert not any(part in {'.env','private','node_modules','.git'} for part in Path(name).parts)
    items.append({'path':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest={'schema_version':1,'content_source_commit':'538666c79348d3584c34ab70d0c0e9ca0f76f340','fiction_run':RUN,
          'local_links_checked':checked,'files':items,'scope':'Portable replay, not a new execution. No model credentials or signers.'}
put('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
assert {p.relative_to(PACK).as_posix() for p in PACK.rglob('*') if p.is_file()}==selected, 'Unexpected stale or extra package files'
archive=OUT/'Agent-Deal-Escrow-demo.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name in sorted(selected):
        z.write(PACK/name, PACK.name+'/'+name)
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(OUT/'Agent-Deal-Escrow-demo.sha256').write_text(digest+'  '+archive.name+'\n',encoding='ascii')
summary={'archive':archive.name,'sha256':digest,'bytes':archive.stat().st_size,'files':len(selected),'relative_links_checked':checked,'pdf_pages':2,'scope':'Static evidence packaging; original execution files unchanged.'}
(OUT/'package-check.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary))
