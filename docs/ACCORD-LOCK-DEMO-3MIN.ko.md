# Accord Lock — 현재 체험 순서

고정 주소: https://agent-spending-firewall.vercel.app/

1. **Try with a sample task → Create task.** LG에너지솔루션 네 분기, 예산 40, 거래당 한도 30. 테스트 단위이며 현금 가치는 없다.
2. **Request offers.** 35 제안이 자동 차단되고 로그가 남는다. 트랜잭션은 생성되지 않는다.
3. **Atlas → Send counteroffer(20) → Approve & lock funds.** 22 제안을 20으로 합의하고 브라우저 EVM에 잠근다.
4. **Run worker.** 결과 네 행과 원문 근거를 확인한다. 시연용 25 청구가 주입되어 지급 버튼이 비활성화된다. 두 한도 안이어도 합의 20과 다르다.
5. **Use agreed invoice: 20 → Approve & pay → Verify on local chain → Export receipt.** 수정 청구·지급·검증을 끝낸다. 원하면 Reject & refund로 환불할 수 있다.
6. **See the matching Sepolia proof.** DealTrace의 실제 Kiln 5회 / 7,890 토큰, 공개 거래 5개, finalized 47검사를 연다. 저장된 실행의 25 거절과 20 출금을 확인한다.

브라우저 워커는 규칙 기반이며 공개 실증은 Kiln/Qwen 기반이다. 같은 런타임·같은 거래라고 말하지 않는다. 브라우저 청구 차단은 앱 검사이고, Sepolia의 25 거절은 서명된 합의에 대한 컨트랙트 검사다.

발표는 [5분 원고](DEALTRACE-PITCH.ko.md)를 따른다. 이전 녹화의 숫자를 현재 대표 거래와 섞지 않는다.
