// Presentation of existing public execution records. This module never signs or sends a payment.
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
export function agentIllustration(kind) {
  return `<div class="al-bot ${kind === 'buyer' ? 'buyer' : 'seller'}" aria-hidden="true"><div class="al-antenna"><i></i></div><div class="al-ear left"></div><div class="al-ear right"></div><div class="al-bot-face"><div class="al-eye"></div><div class="al-eye"></div><div class="al-smile"></div></div><span class="al-gloss"></span></div><div class="al-bot-shadow" aria-hidden="true"></div>`;
}
export function createAccordExperience({ data, amount, icon, receipt, tour }) {
  let scenario = 'normal', step = 0, playing = false, timer = null, speed = 1, host = null;
  const choices = [['normal', '정상 거래'], ['wrong-delivery', '납품 실패 · 환불'], ['over-limit', '한도 초과 · 차단']];
  const base = [
    ['구매 요청', 'DEAL_PROPOSED', '필요한 일을 맡겨요', '소비 에이전트가 데이터와 거래 조건을 제안했어요.'],
    ['권한 확인', 'POLICY_CHECKED', '약속한 한도 안에서', '정해진 예산과 판매자, 거래 조건을 정책이 확인해요.'],
    ['금액 잠금', 'ESCROW_FUNDED', '확인될 때까지, 안전하게', '구매자 예산에서 거래 금액을 에스크로에 잠갔어요.'],
    ['데이터 전달', 'DELIVERY_SUBMITTED', '약속한 결과를 전달해요', '판매 에이전트가 원문 근거가 포함된 데이터를 제출했어요.'],
    ['납품 검수', 'DELIVERY_VALIDATED', '결과까지 꼼꼼하게', '신뢰하는 검수자가 약속한 납품 예치 전 · 조건 확인.'],
    ['지급 완료', 'ESCROW_RELEASED', '약속대로, 거래 완료', '검수를 통과한 결과에 대해 판매자에게 지급했어요.']
  ];
  function stages() {
    if (scenario === 'over-limit') return [...base.slice(0, 2), ['거래 차단', 'TRANSACTION_BLOCKED', '한도를 넘으면, 여기서 멈춰요', '건당 한도를 초과했어요. 예치 서명 없이 거래를 차단했어요.']];
    if (scenario === 'wrong-delivery') return [...base.slice(0, 4), ['검수 실패', 'DELIVERY_VALIDATED', '다른 결과에는 지급하지 않아요', '잘못된 납품이 확인되어 판매자 지급을 중단했어요.'], ['환불 완료', 'ESCROW_REFUNDED', '금액은 돌려주고, 실패는 기억해요', '구매자에게 환불했어요. 다음 거래에는 샘플 검증이 필요해요.']];
    return base;
  }
  const character = agentIllustration;
  function scene() {
    const d = data[scenario], ss = stages(), current = ss[step], end = step === ss.length - 1, bad = scenario !== 'normal' && end;
    const sellerName = d.deal.seller_id === 'seller-a' ? 'Seller A' : 'Seller B';
    const locked = scenario !== 'over-limit' && step >= 2 && !end;
    const event = d.events.find(e => e.event_type === current[1]);
    const price = amount(d.deal.price_minor);
    const buyerSay = step === 0 ? 'PDF의 투자금액을 정리해 줘' : step === 1 ? '승인된 예산 안에서 거래할게요' : end ? (bad ? '제 예산을 지켰어요' : '검증된 데이터, 잘 받았어요') : '검수가 끝나면 지급해 주세요';
    const sellerSay = step < 3 ? `${price}에 준비해 드릴게요` : step < 5 ? '납품한 데이터를 확인해 주세요' : scenario === 'normal' ? '지급까지 확인했어요' : '다음에는 샘플부터 제출할게요';
    return `<div class="al-demo-grid"><section class="al-stage-card" aria-label="에이전트 거래 시연">
      <div class="al-stage-top"><span class="al-recorded"><i></i> RECORDED DEMO</span><span class="al-deal-id">${sellerName} <span>·</span> Sepolia</span></div>
      <div class="al-scene ${playing ? 'is-playing' : ''} ${bad ? 'is-refund' : ''} step-${step}">
        <div class="al-orbit orbit-one" aria-hidden="true"></div><div class="al-orbit orbit-two" aria-hidden="true"></div>
        <div class="al-agent buyer"><div class="al-speech">${buyerSay}</div><div class="al-character">${character('buyer')}</div><div class="al-agent-title"><i></i> 소비 에이전트</div><span class="al-agent-caption">요청하고, 구매해요</span></div>
        <div class="al-connection connection-left ${step >= 1 ? 'active' : ''}" aria-hidden="true"><i></i><b>${icon('arrow')}</b></div>
        <div class="al-lock-zone"><div class="al-lock ${locked ? 'locked' : ''} ${end ? 'finished' : ''}"><div class="al-shackle"></div><div class="al-lock-body">${icon(end ? (bad ? 'arrows' : 'check') : 'key')}</div></div><div class="al-lock-label">${end ? (bad ? (scenario === 'over-limit' ? 'BLOCKED' : 'REFUNDED') : 'SETTLED') : locked ? '스마트 계약 · 잠금' : '스마트 계약 에스크로'}</div><span class="al-lock-amount">${locked ? price : end && scenario !== 'over-limit' ? price : '조건을 확인해요'}</span></div>
        <div class="al-connection connection-right ${step >= 3 ? 'active' : ''}" aria-hidden="true"><i></i><b>${icon('arrow')}</b></div>
        <div class="al-agent seller"><div class="al-speech">${sellerSay}</div><div class="al-character">${character('seller')}</div><div class="al-agent-title"><i></i> 판매 에이전트</div><span class="al-agent-caption">제공하고, 전달해요</span></div>
        ${step === 3 || step === 4 ? `<div class="al-data-packet" aria-hidden="true">${icon('file')} financial-data.json ${icon('check')}</div>` : ''}
      </div>
      <div class="al-narrative" aria-live="polite" aria-atomic="true"><span class="al-step-label">STEP ${String(step + 1).padStart(2, '0')}</span><h2>${current[2]}</h2><p>${current[3]}</p></div>
      <div class="al-timeline" style="--steps:${ss.length}">${ss.map((s, i) => `<button type="button" data-al-step="${i}" class="${i < step ? 'complete' : ''} ${i === step ? 'current' : ''}" aria-label="${i + 1}단계: ${s[0]}" ${i === step ? 'aria-current="step"' : ''}><span>${i < step ? icon('check') : i + 1}</span><b>${s[0]}</b></button>`).join('')}</div>
      <div class="al-player"><button type="button" class="al-play" data-al="play" aria-label="${playing ? '데모 일시정지' : '거래 데모 재생'}">${playing ? '<span class="al-pause">Ⅱ</span>' : icon('play')} ${playing ? '일시정지' : end ? '다시 재생' : '데모 재생'}</button><span class="al-player-position">${String(step + 1).padStart(2, '0')} <span>/ ${String(ss.length).padStart(2, '0')}</span></span><div class="al-player-tools"><button type="button" data-al="reset" aria-label="처음으로">${icon('arrows')}</button><button type="button" data-al="speed" aria-label="재생 속도 ${speed}배">${speed}×</button><button type="button" data-al="next" aria-label="다음 단계" ${end ? 'disabled' : ''}>${icon('arrow')}</button></div></div>
    </section>
    <aside class="al-transaction"><div class="al-panel-title"><h2>거래 현황</h2><span class="al-live-label">기록 재생</span></div><div class="al-order-name">재무 데이터 구매</div><div class="al-order-meta">${escapeText(d.deal.seller_id)} · 금융 리서치</div><div class="al-amount-label">${end ? (scenario === 'over-limit' ? '차단된 요청 금액' : scenario === 'wrong-delivery' ? '환불한 금액' : '지급한 금액') : locked ? '안전하게 잠긴 금액' : '제안한 거래 금액'}</div><div class="al-amount">${price}</div><div class="al-state ${bad ? 'refund' : ''}">${icon(end ? (bad ? 'shield' : 'check') : 'shield')} ${end ? current[0] : locked ? '검수 전까지 지급되지 않아요' : '아직 지급되지 않았어요'}</div><div class="al-rule-list"><div><span>건당 지출 한도</span><strong>${amount(data.report.per_deal_minor)}</strong></div><div><span>승인한 판매자</span><strong>Seller A, B</strong></div><div><span>지급 조건</span><strong>전체 납품 검수</strong></div></div>
      <div class="al-event-heading">지금 확인한 기록 <span>${event ? new Date(event.timestamp).toISOString().slice(11, 19) + ' UTC' : ''}</span></div><div class="al-event"><span class="al-event-icon">${icon(bad ? 'shield' : 'check')}</span><div><strong>${current[0]}</strong><code>${current[1]}</code></div></div>
      <button type="button" class="al-receipt-button" data-al="receipt">거래 증거 확인하기 ${icon('external')}</button><p class="al-proof-note">실제 테스트넷 기록을 재생해요.<br>새 결제는 실행하지 않아요.</p>
    </aside></div>`;
  }
  function overview() {
    const r = data.report, paid = ['normal','preview-first'].reduce((n,k) => n + data[k].deal.price_minor, 0), refunds = ['wrong-delivery','app-off'].reduce((n,k) => n + data[k].deal.price_minor, 0);
    return `<div class="al-experience"><header class="al-heading"><div><div class="al-eyebrow">AGENT COMMERCE, IN ACCORD.</div><h1>에이전트의 거래,<br><span>약속대로 안전하게.</span></h1><p>AI가 외부 작업을 구매할 때, 지출 한도와 정산을 관리해요.</p></div><button type="button" class="al-tour-button" data-al="tour">${icon('play')} 3분 스토리 데모</button></header>
      <div class="al-demo-header"><div><h2>에이전트 거래 데모</h2><span>한 번의 거래가 완성되는 과정</span></div><div class="al-scenarios" role="group" aria-label="거래 시나리오">${choices.map(([key, label]) => `<button type="button" data-al-scenario="${key}" aria-pressed="${scenario === key}" class="${scenario === key ? 'selected' : ''}">${label}</button>`).join('')}</div></div>
      <div id="al-scene-container">${scene()}</div>
      <div class="al-demo-note">${icon('file')} 말풍선은 거래 흐름을 설명하기 위해 재구성했어요. 실제 모델 대화 원문이 아니에요.</div>
      <div class="al-chain-explainer"><div>${icon('agent')}<strong>AI는 구매를 제안</strong><span>필요한 작업과 거래 조건</span></div><b>→</b><div>${icon('shield')}<strong>정책·검수는 확인</strong><span>지출 권한과 납품 결과</span></div><b>→</b><div>${icon('code')}<strong>블록체인은 정산</strong><span>한도 · 자금 잠금 · 지급·회수</span></div></div><div class="al-bottom-heading"><h2>내 예산, 한눈에</h2><a href="#budget">예산과 권한 보기 ${icon('arrow')}</a></div>
      <div class="al-budget-grid">${[['wallet','남아 있는 예산',amount(r.available_minor),'구매자 소유의 미배정 잔액','blue'],['arrows','판매자에게 지급',amount(paid),'검수를 통과한 2건',''],['shield','구매자에게 환불',amount(refunds),'납품 실패 · 기한 만료 2건',''],['stop','한도 초과 차단','1 <small>건</small>','예치 전에 지킨 지출 한도','red']].map(([ic, label, value, note, tone]) => `<a class="al-budget-card ${tone}" href="${ic === 'stop' ? '#policy' : '#budget'}"><span class="al-budget-icon">${icon(ic)}</span><span class="al-budget-label">${label}</span><strong>${value}</strong><span class="al-budget-note">${note}</span></a>`).join('')}</div>
      <a class="al-memory-banner" href="#memory"><span class="al-memory-symbol">${icon('memory')}</span><div><strong>한 번의 실패가, 다음 거래의 안전장치로.</strong><p>Seller B의 다음 거래에는 샘플 검증을 먼저 요청해요.</p></div><span class="al-memory-link">거래 기억 보기 ${icon('arrow')}</span></a>
      <p class="al-snapshot-note">전체 실행이 끝난 시점의 예산 현황 · Sepolia 테스트 ETH · 위 데모의 재생 단계와 별도인 최종 기록</p></div>`;
  }
  function stop() { playing = false; clearTimeout(timer); timer = null; }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { if (!host?.isConnected) return stop(); if (step < stages().length - 1) step++; if (step === stages().length - 1) stop(); paint(); if (playing) schedule(); }, 2600 / speed); }
  function paint() {
    if (!host?.isConnected) return;
    const active = document.activeElement;
    const selector = active?.dataset.al ? `[data-al="${active.dataset.al}"]` : active?.dataset.alStep !== undefined ? `[data-al-step="${active.dataset.alStep}"]` : null;
    host.querySelector('#al-scene-container').innerHTML = scene();
    host.querySelectorAll('[data-al-scenario]').forEach(b => { const selected = b.dataset.alScenario === scenario; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    if (selector) host.querySelector(selector)?.focus({ preventScroll: true });
  }
  function mount() {
    host = document.querySelector('.al-experience');
    if (!host) return;
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-al],[data-al-step],[data-al-scenario]'); if (!b) return;
      if (b.dataset.alScenario) { stop(); scenario = b.dataset.alScenario; step = 0; paint(); return; }
      if (b.dataset.alStep !== undefined) { stop(); step = Number(b.dataset.alStep); paint(); return; }
      switch (b.dataset.al) {
        case 'play': if (playing) stop(); else { if (step === stages().length - 1) step = 0; playing = true; schedule(); } break;
        case 'reset': stop(); step = 0; break;
        case 'next': stop(); step = Math.min(step + 1, stages().length - 1); break;
        case 'speed': speed = speed === 1 ? 2 : 1; if (playing) schedule(); break;
        case 'receipt': stop(); paint(); receipt(scenario); return;
        case 'tour': stop(); tour(); return;
      }
      paint();
    });
  }
  return { overview, mount, unmount: stop };
}
