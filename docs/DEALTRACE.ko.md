# DealTrace 구현 구조

기능: 외부 문서 처리 Agent와 협상한 작업을 양측이 같은 거래로 확인하고, 납품과 청구가 그 약속에 맞을 때만 사람의 권한 안에서 지급한다.

대표 장면은 **예산 40 / 합의 26 / 청구 31 → 지급 차단**이다. 청구를 26으로 정정하고 검수에 통과하면 한 번 지급한다. 기존 에스크로·검수·영수증·복구 기능 앞에 협상과 서명된 청구 검사를 연결했다.

## 모듈

| 파일 | 역할 |
|---|---|
| `src/dealtrace/agent-service.mjs` | Buyer/Seller별 HTTP 프로세스, 별도 키·저장소, 자기 대화와 전체 Deal 검토, 서명 |
| `src/dealtrace/agent-client.mjs` | 프로세스 시작·종료, 제한된 인증 채널, 공개 키만 수신 |
| `src/dealtrace/ledger.mjs` | 서명된 ConversationEvent, 순서·해시, NegotiationState, DealRevision, DealCommit |
| `src/dealtrace/kiln.mjs` | 실제 Qwen 발화·의미 후보, 도구 스키마 검사, 토큰·지연 기록 |
| `src/dealtrace/claims.mjs` | 전체 검수 프로필 바인딩, 서명된 청구, 정확한 금액·수령인·자산·납품 일치 |
| `src/deal-escrow/engine.ts` | 위임·예산·동시 실행·회수·claim 대기 및 정확히 한 번 정산 |
| `src/deal-escrow/chain.mjs` | Sepolia 예치·지급·환불, 가스 한도, 실제 예치 block 시각 |
| `src/deal-escrow/audit.ts` | 대화·위임·원문·검수·청구·체인을 독립 재계산 |
| `web/dealtrace/` | 3장면 UI, 원문 점프, 결과물·영수증 다운로드, 승인·중지 |

## 상태와 불변 조건

1. RFQ와 사람 위임은 먼저 고정한다. 판매자 문구로 예산을 변경할 수 없다.
2. 각 역할은 자기 transcript의 발신자·순서·이전 해시·서명을 확인한다.
3. Qwen은 의미 후보를 제안한다. 코드가 단위·출처·필드·충돌을 검사한다.
4. 자연어 Accept만으로 예치할 수 없다. 각 프로세스가 전체 Deal과 검수 프로필을 검토한 뒤 동일 revision/deal/mandate를 서명한다.
5. 위임, 남은 예산, 판매자, 만료, 과거 제한을 확인한 뒤 고정 총액을 예치한다.
6. 납품이 맞아도 청구가 없으면 지급하지 않는다. 서명된 청구의 금액·수령인·자산·Deal·납품 hash·시각이 모두 맞아야 한다.
7. 거절 이력은 변경 불가다. 정정에는 새 claim ID를 쓰며, 같은 ID의 내용 변경과 중복 지급은 차단한다.
8. 오납품은 환불하고 회사×판매자 REQUIRE_PREVIEW를 기록한다. 새 위임이 이를 지우지 않는다.

Deal은 source manifest, validator profile, ALL_IN_FIXED_PRICE, recipient, chain ID, contract, unit conversion, funding-block deadline anchor를 포함한다. 공개 funding 전에 충분한 납품 창을 확인하고 실제 block 시각도 영수증에서 재검증한다. 모델 호출과 의미 판정은 합의 확정 전에 끝난다.

## 신뢰 경계

세 역할은 별도 프로세스지만 같은 운영자의 로컬 서비스다. 외부 기업 인증은 아니다. 에스크로는 오프체인 controller의 검수 판단을 신뢰한다. 원문 수치 비교는 지원하는 고정 공식 자료에 한정한다. 체인은 자금 상태와 정산 근거 commitment를 보존하며 의미의 진실성은 보장하지 않는다.

[검증 수치](DEALTRACE-VALIDATION.ko.md) · [실제 공개 거래](DEALTRACE-PUBLIC-PROOF.ko.md) · [최종 기획](DEALTRACE-FINAL-PLAN.ko.md)
