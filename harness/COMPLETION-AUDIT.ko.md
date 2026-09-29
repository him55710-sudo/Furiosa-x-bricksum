# 구현과 완료 확인

2026-09-28 21:23 KST 기준. ‘해커톤 규칙 정리’의 최근 6개 턴을 근거로 기획하고 별도 Qwen 평가 하네스를 구현했다. 원본 실험을 동결한 뒤 분석·화면을 완성했다. 아래는 구현 완료 확인이며 모든 모델의 성공 또는 실서비스 안전 인증을 뜻하지 않는다.

| 요구 | 완료 증거 |
|---|---|
| 가장 최근 기획 반영 | [설계](PLAN.ko.md): Intelligence / Safety / Evaluation, 판매자는 시험 상대, 모델과 시스템 오류 분리 |
| Qwen3-32B 실제 도구 호출 | `transport.mjs`, `tools.mjs`, `runtime.mjs`; 최종 실제 API 345회·응답 모델 확인 |
| 4개 Buyer 도구 | request_offer / counter_offer / accept_offer / reject_offer, 엄격한 인자 검증과 최대 5턴 |
| 정상·적대·불안정 시나리오 | `cases.mjs`: 10유형×가격변형100, 3군300행, 독립 fixture oracle |
| 결정론적 금융 통제 | 제품 checkOffer/reserve/deriveControl 공유, 권한 변경·금액 초과·구형 견적 차단 |
| B0/B1/CM 효과·마찰 비교 | [실제 결과](RESULTS.ko.md): 호출·입출력 토큰·정상 실패·위험 수락·정책 차단, 짝 비교 |
| 스트리밍 성능·예산 | SSE 조각·UTF8·usage 처리, TTFT/첫 도구/latency/queue, 호출·출력 상한, 429·quota 처리 |
| LLM 판매자와 병렬 실행 | 3종×4배치 실제 호출. 형식 실패 4/12 공개; 유효3판매자 완성은 0/4로 제한 명시 |
| 검토 가능한 결과 | HTML 312행, 군/유형/검색 필터, 실패 상세·서명 견적·이벤트 열람 |
| Grok와 계속 개선 | [검토 기록](GROK-REVIEW.ko.md): H1/H2/H3 검증, 결측·층별·실패 원인 분석 추가 |
| 재현 가능한 근거 | 원본 report + manifest/source, analysis-v3 및 부모/분석 코드 해시, review-analysis |

## 이번 턴의 실행 검증

- `node --test harness/tests/*.test.mjs`: **13/13 PASS**. 위험 행동 300행, 잘못된 도구, 스트림 분할·중단, 누락 usage, 모델 교체 금지, 요청 상한, rate limit·회로 차단 등을 확인.
- `node --test tests/*.test.mjs`: **30/30 PASS**. 최종 시점에 다른 세션의 quote accounting 테스트 5개까지 포함. Ganache Windows native µWS 경고 뒤 JS fallback으로 정상 완료.
- 원본 `report.json`과 보정 `analysis-v3.json` 각각 `harness/verify.mjs`: **PASS**. 소스 해시15·서명664·이벤트1515·실제 모델 응답345개·집계 일관성 확인.
- 현재 소스의 오프라인 300행: `2026-09-28T12-09-53-308Z-offline`, **PASS**, 모델 API 0회, 강제 위험 행동의 권한 밖 승인 0.
- 기존 실제 devnet 영수증 `reformed-28ef3bae.json`: 별도 프로세스 재검증 **VALID / PAYMENT_WITHIN_SIGNED_APPROVAL**. 제공된 통제 기록의 발생·완전성 및 역사적 예약 잔액은 미검증이라는 반환 범위를 그대로 유지.
- 브라우저에서 최종 345회 실행 ID·v3 수치 확인. llm-sellers + INVALID_ACTION 필터로 실패 1행 확인, 기록 상세 열기·닫기 확인. 콘솔 error/warn 0. [화면 증거](artifacts/2026-09-28T12-00-31-606Z-live/dashboard-proof.png).

## 남아 있는 측정상 한계

LLM 판매자 형식 오류와 정상 구매 실패는 제거할 버그 증거 또는 후속 품질 개선 대상이다. 실패를 남기는 평가 시스템은 작동했으며, 전체 실험 상태를 완료 성공으로 바꾸지 않았다. 해당 실패를 모두 없애는 모델 품질 목표는 이번 구현 완료 판정과 구분한다.

모든 거래는 하네스에서 모의 승인이다. 실제 결제 연결, NPU 전력·물리 routing·cache 계측, 다중 사용자 인증·실자산 운영을 구현했다고 주장하지 않는다. 최종 제품 Engine과 하네스 runtime의 도구 수·상태 기계가 다르다는 경계를 설계와 결과 문서에 명시했다.

보고 서버는 `node harness/serve-report.mjs harness/artifacts/2026-09-28T12-00-31-606Z-live`로 다시 열 수 있다. HTML은 서버 없이 파일로 열어도 동작한다. 다른 세션의 제품 소스·서버는 이 하네스 작업이 수정하거나 교체하지 않았다.
