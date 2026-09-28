# 오래된 대체 거래의 장부 복구

2026-09-29. **동일 nonce로 이미 취소되거나 결제된 거래를 2,048블록 뒤에는 찾지 못해 예약 예산이 계속 묶이는 문제를 재현하고 수정했다.** 제품 범위를 넓히지 않고, 한 의뢰의 최종 돈 흐름을 기록으로 복구하는 변경이다.

## 재현과 변경

원래 예치 거래를 서명한 뒤 전송 직전에 중단하고, 같은 nonce로 다른 거래를 채굴했다. 하나는 자신에게 0을 보내는 취소이고, 다른 하나는 calldata·원금이 같은 정상 예치다. 로컬 EVM에 빈 블록 4,096개를 추가하면 둘 다 기존 코드에서 `PENDING`에 남았다.

현재 코드는 확정 경계의 계정 nonce와 과거 nonce를 이진 탐색해 해당 nonce가 소비된 블록을 찾는다. 전체 거래가 담긴 후보 블록은 한 번만 조회한다. 준비 시점이 잘못된 힌트라면 이전 범위까지 다시 찾는다. 블록이 오래됐다는 이유의 고정 제한은 제거했다.

**nonce 증가는 정산 증거가 아니다.** 후보 거래의 발신자·nonce·해시·블록을 찾은 뒤, 기존 검증기가 실제 영수증, canonical 블록, 확인 수준, 원래 calldata·금액 및 escrow 상태를 대조한다. 다른 거래의 영수증, 재편성, 조회 실패는 예약을 해제하지 않는다. [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)의 과거 블록 조회를 사용한다. [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)처럼 계정의 직접 발신 거래 없이 nonce가 소비될 수도 있으므로, 정확한 거래를 못 찾으면 대기 상태를 유지한다.

## 확인한 범위

- [실제 로컬 EVM 회귀](../tests/deal-escrow/old-replacement.test.mjs): 취소는 `BLOCKED`·예약 0, 동일 의도 예치는 `ESCROW_FUNDED`·예약 180으로 복구된다. 추가 controller nonce 소비 없이 영수증 `VALID`. 과거 상태 조회 장애와 잘못된 블록 영수증에서는 예약 180을 유지한다. 복구당 과거 nonce 조회 최대 16회, 전체 거래 블록 조회 1회라는 한도를 검사한다.
- [탐색 장애 검사](../tests/deal-escrow/nonce-transaction.test.mjs): 1,677만 블록 범위의 처음·중간·마지막 위치, 뒤늦은 힌트, 아직 소비되지 않은 nonce, 후보 누락·중복·다른 발신자·nonce·블록, 재편성 및 RPC 장애를 검사한다. 큰 범위 검사는 모의 RPC이며 공개 체인 실증으로 표시하지 않는다.
- 전체 자동 검사 **101/101**, 실패·건너뛰기 0, TypeScript/Vite 빌드 통과. [현재 검사 기록](../artifacts/deal-escrow/tests.json)의 소스 지문은 `fcc202e6ab29f3ba4c94ecbd8136938880377d9e1349b90bdfb7df73e4f9f905`다.
- [서버 재시작 확인](../artifacts/deal-escrow/nonce-recovery/runtime-checks.json): 원문 작업 2건과 정산 경합 1건의 기존 해시·상태·로컬 블록 5를 보존하고 영수증 모두 `VALID`. 추가 모델 호출과 거래 0.

## 별도의 공개 기록 조회

[읽기 전용 관측](../artifacts/deal-escrow/nonce-recovery/2026-09-28T18-59-55-691Z/public-locator.json)은 기존 [Sepolia 예치 거래](https://sepolia.etherscan.io/tx/0xc75def5330dcdce8fb10fb44db3f5ba435383b0660df8d7e7d22e1e0c6b7143f)를 같은 탐색 코드로 찾았다. Tenderly RPC의 finalized block 11,802,378에서, nonce 5의 거래는 block 11,801,669에 있었다.

거래 자체의 경과는 **709블록**이다. 검색 시작을 거래보다 4,096블록 앞으로 두어 **4,806블록 범위**를 조회했고, 과거 nonce 14회·전체 거래 블록 1회로 정확한 해시와 영수증을 확인했다. 이는 **기존 정상 거래 탐색**이며 새 대체 거래·지급·환불·전체 흐름의 실증이 아니다. 키·앱 DB·모델 호출·거래 전송을 사용하지 않았다.

```sh
pnpm ade:test
pnpm ade:build
node scripts/verify-deal-research-nonce.mjs  # 기존 공개 거래 읽기만 수행
```

RPC가 과거 계정 상태와 블록을 제공해야 한다. 로그만 제공하는 RPC로는 이 탐색을 완료할 수 없다. 이진 탐색은 이 controller 계정의 canonical 이력에서 nonce가 단조 증가한다는 전제를 사용하며, 상태 초기화가 가능한 임의 체인의 계정 복구 도구를 주장하지 않는다. 정확한 거래가 없거나 심한 재편성으로 증거가 불일치하면 수동 검토가 남는다. 이 변경은 실사용자 수요, 독립 원문 검수, AI의 추가 가치나 거래 경제성을 입증하지 않는다.
