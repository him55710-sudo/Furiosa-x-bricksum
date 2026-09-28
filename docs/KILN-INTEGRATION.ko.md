# Kiln 조사 및 연결 명세

확인일: 2026-09-28. 사용자가 필수 모델을 `qwen3-32b`로 변경했다고 명시했으며, 현재 설정과 검증은 이 요구를 따릅니다. 변경 전 GPT 모델 부재 기록은 역사적 증거로 보존합니다.

## 실제 확인 결과

| 항목 | 확인 결과 | 증거 범위 |
|---|---|---|
| 로컬 인증 | 사용자 제공 키를 `.env.local`에 연결, GET /models HTTP 200 | 키는 서버 전용이며 로그에 남기지 않음 |
| 필수 모델 | qwen3-32b 목록 포함, 실제 요청·응답 모델 일치 | 자동 fallback 없음 |
| 실제 추론 | POST /chat/completions HTTP 200, propose_purchase 검증 성공 | 합성 후보 비교 1회, 결제 없음 |
| 선택 | beta-plus: 120 credits, 환불 72시간, 총액 2400 / 예산 3000 minor units | 허용 후보 중 모델이 선택 |
| 사용량 | 입력 355, 출력 405, 합계 760; cached 6 | offer_selection 흐름의 공급자 응답 |
| 비용·지연 | 공급자 보고 $0.00014156; HTTP 지연 5,951ms | 단일 관측값, 에너지 계측 아님 |
| 화면 | 열린 Kiln 단일 모델 플레이그라운드를 qwen3-32b로 선택 | 별도 GPT 활성화 필요 없음 |
| 물리 NPU·전력 | 이번 HTTP 응답에 독립 검증 가능한 라우팅·전력 자료 없음 | 모델 ID만으로 실측 NPU 에너지를 주장하지 않음 |

[실제 실행 JSON](../artifacts/kiln/9292ce67-a174-406f-9021-f5e6a7dd8837.json), 선택된 화면 (로컬 전용: `review/evidence/kiln-qwen-selected.png`).

실행 시각은 `2026-09-28T10:08:51.926Z`, generation ID는 `bb716278-1954-446d-b575-690da4999208`, 결과는 `LIVE_KILN_PROPOSAL_VALIDATED_NO_PAYMENT`입니다. 공급자 식별자와 로컬 run ID를 함께 보존합니다.

## API 연결 설정

```text
KILN_BASE_URL=https://api.bricksum.com/v1
KILN_MODEL=qwen3-32b
KILN_API_KEY=<server-side secret>
```

표준 연결은 `POST /chat/completions`와 Bearer 인증입니다. 제품 백엔드가 호출하고 브라우저에 키를 주지 않습니다. 현재 Codex 대화 모델 변경과 제품 에이전트 모델 연결은 별개입니다. [API 개요](https://kiln.bricksum.com/docs/en/api-reference), [도구 연동](https://kiln.bricksum.com/app/tools).

공식 모델 문서상 qwen3-32b의 context는 32,768이며, 자동 도구 선택은 지원하지만 forced/named tool choice·병렬 호출·structured output은 지원하지 않습니다. 실제 가용성은 인증된 모델 목록과 추론 결과로 확인합니다. [모델 문서](https://kiln.bricksum.com/docs/en/models).

## 현재 진단 스크립트

`scripts/kiln-probe.mjs`는 다음 순서로 동작합니다.

1. 키·고정 endpoint·필수 모델을 확인합니다. 누락되거나 불일치하면 중지합니다.
2. `GET /models`에 필수 모델이 없으면 `REQUIRED_MODEL_NOT_SERVED`로 중지합니다.
3. 합성 후보 중 수수료 포함 예산 초과와 비허용 판매자를 코드에서 제외합니다.
4. 적격 후보만 보내 `propose_purchase` 제안을 최대 한 번 요청합니다.
5. 응답 모델·finish reason·도구 이름·단일 호출·인자 구조·후보 ID를 검증합니다.
6. 검증된 제안, 흐름별 usage, generation ID, 명시적 결과를 JSON에 남깁니다.

이번 실행은 alpha-over-cap(3100)을 ALL_IN_BUDGET_EXCEEDED, unknown-cheap을 MERCHANT_NOT_ALLOWED로 제외했습니다. 이것을 acceptance의 독립된 위반 중지 run 2건으로 세지 않습니다. 전체 위임·누적 예산·서명·기한·중지 경합·계약·결제는 아직 제품 구현 대상입니다.

```powershell
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs --check-only
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs
node --test tests/kiln-probe.test.mjs
```

오프라인 테스트 8개를 통과했습니다. 실제 네트워크 성공과 모의 응답 검사를 구분합니다. `--verify-route`는 목록이 오래됐을 가능성을 조사하는 명시적 1회 진단 옵션이며 자동 대체나 결제를 하지 않습니다.

## 구현에 반영할 API 제약

- 설명이 있는 함수 스키마와 `tool_choice: auto`를 사용합니다. 도구 호출이 없으면 실행 권한도 없습니다.
- JSON 강제·stop·병렬 도구 설정을 권한 장벽으로 사용하지 않습니다. 서버가 parse·스키마·정책을 검사합니다.
- `finish_reason: length`는 불완전 응답으로 중지합니다. 짧은 진단은 비스트리밍, 긴 제품 요청은 SSE와 최종 usage 수집을 고려합니다.
- 이번 Qwen 요청은 `max_tokens: 1200`을 사용하며 `reasoning_effort`는 보내지 않습니다. GPT 전용 안내를 Qwen 지원으로 추정하지 않습니다. 흐름별 출력·호출 횟수 상한은 코드가 유지합니다.
- 실패 후 무제한 재시도하지 않습니다. 공급자 원문 오류 body/message 대신 허용한 오류 code만 기록해 비밀 누출을 줄입니다.

[Chat Completions](https://kiln.bricksum.com/docs/en/api-reference/chat-completions), [호환성 제한](https://kiln.bricksum.com/docs/en/migrating-from-openai).

## 사용량과 효율성

제품 기록은 session/run/flow/attempt를 연결하고 prompt/completion/total tokens, cached tokens, 실제 usage.cost, generation ID, 지연, 종료 사유를 남깁니다. 미제공 값은 0이 아니라 null입니다. reasoning을 출력 토큰에서 임의 차감하지 않습니다. 실패·재시도도 모두 집계합니다.

흐름은 intent_draft / offer_selection / negotiation / receipt_explanation / repair로 나눕니다. 현재 실제 측정은 offer_selection 한 흐름만 있습니다. 나머지는 미실행입니다. 코드 사전 검사·최종 허가·정형 영수증은 LLM 없이 수행하도록 설계합니다. 현재 한 번의 성공만으로 토큰 절감률이나 Control Memory의 우월성을 주장하지 않습니다.

`/messages/count_tokens`는 추론 없는 사전 계수에 활용할 수 있지만 도구 정의를 세지 않으므로 정확한 결산·엄격한 비용 상한으로 쓰지 않습니다. 결산은 실제 usage를 사용합니다. [Count tokens](https://kiln.bricksum.com/docs/en/api-reference/count-tokens).

NPU 라우팅은 공급자 확인, 에너지는 가능한 서버/요청 계측과 할당 방법을 출처로 남겨야 합니다. 자료가 없다면 에너지 값은 unknown이며 가정 기반 민감도 분석을 실측과 구분합니다. HTTP 지연×TDP나 다른 하드웨어의 J/token 계수를 Qwen의 NPU 에너지로 쓰지 않습니다. 서비스 효율은 같은 품질·안전성을 유지한 3-arm 실험의 요청·토큰·지연으로 별도 평가합니다.

## 변경 전 기록

gpt-oss-120b는 2026-09-28 확인 당시 출시 예정이었고 직접 요청은 `404 / model_not_found`였습니다. [과거 실행](../artifacts/kiln/73e3d971-86c4-4632-a398-057f8e95d0d8.json), [활성화 화면 조사](KILN-ACTIVATION-UI.ko.md). 사용자 모델 변경으로 해당 활성화 요청은 종료했습니다. 운영사 문의를 발송하지 않았으며 더 이상 발송 승인을 기다리지 않습니다.
