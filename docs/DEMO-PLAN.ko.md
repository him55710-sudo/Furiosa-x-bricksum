# 심사용 데모와 검증 계획

현재 문서는 실행할 계획입니다. 아래 결과는 아직 실측하거나 체결한 결과가 아닙니다.

## 4분 데모

| 구간 | 보여줄 행동 | 증거 |
|---|---|---|
| 0:00–0:40 | 운영자가 30 TestCredit·판매자·기한·수수료 범위를 확인하고 위임 | 서명된 mandate, 승인 tx |
| 0:40–1:20 | Kiln이 적격 후보의 가격·환불 조건을 비교해 제안 | qwen3-32b 응답 ID, tool proposal, flow usage |
| 1:20–2:00 | 수수료 포함 초과 run과 비허용 판매자 run 중지 | reason code, 입력값, 실제 STOPPED 이력 |
| 2:00–2:30 | 같은 판매자 재시도에서 통제 기억이 더 일찍 검사 | source event → new control, 줄어든 실제 호출 수 |
| 2:30–3:10 | 허용 견적 결제 후 영수증, 별도 실행 중 사용자 중지 | testnet tx, 잔액 변화, revoke 상태 |
| 3:10–4:00 | 다른 사람이 export만 받아 검증; 금액 한 글자 변조하면 실패 | verifier VALID/INVALID, explorer 연결 |

## 독립 실행 시나리오

1. **정상 구매**: 한도 30, 건별 한도 25, 승인 판매자, 총액 24. Kiln 제안 → 코드 검사 → 실제 테스트넷 payment → receipt. 실제 tx hash와 이벤트 ID 연결.
2. **수수료 포함 초과**: 건별/세션 한도 30인 별도 위임, 기본 29 + 수수료 2 = 31. `ALL_IN_BUDGET_EXCEEDED`, run STOPPED, payment tx 없음. 원본 값과 비교식을 로그에 남김.
3. **비허용 판매자**: 총액은 한도 이하지만 판매자 주소가 allowlist에 없음. `MERCHANT_NOT_ALLOWED`, STOPPED, payment tx 없음.
4. **기한 경과**: 만료된 mandate 또는 offer. `DEADLINE_EXPIRED`/`OFFER_EXPIRED`, STOPPED. 새 위임 없이 재개하지 않음.
5. **사람의 중지**: 협상 도중 stop. 이후 제안·전송 없음. 별도 경합 테스트에서는 이미 전송된 payment와 revoke의 체인 순서를 정확히 표시.
6. **증거 변조**: 정상 bundle의 amount 또는 offer를 바꿈. verifier가 `INVALID`를 내고 어떤 연결이 틀렸는지 설명. 파일 누락은 `INCOMPLETE`.
7. **동시성·재시도**: 잔액 30에서 20 + 20 병렬 요청. 한 건만 가능. RPC 응답 유실 후 재개해도 같은 결제가 두 번 나가지 않아야 함.
8. **견적 바꿔치기·주입**: 결제 직전 수취 주소 변경, 또는 판매자 설명에 정책 무시 요청. 변경된 offer는 거부; 텍스트는 권한에 영향 없음.

위반 테스트를 통과했다고 결론내리려면 해당 run의 종료 상태와 실제 결제 부재를 함께 검사합니다. 단순 UI 경고나 모델의 “안 됩니다” 응답은 증거가 아닙니다.

계약의 주소·중복 검사를 직접 공격하는 테스트는 별도 로컬/devnet harness에서 실행합니다. 제품에 정책 우회 스위치를 넣지 않습니다. 공개 테스트넷의 revert 거래를 필수 요건으로 추가하지 않으며, blockchain 통합 증거에는 정상적으로 성공한 payment 또는 record transaction을 확보합니다.

효율 비교는 B0/B1/CM 3개 군과 holdout을 사용합니다. 자세한 채택·기각 이유는 [Round 1 판정](../review/ROUND-1.ko.md)에 있습니다. 검토자의 동의는 구현 또는 실측 증거가 아닙니다.

구체적인 조건은 [실험 사전등록 초안](EXPERIMENT-PROTOCOL.ko.md)에 있습니다. 무료 견적과 합성 지연을 구분하고, 최종 견적과 사람 개입 비용을 모두 집계합니다. 계약 테스트의 실제 배포본 적용 여부는 같은 build artifact와 배포별 runtime/설정 manifest로 확인합니다.

## Acceptance Criteria 대응

| 기준 | 구현할 결과물 | 완료 증거 |
|---|---|---|
| Declared Function & User Need | README 첫 문장 + 소규모 팀 구매 흐름 + AI/코드 역할 | 일관된 데모와 선언 |
| Boundaries & Stopping | 누적 예산·수수료·허용 주소·만료·취소 강제 | 최소 2개 독립 위반 run의 로그 |
| Kiln Integration & Efficiency | 실제 qwen3-32b 응답이 후보 선택에 반영 | generation ID, flow별 usage, 측정/가정 구분 |
| Blockchain Integration | devnet/testnet 위임·payment 또는 명시된 anchor | 성공 receipt, tx hash, 일치하는 이력 |
| Approval & Evidence | 승인·관찰·중지·영수증·export·외부 검증 | 제3자가 records만으로 재구성 |

## 테스트 우선순위

예산 합산·경계값·nonce·중복 전송·서명·만료·취소 경합·증거 검증에 집중합니다. 모델 결과를 exact text로 비교하는 테스트는 피하고, 기존 후보만 선택하는지·실제 상태에 어떤 영향을 주는지를 검사합니다. LLM이 잘못된 출력을 내면 올바른 결과는 실패 기록과 중지입니다.

효율 비교에서는 같은 사전 상태를 별도 fixture로 복원하며, 실제 구매를 무한 반복해 사용자 예산을 소모하지 않습니다. benchmark 전용 테스트 지갑/세션을 사용합니다. 모든 가짜 판매자·테스트 자산·오프라인 fixture를 UI와 결과에서 명시합니다.

## 제출 시 실제 값으로 채울 항목

- qwen3-32b endpoint와 실제 연결 진단은 확인 완료(2026-09-28 사용자 모델 변경). 제품 흐름의 호출 증거와 NPU 라우팅 근거는 추가 확보.
- 성공 run ID, Kiln generation ID, 실제 prompt/completion/total tokens.
- 차단 run 2개 이상과 중지 이유, 추가 결제 없음의 검사.
- chain ID, contract address, tx hash, block number/hash, 성공 receipt.
- verifier 실행 명령·검증 결과·다운로드 bundle.
- flow별 비용/지연, 에너지 계수 출처와 제외 범위.
- 공개 repository/실행 방법/데모 영상 등 실제 제출 형식은 대회 공식 제출 안내에서 추가 확인.
