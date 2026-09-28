# Qwen Agent Safety Harness

**정상·모호·적대적 판매자를 상대로 Kiln Qwen3-32B의 도구 사용과 위험 선택을 측정하고, 제품의 금융 정책이 이를 어떻게 차단하는지 재현하는 평가 시스템입니다.**

최신 기획 대화의 중심은 `Intelligence → Safety → Evaluation`입니다. 판매자는 시험 환경이며 모델 정확도와 시스템 안전성을 따로 보고합니다. 이 모듈은 기존 구매 콘솔과 정책을 이용한 별도 평가 도구입니다. 제품 `src/`나 다른 세션의 구현을 교체하지 않습니다.

처음 읽기: [기획과 설계](PLAN.ko.md) → [실제 345회 호출 결과와 한계](RESULTS.ko.md) → [완료 검사](COMPLETION-AUDIT.ko.md). 원본·보정본·대시보드 링크는 결과 문서에 있습니다.

## 실행

저장소 루트, Node 24 이상과 기존 `pnpm install` 환경을 사용합니다.

```powershell
node --test harness/tests/*.test.mjs
# 외부 API 0회: 100개 조건 × B0/B1/CM, 합성 위험 행동으로 정책 검증
node harness/run.mjs --count=100
# 실제 Kiln: 서버 환경의 기존 키 사용, 모델 자동 교체 없음
node --env-file-if-exists=.env.local harness/run.mjs --live --count=100 --concurrency=3 --max-calls=800 --seller-repeats=2
# <run>은 실행 출력 또는 artifacts/latest-live.json의 id
node harness/verify.mjs harness/artifacts/<run>/report.json
node harness/analyze.mjs harness/artifacts/<run>/report.json
node harness/verify.mjs harness/artifacts/<run>/analysis-v3.json
node harness/render.mjs harness/artifacts/<run>/analysis-v3.json
node harness/review-analysis.mjs harness/artifacts/<run>/analysis-v3.json
```

`dashboard.html`을 열면 비교군·시나리오·결과를 필터링하고 각 거래의 도구 선택, 토큰·지연, 서명 견적과 차단 사건을 볼 수 있습니다. 브라우저는 외부 API를 호출하지 않으며 키가 필요 없습니다.

v1/v2 실행 결과에는 [채점 보정](SCORING-CORRECTION.ko.md)을 적용한 `analysis-v3.json`을 권장합니다. 선택 후 판매자의 조건 변경을 모델 위험 수락에서 분리합니다. 원본을 덮어쓰거나 모델을 다시 호출하지 않습니다. 같은 디렉터리에서 renderer는 마지막으로 지정한 자료의 화면을 저장하므로 보정본을 마지막으로 렌더링하세요.

## 구현 범위

| 최신 기획 요구 | 구현 |
|---|---|
| Buyer Agent의 실제 tool runtime | `request_offer / counter_offer / accept_offer / reject_offer`, 최대 5턴 |
| 판매자 테스트베드 | 결정론적 10종 × 가격 변형, Qwen 판매자 negotiator/aggressive/ambiguous |
| 금융 경계 | 서명 Offer ID만 수락, 제품 `checkOffer / reserve`, 변경된 견적 무효화 |
| Control Memory 비교 | B0/B1/CM, 실제 `deriveControl`, 동일 서명 실패로 고정된 과거 규칙 |
| 스트리밍/효율 | SSE 분할 파싱, TTFT/첫 도구/latency/queue, 흐름별 tokens/calls |
| 동시 추론 | 3판매자 직렬·병렬 생성, 같은 rate window에서 비교 |
| 재현 | 호출 전 manifest, 불변 코드 사본, 원문 입력/응답, 서명/이벤트 해시, 독립 파일 검사 |
| 사람의 결과 확인 | 별도 HTML 평가 화면, 거래별 기록과 오류 표시 |

## 결과 해석

`LIVE_KILN`과 `SCRIPTED_ADVERSARY`를 합치지 않습니다. 모의 승인은 실제 결제와 다릅니다. 기존 콘솔의 실제 devnet 결제와 검증은 [제품 acceptance](../artifacts/demo/acceptance.json)에 있습니다. 하네스는 결제 어댑터가 없고 온체인 거래 0건입니다.

`EVALUATION_COMPLETE`는 실행·계측 완결성을 뜻하며 모든 모델 선택이 옳았다는 뜻이 아닙니다. `EVALUATION_WITH_INCOMPLETE_RUNS`는 API/자원/판매자 생성 실패가 남은 결과입니다. 잘못된 도구 호출과 정상 거래 거절은 별도로 노출합니다. API 실패를 안전한 해결로 세지 않습니다.

100개 case는 10종의 작은 가격 변형입니다. 독립적인 실제 고객 100명을 뜻하지 않습니다. 실제 사용자·장기 드리프트·모든 공격 종류의 안전성은 검증하지 않았습니다. 모형 비교의 호출 감소는 거래 성공·과잉 차단과 함께 해석해야 합니다.

메모리 학습은 합성 과거 서명 실패이며 추론 비용은 0회입니다. 기존 제품 실험의 실제 학습 비용과 혼동하지 않습니다. 전력, 물리 NPU routing, prefix cache hit을 실측했다는 주장을 하지 않습니다. [실행 전 프로토콜과 교정 이력](PROTOCOL.ko.md)에 가정과 한계를 기록했습니다.

## 기획 판단

기본 제품 가치는 승인 범위 강제와 거래 재구성입니다. Control Memory는 반복 실패의 조기 차단이라는 추가 기능이고, Harness는 그 효과·부작용·모델 실패를 검증하는 핵심 기능입니다. Seller AI가 많이 호출됐다는 사실을 상품 차별점으로 삼지 않습니다. 추론은 협상과 도구 선택에, 산술·예산·서명·예약은 결정론적 코드에 둡니다.
