import {agentIllustration} from './accord-scene.mjs';

// Fixed presentation time is intentionally separate from the original chain timestamps.
export const TOUR_SCENES = [
  {at:0,end:20,name:'01 / 무엇을 거래하나요?',cue:'소비 에이전트가 PDF 속 설비투자 데이터를 표로 정리하는 일을 판매 에이전트에게 맡깁니다. Accord Lock은 이 외부 작업의 지출과 정산을 통제합니다.'},
  {at:20,end:45,name:'02 / 돈의 권한은 구매자에게',cue:'구매자가 직접 예산을 넣고 권한을 서명합니다. AI는 구매를 제안하고, 컨트롤러는 정해진 한도 안에서만 예산을 배정합니다.'},
  {at:45,end:90,name:'03 / 잠금에서 지급까지',cue:'돈은 먼저 스마트 계약에 잠깁니다. 판매자가 결과를 보내면 신뢰하는 검수자가 확인하고, 컨트롤러의 정산 요청을 계약이 집행합니다.'},
  {at:90,end:125,name:'04 / 실패는 다음 거래의 조건으로',cue:'다른 판매자의 잘못된 납품은 환불되었습니다. 같은 판매자의 다음 거래는 샘플 검증을 통과해야 예치할 수 있습니다. 전체 납품은 다시 검수합니다.'},
  {at:125,end:155,name:'05 / 앱이 꺼져도 회수',cue:'앱 종료 후 기한이 지나자, 구매자가 별도 도구로 직접 환불을 요청했습니다. 앱이나 컨트롤러 키 없이 계약에서 원금을 회수했습니다.'},
  {at:155,end:180,name:'06 / AI 거래에 필요한 세 가지 역할',cue:'AI는 제안하고, 정책은 권한을 확인하고, 블록체인은 자금을 잠그고 정산합니다. 납품 검수는 신뢰하는 오프체인 검수자의 역할입니다.'}
];

export function tourPosition(seconds) {
  const elapsed = Math.max(0, Math.min(180, Number.isFinite(seconds) ? seconds : 0));
  const index = Math.max(0, TOUR_SCENES.findIndex(s => elapsed < s.end));
  const chapter = elapsed === 180 ? 5 : index;
  const local = elapsed - TOUR_SCENES[chapter].at;
  const beats = [1,3,6,4,3,1][chapter];
  const beat = Math.min(beats - 1, Math.floor(local / ((TOUR_SCENES[chapter].end - TOUR_SCENES[chapter].at) / beats)));
  return {elapsed,chapter,beat,key:`${chapter}:${beat}`,complete:elapsed === 180};
}

export function createTourRenderer({data,amount,icon}) {
  const e = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = hash => hash.slice(0,8)+'…'+hash.slice(-6);
  const tx = (label, hash) => `<a class="at-proof-link" href="https://sepolia.etherscan.io/tx/${e(hash)}" target="_blank" rel="noopener noreferrer" data-tour-proof>${icon('external')} ${label} <span>${short(hash)}</span></a>`;
  const fileLink = (label, file) => `<a class="at-proof-link" href="/evidence/${file}.json" target="_blank" rel="noopener noreferrer" data-tour-proof>${icon('file')} ${label}</a>`;
  const actor = (kind, name, copy) => `<div class="at-actor ${kind}"><div class="at-actor-art">${agentIllustration(kind)}</div><strong>${name}</strong><span>${copy}</span></div>`;
  const arrow = (label,reverse=false) => `<div class="at-flow-arrow ${reverse?'reverse':''}"><span>${label}</span><i></i>${icon('arrow')}</div>`;
  const sheet = (type='pdf',valid=true) => `<div class="at-sheet ${type} ${valid?'':'invalid'}" aria-label="${type==='pdf'?'원본 PDF 문서':'원문 근거가 포함된 결과 표'}"><div class="at-sheet-fold"></div><span class="at-sheet-type">${type==='pdf'?'PDF':'DATA'}</span><strong>${type==='pdf'?'분기 실적 자료':'설비투자 데이터'}</strong>${type==='pdf'?'<i class="at-text-line"></i><i class="at-text-line short"></i><i class="at-text-line"></i>':`<div class="at-mini-table"><span>분기</span><span>투자금액</span><span>출처</span>${['Q1','Q2','Q3','Q4'].map(q=>`<span>${q}</span><span class="at-table-bar"></span><span>${valid?'✓':'×'}</span>`).join('')}</div>`}<span class="at-sheet-foot">${type==='pdf'?'원문에서 필요한 정보만':valid?'원문 위치 · 값 · 파일 해시':'약속한 조건과 다른 결과'}</span></div>`;
  const vault = (value,state='locked',label='스마트 계약') => `<div class="at-vault ${state}"><div class="at-vault-halo"></div><div class="at-vault-art"><div class="al-lock ${state==='locked'?'locked':'finished'}"><div class="al-shackle"></div><div class="al-lock-body">${icon(state==='released'?'check':state==='refunded'?'arrows':'key')}</div></div><div class="at-vault-platform"><i></i><i></i><i></i></div></div><strong>${label}</strong><span class="at-vault-value">${value}</span><span class="at-vault-state">${state==='locked'?'에스크로에 보관':state==='released'?'판매자 지급 완료':state==='refunded'?'구매자 환불 완료':'구매자 소유 예산'}</span></div>`;
  const wallet = (value,label='구매자 지갑') => `<div class="at-wallet-wrap"><div class="at-wallet-art"><span class="at-coin">Ξ</span><div class="at-wallet-body">${icon('wallet')}<i></i></div></div><strong>${label}</strong><span>${value}</span></div>`;
  const chain = (items,active) => `<div class="at-chain-lane"><div class="at-lane-label">${icon('code')}<div><strong>블록체인 기록 · 상태</strong><span>Ethereum Sepolia · 스마트 계약</span></div></div><div class="at-chain-blocks">${items.map(([title,sub],i)=>`<div class="at-chain-block ${i<=active?'recorded':''} ${i===active?'current':''}"><span>${i<=active?icon('check'):icon('clock')}</span><strong>${title}</strong><small>${sub}</small></div>`).join('')}</div></div>`;
  const proof = (links,note='실제 Sepolia 실행 기록을 압축 재생합니다. 새 결제는 실행하지 않습니다.') => `<div class="at-proof"><div>${links}</div><p>${note}</p></div>`;
  const intro = () => `<div class="at-intro-art"><div class="at-task-source">${sheet('pdf')}<span class="at-float-label">외부 작업 예시</span></div>${actor('buyer','소비 에이전트','필요한 일을 의뢰해요')}<div class="at-trade-brief"><span>구매 요청</span><strong>“이 PDF의 투자금액을<br>출처와 함께 정리해 줘.”</strong><div>${amount(data.normal.deal.price_minor)}<small>기록된 거래 금액 · 테스트 ETH</small></div>${arrow('작업 의뢰')}</div>${actor('seller','판매 에이전트','결과를 만들고 전달해요')}<div class="at-task-result">${sheet('data')}</div></div><div class="at-big-takeaway">일은 에이전트에게.<br class="at-mobile-break"> <strong>지출 권한은 구매자에게.</strong></div>${proof(fileLink('이 거래의 원본 기록','normal'),'실행 기록 기반 시연 · 모의 거래 상대 · 일러스트와 말풍선은 설명용 재구성')}`;
  function budget(beat) {
    const r=data.report,t=data['buyer-transactions'].transactions;
    return `<div class="at-budget-art">${wallet(amount(r.deposit_minor))}${arrow('직접 예치 · 직접 서명')}<div class="at-mandate"><span class="at-signed">${icon('check')} 구매자가 서명한 권한</span><div><span>총 배정 한도</span><strong>${amount(r.authority_minor)}</strong></div><div><span>건당 한도</span><strong>${amount(r.per_deal_minor)}</strong></div><p>허용 판매자 · 만료 · 권한 버전도 확인</p></div>${arrow('권한 안에서만 배정')}${vault(amount(r.deposit_minor),'idle','구매자 예산 계약')}</div><div class="at-budget-decision ${beat===2?'blocked':''}">${icon(beat===2?'stop':'shield')}<strong>${beat===2?`${amount(data['over-limit'].deal.price_minor)} 요청 → 예치 전에 차단`:'AI가 구매를 제안해도, 승인한 한도를 넘길 수 없어요.'}</strong><span>${beat===2?'실제 기록: 정책에서 먼저 거절 · 예치 서명 0건':'계약도 총액·건당 한도·판매자·만료를 확인해요.'}</span></div>${chain([['구매자 예치',amount(r.deposit_minor)],['지출 권한 서명',`총 ${amount(r.authority_minor)}`],['계약이 강제하는 한도',`건당 ${amount(r.per_deal_minor)}`]],Math.min(beat,2))}${proof(tx('예치 서명',t.find(x=>x.kind==='deposit').hash)+tx('권한 서명',t.find(x=>x.kind==='authority').hash)+(beat===2?fileLink('차단 기록','over-limit'):''),'한도 초과는 정책에서 먼저 차단된 기록입니다. 계약의 한도 강제는 별도의 보호 장치입니다.')}`;
  }
  function trade(beat) {
    const labels=['구매 요청','정책 확인','금액 잠금','납품 전달','납품 검수','지급 완료'];
    const titles=['필요한 작업과 가격을 정해요.','승인된 구매인지 확인해요.','대금은 계약에 먼저 잠가요.','판매자가 결과를 전달해요.','원문과 납품 조건을 확인해요.','컨트롤러의 요청으로 계약이 지급해요.'];
    const locked=beat>=2&&beat<5, paid=beat===5,d=data.normal;
    return `<div class="at-trade-stage"><div class="at-offchain-label">${icon('agent')} 에이전트 · 정책 · 검수 <span>오프체인</span></div><div class="at-trade-actors">${actor('buyer','소비 에이전트',beat<2?'구매를 제안해요':paid?'데이터를 받았어요':'결과를 기다려요')}<div class="at-delivery-area">${beat<3?`<div class="at-proposal">${icon('file')}<strong>설비투자 데이터 구매</strong><span>4개 분기 · 원문 출처 포함</span><b>${amount(d.deal.price_minor)}</b></div>`:sheet('data')}<span class="at-delivery-badge ${beat>=4?'checked':''}">${icon(beat>=4?'check':'file')}${beat>=4?'신뢰하는 검수자: 통과':'구매 조건과 납품 결과'}</span></div>${actor('seller','판매 에이전트 A',paid?'지급을 받았어요':beat>=3?'데이터를 전달했어요':'작업을 준비해요')}</div><div class="at-money-rail"><span class="at-money-label">자금의 이동 <b>온체인</b></span><div class="at-money-wallet buyer">${icon('wallet')}<span>구매자 예산</span></div>${arrow(locked?'잠금':paid?'배정 완료':'아직 배정 전')}<div class="at-mini-escrow ${locked?'locked':''} ${paid?'paid':''}">${icon(paid?'check':'key')}<span>스마트 계약</span><strong>${amount(d.deal.price_minor)}</strong><small>${paid?'지급 완료':locked?'LOCKED · 보관 중':'예치 대기'}</small></div>${arrow(paid?'지급':'검수 결과 대기')}<div class="at-money-wallet seller ${paid?'paid':''}">${icon('wallet')}<span>판매자 지갑</span></div>${paid?'<span class="at-money-dot"></span>':''}</div></div><div class="at-step-caption" aria-live="polite"><span>${beat+1} / 6 · ${labels[beat]}</span><strong>${titles[beat]}</strong></div>${chain([['예치 기록',`fund · ${amount(d.deal.price_minor)}`],['잠금 상태','LOCKED'],['지급 기록',`release · ${amount(d.deal.price_minor)}`]],beat<2?-1:paid?2:1)}${proof((beat>=2?tx('금액 잠금',d.transactions.fund.tx_hash):fileLink('구매 조건','normal'))+(paid?tx('판매자 지급',d.transactions.release.tx_hash):''),'검수는 오프체인에서 수행합니다. 계약은 데이터의 정확성을 스스로 판정하지 않습니다.')}`;
  }
  function memory(beat) {
    const d=data['wrong-delivery'], next=data['preview-first'];
    return `<div class="at-memory-art"><div class="at-memory-source">${sheet('data',false)}<strong>판매자 B · 납품 검수 실패</strong></div>${arrow(beat===0?'검수 거절':'환불')}${vault(amount(d.deal.price_minor),beat===0?'locked':'refunded','실패한 거래의 에스크로')}${arrow('실패를 다음 조건으로')}<div class="at-memory-rule"><div class="at-memory-brain">${icon('memory')}</div><span>다음 거래 · 같은 판매자 B</span><strong>${beat<2?'샘플 검증이 먼저':beat===2?'샘플 없으면 예치 차단':'샘플 확인 후 거래 재개'}</strong><div class="at-preview-gate ${beat===3?'pass':''}">${icon(beat===3?'check':'shield')} ${beat===3?'샘플 통과 → 예치 허용':'REQUIRE_PREVIEW'}</div><small>전체 납품은 별도로 다시 검수해요.</small></div></div>${chain([['실패한 거래 잠금',amount(d.deal.price_minor)],['구매자 환불',amount(d.deal.price_minor)],['샘플 통과 후 새 예치',amount(next.deal.price_minor)]],beat===0?0:beat<3?1:2)}${proof((beat>=1?tx('실패 거래 환불',d.transactions.refund.tx_hash):fileLink('납품 실패 기록','wrong-delivery'))+(beat===3?tx('다음 거래 예치',next.transactions.fund.tx_hash):fileLink('실패에서 생긴 조건','preview-first')),'실패 기억과 샘플 검증은 오프체인 정책입니다. 환불과 다음 거래의 예치는 각각 체인 기록으로 확인합니다.')}`;
  }
  function recovery(beat) {
    const d=data['app-off'];
    return `<div class="at-recovery-art"><div class="at-offline-app"><div class="at-offline-window"><span></span><span></span><span></span><div>${icon('stop')}<strong>APP OFFLINE</strong></div></div><p>앱 종료 관측</p></div><div class="at-recovery-route">${wallet(amount(d.deal.price_minor),'구매자 본인')}${arrow(beat===0?'기한 대기':'직접 환불 요청')}${vault(amount(d.deal.price_minor),beat===2?'refunded':'locked','블록체인 계약')}<div class="at-recovery-bypass"><span>${icon('arrows')}</span><strong>${beat===2?'구매자 지갑으로 원금 회수':'앱을 거치지 않는 회수 경로'}</strong></div></div></div><div class="at-recovery-facts"><span class="${beat>=0?'done':''}">${icon('stop')} 앱 종료</span><span class="${beat>=1?'done':''}">${icon('clock')} 계약 기한 경과</span><span class="${beat>=2?'done':''}">${icon('check')} 구매자 서명으로 회수</span></div>${chain([['에스크로 잠금',amount(d.deal.price_minor)],['계약의 회수 조건','납품 기한 경과'],['구매자 직접 환불',amount(d.deal.price_minor)]],beat)}${proof(beat===2?tx('구매자 직접 회수',data['buyer-refund'].tx_hash)+fileLink('독립 검증','independent-refund'):fileLink('앱 종료와 회수 기록','report'),'구매자는 기한 후 별도 도구로 회수했습니다. 자동 환불이 아니며, 가스 비용은 회수 원금과 별도입니다.')}`;
  }
  const summary = () => `<div class="at-summary-art"><div>${actor('buyer','AI','무엇을 살지 제안해요')}<span class="at-summary-tag">구매 제안</span></div>${arrow('제안')}<div><div class="at-policy-orb">${icon('shield')}</div><strong>정책 · 검수</strong><p>권한과 납품을 확인해요.</p><span class="at-summary-tag">신뢰하는 오프체인 검수</span></div>${arrow('정산 요청')}<div>${vault('지급 또는 환불','released','블록체인')}<span class="at-summary-tag">한도 · 자금 잠금 · 정산 · 회수</span></div></div><div class="at-summary-sentence">AI가 거래하는 시대,<br><strong>돈이 움직이는 조건은 명확하게.</strong></div><div class="at-final-actions"><button type="button" class="button primary" data-action="start">${icon('play')} 3분 다시 보기</button><button type="button" class="button" data-receipt="normal">실제 거래 증거 보기 ${icon('external')}</button></div>${proof(fileLink('5가지 시나리오 결과','report')+fileLink('독립 체인 검증','independent'),'구매자가 서명한 한도는 계약이 강제합니다. 현재 컨트롤러와 납품 검수는 신뢰 대상이며 판매자 지급을 무조건 보장하지 않습니다.')}`;
  const headings = [
    ['AI가 다른 AI에게','일을 맡긴다면?','PDF 속 설비투자 데이터를, 출처가 있는 표로 구매해요.'],
    ['얼마까지 쓸지는,','구매자가 정해요.','구매자 예산과 서명한 권한을 스마트 계약에 기록해요.'],
    ['돈은 먼저 잠그고,','결과를 확인한 뒤 지급해요.','작업은 에이전트가, 자금의 잠금과 정산은 블록체인이.'],
    ['잘못된 납품은 환불.','다음 거래는 더 꼼꼼하게.','판매자 B의 실패가 다음 구매의 샘플 검증 조건이 돼요.'],
    ['앱이 꺼져도,','회수할 길은 남아요.','기한이 지나면 구매자가 계약에 직접 환불을 요청할 수 있어요.'],
    ['AI의 제안에서,','책임 있는 정산까지.','accord lock · 에이전트 거래의 지출 통제와 정산 기록']
  ];
  function frame(elapsed) {
    const {chapter,beat}=tourPosition(elapsed),h=headings[chapter];
    return `<div class="at-frame chapter-${chapter}" data-tour-frame="${chapter}:${beat}"><header class="at-heading"><div class="at-chapter">${String(chapter+1).padStart(2,'0')} / 06 <span>${TOUR_SCENES[chapter].name.split(' / ')[1]}</span></div><h1>${h[0]}<br><em>${h[1]}</em></h1><p>${h[2]}</p></header><div class="at-illustration">${[intro,()=>budget(beat),()=>trade(beat),()=>memory(beat),()=>recovery(beat),summary][chapter]()}</div></div>`;
  }
  function shell(elapsed=0) {
    return `<section class="at-presentation" aria-label="Accord Lock 3분 시연"><header class="at-topbar"><a class="brand" href="#overview"><span class="brand-mark" aria-hidden="true"></span><span>accord lock</span></a><div class="at-demo-label"><i></i> 실제 기록으로 보는 3분 데모 <span>Sepolia · 테스트 ETH</span></div><button type="button" class="at-exit" data-tour-exit>시연 나가기 ×</button></header><nav class="at-chapters" aria-label="시연 장면">${TOUR_SCENES.map((s,i)=>`<button type="button" data-tour-at="${s.at}" aria-label="${i+1}장 ${s.name.split(' / ')[1]}"><span>${String(i+1).padStart(2,'0')}</span>${['거래의 시작','구매자 권한','거래와 정산','실패의 기억','직접 회수','핵심 정리'][i]}</button>`).join('')}</nav><div id="tour-frame">${frame(elapsed)}</div></section>`;
  }
  return {frame,shell};
}
