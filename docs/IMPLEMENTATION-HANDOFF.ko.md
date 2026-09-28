# 다음 구현을 위한 인계

2026-09-28. 현재 산출물은 설계·연구 연결·실제 Grok Bot 리뷰 2회·Kiln 연결 진단입니다. 전체 제품 또는 해커톤 acceptance 완료가 아닙니다.

## 확정된 방향

사용자는 소규모 개발팀 예산 담당자입니다. 가상 API 크레딧을 비교·협상하는 AI에게 제한된 구매 업무를 위임하고, 완료/중지 이유를 제3자가 검증합니다. React/TypeScript UI, Node/TypeScript API·단일 worker, SQLite, viem, Solidity BudgetVault + TestCredit를 기본 구성으로 삼습니다. 패키지는 실제 구현 시 호환 버전을 고정합니다.

Kiln은 조건 초안·후보 비교·제한된 협상을 합니다. 승인, 지출 한도, 수수료, 수취인, 기한, 중복, 중지, 증거 판정은 코드와 계약이 담당합니다. Control Memory는 증거에서 파생한 한 종류의 ‘더 이른 확정 총액 요구’만 구현합니다. 이득이 없다면 효율 우월성 대신 통제 변경 이력의 검증 가능성을 내세웁니다.

## 작업 순서와 완료 증거

| 순서 | 구현 단위 | 완료로 볼 증거 |
|---|---|---|
| 1 | mandate/immutable offer schema, 고정 purpose, signer manifest, 정수 금액 검사 | 수수료 초과·비허용 수취인·만료·견적 변조를 독립 fixture에서 거부 |
| 2 | 원자적 예약/outbox, stop과 submission 시작 경합, UNKNOWN 복구 | 30 예산에 20+20 동시 요청 중 하나만 통과; crash 후 중복 지급 없음 |
| 3 | 작은 BudgetVault와 TestCredit, 격리 contract harness | 동일 build artifact의 예산/수취인/replay/revoke 테스트, 배포 manifest |
| 4 | Kiln adapter와 generation/usage event를 실제 run에 연결 | 필수 모델의 실제 proposal이 다음 행동을 바꾼 기록; 잘못된 출력은 명시 중지 |
| 5 | 위임·활동/중지·영수증·독립 검증 UI와 export | 다른 실행 환경에서 승인→offer→이력→chain을 재구성. 변조 INVALID, 누락 INCOMPLETE |
| 6 | 테스트넷 정상 흐름과 2개 위반 중지 run | 성공 tx hash/receipt와 일치하는 history, 별도 STOPPED 로그 2개 |
| 7 | 통제 기억·3-arm 실험·4분 영상 | 실패 사건→규칙→다음 run의 더 이른 검사, 공정한 결과표와 제한 |

필수 모델은 사용자 안내에 따라 qwen3-32b로 변경했고 실제 연결 진단이 성공했습니다. 4번은 이제 진단에서 검증한 adapter를 제품의 세션·행동·사용량 이력에 통합하는 작업입니다. 모의 응답을 실제 API 증거로 사용하지 않습니다.

## 외부 의존성

공식 `https://api.bricksum.com/v1`에서 qwen3-32b 실제 요청과 응답 모델이 일치했고, HTTP 200·도구 제안·760토큰을 확인했습니다. [실행 JSON](../artifacts/kiln/9292ce67-a174-406f-9021-f5e6a7dd8837.json). 과거 GPT 활성화 문의는 모델 변경으로 종료됐으며 발송하지 않았습니다.

제출용 물리 NPU 라우팅 근거와 전력 계측 자료는 여전히 공급자 정보가 필요합니다. 이것은 API 연결 실패가 아니라 실행 인프라·에너지 주장에 필요한 별도 증거입니다. [Kiln 명세](KILN-INTEGRATION.ko.md)에 증거 범위를 구분했습니다.

테스트넷 지갑·RPC·faucet·배포는 아직 구성하지 않았습니다. 실행할 때 테스트 자산과 공개 체인/주소를 명시합니다. 실제 금융 자산·실제 상품 공급·광범위 계정 권한은 이 MVP에 필요하지 않습니다.

## 검토 루프 재사용

1. 구현한 기능의 실제 테스트 결과를 문서에 반영합니다.
2. `node scripts/review-packet.mjs`로 지정 문서의 hash가 붙은 snapshot을 만듭니다.
3. 전용 Bot (팀 계정의 로컬 Bot)에 비밀 없는 변경·증거를 전달합니다.
4. finding별 판정과 이유를 남긴 뒤 채택한 최소 변경만 적용하고 재검토합니다.

현재 [Round 2](../review/ROUND-2.ko.md)의 해결 상태는 설계 수준입니다. 운영 중 자동 발송/예약 작업은 설정하지 않았습니다. 봇은 비판 권한만 가지며 제품의 Kiln 모델이나 결제 실행기를 대체하지 않습니다.
