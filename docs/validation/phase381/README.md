# PHASE 3.8.1 — 엔진 수정 및 검증

소스: [main 1fadc0be1ae5d3bf3ce3dffe6532e4ff35c02281](https://github.com/sw030818/oceanrisk-ai/commit/1fadc0be1ae5d3bf3ce3dffe6532e4ff35c02281) · tree cefece20c851ae99472f9cdf9a9395567aedddc7
기준: f174b41fc680fc93cfa371cc7a777df19c9e796b. UI/UX/보고서 변경 없음. 원본 PDF·원문·회사/참조번호·AI raw 응답·키는 공개하지 않는다.

## 확인한 원인과 수정

- **251의 최초 발생 원인은 미확인**이다. 해당 Production 최초 응답이 없다. 실제 PDF.js는250/CARTONS를 보존했다. 251 후보를 주입한 무료 재현에서 기존 검증기가 다른 닫힌 CBM 셀에 포장 라벨을 빌려줘 Native Recovery 후보가2개가 되는 결함을 확인했다. 셀 경계를 준수하도록 바꾸자 원본251/unverified는 보존하고 실제 포장 셀250만 native/verified로 복구했다. 이는 최초AI가251을 만든 원인까지 입증하지 않는다.
- **품명/화물 명세**: 기존 복구기가 수량 suffix를 포함한 전체 문자열을 제외하고, 세로로 이어진 품명을 각각 별도 후보로 처리했다. 실제 동일 상품 셀의 연속 문단을 원본 블록으로 복원하고 명시 속성이 충돌하는 문단은 합치지 않는다. 실제 Manifest 두 줄 품명은 후보2/실패 → 후보1/원본2블록 검증 복구. 혼합 화물 설명은 원문 전체를 보존하며 서로 다른 물품·포장 단위의 두 명시 suffix만 비교에서 분리한다. 모델/용량/단일 모호 숫자는 유지한다.
- **한영 소속**: 신고필증 같은 품목 셀의 실제 한영2줄만 source.goodsContext에 기록한다. 비교 전용 파생 설명이며 original/current를 번역값으로 대체하지 않는다. 다른 셀/행/문서·없는 원문·OCR·사용자 수정은 승격하지 않는다. 750mL 누락은 잠정, 명시900mL 충돌은 다른 규격으로 보존한다.

## 서로 다른 검증의 결과

| 검사 | 결과 | 해석 |
|---|---|---|
| 실제 Set2 올바른 후보·원문 대조 | 유형3/3, 수치/단위20/20 유지, 정상 확정 오탐0 | 실제 AI 추출률 아님 |
| 실제 Set2 잘못된251/누락 품명 주입 |250 근거 복구·전체 줄바꿈 품명 복구, 최초값 보존 | 모의 후보 + 실제 native PDF |
| 실제 Set2 포장 원문 변경 |변경값249 보존/native 검증·잠정 차이 표시 | 범위 부족은 확정으로 완화하지 않음 |
| 독립 합성 실제PDF 변경6종 |포장/수량/총중량/Seal/HS/품명 TP6 FP0 FN0; 정상 FP0 | 올바른 후보를 주는 무료 엔진 평가 |
| 기존 HBL 오류·부분/복수 신고 등 |기존 회귀 유지 | HBL 충돌은 독립 경고·다른 거래 확정 금지 |
| PHASE37 무료 개발 평가 |30사례93문서, 근거2292/2292, 확정오류8/8 FP0 + 참조경고2 | 합성 oracle; 실문서 일반화 성능 아님 |
| 과거 실제 응답 무료 재생 |14사례44문서 오류4/4 FP0; 저장상태1082/1090 | 새 AI 추출/모든 필드 새 근거검증 아님 |
| 이전 원본 캐시 + native 재생 |2세트 각각 핵심9/9 | 최초 기존 AI와 현재 무료 복구·판정 구분 |
| 새 실제 OpenAI 분석 |**0문서·0요청·$0** | 미승인·정확도 미측정 |

최종 ship: npm ci, typecheck, lint, **647단위·64브라우저**, Production build, analyze/recover PDF worker 모두 통과. GitHub Actions quality/production 성공. 공식 사이트의 Production SHA와 GitHub main SHA 일치, 원본3개 무료 prepare(2배치)와 desktop/mobile 확인. Vercel 관리 API의 Ready는 직접 확인하지 않았으며 공개 SHA/HTTP 및 Git deployment success와 구분한다.

중간 실패도 보존한다: 병렬 PDF 검사에서 timeout3건 발생 후 단독16회귀 및 최종 전체검사로 해소. 첫 ship은 추가 줄바꿈 결함을 발견해 Commit/Push 전에 중단했고 최종 stage 전체검사를 다시 실행했다. 기존 테스트 삭제/기준 완화 없음.

## 변경 파일과 남은 범위

핵심은 layout/shipping-label.ts, shipping/verify.ts·recovery.ts·goods-context.ts·cargo-description.ts·goods-semantics.ts·equivalence.ts·schema.ts. facts/fact-review/declaration/issue의 상품 비교에 같은 안전한 비교 adapter를 사용한다. openai.ts는 원문/모델·용량/화물 주석 지시를 보강했으나 실제 호출 효과는 측정하지 않았다. 독립 fixture와 phase381.test.ts에16개 회귀를 추가했다.

최초251 생성 경로, 신규 OpenAI 재분석 정확도는 미검증이다. 동일 상품군만 확인되는 품명/HS·불완전한 참조/선적범위·여러 후보·미지원 OCR는 잠정/미확인을 유지한다. 실제 Set2 올바른 후보 대조에도 정보 부족/잠정 항목이 남으므로 전체 필드 복구 완료를 주장하지 않는다. 원문 포장 변경도 원문값은 검증됐지만 전체 범위 부족으로 잠정 차이다.

기존 PHASE37 ledger는 해시90d2b5f39a9a1d646653baca45770bdf173c0bf20922a04d214c13e78af68aa6 그대로 보존했다. 과거31/2/37/36 예산 또는 미승인8문서 제안을 사용하지 않았다. 자동 재시도·Gemini 폴백·새 기능 없음. 최종 source SHA를 바꾸지 않도록 본 증거와 완료 PROGRESS/PLAN은 validation/phase381-evidence에 별도 Commit/Push한다.
