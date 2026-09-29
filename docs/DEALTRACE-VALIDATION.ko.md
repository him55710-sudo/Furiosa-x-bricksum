# DealTrace 검증 결과

2026-09-29. 실제 공개 실행 `34d1da0d-e842-4f44-acfd-4d97728c81f0`. 고객 실증과 작성된 상황 검증을 구별한다.

| 검증 | 관측 |
|---|---|
| 자동 전체 검사 | 129/129 PASS |
| 실제 Kiln + Sepolia workflow | 17/17 PASS, 10 calls, 12,073 tokens |
| 공개 거래 | 예치 2 + 지급 1 + 환불 1 |
| 독립 finalized 영수증 | 5/5 VALID; PASS |
| 완료 run 재개 | 같은 네 hash, controller nonce 14 유지, 추가 추론/거래 없음 |
| 별도 표현 시험 | 작성된 8개: Qwen 7/8, 규칙 baseline 8/8 |
| 실제 고객 / 외부 조직 / 초면 사용자 연구 | 수행하지 않음 |

## Kiln 흐름별 실측

| 흐름 | 호출 | 입력 토큰 | 출력 토큰 | API 지연 ms |
|---|---:|---:|---:|---:|
| Conversation / seller-a | 2 | 954 | 164 | 3328 |
| Semantics / conversation to terms | 5 | 5910 | 3259 | 47871 |
| Conversation / buyer-agent | 2 | 1079 | 121 | 2520 |
| Conversation / seller-b | 1 | 402 | 184 | 3053 |

승인된 고정 첫 문장, 서명·예산·청구·검수·정산·영수증 검증은 모델을 호출하지 않는다. 전체 transcript를 매번 의미 추출에 넣지 않고 새 메시지와 제한된 상태만 처리한다. 총 호출은 10회로 제한한다. 전체 transcript 전략과의 절감률은 별도 대조 실험하지 않았으므로 수치로 주장하지 않는다.

NPU 전력 실측 없음. API 지연 합계 56.772초 × 귀속 전력 가정 25/50/100 W = 0.39425/0.7885/1.577 Wh. 네트워크·큐 시간이 포함되고 실제 장비 전력·공유·배치율은 모른다. GPU 대비 우위의 증거가 아니다.

## 실패도 보존

표현 시험 `8f7313ad-ed12-4b79-9a3f-25e1e647f09d`는 12,137토큰을 사용했다. 연간 전망치 사례는 KILN_INVALID_TOOL로 실패했고, 모호한 가격은 안전하게 중단했다. 이 8개는 작성된 소규모 사례로 일반화 성능이나 blind benchmark가 아니다. 같은 고정 범위에서는 규칙 baseline이 더 잘했다.

초기 로컬 `0a1fd36b-99a6-4053-900e-2bd714cf4eb5`는 eager model 초기화의 KILN_MODEL_REQUIRED 오류로 API/거래 전에 실패했다. lazy 초기화로 수정한 후 성공했고 실패 기록도 남겼다. public 첫 finalized 확인은 CHAIN_FINALITY_PENDING이었으며 별도 observation을 남겼다.

## 의미 있는 공격 검사

31 청구, 잘못된 수령인/자산/납품 hash, 재사용 claim ID, forged signature, 청구 없는 정상 납품, legacy API를 통한 bilateral/profile 우회, stale revision, 변조된 메시지, 동일 지급 반복, 예산 동시 예약, revoked/expired mandate, 거래 후 정책 유지, 복구·reorg 검사를 포함한다.

Browser QA는 실제 UI 조작으로 승인 없는 실행 차단, 승인 실행, 중지 후 0 API/0 funding, 원문 연결, 4행 결과 다운로드, 원본과 바이트가 같은 영수증 다운로드, 375px 화면과 console 오류를 확인했다. 자동 조작이므로 사람 이해도 연구로 세지 않는다.

공개 실행 후 바뀐 것은 새 run 준비 중 이전 기록임을 명시하는 UI 문구 하나다. `post-run-ui-change.json`에 원본 byte와 두 해시를 보존했다. 금융·에이전트·검증기 소스는 동일하며 최종 소스로 전체 129 검사를 다시 통과했다.
