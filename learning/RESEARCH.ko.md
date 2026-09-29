# 연구·오픈소스 선택 기록

조사일 2026-09-28. Consensus 검색 결과를 `fetch`로 확인하고 원 출판처·arXiv·GitHub 소스와 교차 확인했다. 원문은 필요한 수식·구현을 검토하기 위한 보관본이다. 논문의 모든 실험을 재현했다는 뜻은 아니다.

## 채택한 방향

**선형 특성 기반 비교 선택 + 베이지안 사후분포 + 질문의 가치 계산**을 선택했다. 구매 시점에 새 판매자·새 상품이 나타나므로 상품 ID별 점수보다 가격·환불·수량의 특성 기반 모형이 이번 도메인에 맞는다고 판단했다. 이는 제품 설계 판단이다.

학습 상태를 LLM의 프롬프트 기억으로만 두지 않는다. Kiln 모델은 견적 설명·질문 문구를 만들 수 있지만, 증거 확정과 수치 업데이트는 결정적인 서버 코드가 수행하도록 분리했다. NPU에서 이 작은 통계 모듈을 실행해야 할 이유는 없으며, 이 모듈 자체의 NPU 효율 개선을 주장하지 않는다.

## 논문 4편

| ID | 확인한 원문 | 가져온 근거 | 가져오지 않은 주장 |
|---|---|---|---|
| L01 | Bıyık, Talati, Sadigh, **APReL: A Library for Active Preference-based Reward Learning Algorithms**, 2021, 수정본 2022. [arXiv v2](https://arxiv.org/abs/2108.07259v2) | 응답 모형·신념 분포·질문 전략을 분리한 구현 출발점 | 로봇 연구 결과가 상품 구매에서도 그대로 성립한다는 주장 |
| L02 | Astudillo & Frazier, **Multi-attribute Bayesian optimization with interactive preference learning**, AISTATS 2020, PMLR 108:4496–4507. [학회 원문](https://proceedings.mlr.press/v108/astudillo20a.html) | 다속성 의사결정에서 효용에 대한 불확실성을 유지할 근거 | 이 논문의 Bayesian optimization 전체나 획득함수를 구현했다는 주장 |
| L03 | Houlsby, Huszár, Ghahramani, Lengyel, **Bayesian Active Learning for Classification and Preference Learning**, 2011. [arXiv v1](https://arxiv.org/abs/1112.5745v1) | 예측 엔트로피를 사용한 정보이득 질문 기준 | Gaussian process 실험을 이 격자 로짓 모델에서 재현했다는 주장 |
| L04 | Tien et al., **Causal Confusion and Reward Misidentification in Preference-Based Reward Learning**, ICLR 2023. [arXiv v4](https://arxiv.org/abs/2204.06601v4) | 낮은 선호 예측 오류만으로 분포 밖에서 좋은 선택을 보장하지 못함 | 현재 프로토타입이 인과 혼동을 해결했다는 주장 |

Consensus 원기록: [L01](https://consensus.app/papers/aprel-a-library-for-active-preferencebased-reward-biyik-talati/324fa62a1e475210a1f0b991013bc414/), [L02](https://consensus.app/papers/multiattribute-bayesian-optimization-with-interactive-astudillo-frazier/5b4107b30c145c708bf445bd20e1f1ff/), [L04](https://consensus.app/papers/causal-confusion-and-reward-misidentification-in-tien-he/c2e0ac82570a5b27bd11763168db1743/). L03는 원 저자 arXiv에서 직접 확인했다. L02의 초기 프리프린트는 2019, 학회 출판은 2020이다. L04의 프리프린트는 2022, ICLR 출판은 2023이므로 원 출판처 연도를 우선했다.

정독할 때는 L01의 모듈 구분, L02의 불확실한 효용과 비교 질문, L03의 정보이득 유도, L04의 분포 밖 보상 오인 실험 순서로 읽는다. 우리 수치 결과와 비교할 때에는 문제 종류·특성·사용자 응답 모형이 다른지 먼저 확인한다.

## GitHub 구현 비교

| 후보 | 직접 확인한 파일 | 이번 결정 |
|---|---|---|
| [Stanford-ILIAD/APReL](https://github.com/Stanford-ILIAD/APReL/tree/13a1e7f7d93899682a414ce7812f4749dfcbf317) · MIT | `user_models.py`, `belief_models.py`, `acquisition_functions.py`, `LICENSE` | 핵심 참고 구현. 특성 선형 효용·softmax 응답·사후분포·정보이득이 요구사항과 맞음 |
| [lucasmaystre/choix](https://github.com/lucasmaystre/choix/tree/491d8ed9d59035f31049b047ff0d7b820f1c5b59) · MIT | `choix/opt.py`, `LICENSE`, README | Bradley–Terry 비교와 목적함수 확인. 확인한 API는 항목별 점수 중심이므로 상품 특성·분류별 상태·질문 관리가 필요한 이번 코어로 직접 채택하지 않음 |

APReL 고정 커밋: `13a1e7f7d93899682a414ce7812f4749dfcbf317`.

choix 고정 커밋: `491d8ed9d59035f31049b047ff0d7b820f1c5b59`.

### APReL에서 대응되는 부분

| 원 구현 | 로컬 구현 | 차이 |
|---|---|---|
| [SoftmaxUser](https://github.com/Stanford-ILIAD/APReL/blob/13a1e7f7d93899682a414ce7812f4749dfcbf317/aprel/learning/user_models.py) | [model.mjs](model.mjs)의 비교 응답 확률 | 두 후보 로짓으로 계산, 실수 응답 ε 추가 |
| [SamplingBasedBelief](https://github.com/Stanford-ILIAD/APReL/blob/13a1e7f7d93899682a414ce7812f4749dfcbf317/aprel/learning/belief_models.py) | 로그 공간의 유한 격자 사후분포 | 원 소스는 Metropolis–Hastings 표본화. 우리는 2~4개 단조 효용 특성의 작은 격자를 열거 |
| [mutual_information](https://github.com/Stanford-ILIAD/APReL/blob/13a1e7f7d93899682a414ce7812f4749dfcbf317/aprel/querying/acquisition_functions.py) | `bestQuestion(... information_gain)` | 균등한 사후 표본 평균 대신 격자 가설별 사후 확률로 가중 평균 |

APReL의 Python 패키지 전체를 실행하거나 원 테스트 스위트를 통과했다고 주장하지 않는다. 현재 테스트는 독립적으로 적은 두 후보 softmax 식과 정보이득 식을 JS 결과와 대조한다. 부동소수점 허용 오차는 1e-12다. 사후분포는 별도의 손계산 예로 확인한다.

고차원 특성·복잡한 비선형 효용으로 확대할 때에는 이 열거 방식의 조합 수가 빠르게 늘어난다. 구현은 가설 20,000개·특성 4개·후보 40개 이하로 제한한다. 더 큰 문제에서 APReL 같은 표본화 또는 다른 추론 라이브러리로 이동하는 것은 후속 작업이다.

## 숫자의 출처

| 수치 | 현재 지위 | 실제 서비스에서 정할 방법 |
|---|---|---|
| 초기 각 가중치 평균 1/3 | 세 특성의 대칭 격자 사전분포에서 나옴 | 명시적 사용자 설정 또는 같은 의미의 과거 데이터로 사전분포 검증 |
| 데모 β={1,2,4}, ε=.05 | 실행 예제 가정 | 사용자별·분류별 반복 비교의 예측 log loss/Brier로 검증 |
| 실험 β 후보 집합과 ε | 개발 사용자 seed의 검증 손실로 선택 | 실제 사용자·시간을 분리한 검증 집합에서 선택하고 테스트 데이터는 고정 |
| 격자 8/12/20/30 | 정확도·비용 민감도 검사 | 예측과 결정이 해상도에 민감하면 더 조밀한 근사 검토 |
| 환불 +1.5, 반복구매 +0.5 | 근거 없어 채택하지 않음 | 원인 확인 없는 구매·환불 로그를 선호 라벨로 사용하지 않음 |
| EMA 학습률 .1 | 설명용 비교 기준에만 사용 | 최적 알고리즘 또는 문헌 표준이라고 부르지 않음 |
| 질문비용 .005, 후회허용 .05 등 | 데모의 효용 단위 정책 예시 | 사용자가 수용할 손실·질문 부담을 제품 실험으로 정하고 승인된 정책에 저장 |
| 상위 분류 이전 κ | 사용자가 명시해야 하는 연구 파라미터 | 분류 간 의미가 같은지 먼저 확인하고, 이전하지 않는 기준과 실제 데이터 비교 |

Bayes를 썼다는 이유만으로 모든 숫자가 자동으로 정당해지지 않는다. 데이터의 의미, 특성의 단위, 응답 모형, 사전분포, 비용의 정의가 여전히 가정이다. 이번 구현은 그 가정들을 설정과 증거 파일에 노출한다.

## 보관과 재현

[source-manifest.json](source-manifest.json)에 원문 URL, 저장 경로, UTC 수집 시각, 파일 크기, SHA-256을 기록했다. 논문 4편과 원 코드·라이선스 6개를 `research/archive/learning/`에 보관했다. 원문 보관 폴더는 기존 저장소 정책대로 버전 관리에서 제외된다. 공개 문서에는 출처 링크와 자체 설명을 둔다.

L04의 OpenReview URL은 403 응답으로 보관하지 못했고, 저자의 arXiv v4로 수집했다. 실패 기록과 성공 원문 경로를 같은 manifest에 남겼다. [수집 스크립트](collect-sources.ps1)는 이미 있는 파일을 덮어쓰지 않는다. 새 디렉터리에 재수집할 때 사용할 수 있다.

이번 검증 범위는 소스 대조·오프라인 테스트·합성 실험이다. 실제 사용자 취향 라벨, 온라인 추천 성과, 실제 환불률, 장기 변화 탐지는 검증하지 않았다. 과도하게 확신하는 실패를 숨기지 않도록 [실험 결과](artifacts/simulation.ko.md)에 악화된 조건도 함께 기록했다.
