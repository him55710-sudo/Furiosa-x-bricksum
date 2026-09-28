# Agent Deal Escrow — 동결 명세 구현

2026-09-28 사용자가 현재 대화에 직접 제공한 0–32절을 구현 기준으로 고정한다. 이전 리서치봇 v3와 council 상품 탐색 제안은 이 구현의 제품 결정이 아니다. 제품 재설계·marketplace·ERP·평판·자동 권한 완화는 제외한다.

## 저장소와 재사용

Node 24, Express 5, SQLite(node:sqlite), ethers 6, Solidity 0.8.30/Ganache, React 19/Vite/TypeScript. 기존 src/store.mjs의 트랜잭션 패턴, canonical hash/서명, Kiln auto-tool 응답 검사, 계약 빌드·증빙 검증 패턴을 재사용한다. 이전 purchase-* 구현은 별도 개발 세션이 관리 중이므로 덮어쓰지 않는다. 새 도메인은 src/deal-escrow, 테스트는 tests/deal-escrow에 둔다.

## 순서와 완료 기준

| 단계 | 구현 | gate |
|---|---|---|
| P0 | 엄격한 Deal/Mandate, canonical hash, 불변 저장, 전이·정책 | 불변조건과 불법 전이 테스트 |
| P1 | 전용 테스트 지갑·최소 escrow fund/release/refund | 로컬 EVM 정상/환불/중복/권한 검사 및 tx 연결 |
| P2 | JSON·행 수·컬럼·source URL·기한 검사 | 실패 시 release 불가, 정형 결과/hash |
| P3 | KILN_MODEL·실제 auto-tool 협상·계측 | 실제 모델 참여와 flow별 usage, 실패 기록 |
| P4 | hash-linked event·receipt·독립 verifier | 저장된 원본/변조/누락 판정 |
| P5 | trusted failure → seller별 REQUIRE_PREVIEW | 다음 funding 전 강제, 자동 완화 없음 |
| P6 | 6개 핵심 화면·실측 보고·README·데모 | 실제 UI와 E2E 결과, 실측/미완료 구별 |

## 명세 해석과 실행 경계

- $3.00 task budget에서 $1.80+$1.50 동시/연속 지출은 허용되지 않는다. 성공과 환불 데모는 각각 명시적으로 승인한 별도 태스크다. Control Memory는 회사+seller에 묶여 태스크 간 유지된다.
- Deal.deadline은 funding 이후의 허용 초(duration)다. funding 블록 timestamp로 실제 납품 마감을 확정하며 accepted Deal을 수정하지 않는다. expires_at은 Deal의 유효 기한이고 release에도 검사한다. 만료/권한 철회는 환불을 막지 않는다.
- demo payment unit는 테스트 자산 단위이며 실제 USD 환율을 뜻하지 않는다. 전용 로컬 지갑과 devnet을 우선 사용하고 공개 Sepolia는 전용 지갑의 테스트 ETH/접속 가용성을 별도 확인한다. mainnet은 거부한다.
- controller는 명시적인 신뢰 주체다. 납품·정책 판정을 코드로 수행한 뒤 계약의 release/refund를 요청한다. 계약 자체가 오프체인 데이터의 의미나 진실성을 검증한다고 주장하지 않는다.
- SQLite와 체인은 같은 ACID 트랜잭션이 아니다. 제출 전 intent와 서명 tx를 저장하고 UNKNOWN은 대조 전 풀지 않는다. 성공 receipt 확인 전 SETTLED/REFUNDED로 표시하지 않는다.
- 실제 Kiln 호출은 이 직접 구현 요청의 검증에 한해 제한된 횟수로 실행한다. heartbeat 감시의 무비용/무거래 범위와 구분한다. 모델/키는 환경변수에서 읽고 키를 출력하지 않는다.

## 현재 차단 요인

공개 테스트넷 잔액·RPC 가용성 미확인. 하드웨어 전력·TTFT(비스트리밍)는 미계측. 인간 관찰과 실제 기업 고객 증거 없음. 단위 테스트·로컬 EVM·실제 Kiln·공개 체인·인간 관찰을 서로 대신하지 않는다.
