# Kiln과 NPU: 구현 전에 확인할 계약

확인일: 2026-09-28. 문서에 쓰인 지원과 계정에서 실제 검증한 지원은 구분한다.

## 우리에게 필요한 NPU 사용법

첫 경로는 **앱 → Kiln HTTPS API → 제공자가 운영하는 모델 서버/NPU**다. 우리 Windows PC에 NPU 드라이버를 설치할 필요가 없다. 직접 RNGD 장비를 운영하는 경로는 드라이버·런타임·모델 번들·서빙 설정까지 관리하는 별도 작업이다. [D01](https://kiln.bricksum.com/docs/en), [D07](https://developer.furiosa.ai/latest/en/furiosa_llm/models/gpt-oss.html)

| 경로 | 팀이 관리하는 것 | 이번 우선순위 |
|---|---|---|
| Kiln 관리형 API | 요청, 키, 오류, 응답 검증, 사용량 | 필수 |
| 자체 RNGD 서버 | 하드웨어, SDK, 모델 배치, 서빙, 계측 | 장비와 필요가 있을 때 |
| NPU 컴파일러·커널 최적화 | 연산 스케줄링·메모리 이동 | 개념 학습용 |

NPU가 유리할 수 있는 이유는 신경망 연산과 데이터 이동에 맞춘 설계다. 실제 성능은 모델·정밀도·입출력 길이·배치·동시성·소프트웨어에 영향을 받는다. Furiosa의 2025년 글은 2개 RNGD로 단일 사용자 지연을 최적화한 사례를 설명한다. 그 수치를 현재 Kiln의 속도나 전력으로 대입하지 않는다. [D08](https://furiosa.ai/blog/serving-gpt-oss-120b-at-5-8-ms-tpot-with-two-rngd-cards-compiler-optimizations-in-practice)

최신 Furiosa GPT-OSS 가이드는 `gpt-oss-120b` 사전 빌드 사용에 4개 RNGD를 안내한다. 2025년 2개 카드 데모와 목적·빌드가 다를 수 있으므로 모순을 임의로 해소하지 않는다. Kiln의 실제 장치 수는 제공자 확인 항목이다. [D07](https://developer.furiosa.ai/latest/en/furiosa_llm/models/gpt-oss.html)

## 공개 문서에서 확인한 API 계약

| 항목 | 확인 내용 | 구현 결정 |
|---|---|---|
| Base URL | `https://api.bricksum.com/v1` | 환경설정에 고정; 임의 목적지로 키 전송 금지 |
| 인증 | Kiln 키를 Bearer 헤더로 전달 | 서버 환경변수 사용 |
| 시작점 | `GET /models`, `POST /chat/completions` | 모델 존재 확인 후 추론 |
| 추적 | `X-Neocloud-Generation-Id` | 내부 `run_id`와 연결 |
| 오류 | HTTP 상태·오류 코드별 분기 | 인증/모델/입력 오류를 무한 재시도하지 않기 |

근거: [D01](https://kiln.bricksum.com/docs/en), [D06](https://kiln.bricksum.com/docs/en/api-reference).

### 현재 가용성 충돌

[D02 모델 표](https://kiln.bricksum.com/docs/en/models)는 `gpt-oss-120b`를 coming soon으로, 같은 페이지의 과거 staging 샘플은 호출 가능 모델로 표시한다. 표의 다른 가용 모델이 대회 지정 모델을 대체해도 된다는 뜻은 아니다. 예전 대화에서 나온 `$0.015 / $0.085 per 1M tokens`는 이번 조사에서 현재 적용 가격으로 검증하지 못했으므로 예산에 사용하지 않는다.

**완료 기준:** 대회용 계정에서 모델 ID가 보이고, 실제 응답 `model`이 지정 모델이며, 사용량과 응답이 기록된 경우. 이 문서는 그 호출을 수행했다고 주장하지 않는다.

### 응답 처리 시 주의할 점

- `response_format`의 JSON 모드는 문서상 지원되지 않는다. 요청이 200이어도 content가 비어 있을 수 있다.
- 강제 tool 선택·병렬 tool 호출은 모델별로 다르다. `auto`로 시작하고 실제 동작을 확인한다.
- 함수에는 설명을 넣는다. 모델의 tool 인자는 신뢰하지 않고 서버에서 검증한다.
- 출력 한도에 도달한 `finish_reason=length`는 완성된 거래 제안으로 취급하지 않는다.
- `stop`에 실행 중지를 맡기지 않는다. 중지는 백엔드 상태로 강제한다.

근거: [D04](https://kiln.bricksum.com/docs/en/migrating-from-openai). 구체적 필드와 반환 형태는 [D03](https://kiln.bricksum.com/docs/en/api-reference/chat-completions) 및 로컬 보관본을 확인한다.

## 호출 흐름 제안

```text
서버 환경의 키 확인(값은 출력하지 않음)
→ 모델 목록에서 gpt-oss-120b 확인
→ 허용된 견적만 짧은 구조화 데이터로 전달
→ AI에게 후보 선택과 짧은 근거를 요청
→ 응답 완결성 / 함수 이름 / JSON / 타입 검증
→ 견적 ID를 서버 원본에서 재조회
→ 금액·주소·정책을 코드로 재검사
→ 허용된 경우에만 실행 단계로 전달
```

초기에는 AI의 역할을 `quote_id` 선택으로 제한하면 주소와 가격을 모델이 새로 만들어내는 위험을 줄이기 쉽다. 설명문은 사용자 이해를 돕지만 승인 증거로 사용하지 않는다. 잘못된 JSON은 `MODEL_OUTPUT_INVALID`로 기록하고, 교정 호출 허용 횟수·토큰 한도를 사전에 정한다. 이는 연구를 참고한 구현 제안이다.

## 사용량 기록

각 호출마다 `run_id, flow, attempt, model, started_at, latency_ms, generation_id, prompt_tokens, completion_tokens, total_tokens, cached_tokens?, reasoning_tokens?, cost_usd?, finish_reason, outcome`을 남긴다.

`flow`는 `intent`, `compare`, `negotiate`, `explain`처럼 구분한다. 선택적인 usage 필드가 없으면 `null`로 두고 0으로 해석하지 않는다. reasoning 토큰은 completion에 포함되므로 합계에 한 번 더 더하지 않는다. 스트림에서는 최종 usage를 끝까지 수집한다. 연결을 끊어도 서버가 생성을 계속하고 과금할 수 있다. [D05](https://kiln.bricksum.com/docs/en/usage-billing)

## 효율을 정직하게 측정하는 방법

**직접 관측:** 요청 수, 단계별 입력·출력 토큰, 성공/차단율, 지연, 실제 API 비용. **별도 계측 필요:** NPU 전력, 서버 전체 전력, 공유 서버의 요청별 에너지 배분.

Prefill은 입력 문맥을 처리하는 단계이고 decode는 출력을 차례로 만드는 단계다. KV cache는 모델 내부 계산 상태다. 구매 기록을 저장하는 Control Memory와 다른 개념이다. 메모리 관리와 요청 묶음이 처리량에 영향을 준다는 배경은 [P04](https://arxiv.org/abs/2309.06180)에 있다.

논문 [P03](https://aclanthology.org/2025.acl-long.1563/)은 작업 형태·하드웨어·서빙 설정에 따라 에너지 최적화 결과가 달라짐을 보여준다. 우리 실험에서는 동일한 업무·품질·허용 조건을 유지하고 A/B를 비교한다.

```text
토큰 감소율 = 1 - 최적화 실행의 토큰 / 기준 실행의 토큰
장치 에너지(J) = 측정 구간에서 전력(W)을 시간(s)에 대해 적분
Wh = J / 3600
```

장치 계측이 없을 때 가정 기반 추정은 `E_est = input_tokens × e_input + output_tokens × e_output`처럼 둘 수 있지만, 계수의 출처·장치·길이·배치 조건과 범위를 함께 공개해야 한다. 같은 조건에서 얻은 계수가 없으면 수치 산출을 유보한다. `TDP × API 응답 시간`은 공유 서버의 요청별 에너지 측정이 아니다.

최적화 후보는 전체 대화 대신 승인된 상태 요약 보내기, 확정된 무효 견적을 AI 호출 전 차단하기, 협상 회수 제한, 영수증의 기계적 항목을 코드로 생성하기다. 통제 검사를 생략해서 절감하지 않는다. `low` reasoning이 항상 더 효율적인지는 실패·재시도까지 포함해 비교한다.
