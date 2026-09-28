# 실제 참여자와 업무 자료를 확보하기 위한 실행 묶음

2026-09-29 확인. **연락 후보·공개 사례·외부 작성 작업지는 확보했다.** 실제 연락, 참가 동의, 익명 고객 자료 제공은 아직 없다. 후보 적합도는 공개 근거에 대한 추론이며 응답 가능성을 보증하지 않는다.

## 바로 사용할 자료

| 용도 | 준비한 파일 | 현재 상태 |
|---|---|---|
| 연락 시작 | [후보별 연락 초안](PILOT-OUTREACH.ko.md), [연락처·상태 원장](../data/pilot-workpack/discovery.json) | 5개 대상/경로, 미발송 |
| 기존 제품의 원문 검토 | [사람 검증 절차](USER-STUDY.ko.md), [최신 시연 영상](../artifacts/deal-escrow/research/agent-deal-escrow-demo.ko.mp4) | 실제 응답 필요 |
| 기존 자작 사례 밖의 작업 비교 | [외부 작업지 12개](../data/pilot-workpack/participant/tasks.md), [전달용 ZIP](../artifacts/pilot-workpack/participant-kit.zip) | 원본 표·본문·질문 확보, 실행 전 |
| 참가자 제출 | [빈 제출 JSON](../data/pilot-workpack/participant/response-template.json) | 답·시간·비용 모두 미측정 |
| 평가자 전용 | [정답·계산식·원본 ID](../data/pilot-workpack/evaluator/reference-answers.json) | 원저자 라벨, 독립 사람 검토 전 |
| 실제 사건 접수 | [인터뷰·자료 접수 양식](PILOT-INTAKE.ko.md) | 동의받은 실제 작업 0건 |

## 누구에게 어떤 목적으로 연결할지

| 순서 | 대상 | 확인한 연결 경로 | 요청할 내용 / 적합성의 한계 |
|---|---|---|---|
| 1 | **FinRobot 사용·개발 실무자** | [AI4Finance 공식 홈페이지](https://ai4finance.org/)의 [Discord 초대](https://discord.gg/trsr8SXpW5) | 최근 수집 실패·재시도 한 건을 15분 인터뷰. 공개 초대 링크 존재까지만 확인했고 가입·모집 채널 규칙은 미확인. 유료 외주 구매자라는 증거는 아직 없음 |
| 2 | **Inn Corp** | [개발자 소개](https://apify.com/inn_corp)가 질문·요청용으로 안내하는 [Actor Issues](https://apify.com/inn_corp/pdf-text-table-extractor/issues/open) | PDF 표 추출의 검수 기준·부분 실패 과금 질문 후 소규모 시험 의사 확인. 이미 실패를 구분하는 과금을 설명하므로 추가 에스크로가 불필요할 수 있음 |
| 3 | **ootssu** | [한국 재무제표 Actor](https://apify.com/ootssu/korea-company-financials)의 [Issues](https://apify.com/ootssu/korea-company-financials/issues/open) | DART 정형 데이터로 같은 요청을 끝낼 수 있는지 문의. 우리 제품이 필요 없는 경우를 먼저 확인하는 대상 |
| 4 | **Upstage Document Parse** | [공식 문의 페이지](https://www.upstage.ai/contact-us/document-parse), 공개 업무 메일 `contact@upstage.ai` | 원문 셀 근거·지원 불가 문서·재검수 사례에 관한 기술 의견 요청. 고객이나 파일럿 참여자로 확보한 상태는 아님 |
| 5 | **Apify 개발자 커뮤니티** | 공식 사이트가 연결하는 [개발자 포럼](https://discord.apify.com/) | 외부 문서 작업 경험자 및 초면 시연 검토자 모집. 운영 규칙 확인 후 관련 모집 공간 이용. 채널 자체를 사람 수로 세지 않음 |

우선순위는 응답률 예측이 아니라 현재 제품과 업무가 얼마나 가까운지를 기준으로 정했다. 지원 이슈에는 제품과 관련된 구체적 질문만 남기며 기존 타인의 버그 신고에 홍보 답글을 달지 않는다. 이 문서는 발송 초안이고 외부 게시를 수행하지 않았다.

**제외한 오인 가능성:** [OpenBB 공식 홈페이지](https://openbb.co/)의 2026-08-25 공지는 사업 지속 가능성 확보 실패와 제품군 오픈소스 전환 계획을 설명한다. 과거 영업 연락처만 보고 현재 기업 파일럿 후보로 추천하지 않았다. [langchain-kr](https://github.com/langchain-kr)는 소개상 교재 저장소여서 범용 한국 커뮤니티로 분류하지 않았다.

## 발견한 실제 공개 문제 3건

| 사례 | 당사자가 공개한 내용 | 우리 시험에 적용할 상황 |
|---|---|---|
| [FinRobot #113](https://github.com/AI4Finance-Foundation/FinRobot/issues/113), 2026-08-20, 확인 당시 open | 기초 시세는 보이지만 전체 리서치의 데이터 수집이 여러 종목에서 재시도 후 실패 | 공급자 전부 실패·캐시 없음. 재시도 상한, 실패 이유 보존, 미납품을 성공으로 표시하지 않는지 확인 |
| [pdfplumber #801](https://github.com/jsvine/pdfplumber/issues/801), 2023-02-01, closed | 다양한 문서 형식을 다루는 SaaS에서 문서마다 추출 설정을 손으로 바꾸기 어렵다는 문제 | 지원하지 않는 표는 거래 시작 전에 보류. 표 모양의 출력만으로 검수 통과 금지 |
| [pdfplumber #815](https://github.com/jsvine/pdfplumber/issues/815), 2023-02-14, closed | 실적 발표 PDF 일부 페이지에서 읽기 어려운 추출 텍스트 발생 | 깨진 원문이나 근거 누락을 확신 있는 숫자 납품으로 처리하지 않기 |

세 건은 출처가 있는 제3자의 자기 보고다. 이번에 원래 환경을 재현하지 않았으며 오래된 closed 이슈를 현재 결함이라고 주장하지 않는다. 금전 손해·에스크로 수요·우리 제품 구매 의사도 확인하지 못했다. 신고자의 개인 핸들과 첨부 스크린샷을 수집하지 않았다. 이 상황을 시험으로 실행하기 전까지 원장에는 `NOT_RUN`으로 남긴다.

## 외부 작업 자료: TAT-QA 12개

[TAT-QA 공식 저장소](https://github.com/NExTplusplus/TAT-QA)에서 실제 재무 보고서 기반 표·본문·질문을 확보했다. [ACL 2021 논문](https://aclanthology.org/2021.acl-long.254/)의 외부 연구진이 작성한 자료이며, 저장소는 데이터의 CC BY 4.0 사용 조건을 명시한다. 코드 파일의 MIT 라이선스와 구분하여 [저자·라이선스·변경 내용](../data/pilot-workpack/participant/ATTRIBUTION.md)을 포함했다.

- dev 1,668문항에서 **단일 답, 복수 답, 개수, 산술 각 3개**, 서로 다른 문맥 12개를 고정 시드 해시 순서로 선택했다. 성능을 보고 고른 사례가 아니다.
- 참가자에게는 질문·전체 표·본문만 전달한다. 정답·계산식·정답 유형·관련 문단 라벨은 평가자 파일에 분리했다.
- 원본 commit, SHA256, 선택 규칙은 [manifest](../data/pilot-workpack/manifest.json)에 남겼다. [검증 보고서](../data/pilot-workpack/verification.json)는 파일·라벨 분리를 확인하며 모델 정확도나 사람 검증 결과가 아니다.
- **공개 보고서 발췌 자료**다. 기밀 고객 작업을 익명화한 자료나 미공개 평가 세트가 아니며 모델이 학습했을 가능성이 있다. 개인 참가자 정보를 넣지 않았고 공개 기업명은 유지했다.
- 원본 PDF 페이지 좌표는 포함되지 않는다. 이 자료를 현재 CAPEX 검수기에 그대로 연결해 지급하면 안 된다. 먼저 사람/별도 QA의 작업 비교용으로 사용한다. 현재 제품의 원문·지급 검증은 기존 LGES PDF로 진행한다.

## 실제 비교와 사람 검증 진행 순서

1. 후보 1·2부터 업무 관련 문의 초안으로 접근한다. 실제 사례가 없거나 기존 과금으로 충분하면 그 답 자체를 반증으로 기록한다. 도구 구매·자료 업로드·결제는 이번에 실행하지 않았다.
2. 초면 3명에게 설명 없이 최신 영상을 보여주고 [기존 질문지](USER-STUDY.ko.md)를 받는다. 원격 참가자에게는 영상 파일을 전달하고, 로컬 주소는 전달하지 않는다. 동의·버전·초면 여부를 확인한 실제 답변만 집계한다.
3. 최소 1명은 공식 PDF의 15쪽에서 기간·행·부호·단위를 직접 확인한다. 맞았다는 답만 받지 말고 어느 셀을 확인했는지 남긴다.
4. 별도로 TAT-QA 작업에서 기존 방법 / 코드 기반 방법 / AI 방법의 **동일 입력**에 대한 산출물·근거·작업 및 검수 시간·재시도·실제 비용을 기록한다. 일반 QA 어댑터가 없는 현재 앱은 `UNSUPPORTED`로 기록한다. 기존 CAPEX 16건 결과와 합산하지 않는다.
5. 정답 파일을 보지 않은 상태에서 각 방법의 결과를 먼저 고정한다. 평가자는 이후 정답과 근거를 대조하고 모호한 라벨은 보류한다. 같은 사람이 같은 문제를 재차 푼 경우 순서·학습 효과를 기록한다. 12문항과 소수 참가자로 일반 우위를 주장하지 않는다.
6. [접수 양식](PILOT-INTAKE.ko.md)으로 동의받은 최근 실제 작업 한 건과 양측의 [파일럿 조건 수락](SUPPLIER-PILOT-TERMS.ko.md)을 받는다. 공개 데이터 작업 성공만으로 유료 수요를 입증했다고 처리하지 않는다.

## 재생성·검증

저장소 루트에서 `node scripts/build-pilot-workpack.mjs --verify`를 실행하면 원본 3개 파일의 해시와 결정적으로 생성한 7개 파일을 검사한다. `--verify` 없는 실행은 자료·빈 양식을 재생성하므로 실제 답변은 이 경로에 저장하지 않는다. 실제 답변은 git에서 제외된 `data/private/pilot-intake/`에 별도로 저장한다.

원본 재취득 위치는 manifest의 고정 commit URL이다. 원본 README와 LICENSE도 같은 commit에서 가져왔다. 평가자가 사용할 전체 저장소나 source 폴더를 모델 입력으로 주지 말고, **participant-kit.zip만 전달**한다. 파일 분리는 권한 통제가 아니므로 전체 저장소를 읽는 에이전트에 대한 정답 차단을 보장하지 않는다.

현재 완료 범위는 **연결 경로 탐색과 검증 가능한 자료 준비**다. 실제 연락 0건, 참가자 0명, 고객 자료 동의 0건, 공급자 파일럿 수락 0건을 유지한다.
