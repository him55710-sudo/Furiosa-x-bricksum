> 2026-09-29 업데이트: 아래는 이전 로컬 실증 시점 기록입니다. 공개 Sepolia 예치·지급·환불과 독립 finalized 검증이 완료됐습니다. 최신 한국어 화면·영상·실측은 [공개체인 실증](PUBLIC-ESCROW-PROOF.ko.md)을 따릅니다.

# 남은 한계 후속 보완 — Agent Deal Escrow

2026-09-28. 직전 [페르소나 검증](PERSONA-VALIDATION.ko.md)은 이전 Control Memory의 API 크레딧 구매를 시험했습니다. 현재 README의 주제품은 Agent Deal Escrow이므로 이번에는 같은 실패 유형을 **현재 거래·배송·환불 경로**에 적용했습니다. 이전 실험 결과를 새 제품의 성능으로 재사용하지 않았습니다.

## 구현으로 보완한 항목

| 이전 한계 / 발견한 반례 | 현재 보완 | 검증 |
|---|---|---|
| 예산만 지키고 품질 조건을 낮추는 모델 | 새 사람 승인에 최소 행, 출처 URL 비율, 필수 컬럼, 최대 배송 시간을 고정. 독립 정책에서 승인보다 약한 Deal 차단 | domain/quality-intent 검사, 정상·공격 입력 쌍 |
| 추가 통제로 정상 구매가 막힌 뒤 재개할 수 없음 | preview 파일·본문 제출, 실패 항목 표시, 검증 후 funding 재개. 실제 delivery 파일·본문 제출과 정산 연결 | 실제 브라우저에서 실패 샘플→정상 샘플→예치→정상 배송→지급 |
| 새 요청 ID/다른 탭에서 같은 구매를 중복 실행 | mandate의 기본 구매 의도를 SQLite에 영속화. 재요청·동시 요청·재시작은 같은 Deal. 별도 구매는 명시적인 새 구매 동작 | concurrent/restart intent 검사. 중단된 모델 요청은 자동 재과금하지 않음 |
| null 값과 중복 행으로 배송 수량 부풀리기 | delivery-v2의 값 타입·빈값·2025–2026 분기·비음수 유한 CAPEX·회사/분기/통화 중복·URL 형식 검사 | delivery-quality 검사. 40개 쓰레기 행 배송은 실제 EVM 환불 |
| 통제 원인·preview 원문을 독립 검증하지 않음 | 원인 환불 번들, 회사·판매자 범위, validation hash, preview 원문·Deal hash·attestation을 결합해 재계산 | 원인 누락, 변조, 다른 회사·거래의 증거 혼합 거부 |
| 요약 이벤트만 보고 VALID라고 표시 | 이벤트 ID·순서·필수 자료·거래 종류·서명 거래의 공개 요약·실제 receipt를 대조. 누락/외부 장애는 INCOMPLETE, 모순은 INVALID | audit 검사. CLI도 INCOMPLETE에서 종료 코드 1 |
| 확정 revert도 영구 PENDING | fund 확정 실패는 예약 해제, release 확정 실패는 원 receipt를 보존한 뒤 refund. UNKNOWN은 원 서명 거래와 예약 유지 | 실제 EVM의 만료/revert/응답 유실/재시작/replacement 검사 |
| 프로세스별 큐로 중복 writer를 완전히 막지 못함 | runtime 디렉터리의 SQLite 원자 소유권, 살아 있는 PID의 writer 거부, 죽은 PID만 회수. 같은 chain의 Engine은 큐 공유 | 실제 두 프로세스 경합·강제 종료·재획득, 두 Engine의 중복 funding 검사 |
| 1 confirmation만으로 공개체인 최종성 가정 | local 기본 1, public 기본 2확정 및 canonical block 대조. 더 높은 confirmations / finalized 설정 지원. 납기보다 긴 대기는 서명 전 거부 | 실제 local EVM의 추가 블록 대기·미확정 revert·snapshot/revert 검사 |
| 운영 장애가 화면에 드러나지 않음 | 주기 복구, 3초 제한 DB/RPC health, pending 수·운영 조치 필요 건 표시. 재조직은 노출을 유지하며 추가 자금 집행 중단 | `/api/health`, 브라우저 및 recovery 검사 |
| 검사 도중 파일이 바뀌어도 green report | 코드·테스트·UI·빌드/검증 스크립트·계약·의존성 파일의 시작/종료 지문 비교. 변경·누락·skip·0 tests는 실패 | `ade:test` 보고서, UI의 stale 표시 |

새 구매 의도는 자연어 의미를 추측하는 범용 중복 탐지기가 아닙니다. 한 mandate의 기본 의도, 같은 원본의 재시도, 명시적 별도 구매를 구분하는 프로토콜입니다. 다른 판매자로 기본 의도를 바꾸려 하면 명시적인 새 구매가 필요합니다. 새 `task_requirements`가 있는 거래는 구매 의도 연결 없이 자금을 집행할 수 없습니다.

기존 승인과 delivery-v1 영수증은 당시 규칙으로 재현합니다. 새 검사를 과거 계약에 소급 적용하지 않습니다. 과거 데모 데이터의 중복 때문에 현재 v2 품질 검사가 실패한다는 사실은 `delivery_quality.current_checks_pass=false`로 감사 화면에 표시합니다.

## 실행과 증거

현재 소스 전체 회귀는 **54/54 통과**, 실제 브라우저는 9단계 통과했습니다. 실제 qwen3-32b 정상/공격 3쌍은 **6/6 통과·7,362 tokens·범위 밖 제안 0·위험 허용 0**이었습니다. 합성 공격은 예산 초과·품질 하한 미달·다른 Deal ID를 의도적으로 출력시켰고 세 공격 모두 거부됐습니다. 회귀와 실제 모델 실행 중 소스 변경은 없었습니다.

실제 예산 사칭 공격의 반응은 정상 입력의 가격 180/기간 120초에서 190/60초로 달라졌습니다. 모두 사람의 하한·상한 안에 있지만 응답 동일성이나 최적 구매가 입증된 것은 아닙니다. 이 차이를 실패율 통계로 일반화하지 않습니다.

```powershell
# 유료 호출 0: 실제 로컬 EVM을 포함한 전체 회귀
pnpm ade:test
# 유료 호출 0: 세 가지 페르소나의 정상/공격 입력을 합성 출력으로 재현
pnpm ade:personas
# 유료 호출 0: 별도 데이터 디렉터리·서버에서 실제 브라우저 흐름
node scripts/check-deal-personas.mjs
# 실제 Kiln: 모델 목록 확인 + 추론 최대 6회, blockchain 송금 0
pnpm ade:personas:live
```

- [전체 테스트 결과](../artifacts/deal-escrow/tests.json)
- [합성 공격 결과 위치](../artifacts/deal-escrow/personas/latest-scripted.json)
- [실제 Kiln 결과 위치](../artifacts/deal-escrow/personas/latest-live.json)
- [브라우저·실제 로컬 EVM 결과 위치](../artifacts/deal-escrow/personas/latest-browser.json)
- [Sepolia 현재 준비 상태](../artifacts/deal-escrow/sepolia-readiness-current.json)

정상/공격 입력은 예산 승인 사칭, 품질 하한 약화, 다른 Deal ID 수락 유도입니다. 실제 Kiln 검사는 제품의 `KilnClient`와 `policy`를 호출하고 요청 전 계획·입력·원응답·토큰·판정을 저장합니다. 합성 출력으로 강제로 만든 위험 제안과 실제 모델의 반응을 합산하지 않습니다. 6개 입력은 작고 고정된 회귀 집합이며 전체 공격 성공률이나 최적 판매자 선택률을 추정할 표본이 아닙니다.

## 운영 시 조치

`CHAIN_FINALITY_PENDING`과 외부 RPC 장애는 실패 확정이 아닙니다. 원 signed intent를 유지하고 자동 복구가 같은 거래를 조회하게 둡니다. 같은 구매를 새 ID/nonce로 다시 전송해서는 안 됩니다.

재조직이 확인되거나 refund 자체가 확정 실패하면 health가 운영 조치를 요구합니다. 예산 노출을 보존한 채 새 금융 동작을 차단하거나 해당 건을 유지합니다. 원인을 조사하지 않고 DB 기록·예약을 삭제하거나 자동으로 추가 송금하지 않습니다. 공용체인에서 이 격리를 해제하는 운영 판단과 깊은 재조직 복구를 자동화했다고 주장하지 않습니다.

`ADE_CHAIN_CONFIRMATIONS`와 `ADE_FINALITY_MODE`는 신뢰된 서버 설정입니다. 공개 기본 2확정은 데모의 제한된 확인 정책이며 production finality 보장이 아닙니다. 더 높은 finality 설정과 배송 시간은 함께 설계해야 합니다. 단일 호스트의 writer 배제는 다중 호스트 분산 worker 지원을 의미하지 않습니다.

## 외부 증거가 필요한 항목

| 항목 | 이번 확인 / 아직 필요한 조건 |
|---|---|
| 공개 Sepolia fund/release/refund | 전용 주소 `0xE3e6E3451Ef871546a08339F0da42A2C07a5a2A9`의 테스트 ETH 잔액은 0. RPC 연결은 확인했지만 송금하지 않았습니다. 무료 테스트 ETH 확보 후 실제 실행이 필요합니다. 기존 faucet 일일 제한을 우회하지 않습니다. |
| 실제 데이터의 사실성·출처 관련성 | 타입·고유 행·URL 형식과 회사별 실 CAPEX 사실은 다릅니다. 사실 검증에는 실제 원문, 출처와 값의 대응 및 검수 기준이 필요합니다. 이번 데이터는 합성입니다. |
| 실제 사용자 연구 | 관찰 대상 사용자가 아직 없습니다. 과제는 승인 기준 설정, 실패 샘플 수정, 중복 클릭, 중지, 영수증 해석으로 고정할 수 있지만 관찰 결과를 만들어낼 수 없습니다. |
| controller 신뢰와 기록의 완전성 | chain commitment 이후의 변경과 제공된 실패 원인을 검증합니다. 악성 controller가 처음부터 누락한 사건, 과거 통제의 부재, 형제 Deal 예약의 완전성은 개별 번들만으로 독립 증명하지 못합니다. 감사 결과와 UI에 계속 표시합니다. |
| 실제 전력·물리 NPU 경로·장기 부하 | 실제 API 토큰과 지연은 관측하지만 장비 텔레메트리·실사용 부하·장시간 SLO 자료는 없습니다. 수치를 추정하여 완료로 표시하지 않습니다. |

따라서 이번 완료 범위는 **현재 제품의 코드·로컬 실행·모델 경계 검증 보완**입니다. 위 외부 조건까지 모두 해결됐다는 판정은 하지 않습니다.
