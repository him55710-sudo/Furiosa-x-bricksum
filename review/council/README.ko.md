# 심사역·VC 검토 운영

2026-09-28 시작. 현재 Codex가 세 관점을 순서대로 적용하는 검토 워크플로다. 별도 모델 세 개를 실행하거나 실제 심사위원·YC의 자문을 받은 것이 아니다. 기획을 고치는 것과 제품을 구현·검증한 것을 구별한다.

## 가져온 원본

- 저장소: https://github.com/garrytan/gstack
- 고정 커밋: `01593aa67c94780528e8f5121e47362502410ced`
- 원본 전체: [review/vendor/gstack](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/README.md). shallow clone 완료, 설치 스크립트 실행 없음.
- 이용 조건: [MIT LICENSE](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/LICENSE), 원본 저작권 표시 보존.
- 2026-09-28 GitHub API 조회: gstack **134,364 stars**, 비교 후보 agency-agents **154,984 stars**. 최대 별 수 저장소라는 뜻은 아니다. YC 단서와 사업 검토 적합성 때문에 gstack을 선정했다.
- 참고한 문서: [office-hours](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/office-hours/SKILL.md), [고객 진단](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/office-hours/sections/phase-2a-startup-diagnostic.md), [해커톤 설계 관점](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/office-hours/sections/phase-2b-builder-brainstorm.md), [CEO review](https://github.com/garrytan/gstack/blob/01593aa67c94780528e8f5121e47362502410ced/plan-ceo-review/SKILL.md).

원본을 그대로 보관하고 평가 관점을 이 프로젝트에 맞게 재작성했다. gstack 전체 런타임이나 slash command를 설치한 상태는 아니다. 자동 실행은 Codex의 이 대화에 연결한 heartbeat가 담당한다. 원본의 설치·브라우저·텔레메트리·외부 전송 지시는 이 워크플로의 실행 지시가 아니다.

## 문서

- [세 페르소나와 판정 규칙](PERSONAS.ko.md)
- [개선 기획 v1](../../docs/HACKATHON-PLAN.ko.md)
- [1차 검토](ROUND-001.ko.md)
- [기계가 읽는 지적 이력](findings.json)
- [기획 세션 전달문](HANDOFF.ko.md)
- [예약 검토 실행 지침](HEARTBEAT.ko.md)

## 반복 방식

1. `node scripts/council-snapshot.mjs`로 코드·기획·실행 증거의 변경 목록과 fingerprint를 읽는다. 변경이 없으면 종료한다.
2. 변경된 근거와 이전 지적을 읽고 심사역 → VC → 구현 검증 관점으로 검토한다. 기존 Grok R1/R2 지적을 새 발견처럼 반복하지 않는다.
3. 새 반례 또는 완료 조건을 충족한 증거가 있을 때만 지적을 추가/갱신한다. 기존 ID를 유지하고 판정·최소 수정·완료 증거를 기록한다.
4. 이 세션은 `review/council/`과 `docs/HACKATHON-PLAN.ko.md`를 관리한다. 대상 기획 세션이 기존 아키텍처와 제품 구현의 변경을 판단한다. 동시에 같은 파일을 덮어쓰지 않는다.
5. 새 P0/P1, 우선순위 변경, 실제 검증 완료만 최대 3건으로 묶어 지정한 기획 세션에 한 번 전달한다. 전송 성공 후 `delivery.json`에 fingerprint·대상·finding ID를 기록한다. 응답이 모호하면 대상 세션에서 중복 여부를 확인한다.
6. 검토를 기록한 뒤 `node scripts/council-snapshot.mjs --ack <fingerprint>`를 실행한다. 도중에 입력이 바뀌면 ack가 거부되므로 새 변경을 다시 확인한다.

자체 리뷰·기획·테스트 결과로 변화가 반복 검출되는 일을 막기 위해 council 문서, 이 운영 스크립트와 자체 테스트는 제품 변경 감지 대상에서 제외한다. 이 문서나 페르소나를 수정했을 때는 수동으로 재검토한다. snapshot은 메타데이터·해시만 저장하고 파일을 외부로 전송하지 않는다.

## 중단 조건

- 새로운 반례가 없고 같은 외부 의존성만 남으면 추가 비판·재호출·메시지 없이 종료한다.
- 모델 부재는 운영사 제공 상태가 바뀌기 전까지 같은 API 요청을 반복하지 않는다.
- 기획 수정은 `resolved_by_design`, 테스트는 `verified_in_code`, 실제 통합 증거는 `verified_live`로 분리한다.
- 메시지 수나 AI 점수를 개선 성과로 계산하지 않는다. 새 증거, 해소된 반례, 실제 사용자 관찰을 센다.
