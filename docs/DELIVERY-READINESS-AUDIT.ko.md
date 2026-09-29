# Agent Deal Escrow — 현재 완료 감사

2026-09-29. 판정: **프로토타입 구현·식별된 기술 실증은 있음. 전체 목표 완료는 아님.** 이 문서는 이전 구매 v3 또는 초기 합성 데이터 실행의 완료 표를 현재 제품에 적용하지 않는다.

범위는 사용자 목표의 기술 완성도·UI/UX·직관적 데모, Challenge B의 다섯 acceptance criteria, 최근 「해커톤 규칙 정리」의 동결 명세 P0–P6·Definition of Done, 그리고 [좁힌 제품 계획](FOCUSED-PRODUCT-PLAN.ko.md)이다. 시장·실사용 필요성과 사람의 이해를 자동 검사로 대체하지 않는다.

## 확인한 현재 상태

- 후속 요청에 따라 [2쪽 PDF·휴대용 제출 묶음·발표 순서](SUBMISSION.ko.md)를 완성했다. 공개 파일만 묶었고 원본 해시, ZIP을 푼 뒤의 파일, 상대 링크와 브라우저 화면을 검사했다. 현재 제품 코드를 바꾸거나 이전 실행을 다시 얻은 것처럼 표시하지 않았다.
- 최신 [Ubuntu 실행 36483923356](https://github.com/him55710-sudo/Furiosa-x-bricksum/actions/runs/36483923356)은 102/102, 계약 산출물 일치, 두 UI 빌드와 별도 기존 제품 작업까지 성공했다. 내려받은 CI ZIP의 SHA-256과 검사 보고서를 검증했고 현재 소스 지문과 일치했다.

- 후속 사용자 요청의 [가상 업무 데모 검증](FICTIONAL-DEMO-VALIDATION.ko.md)은 12/12로 완료했다. 실제 Kiln의 정상 주문 오거절을 발견해 제안 가능 가격 범위를 명시했고, 원래 실패와 수정 후 성공을 별도 보존했다. 현재 자동 검사는 새 회귀를 포함한 102개다. 최신 Ubuntu 실행도 102/102이며 [보존한 원본과 해시](../artifacts/deal-escrow/ci/36483923356.json)를 확인했다. 아래 101개 증거는 이전 소스의 관측이다. 현재 로컬 보고서는 [tests.json](../artifacts/deal-escrow/tests.json)과 현재 소스 지문으로 확인한다. 합성 시나리오는 실제 고객·사람 검증을 대신했다고 주장하지 않는다.

- 현재 [자동 검사 보고서](../artifacts/deal-escrow/tests.json)는 102/102, 실패·건너뛰기 0이며 소스 지문 `ad549e9df44f403951d17c0699d2a9a85275c8ab02e087b5aeb4a67f838e734b`와 일치한다. 가상 시나리오의 첫 오거절을 수정한 가격 제안 회귀를 포함한다.
- 이전 커밋 `b3ff2c3`의 Ubuntu 검사는 101/101과 소스 지문 `40741369a95ceb694c7fede80101bbd7301f400b32b7a3dfa3e2558b33362f50`을 확인했다. [실행·산출물 대조 기록](../artifacts/deal-escrow/ci/36472682269.json)에 당시 Actions 실행과 원본 보고서 해시를 연결했다. 현재 102개 결과와 구분한다.
- 과거 Windows 검사 소스 `fcc202e6ab29f3ba4c94ecbd8136938880377d9e1349b90bdfb7df73e4f9f905`와의 차이는 6개 파일의 CRLF/LF뿐이었다. 각 파일을 Git에 저장된 바이트와 대조한 뒤 작업본을 기존 `.gitattributes`의 LF 기준에 맞췄다. 과거 거래·검사 기록의 지문은 소급 변경하지 않았다. 동작 코드는 바뀌지 않았다.
- 새 Ubuntu 환경에서 계약 재컴파일 산출물 일치와 live/replay 두 TypeScript/Vite 빌드가 통과했다. 이전 [재시작 후 검사](../artifacts/deal-escrow/nonce-recovery/runtime-checks.json)는 로컬 작업 2건과 정산 경합 1건의 상태·해시·블록을 보존하고 영수증 모두 `VALID`를 확인한 별도 Windows 관측이다.
- 현재 읽기 전용 재생 API는 원문 실행 `a2f6f4fa`의 지급·환불·샘플 차단·예산 차단·승인 중지 5건과 별도 회수 `5b2ccb95`를 반환했다. 저장된 독립 RPC 판정은 각각 finalized block 11,801,516과 11,801,738의 관측이며 현재 시각의 재실행으로 표시하지 않는다.
- 참여자 서비스 `/api/study`의 실제 사람 자기신고 응답 0, 검토된 사람 0. 자동 QA 1건은 사람으로 세지 않는다. 영수증 재구성이나 원문 검토를 실제 사람에게 관찰한 증거가 없다.

## Challenge B 요구와 증거

| 요구 | 권위 있는 증거와 검사 범위 | 판정 |
|---|---|---|
| README 한 문장 기능·사용자·문제·usable outcome·AI/코드 분리 | [README](../README.md) 첫 문장·1–5절. [작업 화면](SOURCE-WORKBENCH.ko.md)의 승인→견적→예치→납품→JSON/영수증 결과. 결과 실패·환불은 업무 성공과 구분 | 구현·기술 시연 있음. 실제 유료 사용자 필요는 미확인 |
| 경계 및 집행 위치, 최소 두 범위 이탈과 중지 기록 | 코드의 mandate/policy/state machine, contract의 amount/role/deadline/single outcome. 공개 원문 실행의 `budget-denied`, `human-stop`, `preview-denied` 영수증에 서명 전 중지 이유. [공개 증거](SOURCE-PUBLIC-PROOF.ko.md), [정책 검사](../tests/deal-escrow/domain.test.mjs) | 확인. 원금 상한과 별도 운영자 가스 예산을 구분; 모든 비용을 사용자 원금 상한 안에 넣은 구현은 아님 |
| 실제 Kiln 및 결정 연결, flow별 토큰, 추론·에너지 설명 | 사용자 정정 모델 Qwen3-32B. 원문 공개 실행의 실제 `select_offer`와 `submit_dataset`: 2,118 + 2,377토큰. [실행 보고서](../artifacts/deal-escrow/source-sepolia/a2f6f4fa-9f1e-4892-8518-325b8762c4f2/report.json)와 [가정 계산](../artifacts/deal-escrow/source-sepolia/a2f6f4fa-9f1e-4892-8518-325b8762c4f2/energy-estimate.json) | 실제 통합·계측 확인. 물리 장비 경로·전력·AI 우위는 미측정/미입증 |
| devnet/testnet on-chain transaction, hash와 기록, read/write/settle | Sepolia contract `0x04173D24864AD32fE791bd20ef5E97B4a3FC021B`; fund 2·release 1·refund 1. Deal hash/escrow state/settlement commitment와 영수증 연결. 별도 구매자 직접 환불은 다른 실행 | 확인. DB 앵커만 있는 데모가 아니라 실제 테스트 자산 예치·정산 |
| 승인·관찰·중지·영수증, 다른 사람의 기록만으로 재구성 | 실제 브라우저 조작·저장 영수증·독립 RPC·변조 검사. [감사 검사](../tests/deal-escrow/audit.test.mjs)와 [사람 검증 절차](USER-STUDY.ko.md) | 도구와 자동 재구성은 확인. 실제 제3자의 이해 관찰은 미완료 |

## 동결 명세 Definition of Done — 항목별 확인

| 항목 | 현재 근거 | 남는 범위 |
|---|---|---|
| Mandate: budget / expiry 입력 | live workbench 승인 폼과 API, immutable mandate 및 품질 하한 검사 | 개인 암호서명·기업 SSO는 구현 범위 밖 |
| Kiln: 실제 요청 성공 / Deal 제안 참여 / flow usage | 원문 공개 2회, 로컬 PDF 비교 1회, 별도 단위 회귀 1회가 각각 보존됨 | 서로 합쳐 한 실행처럼 표시하지 않음 |
| Deal: 자연어만으로 정산 불가 / schema / 수락 후 불변 / hash 저장 | [domain](../tests/deal-escrow/domain.test.mjs), [kiln](../tests/deal-escrow/kiln.test.mjs), SQLite 불변 trigger, 영수증 재계산 | 악성 controller까지 차단하는 무신뢰 금융 권한은 아님 |
| Control: 예산 / 만료 / 중복 정산 / 불법 전이 거부 | domain의 모든 선언된 상태 쌍, [engine](../tests/deal-escrow/engine.test.mjs), [contract](../tests/deal-escrow/contract.test.mjs) | 형식 검증이나 모든 가능한 실행의 수학적 증명은 아님 |
| Escrow: 실제 테스트넷 fund / 정상 release / 실패 refund / tx 영속 | 원문 공개 영수증 4개 on-chain 거래와 별도 RPC 대조. 원금은 불변 Deal에 고정 | mainnet·생산 환경 자산 수탁 제외 |
| Evidence: 재구성 영수증 / 성공·실패 이력 표시 | audit 화면·JSON, 변조·누락·확정 수준 검사, schema 1–4 호환 | controller의 사건 누락 부재와 인간 이해는 자동 입증 불가 |
| Memory: 검증 실패→REQUIRE_PREVIEW / 다음 funding 차단 | 공개 `preview-denied`; 로컬 작업의 한 행 샘플 통과 후 재개·전체 납품 검사 | 공개 원문 실행의 샘플은 네 행. 한 행 샘플 실증은 별도 로컬 경로 |
| Tests: invariant suite / 조작하지 않은 pass 표시 | 소스 지문에 연결된 실제 Node 보고서, UI의 stale 검사 | 통과 수를 안정성 확률·100% 보장으로 해석하지 않음 |
| README: 선언·사용자·역할·아키텍처·체인·두 차단·Kiln·한계 | README 1–15절 및 연결된 좁은 제품 아키텍처 | 이 감사에서 이전 실행의 미완료·토큰·buyer 설명 불일치를 수정 |
| P6: UI·시연·영상·README | 원문 작업 화면, source replay 9단계, [새 3분 자막 영상](SOURCE-DEMO-VIDEO.ko.md), 데스크톱·모바일 증거 | 초면 관객 이해도와 사람의 사용성 검증은 미완료 |

10개 금융 불변조건은 README 12절에 각각 선언되어 있다. 모델이 정산 금액을 정하지 못함, 수락 Deal 불변, hash 불일치 거부, 만료 Deal funding/release 거부, 철회/만료 mandate funding 거부, 중복 정산 거부, 환불 후 지급 거부, 기억에 의한 권한 확장 거부, 기계에 의한 통제 제거 거부, 실패 납품 지급 거부를 domain/engine/contract/audit의 실제 실행으로 검사한다. 상태 쌍을 훑는 검사는 전이 표의 집행을 확인하는 것이며, 그 표가 비즈니스 요구 전체를 자동 증명하는 것은 아니다.

복구는 [미확정·정산 경합](SETTLEMENT-RACE-PROOF.ko.md), [장기 환불 이력](BUYER-RECOVERY-PROOF.ko.md), [오래된 동일 nonce 대체 거래](NONCE-RECOVERY-PROOF.ko.md)를 별도로 확인했다. 필요한 RPC 과거 상태·로그가 없으면 예약을 풀지 않는다. 심한 재편성·키 분실·운영자 신뢰는 남는다.

## 전체 목표를 완료로 바꾸기 전에 필요한 증거

| 미완료 | 완료를 판단할 실제 자료 | 지금 하면 안 되는 대체 |
|---|---|---|
| 실제 사용자 필요와 공급자 참여 | 실제 유료 발주자의 최근 오납품·환불·재요청 사건, 기존 도구로 해결되지 않는 이유, 동의한 공급자와 한 건의 시험 | 공개 회사 사례나 가상 페르소나를 인터뷰로 계산 |
| 원문 사람 검토 | 사람이 PDF 머리글·분기·행·단위·부호를 직접 확인한 기록 | Codex/동일 파서의 재확인을 human review로 표시 |
| 제3자 재구성과 직관적 데모 | 초면 관객의 실제 응답·관찰, 왜 지급/환불됐는지 설명한 근거와 혼란 지점 | 자동 브라우저 조작·영상 생성·응답 수만으로 이해 완료 |
| 독립 보류 평가 | 수정 전에 동결한 미관측 문서와 사람의 참조, 정상 오차단·오지급·지원 범위 결과 | 이미 본 동일 발행사 5개를 독립 평가라고 재명명 |
| AI 추가 가치와 경제성 | 같은 안전 경계의 대안 비교, 정확도·수동 개입·총비용·시간. 불리한 결과도 보존 | 토큰 감소만으로 NPU 효율이나 구매 가치 주장 |

실측 하드웨어 전력은 제공자가 측정값을 제공할 때만 추가한다. acceptance criteria는 가정 명시를 허용하므로 가정 계산 자체를 미구현으로 보지 않지만, “NPU 에너지 절감 입증”은 별도 미완료 주장이다. Grok 검토 봇 같은 초기 탐색 보조 도구는 제품의 안전·실제 사람 검증을 대체하지 않는다.

## 실행·확인 명령

[GitHub 자동 검사](../.github/workflows/verify-system.yml)에 현재 제품 전용 `deal-escrow-verification` 작업을 추가했다. 새 Ubuntu 환경에서 잠긴 의존성 설치, 계약 재컴파일 및 저장된 계약 산출물 일치, 현재 자동 검사, live/replay 화면 빌드를 실행한다. 기존 Control Memory 작업의 성공을 현재 제품 검증으로 대신하지 않는다. 과거 `tests.json`을 먼저 제거하므로 새 검사 전에 중단된 실행은 과거 PASS 파일을 새 증거로 업로드하지 않는다. 실제 통과 여부는 해당 커밋의 Actions 결과와 `deal-escrow-verification-<run_id>` 보고서로 확인한다. 이 작업에는 Kiln 키·공개 체인 서명·PDF 원문·사람 참여가 없으며 그 실증을 대체하지 않는다.

```sh
pnpm ade:test                        # 외부 모델/공개 거래 없이 현재 자동 검사
pnpm ade:build                       # live workbench 빌드
pnpm ade:replay:build                # 공개 기록 재생 UI 빌드
pnpm ade:source:replay               # 3413, 기존 원문·회수 기록만 읽음
pnpm ade:source:study                # 3414, 버전 고정 사람 질문지
pnpm ade:source:verify               # 별도 RPC로 기존 원문 기록 대조
pnpm ade:source:recovery:verify      # 별도 RPC로 기존 구매자 회수 대조
```

공개 검증 명령은 독립 검증 파일을 갱신하므로 새 관측의 시각·해시를 기록해야 한다. 과거 영상이나 사람 응답을 새 버전에서 얻은 것처럼 바꾸지 않는다. 라이브 시작은 [원문 작업 환경](SOURCE-WORKBENCH.ko.md), 영상 인코딩은 [영상 문서](SOURCE-DEMO-VIDEO.ko.md)를 따른다. 화면 확인만 위해 새 유료 추론이나 공개 정산을 실행할 필요는 없다.

자동으로 처리할 수 있는 구현·합성 검증·제출 패키징을 마무리했다. 위 사람·업무 자료는 외부 참여 없이 생성할 수 없으므로 미완료로 남긴다. 다음 행동은 실제 참여자 자료로 기존 한 흐름을 평가하는 것이다. 자료가 없는 상태에서 전체 완료나 실전 도입 준비 완료를 선언하지 않는다.
