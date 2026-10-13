# OceanRisk AI

**중소 포워더를 위한 적하목록 신고 전 선적서류 검토 도구**

현재 PHASE 3.1은 **House B/L·수출신고필증·House Manifest의 AI 분류·정보 추출·PDF 원문 근거 확인**을 제공합니다. 서류 간 양자·삼각대조와 위험 판정은 PHASE 3.2 대상이며 현재 실행하지 않습니다. 세관 신고를 직접 수행하거나 과태료 예방을 보장하지 않습니다.

## 사용 흐름

3개 업로드 영역에서 서로 다른 종류의 PDF 최소 2종을 선택합니다. 기본 `AI 문서 분석`은 추출 텍스트·페이지 위치 블록을 외부 OpenAI API로 전송합니다. `PDF 원문만 확인`은 공급자 호출 없이 원문을 준비합니다. 기업 자료의 처리·외부 전송 권한을 먼저 확인해야 합니다.

- 파일 선택·드롭·교체·삭제·빨간 PDF 표시, 데스크톱 3열/모바일 화면을 유지했습니다.
- 문서별 실제 유형·완료/부분 성공/실패, 추출 필드·품목·컨테이너·Seal·화물 기록·복수 신고 참조를 표시합니다.
- 선택 영역과 실제 제목에 근거한 분류는 별개입니다. 불일치하면 실제 유형 필드를 표시하고 파일 교체/영역 교환을 지원합니다. 최초 선택값을 보존하며 교환은 추가 API 호출을 만들지 않습니다.
- 모든 값에 원문 대조 완료/근거 미확인/정보 없음/사용자 수정 상태를 표시합니다. 근거 버튼에서 PDF 파일·페이지·블록 좌표·실제 인용을 확인하고 원래 AI 값으로 복원할 수 있습니다.
- 사용자 수정은 `original`과 분리한 `current`에 기록합니다. 원래 인용을 수정값의 검증 성공으로 재사용하지 않습니다.
- AI 실패 시 읽을 수 있는 PDF를 보존합니다. 인증/이용 한도/키 설정 오류가 나면 같은 배치의 추가 AI 호출을 중단하고 원문 준비는 계속합니다.

## 문서 스키마

| 유형 | 주요 문서 필드 | 반복 구조 |
|---|---|---|
| House B/L | HBL 번호, Shipper/Consignee/Notify, Vessel/Voyage, 품명, 포장 개수/단위, 총중량/단위, POL/POD | 품목, 컨테이너, 복수 Seal, 신고·선적 참조 |
| 수출신고필증 | 신고번호/일자, 수출자/신고인, 품명/거래품명, HS Code, 물품 수량/단위, 명시된 순·총·신고 중량 | 여러 품목의 신고 필드, 컨테이너, 신고 참조 |
| House Manifest | HBL 번호, Shipper/Consignee, 품명, 포장/총중량, POL/POD | 화물 기록별 HBL/컨테이너/Seal/품명/수치, 컨테이너, 신고 참조 |

HS Code·신고번호·B/L·컨테이너·Seal 번호는 문자열로 보존합니다. 문서 합계와 개별 행, PCS 물품 수량과 CTNS 포장 개수는 분리하며 계산·환산·연결을 추정하지 않습니다. 누락은 null입니다. 다대다 관계 모델은 보존하지만 실제 대응 알고리즘은 아직 없습니다.

## 분석 및 독립 근거 검증

- 기존 공통 OpenAI Responses transport를 재사용합니다. 서버 전용 `OPENAI_API_KEY`, 기본 `gpt-6-luna`, `store:false`, strict JSON schema, 기본 티어, 요청별 45초·전체 105초 제한, 출력 상한 8,192토큰입니다. 자동 재시도·Gemini 폴백은 없습니다.
- 중간 commentary를 제외하고 최종 구조화 메시지만 파싱합니다. JSON/스키마 오류·미완료·출력 제한·거부·인증·429·연결 실패를 구분합니다. 사용자 문서 전문·키·raw 응답을 로그에 남기지 않습니다.
- AI에는 파일명·사용자 슬롯을 분류 힌트로 보내지 않습니다. 문서 명령문은 신뢰하지 않는 데이터이며 시스템 지시가 아닙니다.
- `ai/citations`가 AI의 페이지/블록 ID 후보를 실제 PDF 블록에서만 복원합니다. 없는 페이지/ID·중복 ID·너무 긴 인용은 미확인으로 남깁니다.
- `shipping/verify`와 `layout/shipping-cells`가 문자·숫자 전체 값, 한영 라벨의 역할, 상대 열 위치, 정확한 품목/컨테이너/화물 행, 단위를 독립 검사합니다. 다른 행의 같은 숫자, 순중량을 총중량으로 인용, 개별 값/단위를 문서 합계로 인용하는 경우 거부합니다. 줄바꿈 품명은 숫자/HS 셀이 있는 실제 데이터 행에 연결합니다.
- `shipping/ground`는 실제 분류 유형에 맞는 필드를 구성하고 중요 정보 누락·근거 미확인·분류 불확실을 부분 성공으로 표시합니다. 분류 제목 근거가 없으면 업로드 선택을 사실로 간주하지 않습니다.

## 실행과 무료 품질 검사

Node.js 24 / Next.js App Router / TypeScript strict / Tailwind CSS / Zod.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:runtime
OPENAI_API_KEY= GEMINI_API_KEY= PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium PLAYWRIGHT_SERVER_MODE=production npm run test:e2e
```

`npm run verify`는 키를 비운 설치·타입·린트·전체 단위·Production build·PDF worker·Playwright 검사를 실행합니다. 기존 단위 291개와 브라우저 15개를 보존하며 전용 회귀를 추가했습니다. 새 테스트는 한영 혼합 검색 가능한 2페이지 합성 PDF, 여러 품목/컨테이너/Seal/신고 참조, 정보 부족, 허위 근거·다른 행·단위, 모의 Responses 오류와 UI를 검사합니다. 실제 세관 발급 진본으로 가장하지 않습니다. **모의 AI/원문 검사 통과는 실제 OpenAI 정확도 검증이 아닙니다.**

## API 계약과 제한

- `GET /api/status`: PHASE 3.1, provider/model, 키 설정 여부, capability, 배포 SHA/ID/environment. 키 값·유효성은 반환하지 않습니다.
- `POST /api/analyze`: multipart `files` + JSON `slots` (`house_bl`, `export_declaration`, `house_manifest`) + `operation`.
- `operation:analyze`: `mode:shipping-analysis`, 개별 문서 분류/필드/근거/usage 또는 안전한 오류. `operation:prepare`(생략 시 하위 호환 기본값): `mode:pdf-preparation`, AI 호출 0회. 지원하지 않는 operation은 거부합니다.
- 두 모드 모두 `review:{status:not_performed,checks:[]}`, 삼각대조 capability false입니다. 분석 가능한 기능과 실제 파일별 수행 여부를 구분합니다.
- 최소 서로 다른 2종, UI 최대 3개/API 최대 4개, 파일당 및 합계 4 MB, 파일당 30페이지/100,000자/10,000블록. 기존 형식·본문 길이·Origin·취소·no-store 보호를 유지합니다.
- 로그인·접근 코드·자체 시간당/일일 분석 횟수 제한은 없습니다. 제공자 한도는 우회하지 않습니다. Invoice/PL 공개 경로는 종료했으며 기존 모듈과 회귀는 내부 검증용으로 유지합니다.

## 저장·배포·유료 검증

AGENTS.md의 `ship`은 검토한 파일만 Stage한 뒤 전체 검사를 통과해야 main 일반 Commit/Push·원격 SHA 대조·기존 Vercel Git 자동 배포와 정확한 Production SHA 확인을 수행합니다. Force Push·실패 코드 배포·기존 설정/키 초기화는 하지 않습니다.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run ship -- --message "feat: analyze shipping PDFs with grounded OpenAI extraction"
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run check:phase31:ui -- --sha=<deployed-main-sha>
```

무료 Production 검사는 정확한 SHA를 먼저 확인하고 **prepare만** 실제 전송합니다. 잘못된 PDF의 분석 오류 경로도 PDF 추출 단계에서 차단되는지 검사하며 공급자 호출은 0회입니다.

실제 유료 검증은 **새 승인 후에만** `test:phase31:production`으로 실행합니다. 사전 비용 확인 `--dry-run`은 호출 0회입니다. 합성 3문서/배치 1회/최대 $0.05/자동 재시도 0의 별도 ledger를 호출 전에 예약하며 usage가 불명확하면 예약을 유지합니다. 기존 PHASE 2.2의 31개/PHASE 2.3의 2개 소진 예산과 공유하지 않습니다. 재실행/예산 초기화는 금지합니다. 실행 결과는 안전한 상태·개수·토큰/비용 메타데이터만 보존합니다.

## 남은 범위

PHASE 3.2의 TS 다대다 대응·양자/삼각대조·분할선적/동시포장 판단·위험 판정은 미구현입니다. CSV/EDI·OCR·세관 자동 신고·업무시스템/온프레미스 연동은 제공하지 않습니다. 복잡한 병합/회전 표·모호한 라벨·스캔 문서는 근거 미확인 또는 판독 실패가 정상이며 실무 전체 양식의 정확도를 보장하지 않습니다. 문서 DB/영구 업로드 저장은 없고 사용자 수정값은 브라우저 세션에만 존재합니다.

실제 실행/미검증/배포 기록은 [PROGRESS.md](./PROGRESS.md), 계획은 [PLAN.md](./PLAN.md), 이전 제품 이력은 [보존 README](./docs/legacy-phase23-readme.md)에 있습니다.
