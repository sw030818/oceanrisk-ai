# Claude 작업 환경 첫 실제 검증 (2026-10-23, source 68e168e)

- 실행: Production API `/api/analyze` + `/api/semantic` 신규 유료 호출 (`scripts/lib/phase39-live.ts` 전송·예약·정산 경로 그대로). 저장 응답 재생/Mock 아님. 자동 재시도 0.
- 모델: `gpt-6-luna` (추출 6문서, 의미 2요청).
- 정상: `tests/fixtures/universal/pdf/universal-01/01~03.pdf` (공개 합성, development 파티션).
- 오류: 같은 거래, 수출신고필증만 재렌더링 (`pdf/claude-fault-pod/02.pdf`), 양하항 `ROTTERDAM`→`ANTWERP` 한 줄만 다름(pdftotext diff 1줄). 기존 8종 오류에 없는 유형. 생성: `generate.py` 함수 그대로 + NotoSansKR 가변폰트 wght=100 정적 인스턴스 (원본 폰트 파일 부재로 바이트는 원본과 다르나 추출 텍스트 동일 확인).

## 결과
| | 정상 | 양하항 오류 |
|---|---|---|
| 추출 API | 3/3 성공 | 3/3 성공 |
| 분류 | 3/3 | 3/3 |
| 핵심 16필드×3 최초 AI 값 | 48/48 | 46/48 (적하목록 HBL·신고번호 최초 누락) |
| Native Recovery 후 | 48/48 | 48/48 (2개 복구, 최초 누락 기록 보존) |
| 신고필증 문서 수준 요약 품명·HS (선택) | 2개 원문 미확인(row_mismatch) | 동일 2개 미확인 |
| 관계 | 3/3 | 3/3 |
| 조치 문제 / 확정 오탐 | 0 / 0 | 1 (양하항 잠정) / 0 |
| 양하항 판정 | 확정 일치 | **잠정 불일치 (확정 아님)** |

## 원인 (코드 미수정 상태 진단)
`ANTWERP`·`ROTTERDAM` 모두 원문 검증됨. 항구 사전(`ports-data.json`)이 20개 항구 큐레이션이며 앤트워프는 `Antwerpen`만 등록 → `portMeaning("ANTWERP")=null` → `review.ts` 표기 차이 가드로 잠정. `SHANGHAI`, `NINGBO`도 null 확인. 단계: 비교 로직(사전 범위). 추출·근거·API 정상.

## 원장
464/616/$0.67984261/미확인 $0.07450616 → 470/624/$0.68702411/미확인 $0.07450616 (추가 6문서·8요청·$0.00718150). 상한 1000/1500/$2 유지.
