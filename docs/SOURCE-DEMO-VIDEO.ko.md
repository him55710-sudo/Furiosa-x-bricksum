# 원문 납품과 직접 회수 — 3분 자막 영상

2026-09-29. [영상 WebM](../artifacts/deal-escrow/source-film/source-demo-3min.webm) · [한국어 대본/SRT](../artifacts/deal-escrow/source-film/captions.ko.srt) · [영상·장면 manifest](../artifacts/deal-escrow/source-film/video.json).

**공개 실증의 실제 브라우저 화면에 한국어 자막을 붙인 180초 무음 영상**이다. 1280×864, 2fps, 18개 자막 구간. 정지 화면을 이어 붙인 기록 재생이며 실시간 화면 녹화나 새 거래 실행으로 표시하지 않는다. 재생·정지·탐색이 가능한 [로컬 보기 페이지](../artifacts/deal-escrow/source-film/index.html)를 함께 제공한다.

## 3분 흐름

| 시각 | 장면 | 전달할 사실 |
|---|---|---|
| 0:00–0:12 | 네 분기 빈칸·사람 승인 | 맡긴 업무와 예산; 공급자는 데모 시뮬레이터 |
| 0:12–0:35 | 실제 Kiln 선택·불변 조건 | 실적/전망/마감 비교; AI 발화만으로 결제 불가 |
| 0:35–0:50 | 예치·판매자 수령 0 | 검수 전에 돈이 판매자에게 넘어가지 않음 |
| 0:50–1:10 | 네 값과 지급 | 고정 참조표 검수; 모델 입력은 전사 표 |
| 1:10–1:35 | 3,014 대신 3,441·환불 | 모양이 맞아도 승인한 지표가 다르면 실패; 명시적 오류 주입 |
| 1:35–1:55 | 해당 공급자의 다음 예치 차단 | 믿으라는 경고 대신 코드가 샘플 선행 조건 집행 |
| 1:55–2:15 | 지급/환불 영수증·신뢰 범위 | 별도 RPC 대조와 controller에 남는 신뢰 |
| 2:15–2:30 | 2회·4,495토큰 | flow별 실측과 전력 미측정 구분 |
| 2:30–3:00 | 별도 만료 의뢰·앱 종료·직접 회수 | 이미 지급한 돈을 되돌린 것이 아님; 운영자 송금·추론 없이 장부 복구 |

원문 실행 `a2f6f4fa`와 회수 실행 `5b2ccb95`의 ID를 자막에 계속 표시한다. 실제 테스트넷 정산 해시와 기록의 의미는 [원문 공개 실증](SOURCE-PUBLIC-PROOF.ko.md), [구매자 회수](BUYER-RECOVERY-PROOF.ko.md)를 따른다. 새로운 로컬 PDF 파서와 한 행 샘플 흐름을 이 공개 영상의 실행 결과로 끼워 넣지 않는다. 이전 합성 52행/7행 영상도 원래 경로에 보존한다.

## 제작·검증

CUA로 `3413/?replay=1`의 실제 화면을 캡처했다. 긴 장면은 상단과 하단을 따로 보여준다. [원본 PNG·DOM](../artifacts/deal-escrow/source-film/frames/)과 [캡처 기록](../artifacts/deal-escrow/source-film/capture.json)을 보존한다. 캡처된 콘솔 오류·경고는 0건이다.

영상 제작기는 화면 픽셀을 고치지 않고 여백에 자막을 배치한다. 각 화면·자막 합성 이미지·독립 검증 원본·렌더러·폰트·완성 영상의 해시를 manifest에 남긴다. FFmpeg로 전체 360프레임을 디코딩하고 180초 길이를 확인했다. 이는 화면 캡처/인코딩 검증이며 사람의 이해도 평가가 아니다. 영상에는 음성 내레이션이 없으며 SRT를 발표 대본으로 쓸 수 있다.

```sh
# Pillow, 한국어 글꼴 및 FFmpeg가 필요하다. 모델·지갑·네트워크 호출 없음.
python scripts/render-source-evidence-video.py --ffmpeg /path/to/ffmpeg --font /path/to/korean-font.ttf

# 현재 PC에서만 공개 영상 파일을 재생한다.
python -m http.server 3417 --bind 127.0.0.1 --directory artifacts/deal-escrow/source-film
# http://127.0.0.1:3417/
```

UI나 증거가 바뀌면 CUA에서 다시 캡처해야 한다. 인코더만 다시 실행해도 오래된 화면이 현재 UI로 바뀌지는 않는다. 실제 고객 수요·사람의 원문 검토·독립 보류 평가·거래 경제성·하드웨어 전력은 미검증이며, 이 영상으로 전체 목표 완료를 주장하지 않는다.
