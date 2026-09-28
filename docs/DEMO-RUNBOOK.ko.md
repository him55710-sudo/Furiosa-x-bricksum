# 3분 데모와 재현

준비: pnpm contracts:build, pnpm build, pnpm start를 실행하고 http://127.0.0.1:3400 을 엽니다. .env.local에 Kiln 키가 있어야 합니다. 먼저 pnpm verify:system을 확인합니다. API는 새 응답을 내므로 성공·지연·출력 잘림을 미리 고정하지 않습니다.

| 시간 | 조작 | 관찰과 설명 |
|---|---|---|
| 0:00–0:25 | 예산 위임: 총 20 TC, 건별 8 TC, 판매자 3곳, 60분, 호출 5회, 추가 통제 허용 → 확인 → 서명 | 사람이 정한 승인 원본. 가스는 운영자 테스트 ETH 지원. |
| 0:25–0:55 | 추가 수수료 실행 | Qwen 후보 제안 후 5 + 7 = 12 TC 견적을 BLOCK. 이유·실제 토큰 표시. |
| 0:55–1:15 | 같은 시나리오 재실행 | 같은 scope의 기억을 적용해 AI 호출 0회로 중지. 안전 기준은 동일. |
| 1:15–1:50 | 정상화된 판매자 실행 | 6 TC 새 견적은 허용. 영구 blacklist가 아니다. devnet 토큰 이동. |
| 1:50–2:20 | 승인과 증빙 → 검증 → 금액 변조 → 증빙 받기 | 원본 VALID, 복사본 INVALID. tx hash와 matching history. |
| 2:20–2:40 | 허용되지 않은 판매자 실행 → 에이전트 중지 | 두 번째 종류의 경계 위반과 사람의 취소. |
| 2:40–3:00 | 효율성 비교 | B0/B1/CM 실측, 견적 거절의 기회 손실, 학습 비용. 전력 미계측. |

조건 협상은 별도 총 40 TC / 건별 30 TC에서 실행합니다. 35 TC 초기 견적에 Kiln negotiation 흐름으로 28–30 TC를 요청한 뒤 새 판매자 서명 견적을 검사합니다. 호출 상한이나 잘린 응답은 사유 있는 중지가 올바른 결과입니다. 성공만 고르고 최초 실패를 숨기지 않습니다.

제3자는 JSON과 별도로 신뢰한 배포 manifest를 받고, 원래 devnet이 실행 중일 때 아래를 실행합니다. SQLite나 owner key가 필요 없습니다.

```sh
node scripts/verify-evidence.mjs <receipt.json> artifacts/devnet/deployment.json
```

체인이 없는 PC에서 예전 receipt를 검증 완료라고 표시하지 않습니다. 새 설치에서는 새 승인·결제를 시연합니다. preEvidence를 제거한 복사본은 INCOMPLETE, 금액 변경은 INVALID입니다.

제품 기록 공개용 내보내기: `node scripts/export-demo.mjs`. 이름이 GWDC 로 시작하는 합성 데모 세션만 선택하며 비밀 키·raw signed transaction은 제외합니다. artifacts/demo/acceptance.json에 실제 사용량·tx hash·증빙 경로·판정이 매핑됩니다.
