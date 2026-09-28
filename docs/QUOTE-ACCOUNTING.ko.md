# 견적 회계 정정 — 성공과 요청 시도를 구분

2026-09-28. 검토 C-E02를 원본 자료로 확인하고 오프라인 정정했다. 새 Kiln 호출·체인 거래 없이 수행했다. [고정 실험](../artifacts/experiments/2026-09-28T11-23-54-460Z/result.json)·manifest·source·latest는 그대로 보존한다.

## 오류와 정정

기존 `quoteCalls = early + final`은 성공한 서명 견적만 세었다. 당시 engine은 early late-quote를 거절하고 throw한 뒤 성공 카운터에 도달하지 않았다. 그래서 B1·CM의 거절 2회씩이 ‘견적 요청’ 표에서 빠졌다. 캐시 재사용은 성공과도 별개로 기록되어 있었다.

| 범위 | 성공 | 시도 | 거절 | 캐시 |
|---|---:|---:|---:|---:|
| B0 평가 | 16 | 16 | 0 | 0 |
| B1 평가 | 25 | 27 | 2 | 9 |
| CM 평가 | 14 | 16 | 2 | 8 |
| CM 생성 | 2 | 2 | 0 | 0 |
| CM 생성 포함 | 16 | 18 | 2 | 8 |

평가 성공·캐시는 **원래 기록**, 시도·거절은 **고정 코드와 fixture·행의 사후 재구성**이다. 생성 사건의 성공·시도·거절·캐시는 모두 재구성이다. 직접 계측한 값으로 소급 표기하지 않는다. 거절 지연·실제 공급자 비용은 null이며 성공 견적 지연에서 추정하지 않는다. 모델 토큰·성공/중지 결과에는 변경이 없다.

재현:

```sh
node scripts/correct-quote-accounting.mjs
node --test tests/quote-accounting.test.mjs
```

스크립트는 해당 run ID와 engine SHA를 고정하고 manifest의 코드 사본 12개와 원시 rows/result 일치를 검사한다. 한 개 late-quote 후보의 early 거절 4개를 재구성하고 생성 사건을 별도로 합산한다. [정정 JSON](../artifacts/experiments/corrections/2026-09-28T11-23-54-460Z-quotes.json)에 원본 result/manifest SHA-256·행별 정의·전체 합계를 보관한다. 원본을 수정하지 않는다.

API는 정정 자료의 실험 ID와 **원본 파일 바이트의 SHA-256**이 맞을 때만 이를 붙여 표시한다. 정정 자료가 없는 구형 기록은 시도·거절을 미확인으로 표시한다. 다른 실험에 정정 수치를 적용하지 않는다.

## 이후의 직접 계측

새 run은 attempts.early/final과 rejected를 0으로 초기화한다. 캐시 hit이면 cacheHits만 증가하고, 새 견적 경로에 들어갈 때 attempts를 늘린다. 거절은 rejected, 서명 견적 반환은 early/final 성공 카운터를 늘린다. 이후 중단/오류가 있으면 attempts가 successes+rejections보다 클 수 있으므로 둘을 같게 강제하지 않는다.

benchmark schema v2는 평가·생성 양쪽에 `quoteSuccesses, quoteAttempts, quoteRejections, quoteCacheHits, quoteEvidence`를 저장하고 CSV·summary에도 같은 정의를 쓴다. `DIRECT_COUNTERS`는 견적 시뮬레이터 실행 경로의 직접 카운터이며 실제 상용 공급자 네트워크 요청을 측정했다는 뜻은 아니다. 거절 지연과 공급자 비용을 별도로 측정하지 않는 한 null을 유지한다.

수정 검증은 거절 한 건=시도1/거절1/성공0, 캐시 재사용=신규 시도0, 사전 제외=모두0, 원본 유지, 정정 자료 불일치 거부, 구형 데이터 미계측 보존을 포함한다. API·화면·측정 문서는 위와 같은 집계를 사용한다. Memory의 일반적인 효율 우월성이 입증됐다는 결론은 여전히 내리지 않는다.

회귀 검사 5개, TypeScript·Vite 빌드가 통과했다. 실제 콘솔에서 B0/B1/CM 시도 16/27/16, CM 생성 포함 18과 사후 재구성 표기를 확인했으며 브라우저 오류는 없었다. [수정 화면](../artifacts/demo/09-quote-accounting-corrected.png). 기존 결제·중지 증빙 재검증은 반복하지 않았다.
