# 논문 읽기 카드

검토 범위: 초록·서지·공개 설명. PDF를 보관했지만 모든 본문과 실험을 재현한 것은 아니다. 아래 **적용**은 논문의 직접 결론과 구분한 우리 설계 제안이다. 수치 성능을 우리 시스템의 결과로 인용하지 않는다.

## P01 · AgentDojo

**서지:** Edoardo Debenedetti, Jie Zhang, Mislav Balunović, Luca Beurer-Kellner, Marc Fischer, Florian Tramèr. *AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents*. NeurIPS 2024 Datasets and Benchmarks.

[학회 원문](https://proceedings.nips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html) · [arXiv](https://arxiv.org/abs/2406.13352) · [Consensus 확인](https://consensus.app/papers/agentdojo-a-dynamic-environment-to-evaluate-attacks-and-debenedetti-zhang/2767c52e68cc5c859885fda9822f69d4/) · [공개 원문 PDF](https://arxiv.org/pdf/2406.13352v3)

- **질문:** 외부 도구에서 읽은 데이터가 AI의 목표를 바꾸게 할 수 있는가?
- **확인한 내용:** 여러 실제형 도구 업무와 공격·방어를 평가하는 환경을 제공한다. 모델은 공격이 없어도 업무를 실패할 수 있어, 정상 업무 능력과 공격 저항성을 함께 봐야 한다.
- **적용:** 판매자 견적에 “예산·허용 주소를 바꾸라”는 문장을 삽입한 테스트를 만든다. 금지 행동 차단율과 정상 구매 성공률을 따로 측정한다.
- **한계:** 우리 결제 컨트랙트나 Kiln 모델이 검증된 것은 아니다.
- **정독 위치:** threat model, benchmark 구성, 공격 성공과 utility 측정 정의.
- **읽고 할 일:** 정상 3개·공격 3개 견적 fixture 작성.

## P02 · Defeating Prompt Injections by Design (CaMeL)

**서지:** Edoardo Debenedetti, Ilia Shumailov 외. 2025. arXiv:2503.18813v2. 이 자료집은 arXiv 버전 기준이며 학회 게재 여부는 추가 확인하지 않았다.

[원문](https://arxiv.org/abs/2503.18813) · [저자 코드](https://github.com/google-research/camel-prompt-injection) · [Consensus 확인](https://consensus.app/papers/defeating-prompt-injections-by-design-debenedetti-shumailov/3ab70b4b93d751299bc38979dd702bec/) · [공개 원문 PDF](https://arxiv.org/pdf/2503.18813v2)

- **질문:** 모델이 속더라도 실행 권한을 시스템이 제한할 수 있는가?
- **확인한 내용:** 신뢰한 요청의 제어 흐름과 비신뢰 데이터 흐름을 구분하고, 도구 호출에 capability와 정책 검사를 적용하는 보호 계층을 제시한다.
- **적용:** AI는 견적 후보를 고르고, executor가 신뢰하는 주소·금액·정책은 승인된 서버 상태에서만 가져온다. 판매자 텍스트가 authority를 늘리지 못하게 한다.
- **한계:** 단순한 JSON 검사와 allowlist 구현만으로 논문의 보장과 같다고 말할 수 없다. 인자 유래와 정보 흐름까지 다룬 접근이다.
- **정독 위치:** trusted/untrusted 구분, capability semantics, 가정과 한계.
- **읽고 할 일:** 입력 필드마다 출처와 신뢰 수준 표시.

## P03 · Energy Considerations of Large Language Model Inference and Efficiency Optimizations

**서지:** Jared Fernandez, Clara Na, Vashisth Tiwari, Yonatan Bisk, Sasha Luccioni, Emma Strubell. ACL 2025, pp. 32556–32569. DOI: `10.18653/v1/2025.acl-long.1563`.

[학회 원문](https://aclanthology.org/2025.acl-long.1563/) · [저자 코드](https://github.com/slab-cmu/llm-inference-energy-considerations) · [Consensus 확인](https://consensus.app/papers/energy-considerations-of-large-language-model-inference-fernandez-na/0336437d038550999374e842e921ee80/) · [공개 원문 PDF](https://aclanthology.org/2025.acl-long.1563.pdf)

- **질문:** 추론을 빠르게 하는 최적화가 모든 업무에서 같은 전력 절감을 주는가?
- **확인한 내용:** 입출력 분포, 배치, 소프트웨어, GPU와 병렬화 설정에 따라 에너지 결과가 달라진다. 이론 연산량만으로 실제 에너지를 추정하는 방식의 한계를 논의한다.
- **적용:** 입력과 출력 토큰, 시도별 오류·재시도, 성공 업무 수를 기록한다. 같은 과제와 품질 조건의 A/B 비교를 만든다.
- **한계:** GPU 실험 결과를 RNGD 또는 Kiln 요청의 J/token으로 사용할 수 없다. “논문에서 절감 → 우리도 같은 절감”은 성립하지 않는다.
- **정독 위치:** workload binning, 계측 범위, online/offline serving, 에너지 추정 한계.
- **읽고 할 일:** 관측값·추정값·미관측값을 나눈 측정 표 작성.

## P04 · Efficient Memory Management for Large Language Model Serving with PagedAttention

**서지:** Woosuk Kwon 외. SOSP 2023. arXiv:2309.06180.

[원문](https://arxiv.org/abs/2309.06180) · [공개 원문 PDF](https://arxiv.org/pdf/2309.06180v1)

- **질문:** LLM 서버에서 메모리 관리가 왜 처리량에 큰 영향을 주는가?
- **확인한 내용:** KV cache의 단편화·중복을 줄이는 PagedAttention과 vLLM을 제시한다. 요청 길이와 메모리 이용이 배치 크기·처리량과 연결된다.
- **적용:** NPU의 TOPS만 비교하지 않고 입력 길이, 동시 요청 수, TTFT, 출력 속도를 구분해 이해한다.
- **한계:** Kiln이 이 알고리즘을 사용한다거나 우리가 API로 해당 설정을 제어할 수 있다는 증거는 아니다. 서버 내부 최적화는 제공자 영역이다.
- **정독 위치:** KV cache 관리, 실험 workload, latency-throughput tradeoff.
- **읽고 할 일:** “Control Memory”와 “KV cache”를 각 한 문장으로 구분.

## P05 · Secure and Transparent Audit Logs with BlockAudit

**서지:** Ashar Ahmad, Muhammad Saad, Aziz Mohaisen. *Journal of Network and Computer Applications*, 145, 102406, 2019. DOI: `10.1016/j.jnca.2019.102406`.

[출판사](https://www.sciencedirect.com/science/article/abs/pii/S1084804519302401) · [공개 저자 원문](https://arxiv.org/abs/1907.10484) · [Consensus 확인](https://consensus.app/papers/secure-and-transparent-audit-logs-with-blockaudit-ahmad-saad/0658bd6149cc509891d309c6063ba786/) · [공개 원문 PDF](https://arxiv.org/pdf/1907.10484)

- **질문:** 관리자나 공격자가 DB와 감사 로그를 함께 바꾸면 어떻게 발견할 것인가?
- **확인한 내용:** 감사 로그의 변조 위협을 다루며, PBFT 기반 블록체인으로 로그를 기록하는 설계와 실험을 제시한다. Consensus fetch에는 초록이 없어 저자 arXiv와 출판사 설명을 별도로 확인했다.
- **적용:** 승인 당시의 정책 버전과 실행 자료를 연결하고, 원본 묶음의 변경을 검출할 별도 앵커를 둔다.
- **한계:** permissioned 환경 연구이며 공용 EVM의 비용·확정 시간과 다르다. 기록의 무결성이 업무 사실 자체의 진실성을 보장하지는 않는다.
- **정독 위치:** threat model, 로그 생성 지점, 합의 가정, 지연·payload 실험.
- **읽고 할 일:** 기록을 바꾼 경우와 처음부터 거짓 기록을 만든 경우를 구분한 위협 표 작성.

## 우선순위

P01 → P02 → P03을 먼저 읽으면 AI 권한 통제와 효율 측정의 이유를 설명할 수 있다. P05는 온체인 증거의 필요와 한계, P04는 모델 서버의 성능 배경을 공부할 때 읽는다. 이 목록은 체계적 문헌고찰이나 연구의 완전한 목록은 아니다.
