# 공개 저장소 범위

공식 팀 저장소: https://github.com/him55710-sudo/Furiosa-x-bricksum

이 저장소는 실행 가능한 금융 통제 콘솔·정책/복구 코드·계약·검증기·테스트와 비밀 없는 실제 Kiln/devnet 실행 증거를 공유합니다. 연구 요약과 외부 비판도 포함합니다. 실제 자산용 운영 제품이나 공개 테스트넷 배포는 아닙니다.

## 로컬에만 보관하는 자료

- `.env.local` 등 인증 환경 파일. `.env.example`은 빈 키와 공개 설정만 제공합니다.
- `data/private/`: 원장 DB, 로컬 체인, 실행자·판매자 테스트 키. `artifacts/verification/`는 재생성하는 검사 보고서이며 공개용 사본만 선별합니다.
- `review/evidence/`, `artifacts/kiln-ui/`: 로그인 계정 화면과 대화 원문. 공개 문서에는 검토 요약과 판정만 포함합니다.
- `review/bot.json`, `review/completion-audit.json`, `review/council/state.json`, `review/council/delivery.json`: 해당 컴퓨터의 봇·검토·전달 상태.
- `review/runs/`: 재생성 가능한 검토 패킷.
- `research/archive/`: 학습용으로 내려받은 제3자 원문. 공개 문서는 원 출처로 연결하며 archive-manifest의 파일 경로·해시는 로컬 수집 당시 기록입니다.
- `review/vendor/`: 별도의 gstack 참조 checkout. council 문서는 고정 커밋의 원문 링크로 연결합니다.

문서의 ‘로컬 전용’ 표시는 공개 저장소에 없는 증거를 뜻합니다. 스크린샷이나 대화 원문을 공개했다는 뜻으로 해석하지 않습니다. 공개된 API 결과는 모델·도구 제안·사용량 확인에 쓰며 물리 NPU 라우팅·에너지·전체 제품 안전성까지 입증하지 않습니다.

## 새 컴퓨터에서 실행

Node.js 24 이상과 pnpm 11을 사용합니다. 잠금 파일로 의존성을 설치합니다.

```powershell
git clone https://github.com/him55710-sudo/Furiosa-x-bricksum.git
cd Furiosa-x-bricksum
Copy-Item .env.example .env.local
# .env.local의 KILN_API_KEY에 본인 키 입력
pnpm install --frozen-lockfile
pnpm contracts:build
pnpm build
pnpm test
pnpm start
```

콘솔의 구매 실행은 실제 Kiln 사용량과 devnet 테스트 결제를 발생시킵니다. 연결 진단 스크립트 kiln-probe는 결제하지 않습니다. 키를 Git이나 이슈에 붙여 넣지 않습니다. 새 검토 패킷은 `node scripts/review-packet.mjs`로 생성합니다. 봇과 예약 작업 설정은 clone만으로 다른 컴퓨터에 생성되지 않습니다. 공개 영수증의 서명은 합성 데모 승인에 대한 것이며 개인키가 아닙니다.
