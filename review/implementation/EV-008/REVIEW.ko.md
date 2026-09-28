# EV-008 — Agent Deal Escrow 오프라인 대조 검토

2026-09-28. 제품 재설계 없이 성공·환불·preview gate·10개 불변조건·지급 revert와 응답 유실 복구를 대조했다. 새 모델 호출, RPC 조회, 체인 거래, 배포, 다른 채팅 답신은 수행하지 않았다. 제품 파일은 변경하지 않았다.

**결론: 기본 금융 흐름은 구현되어 있다. 새 P1 결함 1건과 제출 증빙 갱신 2건을 확인했다.** 공개 Sepolia escrow 미완료는 이미 알려진 별도 gate다. 구매 복구 v3의 공개 지급을 escrow fund/release/refund 증거로 사용하지 않는다.

검토 대상은 [29개 파일의 고정 사본과 hash](manifest.json)이다. 원본 작업 트리는 검토 중 계속 수정되었으므로 결과를 현재 전체 소스의 최종 승인으로 해석하지 않는다. [실행 범위·변경 관측](scope.json).

## P1 — 같은 의도의 대체 거래 복구 후 영수증이 INVALID

- 위치: 고정 [engine.ts:61](source/src/deal-escrow/engine.ts), [audit.ts:13 및 87](source/src/deal-escrow/audit.ts).
- 조건: 동일 nonce·수신인·calldata·금액을 가진 거래의 수수료만 변경해 다른 hash로 채굴된다. `reconcile`은 동일 의도의 성공으로 분류한다.
- 원인: 엔진은 `op.txHash`를 대체 거래 hash로 갱신하지만 `op.raw`는 원래 서명 거래 그대로 보존한다. 영수증의 `claim()`은 `op.raw`를 다시 해석하므로 원래 hash를 출력한다. 검증기는 `claim.tx_hash === op.tx_hash`에서 실패한다.
- 실제 반례: [오프라인 재현 코드](reproduce-replacement.mjs)와 [결과](replacement-reproduction.json). 금융 상태는 `ESCROW_FUNDED`지만 `hashesMatch=false`, `INVALID / TRANSACTION_CLAIM_MISMATCH`다. 임시 테스트 키와 모의 adapter 응답을 사용했으며 실제 체인에 거래를 보내지 않았다.
- 영향: 정상적인 수수료 교체 복구 뒤 제3자가 허용된 지급을 영수증으로 재구성하지 못한다. 중복 지급이나 자금 손실을 재현한 것은 아니다.
- 최소 수정: 최초 서명 의도와 확인된 실행을 별도로 보존한다. `reconcile`이 검증한 대체 거래의 공개 hash·from/to·nonce·calldata·value를 실행 증빙에 연결하고, 영수증은 최초 의도와 실제 실행을 구분해야 한다. 원래 raw와 hash를 보존하면서 주장 hash만 바꾸는 수정은 피한다. 동일 의도 replacement의 fund/release/refund 각각에 `receipt → verifyReceipt` 검사를 붙인다.

```sh
node review/implementation/EV-008/reproduce-replacement.mjs
```

검토 종료 직전 원본의 같은 갱신 경로와 raw 기반 claim도 확인했다. 원본이 이후 수정되면 이 고정 사본의 결과와 새 결과를 따로 비교해야 한다.

## 제출 증빙 갱신

1. **기존 preview 차단 영수증에 원인 거래가 빠져 있다.** 저장된 `dda69b44-61e0-4de4-a6d8-b44d5e05cd92.json`을 현재 검증기로 읽으면 `INCOMPLETE / CONTROL_SOURCE_MISSING`다. 코드의 새 export는 이미 `control_source`를 포함하므로 기능을 다시 만들 필요는 없다. 기존 환불 영수증을 출처로 첨부한 파생 대조는 `STRUCTURALLY_VALID`가 됐다. 기존 기록을 보존하고 새 export 버전으로 증빙 묶음만 갱신하면 된다.
2. **기존 성공 자료는 delivery-v1 결과다.** 52행 중 회사·분기·통화 조합은 32개다. 현재 delivery-v2의 `UNIQUE_ECONOMIC_ROWS`는 실패한다. 과거 지급은 당시 기준으로 구조적으로 유효하지만 현재 검수기의 성공 증거는 아니다. 과거 재생에는 validator 버전을 명시하고 새 검수 통과 주장은 새 실행 증거가 생긴 뒤에만 한다.

[4개 기존 영수증 대조](offline-verification.json): 성공·환불·예산 차단은 `STRUCTURALLY_VALID`, preview 차단은 원인 자료 누락으로 `INCOMPLETE`. [누락 첨부 및 현재 품질 검사 반례](evidence-gap-reproduction.json). 이는 오프라인 구조 검증이며 저장된 과거 `VALID` RPC 판정을 새로 확인한 것이 아니다.

## 10개 불변조건 대조

| 요구 | 집행 위치와 기존 테스트 | 판단 |
|---|---|---|
| 모델이 정산 금액을 정하지 못함 | `agentAction`은 ID만 허용, `chain.prepare`는 accepted price 사용; engine 도구 금지 테스트 | 구현 확인 |
| 수락한 Deal 불변 | frozen object와 SQLite `immutable_deal` trigger; domain 테스트 | 이번 오프라인 검사 통과 |
| hash 불일치 정산 금지 | `policy.DEAL_HASH`, 서명 직전 검사; engine hash 변조 테스트 | 구현·기존 테스트 확인 |
| 만료 Deal funding/release 금지 | 코드 만료 검사, 계약 fund/release deadline; domain/contract/engine 테스트 | 구현 확인 |
| 취소·만료 mandate 신규 funding 금지 | 승인·서명 직전 ACTIVE/expiry 검사; engine revoke/expiry 테스트 | 구현 확인, 이미 서명한 거래는 대조 대상 |
| 같은 Deal 중복 정산 금지 | 계약 NONE/LOCKED 상태, 터미널 전이, operation 단일 키 | 구현 확인 |
| 환불 뒤 지급 금지 | REFUNDED 터미널과 계약 NOT_LOCKED | 구현 확인 |
| Control Memory 권한 확대 금지 | 고정 REQUIRE_PREVIEW 매핑, mandate body 불변 | 구현 확인 |
| 모델이 gate 제거 금지 | 허용 도구에 제거 없음, controls update/delete trigger | 이번 오프라인 검사 통과 |
| 실패한 납품 지급 금지 | `settle`의 verified·정책·기한 검사; failed delivery → refund 테스트 | 구현·기존 테스트 확인 |

고정 사본의 `domain.test.mjs`만 실행하여 **6 tests / 6 pass / 0 fail**을 확인했다. 체인 테스트는 재실행하지 않았다. 위 표의 ‘구현 확인’은 코드·기존 테스트의 대조이며 이번에 전체 불변조건을 새 EVM에서 검증했다는 뜻이 아니다.

## 성공·실패 복구의 구분

- 성공 경로: accepted Deal → 원자적 예산 예약 → exact-value escrow → 결정론적 납품 검사 → release.
- 실패 경로: 7행 납품 → `DELIVERY_REQUIREMENT_FAILED` → refund → 회사+판매자 범위 REQUIRE_PREVIEW. 다음 funding 전에 실제 preview 결과와 Deal hash를 확인한다.
- mined revert: 정확한 서명 거래·controller·contract·status-0 영수증과 설정된 확정 경계가 있어야 REVERTED로 기록한 뒤 refund로 전환한다.
- 응답만 유실: 성공 여부 불명이면 PENDING을 보존하고 같은 거래를 대조한다. 성공한 release에 환불을 만들지 않는 기존 회귀 테스트가 있다.
- 기본 공개 확정 정책은 현 사본에서 2 confirmations이고 finalized 모드는 별도 설정이다. 이를 Ethereum 최종 확정과 동일하게 표현하면 안 된다. 공개 escrow 실증은 여전히 별도 미완료다.

저장된 29개 PASS의 fingerprint와 검토 당시 소스 fingerprint는 다르다. 추가 개발이 끝난 뒤 전체 테스트를 한 번 실행하고 source fingerprint가 같은 결과를 제출해야 한다. 이번 검토에서는 오래된 PASS를 현재 코드의 PASS로 갱신하지 않았다.

EV-008의 오프라인 대조는 여기서 종료한다. 신규 제품·시장·기능 제안은 추가하지 않는다.
