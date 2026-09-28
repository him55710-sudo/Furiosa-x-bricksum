# 반복 검토 실행 지침

작업 폴더: `C:/Users/user/Downloads/Furiosa x Bricksum`.

최우선: 사용자가 현재 세션에 Agent Deal Escrow 동결 명세 0–32절 전체를 직접 제공했다. [구현 계획](../../docs/AGENT-DEAL-ESCROW-IMPLEMENTATION.ko.md)을 따른다. 제품 재설계·상품 재선정·이전 v3 복귀를 제안하지 않는다. EV-007 탐색 제안은 직접 명세로 대체됐다. heartbeat는 현재의 직접 구현을 중단하거나 대체하지 않으며, 이후 비교는 동결 범위 안의 구현·검증 보완에 한한다.

2026-09-28 사용자 지시: **시스템 아키텍처 제작 세션이 질문에 대한 답을 끝내면 개선점을 자동 발송한다.** 대상은 `기획 GWDC 챌린지 시스템 아키텍처`, thread ID `01a0e73b-176c-7403-81cd-305eb84b0196`, host `local`이다. 검토는 현재 대화의 heartbeat에서 실행한다. 5분 간격은 완료 여부를 확인하는 내부 주기이며 메시지를 보내는 주기가 아니다. 정확한 완료 순간의 이벤트 콜백이 아니라 다음 확인 때 감지한다.

## 완료 확인

1. 먼저 [IDEA-SYNC.ko.md](IDEA-SYNC.ko.md)와 `ideas.json`에 따라 ChatGPT **해커톤 규칙 정리** (`6ab9ac74-c550-83ee-9f2b-af4ffc9e3f80`)의 새 완료 메시지를 `read_thread`로 읽고 비교한다. 개발 중이어도 새 아이디어 비교표와 pending 묶음을 만들 수 있다. 이 출처에는 메시지를 보내지 않는다. 그 뒤 delivery.json을 읽고 `wait_threads`를 개발 대상 하나, `timeoutMs: 0`, 저장된 `afterCursor`로 호출한다. 새 cursor는 저장하되 cursor만으로 처리 완료를 판정하지 않는다.
2. 개발 대상이 실행 중, 사용자 입력/승인 대기, 오류, 중단 상태이면 발송하지 않는다. 새 아이디어는 로컬에 대기시키고 종료한다. `latestTurn.status == completed`, 오류 없음, 최종 답변이 존재하고 대상이 새 작업을 시작하지 않았을 때만 전달 단계로 간다. 상태가 불명확하면 `read_thread`에서 해당 turn을 확인한다. 단순 idle, commentary, 도구 완료는 답변 완료가 아니다.
3. 감시 시작 시 진행 중이던 `watchFromTurnId`의 답변부터 대상으로 한다. 시작 시각보다 오래된 완료 턴은 보내지 않는다. `processedTurns` 또는 `lastProcessedTurnId`에 있는 완료 답변은 다시 처리하지 않는다.
4. 새 완료 답변은 파일 변경이 없어도 읽는다. 새 설계 결정·수정 요청의 답이 파일에 반영되지 않았을 수 있다. `read_thread`는 이때 필요한 최신 1~2턴만 읽고 평상시 상태 확인에는 쓰지 않는다.

아이디어 출처만 새로 바뀐 경우는 예외 입력이다. 개발의 마지막 정상 완료 답변을 이미 검토했더라도 idle이면 새로운 유의미한 아이디어 묶음을 전달할 수 있다. `COUNCIL-IDEA:<ideaBatchFingerprint>:<targetTurnId>`와 배치 이력으로 중복을 막는다. 개발 완료 검토와 동시에 있으면 한 메시지로 합친다. 예외는 발송 시점/대상 권한을 확대하지 않으며, 처리한 개발 답변을 다시 리뷰하도록 요구하지 않는다.

## 검토와 전달

2026-09-28 추가 사용자 요청으로 [EVOLUTION-LOOP.ko.md](EVOLUTION-LOOP.ko.md), [WINNING-PATTERNS.ko.md](WINNING-PATTERNS.ko.md), `evolution.json`을 함께 적용한다. 새 완료 후 기존 실험 결과를 확인하고, 근거가 생겼을 때 다음 핵심 개선 실험 하나를 선택한다. 이 확장은 완료 조건·중복 방지·권한 범위를 바꾸지 않는다.

5. PERSONAS.ko.md, findings.json, evolution.json과 개선 루프/수상 패턴 문서를 읽고 `node scripts/council-snapshot.mjs`를 실행한다. 최종 답변과 변경 파일, 기존 Grok/council 지적 및 activeExperiment의 완료 조건을 대조한다. HANDOFF.ko.md의 최초 초안을 그대로 보내지 말고 현재 구현·테스트로 해결된 부분을 제외한다. 비밀/환경 파일은 읽거나 메시지에 포함하지 않는다.
6. 심사역 → YC식 VC → 구현 검증 관점으로 순서대로 판단한다. 새 반례를 채우려고 문제를 만들지 않는다. 해결된 지적은 근거 없이는 다시 열지 않는다. 계획·코드 테스트·실제 통합·고객 증거를 구분한다.
7. review/council에 새 round와 findings를 기록한다. 필요한 보완은 docs/HACKATHON-PLAN.ko.md에 반영한다. 대상 세션이 관리 중인 아키텍처·제품 파일을 동시에 덮어쓰지 않는다.
8. 새 P0/P1, 중요 우선순위 변경, 실제 검증 완료와 증거에 따른 다음 핵심 개선 실험만 최대 3건으로 묶는다. 새 작업은 한 건만 제안한다. 이전 실험은 before/after와 improved/unchanged/regressed/inconclusive를 기록해 닫거나 보류한다. 이미 개발 중이면 같은 일을 다시 요청하지 않는다. 같은 외부 차단, 기존 지적의 재촉, P2 표현 수정만 있으면 발송하지 않는다. 중요한 변화가 없으면 해당 turn을 `reviewed_no_action`으로 기록한다.
9. 발송 직전 `wait_threads(timeoutMs: 0)`로 다시 확인한다. 대상이 새 작업을 시작했거나 완료 turn ID가 바뀌었으면 발송을 보류하고 다음 완료 뒤 다시 검토한다. 사용자 입력/승인 요청에는 대신 응답하지 않는다.
10. 전송 전에 delivery.json의 `pendingDelivery`에 eventType, sourceTurnId(개발 완료 ID), fingerprint, finding IDs, 고유 marker `COUNCIL-REVIEW:<sourceTurnId>`와 전달문을 저장한다. 새 아이디어가 있으면 ideaBatchFingerprint·sourceMessageVersions도 포함하고 아이디어만의 전송은 IDEA-SYNC marker를 쓴다. 승인된 대상에 `send_message_to_thread`로 한 번 보낸다. 메시지에는 marker, 근거, 최소 수정, 완료 조건, 변경 파일을 포함하고 진행 중인 사용자 작업을 우선하며 새 결제·연락·배포로 범위를 확장하지 말라고 명시한다.
11. 전송 성공을 확인한 뒤 deliveries에 timestamp/sourceTurnId/fingerprint/finding IDs/targetThreadId를 기록하고 pendingDelivery를 해소한다. 성공 응답이 모호하거나 기록 전에 실행이 끊기면, 재실행 시 대상의 최근 메시지에서 marker를 찾아 이미 전달됐는지 확인한다. 중복이 없다는 근거가 확보되기 전에는 재발송하지 않는다.
12. 검토·전달 상태를 기록하고 processedTurns 및 lastProcessedTurnId를 갱신한다. 검토한 입력의 fingerprint로 `node scripts/council-snapshot.mjs --ack <fingerprint>`를 실행한다. 다른 세션의 수정으로 ack가 거부되면 새 변경을 다음 검토 대상으로 남기며 이미 성공한 메시지는 재발송하지 않는다.

우리 메시지에 대한 대상의 새 완료 답변도 실제 새 증거가 있는 경우 검토할 수 있다. 동의/수신 확인뿐인 답변에는 답장을 보내지 않는다. 같은 반례·같은 외부 의존성으로 자동 대화를 이어가지 않는다.

`evolution.json`의 coordinationNotice가 queued이면 다음 적격 완료 때 전달 내용과 합쳐 한 번만 안내한다. 실험별 가설·현재값·최소 변경·완료/기각 조건·담당·증거를 남긴다. 공식 사례는 유의미한 완료 회차 5개 이후 또는 규칙 변경 때 필요한 1~2건만 갱신한다. 수상작의 설명은 수상 원인의 증명이 아니며 종합 우승/부문상/결선과 관측/추론을 구별한다.

모델 가용성은 새 운영사 정보나 실제 증거가 생겼을 때만 재확인한다. 주기마다 유료 추론·체인 전송·Grok 호출을 실행하지 않는다. 새로운 외부 메시지·결제·배포·공개 게시를 이 검토 자동화에 포함하지 않는다.

사용자에게는 의미 있는 변경·완료·실행 실패·결정이 필요한 경우에만 알린다. 미완료·변화 없음·조치 없음이면 조용히 종료한다. 매회 확인했다는 알림을 남기지 않는다.
