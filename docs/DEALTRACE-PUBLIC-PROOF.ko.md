# DealTrace v3 실제 공개 증거

실행 `34d1da0d-e842-4f44-acfd-4d97728c81f0` · mode LIVE_KILN_SEPOLIA · 17/17 PASS · actual qwen3-32b 10회 / 12,073토큰.

이 실행은 최종 기획의 **40 예산 / 26 합의 / 31 청구 차단 / 정정 26 지급**을 실제 수행했다. 기존 v2 실행 `7d2a57a8-f236-46a8-b9da-198de969cf6e`와 구별한다.

| 동작 | Sepolia transaction | Block |
|---|---|---:|
| fund | [0x330944abfde9fc55b6f45eaa18e544774567a0973b48ea3e8598a45fea825fef](https://sepolia.etherscan.io/tx/0x330944abfde9fc55b6f45eaa18e544774567a0973b48ea3e8598a45fea825fef) | 11806754 |
| release | [0xd321f5ff9b4852aeafea3403142faa9943c3024f807980680a77c27d377cc2fd](https://sepolia.etherscan.io/tx/0xd321f5ff9b4852aeafea3403142faa9943c3024f807980680a77c27d377cc2fd) | 11806756 |
| fund | [0xee74bb22233687acd3a58eda4101490a01c2bacf75db84dd15e523890e5c47dd](https://sepolia.etherscan.io/tx/0xee74bb22233687acd3a58eda4101490a01c2bacf75db84dd15e523890e5c47dd) | 11806758 |
| refund | [0x9d79a27fdaa7c56f349b688a52c051a105dc8515d7af8abffff410c4e78d3613](https://sepolia.etherscan.io/tx/0x9d79a27fdaa7c56f349b688a52c051a105dc8515d7af8abffff410c4e78d3613) | 11806760 |

Contract: `0x04173D24864AD32fE791bd20ef5E97B4a3FC021B`. DEMO minor 1 = 1,000,000,000 wei의 테스트 자산. 자체 토큰이나 USD가 아니다. 합의 26 DEMO = 2,600 minor. 가스는 별도 운영비이고 해당 실행은 operation당 최대 400,000,000,000,000 wei로 제한했다.

31 청구 거절은 추가 체인 거래를 만들지 않는다. 이미 예치된 26은 잠겨 있고, controller nonce가 늘지 않은 전후 관측과 서명된 거절 기록을 report에 남겼다. 거절 뒤 새 ID로 서명한 26 청구에만 지급했다. 이후 별도 위임의 잘못된 납품은 환불했다.

독립 read-only 검증: **5/5 VALID**, `PASS`. 확인 시각 `2026-09-29T09:45:15.201Z`, finalized block `11806768`. 앱 DB·개인키·Kiln API를 쓰지 않는다. 최초의 finality 대기 관측과 완료 run 재개 증거도 보존했다.

[실행 report](../artifacts/dealtrace/runs/34d1da0d-e842-4f44-acfd-4d97728c81f0/report.json) · [독립 검증](../artifacts/dealtrace/runs/34d1da0d-e842-4f44-acfd-4d97728c81f0/independent-verification.json) · [원본 영수증](../artifacts/dealtrace/runs/34d1da0d-e842-4f44-acfd-4d97728c81f0/257c3ed4-2faa-4793-84f3-5dfae5978fe8.receipt.json) · [resume 증거](../artifacts/dealtrace/runs/34d1da0d-e842-4f44-acfd-4d97728c81f0/resume-proof.json)

## 제3자 재검증

`pnpm dealtrace:verify:receipt <receipt.json>`은 별도 process에서 서명·hash·위임·검수·청구·finalized chain을 검증한다. 신뢰하는 deployment는 `artifacts/dealtrace/trusted-deployment.json`으로 고정한다. 네트워크 접근 불가나 최종 확정 대기는 INCOMPLETE, 증거 변조는 INVALID다. `--offline`은 지급 영수증의 on-chain 유효성을 확정하지 않는다.

작성된 가격·공격 상황, 고정 원문 검수, 같은 운영자의 로컬 역할과 오프체인 controller를 신뢰한다. 이 결과는 실제 고객 거래나 실돈 custody 보안 감사가 아니다.
