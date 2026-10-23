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

---

# 항구 동일성 수정 후 실제 재검증 (source 2336c47)

- main `2336c47ba4fff4e9349743e99a2fc46ea118b1af`: ship(npm ci·tsc·eslint·단위 943·build·worker·브라우저 70) 통과 → push → Actions quality/production success → GitHub Deployment(Production) success → 공식 `/api/status` 동일 SHA. 첫 ship은 Next.js 보안 업그레이드 권고로 build 단계 중단(코드 실패 아님, 미커밋), 같은 명령 재실행으로 통과. Next.js 업그레이드는 수행하지 않음.
- 수정: 고정 UN/LOCODE(sha 6257…) 항구 기능 17,527개 + 관용 표기 23개 + CLDR 47 국가명. 확정 불일치는 각 값이 가리킬 수 있는 모든 동명 항구가 서로 겹치지 않을 때만. 기존 기준 항구 20개 의미 유지.

## 신규 유료 분석 (API, 자동 재시도 0)
| 세트 | 양하항 기대 | 실제 판정 | 확정 FP | 최초 AI 정확 | 최종 정확·원문검증 |
|---|---|---|---|---|---|
| universal-01 정상 | 확정 일치 | 확정 일치 | 0 | 69/69 | 69/69 |
| ROTTERDAM→ANTWERP 오류 | 확정 불일치 | **확정 불일치** (수정 전 잠정) | 0 | 69/69 | 69/69 |
| P1 GENOA/ITGOA/GENOVA, ITALY | 확정 일치 | 확정 일치 | 0 | 69/69 | 69/69 |
| P2 VANCOUVER, CANADA/USA | 확정 불일치 | 확정 불일치 | 0 | 46/69 | 62/69 |
| P3 SHANGHAI/NINGBO | 확정 불일치 | 확정 불일치 | 0 | 69/69 | 69/69 |
| P4 CNSHA/SHANGHAI | 잠정 | 잠정 불일치 | 0 | 69/69 | 69/69 |

P2 적하목록(boxed)은 최초 AI 출력이 거의 비어 0/23 → Native 16/23, 컨테이너 행 6 + 선적범위 1 미복구 → 컨테이너·Seal 잠정 2건. 동일 PDF 브라우저 수동 1회 재분석에서는 정상(양하항만 확정 불일치). AI 요청 본문은 68e168e와 바이트 동일(해시 비교) → 코드 변경 아닌 모델 출력 변동.

## 기존 회귀 (scripts/universal/live.ts + score.ts)
- 정상 부모 6세트 18문서: 분류 18/18, 관계 18/18, 확정 FP 0, 최초 419/444, 최종·검증 437/444(universal-02 boxed 적하목록 최초 공백, 컨테이너 7필드 미복구 → 잠정 2건).
- 오류 8종(오류 MF 8 신규 + 부모 HBL/신고 재사용 16): 확정 탐지 8/8, FP 0, FN 0, 관계 22/22, 최초 580/582, 최종·검증 582/582. 조치 문제 수 68e168e와 동일.
- Set2·Set3: 원본이 사용자 비공개 PDF로 이 환경·공개 저장소에 없어 **실제 재분석 미실행**. 관련 합성 단위 회귀(set3-extraction, NL/네덜란드, VANCOUVER)는 통과.

## 실제 Production 브라우저
- 정상: 확정 불일치 0·확인 필요 0·확인된 일치 12, 양하항 행 ROTTERDAM×3 확인된 일치.
- ANTWERP 오류: 확정 불일치 1·조치 1, 근거 대화상자 ROTTERDAM→NLRTM(p1-b12/b13), ANTWERP→BEANR. 390px 가로 넘침 없음.
- P2: VANCOUVER, CANADA→CAVAN / VANCOUVER, USA→USVAN 확인된 불일치.
- 첫 정상 브라우저 실행은 분석·정산 성공 후 스크립트 선택자 오류로 상세 캡처 실패(보존), 수정 후 재실행.

## 원장
470/624/$0.68702411 → **526/704/$0.75296233**, 미확인 상한 $0.07450616 유지. 추가 56문서·80요청·$0.06593822. 상한 1000/1500/$2.
