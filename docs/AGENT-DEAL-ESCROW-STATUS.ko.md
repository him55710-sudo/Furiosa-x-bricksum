> 과거 로컬 실증 시점 기록입니다. 아래의 잔액 부족·공개 실증 미완료·54개 검사 상태를 현재 상태로 읽지 마세요. 현재 원문 기반 Sepolia 실증과 별도 구매자 회수, 101개 자동 검사, 최신 3분 영상 및 미완료 사람 검증은 [현재 완료 감사](DELIVERY-READINESS-AUDIT.ko.md)를 따릅니다. 아래 기록은 당시 증거로 보존합니다.

# 동결 명세 구현 상태

2026-09-28. **로컬 devnet·실제 Kiln·UI 검증 완료. 공개 Sepolia fund/release/refund 미완료. 전체 Definition of Done을 완료했다고 주장하지 않는다.**

후속 [한계 보완](LIMITATIONS-REMEDIATION.ko.md): 승인 품질 하한, 구매 의도 중복 방지, 배송 v2, preview 재개 UI, 확정 실패·replacement·reorg 처리, 통제 원인 감사가 추가됐습니다. 별도 실제 Kiln 정상/공격 입력 6회(7,362 tokens)에서 범위 밖 제안 0건을 관측했습니다. 기존 실측 데모 6회와 구분합니다.

| 영역 | 상태 | 실제 근거 |
|---|---|---|
| Mandate | 완료 | 사용자 budget/max/expiry 입력 UI, 정형 스키마, 중지 API/UI |
| Kiln | 완료 | `/models` 확인, 실제 tool call 6회, 6,541 tokens, flow별 계측 |
| Deal | 완료 | unknown-field 거부, 정수 minor 금액, canonical hash, SQL 불변 trigger |
| Control | 완료 | budget·expiry·중복·불법전이·최종 권한 재검사 |
| Escrow / 로컬 devnet | 완료 | 실제 Solidity 배포, fund 2회, release 1회, refund 1회와 receipt |
| Escrow / 공개 Sepolia | 대기 | 전용 지갑 잔액 0. RPC는 연결됨. Google 무료 faucet은 일일 한도에 걸림 |
| Delivery | 완료 | JSON 배열·행 수·필수 컬럼·HTTP(S) URL 비율·마감·content/evidence hash |
| Evidence | 완료 | 원본 기록 재계산, 이벤트 연결, 체인 로그 대조, 변경/누락 탐지 |
| Control Memory | 완료 | 신뢰된 배송 실패→Seller B 제한, preview 없으면 funding 차단, 자동 완화 없음 |
| Tests | 완료 | `artifacts/deal-escrow/tests.json` 실제 runner 54 tests / 54 pass / 0 fail. 실행 중 소스 변경도 실패 처리 |
| Browser | 완료 | Edge/Playwright, 입력·탐색·감사 검증, API 403/400, 390px overflow 없음 |
| README | 완료 | 선언문, 15개 필수 설명, 책임 표, 신뢰 경계, 한계 |
| Video | 완료 | 실제 기록을 이용한 3분 무음 화면 재생. 실시간/공개 테스트넷으로 표시하지 않음 |

## 재현

`pnpm ade:contracts` → `pnpm ade:test` → `pnpm ade:build` → `pnpm ade:start`.

기존 실측은 `artifacts/deal-escrow/latest-demo.json`과 `runs/a19c9740-e56d-4de3-acdb-e4a2fd4d24c9/`에 보존한다. 다시 실제 모델을 호출하는 명령은 `pnpm ade:demo`다. 테스트 자체는 유료 모델을 부르지 않는다. 서비스 재시작 뒤 기존 4개 Deal과 거래 기록이 보존됨을 확인했다.

각 보안 요구의 테스트 위치: `tests/deal-escrow/domain.test.mjs`(불변성/스키마/전이), `engine.test.mjs`(10개 불변조건/경합/복구/미제출 만료/추가 gate), `contract.test.mjs`(권한/단일결과/buyer 만료 환불), `kiln.test.mjs`(오작동 출력/계측), `audit.test.mjs`(제3자 재구성/변조).

## 아직 필요한 외부 조건

전용 주소 `0xE3e6E3451Ef871546a08339F0da42A2C07a5a2A9`에 무료 **Sepolia 테스트 ETH**가 필요하다. 실제 코인 구매는 필요 없다. 계정의 Google faucet 재요청 가능 시간은 2026-09-29 22:38:46 KST로 표시됐다. 다른 개발 채팅의 실행 중인 지갑/nonce는 건드리지 않았다.

가용해지면 `pnpm ade:sepolia`를 실행하여 이 프로젝트의 계약 배포와 두 정산 결과를 확인한다. 실행 전 모델 호출 6회 및 테스트 가스가 발생한다는 점을 구분한다. `ADE_NETWORK=sepolia`와 `ADE_DATA_DIR=data/private/deal-escrow/sepolia`로 UI를 해당 증거에 연결할 수 있다. 최신 실행이 공용 체인인지 로컬인지 라벨을 확인한다.

전력·TTFT는 미계측이며 수치 추정도 제시하지 않았다. 사람에게 영수증을 읽혀 본 관찰은 아직 없다. 재편성/최종성은 production-grade라고 주장하지 않는다. 3분 영상은 내레이션 없이 만들어졌고 한국어 대본은 별도 문서에 있다.

## 개발 채팅과의 조율

사용자가 지정한 개발 채팅은 다른 실행을 진행 중이었다. 실행 중 메시지를 보내지 말라는 기존 조건을 유지하여, 동결 명세·새 모듈·증빙 경로를 `evolution.json`의 queued coordinationNotice에 저장했다. 기존 상품 선택 실험 EV-007 및 이전 전달 초안은 사용자 직접 명세로 대체했다. 기존 `purchase-*` 구현을 삭제하거나 수정하지 않았다.

## 추가 복구 검증 — 2026-09-28

지급 서명 후 체인 시간이 납품 마감을 넘어서면 실제 EVM 지급 거래가 revert되는 상황을 재현했다. 정확한 status-0 영수증이 확인된 지급은 REVERTED로 기록하고 ESCROW_RELEASE_REVERTED 사유로 환불한다. RPC 장애 중 SQLite를 닫고 다시 연 뒤 복구하는 경우도 포함한다. 성공한 지급의 응답만 유실된 경우에는 환불하지 않고 같은 거래를 복구한다. 변경된 실패 영수증을 감사 검증기가 거부한다. 공개 Sepolia 검증이나 체인 최종성 보장으로 해석하지 않는다.
