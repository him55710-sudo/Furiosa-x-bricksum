# 구축 중 발견한 문제와 회귀 검사

| 문제 | 재현 결과 | 보완 | 검사 |
|---|---|---|---|
| 병렬 예약 시 두 번째 구매가 첫 번째 구매 확정 전의 spentBefore를 증빙에 저장 | 정상 결제인데 verifier가 CUMULATIVE_BUDGET_MISMATCH | 직렬 제출 순서 안에서 정책과 누적 지출을 재검사하고 그 시점의 증빙을 anchor | INV-003 |
| 내보낸 run.controls 삭제가 anchor 비교에서 빠짐 | 목록을 지워도 VALID | preEvidence의 controls·domain을 외부 bundle과 비교 | RED-002 |
| 선행 UNKNOWN이 있는 상태에서 같은 executor로 새 제출 가능 | 미확정 결과에 따라 nonce와 지출 증거가 모호해짐 | 미확정 제출이 해소될 때까지 추가 제출 중지, 예약 해제는 미제출 run에만 적용 | OPS-003 |
| 서버의 주기 복구가 미확정 결제만 처리 | pending 취소는 서버 재시작 전까지 재시도하지 않음 | 주기 복구가 결제와 취소를 함께 처리하고 실행 중인 작업 제외 | OPS-002, OPS-003 |

HTTP Host 공격의 첫 fixture는 Fetch의 Host 정규화 때문에 실제 공격 헤더를 전송하지 못했습니다. raw HTTP로 교체해 실제 Host 거부를 검사합니다. 브라우저 검사도 화면을 먼저 닫고 서버/DB를 정리하도록 종료 순서를 수정했습니다. 이 둘은 제품 취약점이 아니라 검증 도구의 오류였습니다.
