# 공개 저장소 범위

공식 팀 저장소: https://github.com/him55710-sudo/Furiosa-x-bricksum

이 저장소는 현재까지 작성한 아키텍처·검증 계획, Kiln 연결 진단 코드와 테스트, 비밀 없는 실제 API 결과, 연구 요약과 출처, 외부 비판에 대한 판정을 공유합니다. 전체 결제 제품이나 해커톤 acceptance 완료본은 아닙니다.

## 로컬에만 보관하는 자료

- `.env.local` 등 인증 환경 파일. `.env.example`은 빈 키와 공개 설정만 제공합니다.
- `review/evidence/`, `artifacts/kiln-ui/`: 로그인 계정 화면과 대화 원문. 공개 문서에는 검토 요약과 판정만 포함합니다.
- `review/bot.json`, `review/completion-audit.json`, `review/council/state.json`, `review/council/delivery.json`: 해당 컴퓨터의 봇·검토·전달 상태.
- `review/runs/`: 재생성 가능한 검토 패킷.
- `research/archive/`: 학습용으로 내려받은 제3자 원문. 공개 문서는 원 출처로 연결하며 archive-manifest의 파일 경로·해시는 로컬 수집 당시 기록입니다.
- `review/vendor/`: 별도의 gstack 참조 checkout. council 문서는 고정 커밋의 원문 링크로 연결합니다.

문서의 ‘로컬 전용’ 표시는 공개 저장소에 없는 증거를 뜻합니다. 스크린샷이나 대화 원문을 공개했다는 뜻으로 해석하지 않습니다. 공개된 API 결과는 모델·도구 제안·사용량 확인에 쓰며 물리 NPU 라우팅·에너지·전체 제품 안전성까지 입증하지 않습니다.

## 새 컴퓨터에서 실행

Node.js 22 이상을 사용합니다. 외부 npm 패키지 설치는 필요하지 않습니다.

```powershell
git clone https://github.com/him55710-sudo/Furiosa-x-bricksum.git
cd Furiosa-x-bricksum
Copy-Item .env.example .env.local
# .env.local의 KILN_API_KEY에 본인 키 입력
node --test tests/*.test.mjs
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs --check-only
node --env-file-if-exists=.env.local scripts/kiln-probe.mjs
```

추론 명령은 실제 Kiln 사용량을 발생시키며 결제는 실행하지 않습니다. 키를 Git이나 이슈에 붙여 넣지 않습니다. 새 검토 패킷은 `node scripts/review-packet.mjs`로 로컬에서 생성합니다. 봇과 예약 작업 설정은 저장소를 clone하는 것만으로 다른 컴퓨터에 생성되지 않습니다.
