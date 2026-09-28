# Control Memory 검증 시스템

구매 권한을 사람이 서명하고, 제안은 코드와 계약의 검사를 거쳐 결제되며, 제3자가 기록을 재검증하는 전체 흐름을 확인합니다. 테스트 제목의 고정 ID가 요구사항·실행 결과·수정 위치·재현 명령을 연결합니다. 판정 기준은 `verification/catalog.mjs`에 있습니다.

## 실행

Node.js 24 이상과 저장소의 pnpm 의존성을 사용합니다.

```powershell
pnpm install --frozen-lockfile
pnpm run contracts:build
pnpm run verify:system
```

`node scripts/verify-system.mjs`로도 같습니다. 기본 실행은 외부 Kiln 호출 없이 격리된 임시 SQLite·임의 포트·로컬 EVM 테스트 자산을 사용합니다. 제품 데이터베이스나 실행 중인 devnet을 재사용하지 않습니다. 기존 회귀 테스트와 `learning/tests`도 전체 검증에 포함합니다. 브라우저 검사는 실제 제품을 새로 빌드합니다.

Windows에서는 설치된 Edge를 기본 사용합니다. 다른 환경에서는 `pnpm exec playwright install --with-deps chromium`을 실행합니다. `CONTROL_VERIFY_BROWSER_CHANNEL=chrome` 또는 `msedge`로 설치된 브라우저를 지정할 수 있습니다. 브라우저가 없거나 빌드가 실패하면 검사를 통과 처리하지 않습니다.

```powershell
node scripts/verify-system.mjs --suite=invariants --seed=12345
node scripts/verify-system.mjs --suite=scenarios
node scripts/verify-system.mjs --suite=redteam
node scripts/verify-system.mjs --suite=operations
node scripts/verify-system.mjs --suite=e2e
node scripts/verify-system.mjs --suite=browser
node scripts/verify-system.mjs --suite=invariants --case=INV-003 --seed=20260928
```

실제 Kiln E2E는 따로 실행합니다. `.env.local`의 기존 키로 **실제 추론을 최대 1회** 호출하므로 API 사용량이 발생합니다. 정상 구매의 HTTP 제품 흐름과 로컬 EVM 결제까지 확인하고, 요청 실패·모델 불일치·사용량 누락도 실패로 남깁니다. 자동 fallback이나 live 재시도는 없습니다.

```powershell
pnpm run verify:live
# 동일 명령
node --env-file-if-exists=.env.local scripts/verify-system.mjs --suite=live
```

## 무엇을 검증하는가

| 검증 축 | 실제 관찰하는 조건 |
|---|---|
| 불변조건 | 정수 금액, 수수료 합산, 정확한 경계값, 서명·목적·기한, 누적 지출 + 예약 ≤ 승인 예산, 예약/정산 보존, 이벤트 해시 연결 |
| 상태 생성 | 고정 seed로 80개의 금액·예약·거절·해제 전이 생성, 매 전이 이후 장부와 체인 노출 검사, SQL rollback |
| 동시성 | 16 TC 예산에서 8 TC 구매 6개 경합, 정확히 2개 정산, 각 증빙의 독립 검증, 동일 요청 재사용 |
| 시뮬레이션 | B0/B1/CM × 8개 시나리오 = 24개 조합, 협상·정상·수수료·비허용·만료·주입·정상화·선제 견적 거절 |
| 레드팀 | 모델/도구 바꿔치기, 복수 호출, 미등록 후보, 추가 권한 필드, 잘린 출력, 잘못된 JSON, 협상 초과액, 비밀 반사, 서명·증빙·통제 기록 변조, 계약 직접 공격 |
| 운영 | 실제 디스크와 EVM 재시작, 영수증 유실, RPC 장애, UNKNOWN 예약 유지, 재정산 방지, 제출 전후 중지 경합, 취소 재시도, SQLite 백업 복원, 준비 상태 진단 |
| HTTP E2E | 실제 HTTP 지갑 로그인→서명 승인→구매→토큰 이동→증빙 다운로드→별도 verifier→변조 거부, 다른 소유자의 접근·Origin·Host·로그인 재사용 차단 |
| 브라우저 | 실제 화면에서 위임·서명·구매·검증·파일 다운로드·변조 실험·중지, 브라우저 런타임 오류 검사, 스크린샷 |
| Live | 실제 qwen3-32b 사용량과 HTTP 구매·devnet receipt·독립 검증 연결 |

모의 응답은 실제 `Kiln` 어댑터에 합성 HTTP 응답을 주입하여 출력 검증을 함께 거칩니다. 제품 HTTP 입력으로 모의 모드나 정책 우회를 켤 수 없습니다. 공개 테스트넷·실물 공급·물리 NPU·전력 실측의 성공으로 해석하면 안 됩니다. 시나리오 행렬은 기능 검증이며 CM의 효율 우월성을 주장하는 통계 실험이 아닙니다.

## 결과와 보완 루프

각 실행은 `artifacts/verification/<run-id>/`에 다음을 저장합니다. `latest.json`은 최근 실행 위치이며, 과거 기록은 덮어쓰지 않습니다.

- `report.html`: 축·상태별 필터, 실패 원인, 수정 위치, 재현 명령, 증거 링크.
- `report.json`: 소스 SHA-256·Git revision·Node 버전·seed·실행 시간·판정·기존 회귀 결과.
- `report.md`: 사람이 검토할 요약.
- `findings.json`: 이번 실행에서 열린 문제, 우선순위, 재현 명령.
- `evidence/`: 시나리오 행렬·상태 전이·복구 결과·실제 HTTP 번들·브라우저 스크린샷. live 실행이면 실제 API 사용량도 포함.

선택된 검사 중 실패·누락·skip, 회귀 실패, 실행 기반 오류, **실행 중 소스 변경**이 있으면 종료 코드 1입니다. 미선택 검사는 `NOT_RUN`으로 표시하며 통과율의 분모에서 분리합니다. 잘못된 CLI 인자는 종료 코드 2입니다. CI는 실패한 실행에서도 보고서를 보존합니다. GitHub CI 실행 자체는 로컬 통과와 별개입니다.

문제가 생기면 보고서의 재현 명령을 실행하고, 같은 ID의 검사가 실제 문제를 재현하는지 확인한 뒤 수정합니다. 해당 검사 통과 후 전체 `verify:system`을 다시 실행합니다. 새로운 장애는 catalog의 고정 ID와 실행 케이스로 추가해 반복 검증에 넣습니다. `findings.json`이 비었다는 사실은 **그 실행에서 선택한 범위**에 열린 문제가 없다는 뜻입니다.

API 키·로그인 cookie·지갑 개인키·송신용 raw transaction을 보고서에 기록하지 않습니다. 테스트 지갑과 체인 키는 검사별 임시 폴더에만 만들고 종료 시 제거합니다. 보고서 자체는 로컬 생성물로 Git에서 제외합니다. 공유할 때는 필요한 실행 폴더만 검토하여 전달합니다.

## 운영 판정과 복구

`GET /api/health`는 SQLite·체인 연결이 준비되면 200 `READY`, 의존성 장애이면 503 `NOT_READY`를 반환합니다. `pending`은 제출/UNKNOWN 건수입니다. 외부 모니터링 서비스는 아직 연결하지 않았습니다.

1. `UNKNOWN`은 실패 확정이 아닙니다. 예약금을 유지하고 같은 서명 거래의 receipt를 확인합니다. 새 nonce로 같은 구매를 다시 전송하지 않습니다.
2. 미확정 거래가 있으면 새 제출을 차단합니다. 공유 executor의 nonce 및 선행 지출이 확정돼야 다음 증빙을 만들 수 있습니다.
3. 사용자의 중지는 로컬에서 먼저 적용합니다. 제출이 시작된 run은 응답의 `submittedRuns`에 남기고 체인 순서대로 결제/취소를 확인합니다.
4. 백그라운드 복구는 15초마다 미확정 결제와 미확정 취소를 재확인합니다. 실행 중인 worker는 복구 대상에서 제외합니다.
5. 운영 백업은 SQLite backup API 등 일관된 방식으로 생성합니다. WAL 파일을 무시한 단순 복사는 이 테스트의 복원 절차와 다릅니다.
6. 계약 소스가 바뀌면 새 artifact를 빌드하고 새 데이터 디렉터리에서 배포를 검증합니다. 현재 devnet 상태를 지워 오류를 숨기지 않습니다.

다중 프로세스 worker, 장시간 부하/SLO, 체인 재조직, 공개 테스트넷, 외부 지갑 확장, 실제 공급/환불, 외부 경보 연동은 추가 검증 항목입니다. 로컬 통과는 운영 배포 승인을 의미하지 않습니다.
