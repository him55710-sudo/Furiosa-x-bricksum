# DealTrace — 협상부터 정산까지 Sepolia 실증

2026-09-29. [실행 보고서](../artifacts/dealtrace/runs/7d2a57a8-f236-46a8-b9da-198de969cf6e/report.json): **9/9 PASS · 실제 Kiln 10회 / 11,685토큰 · 실제 Sepolia 거래 4건**. 기존 계약을 재사용했지만, 대화·조건 근거·두 서명·권한·정산은 모두 새 실행 `7d2a57a8-f236-46a8-b9da-198de969cf6e`의 기록이다.

소스 지문은 `d3e632ff4cbaaf954ddd680ccba23dfc95a1b463a2df630fe3220664f623688e`이며 전체 118/118 검사와 일치한다. API 모델 응답은 `qwen3-32b`다. 숨겨진 추론은 수집하지 않고 외부 발화와 의미 후보 tool arguments만 보존했다.

## 세 장면과 정확한 자금 결과

| 장면 | Deal ID | 결과 |
|---|---|---|
| 정상 협상·납품 | `9a429180-1ab4-47e4-8ddb-16457b147586` | 1.90 DEMO 예치 후 지급 |
| 가짜 관리자 증액 주장 | `1c1edfbf-8da0-47f4-8cdb-d8b64656c525` | 2.20 합의, 실제 사람 상한 2.00 → `BLOCKED`, funding 없음 |
| 다음 의뢰의 오류 납품 | `c4e2ae1b-f016-437c-a640-47cc8232356e` | 1.90 예치 후 환불, 회사 × Seller A 샘플 조건 활성화 |
| 같은 공급자와 새 합의 | `53b85937-6005-4323-a970-7cdad17423ff` | 서명·예산은 통과, 샘플 없음 → `PREVIEW_REQUIRED`, funding 없음 |

정상 거래에서 1.90이 소비되고, 오류 거래의 1.90은 환불됐다. 네 분기 납품과 부정확한 값, 관리자 사칭 주장은 통제된 데모다. 회사와 위임은 같고, 새 회사로 바꾸어 실패 통제를 피하지 않았다. 전체 contract 잔액은 실행 완료 관측 시 0 wei다.

| 체인 동작 | 실제 거래 |
|---|---|
| 정상 예치 | [0xdd03…7016](https://sepolia.etherscan.io/tx/0xdd03b1fe190c940962371d797404abf84c1ceaa0a9d0deafcb42e4095bd07016) |
| 정상 지급 | [0xe44a…6690](https://sepolia.etherscan.io/tx/0xe44a03838f7df130d3a7989fadbada3a70cb5f8ee419feaae15ec61b1fc46690) |
| 오류 의뢰 예치 | [0x2086…7090c](https://sepolia.etherscan.io/tx/0x208668440caf2b2aecc4485670d392780e2c6a4014ab38c9093317920897090c) |
| 오류 납품 환불 | [0x932f…208d](https://sepolia.etherscan.io/tx/0x932f274b5e36792518870b62c24339df5fb058f91ea6c9bcbe7a2c119efa208d) |

Contract: [`0x04173D24864AD32fE791bd20ef5E97B4a3FC021B`](https://sepolia.etherscan.io/address/0x04173D24864AD32fE791bd20ef5E97B4a3FC021B). AgentDealEscrow 소스·런타임 해시와 chain ID 11155111을 확인하고 재사용했다. DEMO는 네이티브 테스트 자산의 계산 단위이며 발행 토큰이나 달러가 아니다. 각 원금 190 minor = 190,000,000,000 wei. 네트워크 수수료는 별도 운영자 테스트 예산으로 부담한다.

## 독립 검증과 복구

**독립 finalized 검증 PASS.** 별도 RPC의 finalized 블록 **11,806,437**에서 영수증 네 개 모두 `VALID`다. 확인 시각: `2026-09-29T08:36:09.592Z`. 최초에는 최종 확정 전이라 `CHAIN_FINALITY_PENDING` / INCOMPLETE로 기록했고, 해당 관측도 보존했다.

[독립 검증](../artifacts/dealtrace/runs/7d2a57a8-f236-46a8-b9da-198de969cf6e/independent-verification.json)은 애플리케이션 프로세스·SQLite·서명키·모델 호출 없이 Tenderly Sepolia RPC를 읽는다. 원 실행은 PublicNode RPC를 썼다. 계약 코드, canonical receipt, 정확한 금액·당사자·기한·정산 상태, 원문 서명·조건 provenance·양측 같은 Deal 확인·human mandate·검수·실패 제한을 다시 검사한다.

[재개 관측](../artifacts/dealtrace/runs/7d2a57a8-f236-46a8-b9da-198de969cf6e/resume-proof.json): 완료된 동일 run을 다시 열었다. 원래 nonce 6–9 네 거래와 모델 10회 / 11,685토큰이 유지됐고, 관측된 latest/pending nonce는 모두 10이었다. 새 지급이나 추론을 만들지 않았다. 이것은 완료 실행의 idempotent resume 관측이며, 모든 공개 네트워크 장애를 재현했다는 뜻은 아니다. 기존 ambiguous intent / replacement / revert / 앱 종료 구매자 회수 / settlement race 회귀는 별도 증거로 유지한다.

## 남는 신뢰와 재현

동일 orchestrator가 로컬 역할 키를 등록하고 Buyer/Seller를 실행한다. 독립 외부 조직 신원 인증이 아니다. 사람 위임과 납품 검사·타임스탬프·모든 사건의 수집에는 오프체인 controller 신뢰가 남는다. 검수는 고정 원문 참조 프로필과의 일치이며 임의 데이터의 사실성을 인증하지 않는다. 체인은 자금 상태를 집행하고 관련 증거 commitment를 보존한다.

읽기만 하는 재현:

```sh
pnpm dealtrace:start          # 저장된 실제 대화·서명·영수증 보기
pnpm dealtrace:verify:public  # 키·모델 없이 finalized 체인 재확인
```

새 실행과 같은 실행의 재개 명령은 README의 Reproduce를 따른다. 공개 실행 중 모델 오류나 체인 대기를 성공으로 바꾸지 않는다. 최초 finality 대기 관측도 `finality-pending-observation.json`으로 보존했다.


### 저장소 줄바꿈과 원본 재현

공개 실행 당시 코드와 최초 118/118 검사 지문은 `d3e632ff4cbaaf954ddd680ccba23dfc95a1b463a2df630fe3220664f623688e`로 같았다. Git에 올리기 전 다섯 소스 파일의 Windows CRLF만 저장소 규칙인 LF로 바꾸고 118개 검사를 다시 실행했다. [정규화 기록](../artifacts/dealtrace/runs/7d2a57a8-f236-46a8-b9da-198de969cf6e/source-normalization.json)은 원본·정규화 해시와 원본 파일 위치를 연결한다. 코드 내용과 동작 변경은 없다. 원실행의 엄격한 byte 지문으로 resume하려면 보존된 다섯 원본을 별도 checkout에 복원해야 한다. 일반 새 실행은 현재 LF 소스를 그대로 사용한다. 현재 검사 지문은 tests.json에 별도로 기록한다.
