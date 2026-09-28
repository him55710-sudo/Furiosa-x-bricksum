# Control Memory — GWDC Challenge B

**Declared function (target):** Control Memory lets a small team's owner delegate a bounded API-credit purchasing session to a Kiln-powered agent, stops unauthorized spending, and gives an independent reviewer a verifiable record of each decision and payment.

소규모 개발팀 운영자가 API 크레딧 구매를 AI에 맡길 때, 승인 범위를 지키고 사후에 그 사실을 검증하는 프로토타입을 설계합니다. 핵심은 **검증된 실패 기록이 다음 시도의 더 이른 통제로 이어지는 것**입니다.

공개 저장소에는 코드·설계·연구 요약·비밀 없는 API 실행 JSON을 포함합니다. 환경 파일, 계정 화면과 대화 원문, 개인 학습용 논문 원본은 로컬에 보관합니다. [공개 범위와 실행 방법](docs/PUBLICATION.ko.md).

## 현재 상태 — 2026-09-28

- 설계 완료: [전체 아키텍처](docs/ARCHITECTURE.ko.md), [Kiln 조사와 연결 방법](docs/KILN-INTEGRATION.ko.md), [데모와 검증 계획](docs/DEMO-PLAN.ko.md).
- 구현 완료: 별도 패키지 설치 없이 실행하는 Kiln 연결 진단 스크립트. 모델 조회 후 합성 구매 후보를 비교하는 실제 추론 요청을 최대 1회 보냅니다. 결제 기능은 없습니다.
- 미구현: 제품 UI, 전체 정책 엔진, Control Memory 저장소, 지갑 승인, 테스트넷 결제, 독립 검증기. 아래 기능 선언은 구현 목표이며 대회 기준 달성 선언이 아닙니다.
- 모델 변경: 사용자가 2026-09-28 필수 모델을 **`qwen3-32b`**로 변경했다고 명시했습니다. 설정·모델 검사·플레이그라운드를 이에 맞췄습니다. 자동 fallback은 없습니다.
- 실제 연결 성공: 인증 모델 조회와 `qwen3-32b` 추론 모두 HTTP 200. `offer_selection` 흐름에서 `beta-plus` 제안이 검증됐고 입력 355 / 출력 405 / 합계 **760토큰**, 공급자 보고 비용 **$0.00014156**, 응답 지연 **5,951ms**를 기록했습니다. [실제 실행 기록](artifacts/kiln/9292ce67-a174-406f-9021-f5e6a7dd8837.json).
- 증거 범위: 수수료 포함 예산 초과·비허용 판매자 후보는 코드에서 제외했습니다. 이는 연결 진단의 후보 필터링과 도구 제안 검증이며, 전체 세션 안전성·실제 결제·물리 NPU 라우팅·전력 실측의 증거는 아닙니다.
- 과거 GPT 모델 부재 기록은 보존합니다. [기존 활성화 조사](docs/KILN-ACTIVATION-UI.ko.md)는 사용자 모델 변경으로 종료됐고 운영사 문의는 발송하지 않았습니다.
- 기획 개선 완료: [Grok Bot 검토 루프](review/README.md)를 만들고 실제 비판·판정·수정·재검토를 2회 진행했습니다. [연구 자료집](research/README.md)을 [테스트 요구](review/RESEARCH-TO-TESTS.ko.md)에 연결하고, [3-arm 실험 초안](docs/EXPERIMENT-PROTOCOL.ko.md)을 작성했습니다. 실험 결과는 아직 없습니다.

## 연결

1. `.env.local`의 `KILN_API_KEY=` 뒤에 기존 Kiln 키를 입력합니다. 키 원문을 채팅이나 Git에 올리지 않습니다.
2. Node.js 22 이상에서 다음을 실행합니다. 외부 npm 의존성은 없습니다.

```powershell
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs --check-only
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs
```

`kiln:check`는 모델 목록만 조회합니다. `kiln:probe`는 모델이 제공될 때만 API 크레딧 구매 후보를 비교하는 요청 1회를 보내므로 Kiln 사용량이 발생할 수 있습니다. 연결 요청에 쓰이는 데이터는 합성 예시입니다.

위 명령은 각각 `npm run kiln:check`, `npm run kiln:probe`와 같습니다. 현재 도구 환경은 `node`만 PATH에 있어 직접 명령으로 검증했습니다. 목록에 없는 필수 모델의 실제 라우팅을 1회 진단하려면 `--verify-route`를 사용합니다. 이 옵션도 모델 대체나 결제를 하지 않습니다.

키 없이 요청 형식과 후보 사전 검사를 보려면 `npm run kiln:preview`를 실행합니다. 이 출력은 오프라인 확인이며 실제 Kiln 성공 사례가 아닙니다.

검토 자료를 새로 묶으려면 `node scripts/review-packet.mjs`를 실행합니다. 자세한 다음 개발 단계는 [구현 인계](docs/IMPLEMENTATION-HANDOFF.ko.md)를 따릅니다.

연결 진단의 오프라인 응답 검증은 `node --test tests/kiln-probe.test.mjs`로 실행합니다. 8개 테스트(정상 제안, 모델 부재, model_not_found 404, 미분류 404 및 오류 비밀 누출 방지, 모델 바꿔치기, 출력 잘림, 부적격 후보, 복수 호출)를 통과했습니다. 이 테스트는 네트워크를 모의 처리하므로 실제 NPU 추론 또는 제품 안전성 전체를 입증하지 않습니다.

실행 기록은 `artifacts/kiln/<run-id>.json`에 저장됩니다. 키나 HTTP 인증 헤더는 저장하지 않습니다. `STOPPED`와 사유도 결과입니다. API 사용량이 응답에 없으면 `null`로 남깁니다.

## 제품 역할 분담

| Kiln / qwen3-32b | 결정론적 코드 | 블록체인 |
|---|---|---|
| 자연어 구매 조건 초안, 적격 후보 비교, 제한된 협상, 요청 시 설명 | 사람의 최종 승인, 서명·스키마 검사, 누적 예산·수수료·판매자·기한·중지, 원자적 예약, 증빙 검증 | 승인 상태와 취소, 예산·수취인 제한, 테스트 토큰 결제, 증빙 해시 |

프로토타입의 목표 흐름: 사용자 요청 → 승인할 조건 확인 → 위임 → Kiln 제안 → 코드 검사 → 테스트넷 결제 또는 사유 있는 중지 → 영수증 → 제3자 재검증.
