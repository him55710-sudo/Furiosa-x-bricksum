# v3 핵심 기능 완료 감사

목표: “핵심 기능들을 모두 구현하고 검증한다.” 범위는 [v3 계획](HACKATHON-PLAN.v3.ko.md)의 P0-1~P0-5와 Challenge B acceptance criteria다. P1의 실제 고객 shadow replay·표준 x402 SDK 비교는 후속 검증이며, 완료한 기능이나 상용 연동으로 계산하지 않는다.

## 요구사항별 증거

| 요구 | 구현 및 직접 확인할 증거 | 판정 |
|---|---|---|
| 한 문장 기능·사용자·사용 흐름, AI와 코드의 역할 | README의 Declared function, PurchaseApp 승인→조회→복구→영수증, 구현 문서 역할 표 | 구현·로컬 관통 검증 |
| 구매 ID·자료 조건에 묶인 사람 서명 | Consent EIP-712, Quote EIP-712, PurchaseVault 승인 및 결제 함수, 서명/자료 변조 테스트 | 통과 |
| 구매당 지급 최대 1회·새 ID 우회·재등록 차단 | 계약 settled latch, 새 offer의 mined revert, 취소 후 재등록/nonce 재사용 거부 | 로컬·공개 Sepolia 통과 |
| 정상 구매가 실제로 완료됨 | TestCredit Transfer, 자료 bytes·서명, Qwen 인용 답변, 통합 보고서 | 공개 Sepolia 통과 |
| 예산·판매자·기한의 최소 두 경계 이탈 | 수수료 포함 12 > 8, outsider, expired. 각각 중지 이벤트·추론 0·지급 0 | 로컬·공개 Sepolia 통과 |
| 방송 전/후 장애·동시 실행·확정 불명 상태 | 서명 tx를 방송 전 저장, 같은 tx 재방송, 실제 socket 유실, SQLite 작업 잠금, nonce 교체 증거 | 통과 |
| 최종 확정 대기·재편성 | 확정 전 결과 조회/추론 보류, 실제 로컬 evm_revert 후 동일 tx 복구 테스트 | 2개 추가 테스트 통과 |
| 보호된 자료 재조회·회수 불가 | 1회성 challenge·owner/executor 서명·제3자 및 재사용 거부, UNRECOVERABLE에서도 추가 결제 없음 | 통과 |
| 실제 Kiln Qwen3-32B와 flow별 사용량 | 원본 API request/response/id/usage, need-assessment와 evidence-answer 분리 | 공개 실제 요청 2회·1,765 tokens |
| 인용 품질과 효율 | 12개 합성 사례·키워드 기준선·의미 검토, 이전 실패 보존, 문단 선택과 원문 복사 분리 | 최종 12/12, 일반화 성능 아님 |
| 사람의 중지·영수증·독립 판정 | EIP-712 relay 중지, owner revokeDirect, JSON bundle, 별도 프로세스 verifier | 공개 앱 전체 종료 중 직접 취소·독립 판정 통과 |
| 공개 Sepolia 지급·중지·독립 RPC·최종 확정 | artifacts/purchase-sepolia의 거래/보고서와 independent-verifier.json | **PASS / finalized 11800941 / 독립 VALID** |
| 빌드·실행·GitHub 업로드·재현 소스 | purchase:web, purchase:test, 독립 RPC 검증 명령, 소스 bytes 사본·hash | 구매 빌드·21개 테스트 통과, 공개 증빙 포함 |

## 이번에 발견해 수정한 결함

최종 확정 전 지급이 로컬 체인 재편성 실험에서 사라졌을 때, 원래 코드는 `CONFIRMING`을 유지하며 다음 실행에서도 같은 tx를 다시 보내지 않았다. 실제 체인 snapshot/revert로 재현했고 기대 `COMPLETE` 대신 `PAYING`에 남았다.

수정 후 기존 receipt가 사라지면 `PAYMENT_CONFIRMATION_LOST`를 기록하고 예약과 서명 payload를 유지한 `UNKNOWN`으로 돌아간다. 같은 tx를 대조·재방송하며 새 결제 의도는 만들지 않는다. 확정 전에는 자료 수령과 두 번째 추론을 진행하지 않는다. 이 두 검증을 포함한 구매 테스트 **21개가 통과**했다. 재편성은 로컬에서 주입한 실험이며 Sepolia에서 실제 재편성이 발생했다고 주장하지 않는다.

## 한계와 완료 판정 원칙

공개 거래가 블록에 포함된 것과 최종 확정된 것은 다르다. `finalized`가 검사 대상 거래 블록을 지나고, 독립 RPC와 별도 CLI가 지급·승인·자료를 일치시킨 결과를 받기 전에는 P0-5 완료가 아니다.

NPU 전력은 미계측이고 수학적 에너지 가정만 공개했다. 코드 사본과 API 모델명은 물리 NPU 라우팅의 원격 증명이 아니다. 자료 bytes 일치도 자료의 진실성이나 판매자의 이행 보증이 아니다. 이들은 구현하지 않은 제품 보장을 추가하는 데 사용하지 않는다.

공유 작업 폴더의 별도 `web/deal-escrow/Replay.tsx`가 ES2022 설정에서 `findLastIndex` 타입 오류를 일으켰다. 해당 작업은 변경하지 않고, 구매 앱의 실제 진입점과 import 그래프를 검사하는 `tsconfig.purchase.json` 및 `pnpm purchase:web`를 추가했다. 해당 빌드는 통과했다. 다른 앱의 실패를 구매 앱 테스트로 검증했다고 주장하지 않는다.

## 최종 판정과 범위 구분

[공개 관통 보고서](../artifacts/purchase-sepolia/runs/2026-09-28T13-47-16-518Z/report.json)의 8개 검사가 모두 PASS이며 [독립 검증](../artifacts/purchase-sepolia/runs/2026-09-28T13-47-16-518Z/independent-verifier.json)도 VALID다. 최종 확정 블록 11800941을 확인했다.

이 완료 판정은 구매 복구 v3 P0-1~P0-5에 해당한다. 공유 저장소의 다른 작업에서 추가한 Agent Deal Escrow의 공개 fund/release/refund를 이 결과로 완료 처리하지 않는다. 실제 고객 검증과 물리 NPU 계측은 미완료 상태로 남긴다.
