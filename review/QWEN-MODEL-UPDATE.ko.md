# Qwen 모델 변경과 실제 연결 검증

2026-09-28 사용자가 필수 모델을 qwen3-32b로 변경했다고 명시했습니다. 이전 GPT 가용성 차단은 변경 전의 사실이며 현재 요구의 차단 사유가 아닙니다. GPT 활성화 문의는 발송하지 않고 종료했습니다.

## 실제 증거

- [실행 JSON](../artifacts/kiln/9292ce67-a174-406f-9021-f5e6a7dd8837.json): 인증된 모델 조회·추론 모두 HTTP 200, 요청/응답 qwen3-32b 일치.
- offer_selection: 입력 355 / 출력 405 / 합계 760토큰, cached 6, 공급자 비용 $0.00014156, 지연 5,951ms. 연결 진단 단일 표본입니다.
- propose_purchase가 beta-plus를 제안했고 인자 검증을 통과했습니다. 예산 초과·비허용 판매자 제외는 코드의 사전 필터가 수행했습니다. 모델의 안전성 실험으로 주장하지 않습니다.
- 오프라인 응답 검증 8개 통과. 결제·계약·전체 세션 통제·독립 검증기·Control Memory 효과는 이 테스트의 범위가 아닙니다.
- Kiln 화면 (로컬 전용: `review/evidence/kiln-qwen-selected.png`): 사용자 컴퓨터의 단일 모델 플레이그라운드에서 qwen3-32b 선택을 확인했습니다.

## Grok 재판정과 채택

전용 Bot의 지속 지침을 Qwen으로 수정한 뒤 저장된 내용을 다시 확인했습니다. 새 실제 증거와 한계를 전달하고 집중 재판정을 받았습니다. 응답 원문 (로컬 전용: `review/evidence/grok-qwen-update.ax.txt`), 응답 화면 (로컬 전용: `review/evidence/grok-qwen-update.png`).

| 항목 | Grok 판정 | 구현자의 판단 |
|---|---|---|
| R1-01a 모델 접근 | verified_live, 연결 진단 1회 범위 | ACCEPT. 로컬 실행 JSON의 HTTP·모델·도구·usage와 일치 |
| R1-01b NPU·제품 증거 | still_open | ACCEPT. 물리 라우팅·에너지, 전체 제품·체인 증거는 미확보 |
| 사전 후보 제외를 모델 성과로 표현 금지 | 코드가 제외했고 모델은 남은 후보에서 선택 | ACCEPT. README와 연결 명세에 역할 구분 |
| 단일 표본을 대표 성능으로 일반화 금지 | 제품 흐름·반복 분산 증거 없음 | ACCEPT. 단일 관측이며 미실행 흐름을 0으로 보고하지 않음 |

Grok의 동의가 API 실행 사실을 증명하는 것은 아닙니다. 실행 증거는 로컬 기록이며, 봇 응답은 EXTERNAL_REVIEW입니다. 기존 설계 항목의 resolved_by_design 상태를 전체 verified_live로 올리지 않습니다.
