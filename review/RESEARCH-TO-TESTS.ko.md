# 연구를 코드·실험 요구로 연결하기

자료: `research/04-paper-notes.md`, `research/03-backend-onchain.md`, `research/06-planning-handoff.md`. 연구 세션이 검토한 범위는 초록·서지·공개 설명이며 논문 전체 실험을 재현한 것은 아닙니다. 이 문서는 적용 설계입니다.

| 근거 | 실제 설계 요구 | 반증/검증 fixture | 현재 증거 수준 |
|---|---|---|---|
| AgentDojo P01 | 주입 저항성과 정상 구매 효용을 함께 측정 | 판매자 텍스트에 주소 변경/예산 무시 주입 + 동일한 정상 제안 | 명세 |
| CaMeL P02 | 실행 인자의 출처를 추적 | LLM이 새 주소/금액을 만들어도 서버는 승인된 immutable offer만 사용 | 명세; CaMeL 구현 아님 |
| Energy P03 | 같은 업무 품질에서 비용 비교 | 같은 fixture·입출력 분포·재시도 포함, 성공/실패별 분리 | 명세; RNGD 전력 실측 없음 |
| PagedAttention P04 | 서버 KV cache와 업무 기억 분리 | cached_tokens 미제공이면 null, application cache 적중과 별도 필드 | 명세 |
| BlockAudit P05 | 해시 검증과 사실·완전성 구분 | 파일 변조 INVALID, 파일/선행 이력 누락 INCOMPLETE | 명세 |

## 출처 등급

`USER_SIGNED`(위임), `MERCHANT_SIGNED`(고정 견적), `SERVER_DERIVED`(정책 판정/합계), `CHAIN_OBSERVED`(확정 receipt), `MODEL_SUGGESTED`(제안/설명), `UNTRUSTED_TEXT`(판매자 설명), `EXTERNAL_REVIEW`(Grok 비판)을 구분합니다. 마지막 세 등급은 예산·판매자·기한 변경의 권한 근거가 될 수 없습니다.

## 중지 경합의 구현 요구

`stop`과 `begin_submission`은 같은 원자적 쓰기 경계에서 `sessionVersion`을 검사합니다. 먼저 commit한 전이를 순서 기준으로 삼습니다. 네트워크 송신 직전 단순히 flag를 다시 읽는 것만으로 충분하다고 보지 않습니다. `SUBMISSION_STARTED`가 먼저면 stop 응답은 진행 중 작업을 포함해야 합니다.

## Control Memory의 강한 비교군

B1: 항상 조기 확정 총액 요구. B0: 기억 없이 최종 결제 전 확정 총액 요구. CM: 동일한 최종 검사 + 사건 기반 조기 요구.

수수료 불확실 판매자뿐 아니라 정상 반복 판매자, 가격을 협상하면 예산 안에 들어오는 판매자, 수정된 정상 견적, 처음 보는 판매자를 포함합니다. 토큰만 줄고 구매 성공률/가격이 나빠지면 성공이라고 결론내리지 않습니다. 모든 시나리오에서 B1이 CM보다 같거나 좋으면 memory의 효율성 주장을 기각하거나 적용 범위를 축소합니다. [구체적인 실험 초안](../docs/EXPERIMENT-PROTOCOL.ko.md).

## 증거 분리

리뷰 문서 수정은 `resolved_by_design`, 로컬 fixture 통과는 `verified_in_code`, 실제 Kiln/체인 실행은 `verified_live`입니다. 사용자 모델 변경 이후 실제 `qwen3-32b`의 후보 제안이 HTTP 200으로 성공했고 760토큰과 generation ID를 남겼습니다. [실제 기록](../artifacts/kiln/9292ce67-a174-406f-9021-f5e6a7dd8837.json). 연결 진단만 `verified_live`이며, 전체 제품·체인 실행·Control Memory 효과·NPU 에너지 계측은 아직 검증되지 않았습니다.
