# 출처 목록과 확인 범위

접근일: **2026-09-28**. 검색 결과를 그대로 사실로 옮기지 않고, 실제 확인한 문서·초록·서지를 기준으로 요약했다. API 문서는 변할 수 있으므로 구현 직전에 다시 확인한다.

## 공식 개발 문서 14개

| ID | 문서 / 원 출처 | 활용 질문 | 확인 범위 |
|---|---|---|---|
| D01 | [Kiln Overview](https://kiln.bricksum.com/docs/en) | 어떤 서비스이며 어디로 요청하나? | 공개 본문 |
| D02 | [Kiln Models](https://kiln.bricksum.com/docs/en/models) | 지정 모델이 실제 가용한가? | 공개 표·과거 샘플; 충돌 기록 |
| D03 | [Kiln Chat completions](https://kiln.bricksum.com/docs/en/api-reference/chat-completions) | 도구 호출·응답·usage는 어떤 형태인가? | API 필드·제한 |
| D04 | [Kiln Migrating from OpenAI](https://kiln.bricksum.com/docs/en/migrating-from-openai) | 호환되지 않는 옵션은? | Known limitations |
| D05 | [Kiln Usage & billing](https://kiln.bricksum.com/docs/en/usage-billing) | 토큰·과금·요청 ID를 어떻게 기록하나? | 공개 본문 |
| D06 | [Kiln API Reference](https://kiln.bricksum.com/docs/en/api-reference) | 인증·오류·공통 계약은? | 공통 API 계약 |
| D07 | [Furiosa GPT-OSS guide](https://developer.furiosa.ai/latest/en/furiosa_llm/models/gpt-oss.html) | 자체 RNGD 서빙과 Kiln의 차이는? | 2026.3.0 문서; 사전 빌드·서빙 예시 |
| D08 | [Furiosa: gpt-oss-120b at 5.8 ms TPOT](https://furiosa.ai/blog/serving-gpt-oss-120b-at-5-8-ms-tpot-with-two-rngd-cards-compiler-optimizations-in-practice) | NPU 최적화는 무엇을 바꾸나? | 2025-10-15 업체 기술 설명; 독립 벤치마크 아님 |
| D09 | [Ethereum Transactions](https://ethereum.org/developers/docs/transactions/) | 서명·전송·gas·거래 결과란? | 거래 구조와 처리 설명 |
| D10 | [Ethereum Networks](https://ethereum.org/developers/docs/networks/) | 어떤 테스트망을 쓰나? | Sepolia/Hoodi 용도·개발망 |
| D11 | [EIP-712](https://eips.ethereum.org/EIPS/eip-712) | 구조화된 승인을 어떻게 서명하나? | Final 명세; domain·replay 주의 |
| D12 | [RFC 8785 — JCS](https://www.rfc-editor.org/rfc/rfc8785) | JSON의 hash를 재현하려면? | 정규화 정의; Informational RFC |
| D13 | [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) | 예산 검사와 예약 경쟁을 막으려면? | 문서 18, row lock·FOR UPDATE |
| D14 | [Ethereum Smart contract security](https://ethereum.org/developers/docs/smart-contracts/security) | 접근제어·검증에서 무엇을 보나? | 공식 보안 가이드 |

D02, D03, D05의 공식 제공 Markdown은 보관 폴더 (로컬 전용: `research/archive/`)에 있다. 나머지 웹 문서는 원문 링크와 이 자료집의 요약으로 관리한다. 로컬 스냅샷은 현재 문서와 달라질 수 있다.

## 논문 5편

| ID | 원문 | 출판 상태 | 검색 경로·읽기 범위 |
|---|---|---|---|
| P01 | [AgentDojo](https://arxiv.org/abs/2406.13352) | NeurIPS 2024 Datasets and Benchmarks 출판처 확인 | Consensus search+fetch, 원 저자 초록, 학회 페이지 |
| P02 | [CaMeL / Defeating Prompt Injections by Design](https://arxiv.org/abs/2503.18813) | arXiv v2 기준; 학회 상태 추가 미확인 | Consensus search+fetch, 원 저자 초록 |
| P03 | [Energy Considerations](https://aclanthology.org/2025.acl-long.1563/) | ACL 2025 | Consensus search+fetch, ACL 초록·서지 |
| P04 | [PagedAttention](https://arxiv.org/abs/2309.06180) | 원 저자 arXiv의 SOSP 2023 표기 | 원 저자 초록·서지 직접 확인 |
| P05 | [BlockAudit](https://arxiv.org/abs/1907.10484) | JNCA 145, 102406, 2019 | Consensus search+fetch, 출판사·저자 초록 |

Consensus는 검색 통로이며 학회 심사 여부의 최종 증거로 사용하지 않았다. 특히 arXiv 자료를 모두 peer-reviewed라고 묶어 부르지 않는다. 정확한 서지와 적용 한계는 [논문 카드](04-paper-notes.md)에 있다.

## 검색 기록

- `LLM agent prompt injection tool use authorization security AgentDojo domain:cs year:2023-2026`
- `large language model inference energy efficiency prefill decode token energy domain:cs year:2023-2026`
- `blockchain tamper evident audit logs accountability authorization hash timestamping domain:cs`

처음 보안·에너지 검색을 동시에 요청할 때 한 요청이 rate limit에 걸렸고, 이후 보안 질의가 정상 수행되었다. 실패한 질의 결과를 인용하지 않았다.

선정 기준은 Challenge B의 직접 관련성, 원 출처 확인 가능성, 구현에 연결되는 가정·실험·한계가 있는지다. 최신 논문을 전부 수집하는 대신 기본 설계를 설명할 수 있는 5편을 우선 선별했다. 발표에서 신규성이나 세계 최초를 주장하려면 별도 선행연구 조사가 필요하다.

## 보관 파일 검증

[archive-manifest.json](archive-manifest.json)에 파일별 URL, 수집 시각(UTC), 크기, SHA-256, 저장 상태가 있다. PDF는 공개된 저자본 또는 학회본이다. 자동 수집은 [collect-public-sources.ps1](scripts/collect-public-sources.ps1)에 기록했다. 기존 파일을 덮어쓰지 않으며, 다시 수집하려면 새 날짜의 보관 폴더를 사용하는 방식으로 확장한다.

Hash는 이번에 받은 파일이 나중에 바뀌었는지 확인하기 위한 값이다. 출처 진위나 PDF 내용의 과학적 타당성을 그 자체로 증명하는 값은 아니다.
