# Accord Lock · 최종 Track B 제출 패킷

기준은 원격 `main`의 최신 Accord Lock / DealTrace 구현이다. 초기 구매자 예산 데모의 180 gwei, Kiln 1회 자료와 섞지 않는다.

## 제출물

1. **Public GitHub:** https://github.com/him55710-sudo/Furiosa-x-bricksum. README 첫 문장은 선언이다. 행사 전·중 제작 구분, 실행 방법, Kiln flow별 로그와 전체 tx hash를 포함했다.
2. **영상:** `artifacts/accord-lock/submission/accord-lock-track-b-165s.ko.mp4`. 2분 45초, 1920×1080, 한국어 합성 음성. 실제 새 로컬 작업 두 개를 조작하고 마지막에 별도 과거 Kiln/Sepolia 실증을 연다. 마우스 클릭을 표시하는 원은 촬영 보조 표시다.
3. **제출용 Deck (단일 기준본):** `output/pdf/accord-lock-track-b.pdf`, 8쪽, SHA-256 `31e2aa50e9684f363c3c778060def49f4ffa1fc57cbcaa2961390b188267a273`. 현재 40 / 20 / 25 제품과 공개 증거를 설명한다. 제출폼·README·영상과 함께 이 파일을 사용한다.
4. **온체인 증거:** [공개 report](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json), [finalized 47검사](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/finalized-verification.json), README flow별 hash 표.

대표 거절: `0x255d855d5e19779fdc0fd12a02c924db0bb1980561fbc3dea98df230135e4e59`.

대표 정상 정산: `0x00b1e35d51542daceacd191caabf6fd0e77b740ecb45eab0b4daa15965ecce2f`.

판매자 출금: `0x6a322e82f24b1fd1b3c2d40f2215ead29c9b0c4d1899b1bb6f87cecaf95cb7cc`.

## Track B를 판별하기 쉬운 구성

- RUN 1은 `35 > per-deal 30`에서 중단하고 그대로 보존한다.
- **새 Task**인 RUN 2에서 22를 20으로 협상한 뒤 25 청구를 차단한다. 두 Task ID와 두 이벤트가 화면과 `track-b-runs.json`에 남는다.
- Run 2의 20 수정·지급은 회복 장면이다. 새로운 독립 run으로 세지 않는다.
- 로컬 서명 전 거절과 공개 Sepolia 컨트랙트 revert를 구분한다. 로컬 두 Task의 Kiln 호출은 0건이고, 별도 공개 실증은 5건이다.

## 주장에서 지킬 경계

| 심사항목 | 이번 보완 | 남은 리스크 |
|---|---|---|
| Technical 30 | 실제 공개 5회 Kiln·5개 tx·47검사와 로컬 조작을 연결 | 브라우저와 공개 증거의 런타임이 다름, 오프체인 검수 신뢰 |
| Task fit 25 | 선언을 맨 위로, 별도 두 실행과 중단 기록을 명시 | 최종 적격 여부는 운영진 해석에 따름 |
| Innovation 20 | 예산 40 안에서도 합의 20을 넘는 청구 25를 거절 | 결제 스택의 기능인지 독립 사업인지 미검증 |
| Usability 15 | 사용자 과업·빠른 클릭·명확한 수정과 영수증 흐름 | 유료 고객과 독립 공급자 증거 없음 |
| Presentation 10 | 165초 대본·영상, 8쪽 덱, 증거 버전 통일 | 실제 제출 링크의 접근성과 업로드 버전 확인 필요 |

이전 82점은 심사표에 대입한 주관적 추정이다. 이번 수정만으로 90점 또는 Top 3를 보장하지 않는다. 개선 효과는 심사위원이 제품과 증거를 확인하기 쉬워졌다는 데 있다.

## 마지막 확인

- Git 기록상 첫 커밋은 두 줄짜리 README이며, 이후 앱·컨트랙트·증거가 추가됐다. 이 기록만으로 추적되지 않은 사전 준비의 부재까지 증명할 수는 없다. 외부 라이브러리와 원문 자료는 별도로 구분한다.
- 최신 코드용 격리 작업 폴더에서 수정했다. 원래 Downloads 폴더는 이전 스냅샷이어서 그곳에서 만든 자료는 최종 제출본으로 쓰지 않는다.
- 로컬 자료 작성과 Google Form 제출은 다르다. 공개 GitHub에 변경분을 반영하고, 영상·덱을 업로드한 뒤 최종 URL 접근 권한을 확인해야 한다.
- 정확히 제출할 커밋의 CI가 완료됐는지 확인한다. 다른 SHA의 green을 대신 사용하지 않는다.
- 등록 팀과 제출 팀의 정보가 같은지 확인한다.

주최 측 제공 일정: 9/30 12:00 KST 제출 마감, 15:00 Top 3 발표, 16:00 최종 발표. 이 패킷 작성은 제출 완료를 뜻하지 않는다.
