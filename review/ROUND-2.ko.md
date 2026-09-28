# Grok Bot Round 2 — 재검토와 최종 설계 판정

2026-09-28 수신. 봇 대화 (팀 계정의 로컬 Bot), 두 차례 대화의 UI 원문 (로컬 전용: `review/evidence/grok-two-rounds.ax.txt`), 저장된 봇 설정 (로컬 전용: `review/evidence/grok-bot-settings.png`). 원문은 접근성 트리에서 보존했으며 UI 라벨도 포함합니다. 아래는 구현자의 판단입니다.

Grok은 필수 모델 부재가 ‘0점’이라는 단정, seed/temperature의 결정성, 다른 scope를 일반화 holdout으로 취급한 점, 더 높은 nonce로 replacement를 판정한다는 조언을 철회·정정했습니다. 테스트넷 revert를 대회 필수 조건으로 추가하는 제안도 철회했습니다. 외부 모델의 동의는 검증 증거가 아닙니다.

| Finding | Grok 재판정 | 우리 처리 | 남은 검증 |
|---|---|---|---|
| R1-01 | still_open | 필수 모델과 NPU 라우팅은 외부 의존성 | 실제 해당 모델 추론 응답·사용량·운영사 근거 |
| R1-02/03 | resolved_by_design | 3-arm, holdout, 무효 가설, 비용 집계 반영 | 실제 공정한 반복 비교 |
| R1-04 | resolved_by_design | 현재 승인/새 견적, 통제 lifecycle, 과잉 차단 반영 | 개선 견적·협상 후 확정 fixture |
| R1-05 | resolved_by_design | 서로 다른 위반과 격리 계약 harness | 2개 STOPPED run, 성공한 chain receipt |
| R1-06 | resolved_by_design | ‘서명된 offer와 승인·체인 결과의 일관성’으로 주장 범위 명시 | signer manifest·변조·독립 재현 |
| R1-07 | still_open | U1 선호와 공격/정상 쌍을 사전등록 초안에 추가 | 선택 품질을 실제 비교하기 전까지 결과 미확인 |
| R1-08 | resolved_by_design | 원자적 중지·SUBMISSION_STARTED 및 동일 nonce 효과 검증 | crash/RPC 유실/경합 주입 |

## 새 반례의 수용 범위

| ID | 제안 | 판정과 반영 |
|---|---|---|
| N-01 | 모델이 purpose를 재분류하여 기억 범위를 우회 | ACCEPT. 사람이 고정 enum과 조건을 승인하고 hash에 결합. 모델은 scope를 바꿀 수 없음. A1 주입 fixture |
| N-02 | 로컬 harness와 실제 배포 계약이 다를 수 있음 | PARTIAL. 동일 artifact·빌드 manifest·실측 runtime 대조 수용. 체인별 constructor/immutable/library 주소 때문에 raw hash가 다를 수 있으므로 무조건 같은 hash/인자 요구는 기각. 예상 bytecode와 배포별 환경 차이를 검증 |
| N-03 | 사람 개입 비용을 빼면 효율을 과장 | ACCEPT. REVIEW_REQUIRED·개입 횟수·측정 가능한 사람 시간 포함. 토큰 절약이 사용자의 추가 노동을 가린 결과인지 공개 |

## 실험표에서 그대로 채택하지 않은 부분

- B0의 ‘최종 견적 비용 0’은 잘못된 집계입니다. 모든 arm의 최종 견적 요청과 재요청도 계산합니다.
- 유료 견적을 쓰면 그 호출 자체도 위임 예산을 소비합니다. 추가 결제 흐름을 키우지 않도록 현재 초안은 무료 견적과 합성 지연 조건을 비교하며, 합성 결과를 실제 시장 근거로 쓰지 않습니다.
- ‘반복 간 분산보다 차이가 크다’만으로 통계적 우월성을 선언하지 않습니다. 작은 표본은 원시 값과 품질·비용의 tradeoff를 공개합니다.
- 통제 생성마다 새 승인이 필요한 것은 아닙니다. 위임에 특정한 제한 규칙의 자동 생성을 사전 승인했다면 그 범위 안에서 파생할 수 있고, 권한 확대/통제 해제에는 새 승인이 필요합니다.

수정 결과: [아키텍처](../docs/ARCHITECTURE.ko.md), [실험 프로토콜](../docs/EXPERIMENT-PROTOCOL.ko.md), [연구→테스트 연결](RESEARCH-TO-TESTS.ko.md). 같은 주제의 2회 리뷰를 마쳤으며, 다음 리뷰는 실제 정책/계약 코드 또는 새 실행 증거가 생겼을 때 진행합니다.

최종 기준선도 봇에 전달했고, 봇은 F2의 B0 비용 누락 및 raw bytecode 동일성 조건을 자신의 오류로 인정했습니다. 수신 확인 원문 (로컬 전용: `review/evidence/grok-baseline-ack.ax.txt`), 완료 화면 (로컬 전용: `review/evidence/grok-review-completed.png`). 이 확인은 세 번째 비판 라운드가 아니며 새로운 구현 검증을 의미하지 않습니다.
