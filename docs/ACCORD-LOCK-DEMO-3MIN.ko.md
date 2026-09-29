# Accord Lock — Track B 최종 3분 시연 계획

[영문 기준 원고](ACCORD-LOCK-DEMO-3MIN.en.md) · [두 정지 실행의 원본 기록](../artifacts/accord-lock/track-b-stops.json) · [공개 실행 보고서](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json)

목표 길이 2분 55초, 최대 3분. 화면에 `RUN 1`, `RUN 2`, `STOPPED`, 실제 엔진 상태 `BLOCKED` 및 이유 코드를 반드시 표시한다. 이전 영상은 과거 버전의 역사적 자료다.

| 시간 | 화면과 설명 |
|---|---|
| **0:00–0:15 문제** | 인간 예산 40, 협상된 Deal 20, 청구 25. “예산 안의 금액도 합의한 거래가 아니면 지급할 수 없습니다.” |
| **0:15–0:50 RUN 1** | [브라우저 샘플](https://agent-spending-firewall.vercel.app/)에서 예산 40, 거래당 한도 30, Meridian의 35 제안과 남은 `Sample offer blocked` 활동 로그를 보여준다. 별도 [엔진 실행 기록](../artifacts/accord-lock/track-b-stops.json)의 `MAX_SINGLE`, `POLICY_CHECKED`, `TRANSACTION_BLOCKED`를 보여준다. 이 기록에서는 Kiln 호출·자금 잠금·지급·Deal 거래가 모두 0이다. |
| **0:50–1:20 RUN 2** | 허용 판매자 A/B/C와 등록되었으나 허용되지 않은 D의 20 제안을 [두 번째 실행 기록](../artifacts/accord-lock/track-b-stops.json)에서 보여준다. `SELLER_ALLOWED` 실패, `BLOCKED`, `TRANSACTION_BLOCKED`를 눈에 띄게 둔다. Kiln 호출·자금 잠금·지급·Deal 거래가 모두 0이다. 브라우저 셀러 선택 화면이 아니라 엔진 기록임을 말한다. |
| **1:20–1:40 사람의 Stop** | 미리 20을 잠근 브라우저 작업에서 **STOP AGENT**를 누른다. 새 지출 권한 중단과 기존 약정 20 유지를 보여준다. 이는 해당 작업의 로컬 권한 취소이며 전역 온체인 취소가 아니다. |
| **1:40–2:30 실제 Kiln + Sepolia** | [공개 V2 보고서](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json)의 Kiln 5회, 22→20 협상, [25 청구 실패 거래](https://sepolia.etherscan.io/tx/0x255d855d5e19779fdc0fd12a02c924db0bb1980561fbc3dea98df230135e4e59), [20 정산](https://sepolia.etherscan.io/tx/0x00b1e35d51542daceacd191caabf6fd0e77b740ecb45eab0b4daa15965ecce2f), [판매자 출금](https://sepolia.etherscan.io/tx/0x6a322e82f24b1fd1b3c2d40f2215ead29c9b0c4d1899b1bb6f87cecaf95cb7cc)을 보여준다. 브라우저는 로컬·규칙 기반, 공개 증거는 실제 Kiln·Sepolia 실행으로 서로 다른 런타임과 거래다. |
| **2:30–3:00 증거 요약** | 한 화면에 정지 2회, Kiln 5회, 입력 4,145·출력 3,745 토큰, Sepolia 거래 5개, [finalized 47개 검증](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/finalized-verification.json)을 표시한다. “Accord Lock makes the negotiated agreement the boundary for agent payment.” |

정지 사례는 말로만 주장하지 않고 보존된 이벤트를 보여준다. Sepolia의 실패 거래는 컨트랙트 집행 증거이며 지급 성공으로 표현하지 않는다.

세 재구성 대본은 합성 평가이며 실제 사람 이해도 검증으로 집계하지 않는다. 실제 최초 사용자 응답은 0명이다.
