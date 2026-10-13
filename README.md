# OceanRisk AI

**중소 포워더를 위한 적하목록 신고 전 선적서류 검토 도구**

현재 PHASE 3.3는 **House B/L·수출신고필증·House Manifest의 AI 분류·정보 추출·PDF 원문 근거 확인**을 제공합니다. 같은 의미의 검증된 참조로 관계를 연결하고, 비교 가능한 범위의 양자·삼각대조와 정합성 확인 사항을 제공합니다. 세관 신고를 직접 수행하거나 과태료 예방을 보장하지 않습니다.

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

HS Code·신고번호·B/L·컨테이너·Seal 번호는 문자열로 보존합니다. 문서 합계와 개별 행, PCS 물품 수량과 CTNS 포장 개수는 분리하며 계산·환산·연결을 추정하지 않습니다. 누락은 null입니다. 문서별 qualified ID와 행 대응으로 다대다 관계를 표현합니다. 복수 신고·부분/동시포장 범위를 확인하지 않고 자동 합산하지 않습니다.

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

`npm run verify`는 키를 비운 설치·타입·린트·전체 단위·Production build·PDF worker·Playwright 검사를 실행합니다. 기존 단위 332개와 브라우저 21개를 보존하며 전용 회귀를 추가했습니다. 새 테스트는 한영 혼합 검색 가능한 2페이지 합성 PDF, 여러 품목/컨테이너/Seal/신고 참조, 정보 부족, 허위 근거·다른 행·단위, 모의 Responses 오류와 UI를 검사합니다. 실제 세관 발급 진본으로 가장하지 않습니다. **모의 AI/원문 검사 통과는 실제 OpenAI 정확도 검증이 아닙니다.**

## API 계약과 제한

- `GET /api/status`: PHASE 3.3, provider/model, 키 설정 여부, capability, 배포 SHA/ID/environment. 키 값·유효성은 반환하지 않습니다.
- `POST /api/analyze`: multipart `files` + JSON `slots` (`house_bl`, `export_declaration`, `house_manifest`) + `operation`.
- `operation:analyze`: `mode:shipping-analysis`, 개별 문서 분류/필드/근거/usage 또는 안전한 오류. `operation:prepare`(생략 시 하위 호환 기본값): `mode:pdf-preparation`, AI 호출 0회. 지원하지 않는 operation은 거부합니다.
- prepare는 대조 미실시입니다. analyze는 관계·양자/삼각 상태·검사·요약을 반환하며 3종이 있어도 공통 연결 근거가 없으면 삼각대조를 보류합니다. capability와 실제 수행 결과는 별개입니다.
- 최소 서로 다른 2종, UI 기본 3개+추가 PDF 1개/API 최대 4개, 파일당 및 합계 4 MB, 파일당 30페이지/100,000자/10,000블록. 기존 형식·본문 길이·Origin·취소·no-store 보호를 유지합니다.
- 로그인·접근 코드·자체 시간당/일일 분석 횟수 제한은 없습니다. 제공자 한도는 우회하지 않습니다. Invoice/PL 공개 경로는 종료했으며 기존 모듈과 회귀는 내부 검증용으로 유지합니다.

## 저장·배포·유료 검증

AGENTS.md의 `ship`은 검토한 파일만 Stage한 뒤 전체 검사를 통과해야 main 일반 Commit/Push·원격 SHA 대조·기존 Vercel Git 자동 배포와 정확한 Production SHA 확인을 수행합니다. Force Push·실패 코드 배포·기존 설정/키 초기화는 하지 않습니다.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run ship -- --message "feat: analyze shipping PDFs with grounded OpenAI extraction"
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run check:phase32:ui -- --sha=<deployed-main-sha>
```

무료 Production 검사는 정확한 SHA를 먼저 확인하고 **prepare만** 실제 전송합니다. 잘못된 PDF의 분석 오류 경로도 PDF 추출 단계에서 차단되는지 검사하며 공급자 호출은 0회입니다.

보존된 PHASE 3.1 전용 `test:phase31:production`은 당시 **새 승인 후에만** 실행하는 별도 도구입니다. 현재 PHASE 3.3 승인·도구·예산은 아래 절차를 사용합니다. 사전 비용 확인 `--dry-run`은 호출 0회입니다. 합성 3문서/배치 1회/최대 $0.05/자동 재시도 0의 별도 ledger를 호출 전에 예약하며 usage가 불명확하면 예약을 유지합니다. 기존 PHASE 2.2의 31개/PHASE 2.3의 2개 소진 예산과 공유하지 않습니다. 재실행/예산 초기화는 금지합니다. 실행 결과는 안전한 상태·개수·토큰/비용 메타데이터만 보존합니다.

## 남은 범위

명시적 연결/범위를 확인할 수 없는 다대다 화물 배분·복수 신고 합산은 잠정/확인 필요로 남깁니다. HS 또는 컨테이너만으로 상품/선적을 확정하지 않으며 다른 언어·요약 범위의 품명과 항구 표기 차이는 확인이 필요합니다. CSV/EDI·OCR·세관 자동 신고·업무시스템/온프레미스 연동은 제공하지 않습니다. 복잡한 병합/회전 표·모호한 라벨·스캔 문서는 근거 미확인 또는 판독 실패가 정상이며 실무 전체 양식의 정확도를 보장하지 않습니다. 문서 DB/영구 업로드 저장은 없고 사용자 수정값은 브라우저 세션에만 존재합니다.

실제 실행/미검증/배포 기록은 [PROGRESS.md](./PROGRESS.md), 계획은 [PLAN.md](./PLAN.md), 이전 제품 이력은 [보존 README](./docs/legacy-phase23-readme.md)에 있습니다.

## PHASE 3.2 실제 대조와 검증

`shipping/relationships`는 검증된 같은 의미의 HBL/신고/선적 참조를 우선하며 컨테이너/품명 단독 동일성을 확정하지 않습니다. `shipping/review`는 3종 양자와 모든 연결이 검증된 공통HBL 삼각대조를 수행합니다. `shipping/coverage`가 실제 표의 전체 데이터행 포함·중복을 확인한 뒤 동일HBL/서로다른컨테이너의 화물 수치만 합산합니다. 원문 수치·단위·동일 범위가 있어야 확정 불일치이며 사용자 수정/관계확인·근거 부족·부분/동시포장은 잠정입니다.

UI에서 선적 연결/범위·일치·확정불일치·잠정/확인필요·정보부족/비교불가를 확인하고 각 비교값의 원문을 열 수 있습니다. 수정/복원·사용자 관계 확인은 순수 함수로 재계산하며 유료 호출을 추가하지 않습니다. 중요도와 확실성은 별도입니다.

이번 신규 예산은 $0.50/유료 문서 최대12/자동재시도0으로 명시 승인됐습니다. 과거 예산과 별도ledger를 사용하고 요청bytes와출력상한을 먼저 예약하며 미확인 사용량을 환불된 것으로 취급하지 않습니다. 실제 결과는 모의와 분리하며 합성 서류의 범위를 넘어 실무전체 정확도를 주장하지 않습니다.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:phase32:production -- --sha=<tested-main-sha> --stage=normal --approved-documents=12 --approved-max-cost-usd=0.50
```

stage baseline은 기존3.1 추출2건, normal은3종, mismatch/uncertain은각2종입니다. 실패 후 무조건반복하지 않고 필요한 경우에만 남은예산에서 repair를 사용합니다. 실제응답을 메모리에서만 재사용해 공식ProductionHTML/assets의 데스크톱/모바일·원문·수정 UI를 확인하며 추가유료호출0입니다. API 전문/문서 전문/키를 기록하지 않습니다.

실제 live 결과·토큰·예산은 [validation/phase32-evidence 기록](https://github.com/sw030818/oceanrisk-ai/tree/validation/phase32-evidence/docs/validation)에 정상Push하여 보존합니다. 보고서만의 커밋으로 테스트된 Production main SHA를 바꾸지 않습니다. 그 원격 예산도 확인해 새 작업환경에서 소모 예산을 초기화하지 않습니다. 해당 기록이 아직 없으면 live 완료를 의미하지 않습니다. PHASE3.1 당시 승인대기와새3.2승인을 구분합니다.

### PHASE 3.3 사용 흐름
House B/L·수출신고필증·House 적하목록 각 영역에 여러 PDF를 추가합니다. 기존 파일은 유지되고 개별 삭제/교체가 가능합니다. 검토 공간은24개/64 MB, 파일당4 MB/30페이지이며 서버 요청은4 MB 이내로 자동 분할합니다. 같은 이름도 고유ID로 구분합니다. 한 종류는 개별 분석만 제공하고 검증된 다른 유형과 연결될 때 대조합니다.

주 버튼 **AI 서류 분석 시작**은 외부 OpenAI 분류·추출·근거 후보 및 결정적 대조를 실행합니다. 보조 **PDF 원문만 보기**는 무료 파싱만 실행합니다. 배치 실패는 다른 성공 결과를 지우지 않으며 추가파일 분석은 기존 성공/수정 결과를 재사용합니다. 시간부족으로 아직AI를호출하지않은 문서는 단일파일배치로 연기합니다.

검색 가능한 페이지는 기존PDF.js 원문을 유지합니다. 텍스트 부족 페이지는 동의된 auto OCR에서만 최대3페이지를 외부 OpenAI에 PDFsubset으로 보내 인식합니다. OCR 인식값/페이지는 후보이며 독립적으로 확인된 원문 좌표가 아닙니다. 숫자/단위는 원본PDF에서 직접 확인해야 하며 확정 오류 근거로 승격하지 않습니다. 원본은 브라우저파일 링크로 확인하고 서버에 영구저장하지 않습니다.

복수신고는 명시된 전체신고목록·원문 전체품목·서로다른품명/HS·동일수량단위·전체범위가 모두 확인된 경우에만 물품수량을집계합니다. 중복품목/공동포장/미명시배분은 보류합니다. 검토 보고서는 브라우저 인쇄/PDF저장으로 출력하며 PDF전문을 포함하지 않습니다.

실제 검증: `NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:phase33:production -- --sha=<ProductionSHA> --stage=normal --approved-documents=24 --approved-requests=30 --approved-max-cost-usd=0.10`. 신규 예산$0.10/24문서/30공급자요청을 전체 단계가 공유합니다. 명령플래그는 새로운 승인을 대신하지 않고 소모예산을 복원하지 않습니다. baseline/normal/mismatch/complex/uncertain/ocr/holdout은 각각 결과를 보존하며 OCR합성회전스캔 생성은 개발환경의pdftoppm을사용하고ProductionOCR은별도native실행파일을요구하지않습니다.

### PHASE 3.4 결과 워크스페이스
현재 버전은 업로드 3영역·유형별 여러PDF·개별 추가/교체/삭제·안전한 순차배치를 유지하며 결과를 KPI, 서류 비교표, 상세 패널, 선적 그룹, 통합 인쇄 보고서로 표시합니다. 개별 문서1개도 분석할 수 있습니다. 검토공간24개/64MB, 파일4MB/30페이지, 요청4MB/최대4개(클라이언트기본2개) 제한은 서로 다릅니다.

선적 분석은 실제 PDF 텍스트 블록과 선으로 닫힌 셀 경계를 사용합니다. 일반 Bill of Lading만으로 House를 확정하지 않고 House 발행 문맥을 함께 대조합니다. 번호/분리라벨·단위·품목행/전체합계를 구분하며 CT는 포장문맥, 항구는명시 UN/LOCODE 별칭에서만 정규화합니다. 같은 검증 HBL의 문서 기재 수치 비교는 전량 선적 또는 계약 이행 입증이 아닙니다. 부분선적·복수신고·근거 부족·사용자 수정은 해당 판정을 보호합니다.

사용자 제공 실패PDF는 공개저장하지 않습니다. 독립합성 CI, 기존회귀, 실제사용자첨부 OpenAI 분석, 실제응답의무료UI재생은 각각구분합니다. 새 PHASE3.4 검증예산은최대$0.15이며이전소진예산과분리합니다. 예산예약·토큰·미확인usage비용을보존하고자동재시도하지않습니다. 실제결과는 validation/phase34-evidence에별도보존해테스트한ProductionSHA를유지합니다.
