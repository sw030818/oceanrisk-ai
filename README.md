# OceanRisk AI

**중소 포워더를 위한 적하목록 신고 전 AI 정합성 사전검증 시스템**

House B/L 초안, 별도 출처의 수출신고필증, House 적하목록 신고 예정자료의 원문과 연결관계를 신고 전에 검토하는 보조 도구입니다. 현재 **PHASE 3.0: 문서 모델·업로드·PDF 준비 기반**입니다. 새 서류의 AI 분류·필드 추출·양자 및 삼각대조는 아직 제공하지 않습니다.

## 현재 사용 가능한 기능

- 3개 업로드 영역: House B/L / 수출신고필증 / House 적하목록. PDF 드래그·드롭, 교체·삭제, 빨간 PDF 표시, 모바일 대응.
- 서로 다른 종류의 서류 최소 2종으로 자료 준비 시작. 3종이면 삼각대조를 위한 자료 준비 상태로 표시합니다. 실제 대조 완료를 뜻하지 않습니다.
- PDF.js의 페이지별 텍스트·블록 ID·좌표·행 추출, 판독 실패 및 부분 성공, 페이지 원문·위치 확인.
- 문서별 필드 틀과 사용자 입력/초기화. 원본 추출값과 현재 수정값을 분리하며 사용자 입력을 원문 대조 완료로 표시하지 않습니다. 현재 AI 원본값은 모두 미추출입니다.
- 공개 `/api/analyze`는 PDF 준비만 실행합니다. OpenAI 키가 있어도 공급자를 호출하지 않습니다. Invoice/PL 요청은 안전하게 거부하며 과거 모델·Responses·근거·규칙 코드는 내부 회귀용으로 보존했습니다.

## 실행 및 검증

Node.js 24 / Next.js App Router / TypeScript strict / Tailwind CSS / Zod.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:runtime
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium PLAYWRIGHT_SERVER_MODE=production npm run test:e2e
```

`npm run verify`는 설치·타입·린트·전체 단위·Production 빌드·PDF worker·브라우저 검사 전체를 실행합니다. 키를 비워 유료 호출을 방지합니다. 합성 PDF만 테스트하며 PHASE 3.0에서는 실제 OpenAI 검증을 실행하지 않습니다. 기존 265개 단위 회귀를 유지하고 새 모델·공개 API 안전 검사를 추가했습니다. 브라우저 검사는 의도적으로 바뀐 3종 UI 계약과 **분석 미실시**를 검증하도록 갱신했습니다.

## 문서 데이터 구조

`src/modules/shipping`은 기존 Invoice/PL 스키마를 확장해 혼용하지 않고 별도의 Zod 문서 모델을 제공합니다.

- `uploadType`은 사용자가 지정한 영역, `detectedType`은 실제 분류 결과입니다. 현재 `detectedType:null`, `classificationStatus:not_performed`로 반환하며 파일명으로 분류하지 않습니다.
- 문서별 필드: HBL 번호·Shipper/Consignee/Notify Party·수출신고번호/수출자/HS Code·물품 수량/단위·포장 개수/단위·신고 중량 또는 총중량/단위·POL/POD·선적 범위. 문서 성격에 따라 서로 다른 필드 틀입니다.
- 각 필드는 `original`과 `current`에 값·근거 상태·파일/페이지/블록/좌표/의미를 보존합니다. 사용자 입력은 `user_edited`이며 AI 원문 검증 성공으로 승격하지 않습니다. 이 스키마만으로 원문 의미 검증을 수행한 것은 아닙니다.
- 별도 의미/라벨/근거를 갖는 `additionalFields`로 실제 문서의 추가 필드를 확장할 수 있습니다. 복수 `items`, `containers`(컨테이너·Seal·포장·중량), `references`(HBL·복수 신고·선적 등). 현재 목록은 미추출이므로 비어 있습니다. 물품 수량과 포장 개수는 별도 필드이며 환산하지 않습니다.
- `relationships`는 여러 문서·품목·컨테이너·참조의 명시적 다대다 연결입니다. 분할선적·동시포장·제안/사용자확인/근거확인/충돌 상태를 표현할 수 있고, HBL 한 건과 신고 한 건의 1:1을 가정하지 않습니다. 문서 그룹 밖의 항목 연결은 거부합니다. 실제 대응 판정은 아직 구현하지 않았습니다.
- 후속 검증 계약은 기존 6개 판정 상태를 재사용하고 양자 3종·삼각·문서 자체 검토를 구분합니다. 현재는 판정이나 오류 0건을 생성하지 않습니다.

## API 및 제한

- `GET /api/status`: 활성 provider/model, 키 설정 여부, PHASE 3.0 capability, 배포 SHA/ID/environment. 키의 값 또는 유효성을 반환하지 않습니다.
- `POST /api/analyze`: multipart `files` + 필수 JSON `slots` 배열(`house_bl`, `export_declaration`, `house_manifest`). 서로 다른 종류 최소 2종, 파일과 같은 길이. 향후 복수 수출신고필증을 위해 API는 동일 슬롯 반복을 허용합니다.
- 반환 `mode:pdf-preparation`, `aiCalled:false`, 파일별 PDF/준비된 문서 틀/오류와 준비 요약. 분류·AI 추출·삼각대조 capability는 모두 false입니다.
- UI: 영역당 1개, 최대 3개. API: 최대 4개. 파일당 및 합계 4 MB, 파일당 30페이지 / 100,000자 / 10,000블록. 파일 형식·본문 길이·Origin·취소·105초 처리 제한·no-store를 유지합니다.
- 로그인·접근 코드·애플리케이션 자체 시간당/일일 분석 한도를 추가하지 않았습니다. 제공자 할당량을 변경하거나 우회하지 않습니다.

## 보안 및 사용 범위

기업 내부 자료의 사용·처리·외부 전송 권한을 확인해야 합니다. 현재 단계의 PDF 준비는 서버에서 처리하며 OpenAI로 보내지 않습니다. 후속 AI 분석에서는 추출 텍스트와 위치 정보가 외부 OpenAI API로 전송되며 실행 전에 명확히 안내합니다. API 키는 서버에서만 접근합니다. 기존 `.env.example`/Vercel 키 설정을 삭제하거나 초기화하지 않습니다.

문서 DB·영구 파일 저장·문서/API 응답 로그를 만들지 않습니다. 준비 결과와 사용자 입력은 현재 브라우저 세션에만 있으며 새로고침 후 유지되지 않습니다. 실제 업무 PDF를 테스트/Git에 넣지 않습니다.

세관 신고를 직접 수행하지 않고 과태료 예방을 보장하지 않습니다. 관세청/EDI 자동 제출·결과 조회·Booking 연결·외부 실시간 업무 연동·온프레미스 배포·OCR은 제공하지 않습니다. 기존 EDI의 사전검증 기능 유무를 단정하지 않습니다.

## 저장 및 Production 배포

AGENTS.md의 `ship` 절차를 사용합니다. 작업 파일만 검토·Stage하고 전체 품질 검사 통과 후 main 일반 Commit/Push → 원격 SHA 확인 → 기존 Vercel Git 자동 배포 → Production 동일 SHA 확인 → GitHub Actions quality/production을 확인합니다. Force Push·기존 기록/설정 삭제·실패 코드 배포는 하지 않습니다.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run ship -- --message "feat: prepare manifest filing document workspace"
```

배포 후 새 화면과 실제 합성 PDF 준비를 무료로 확인할 수 있습니다. 이 도구는 정확한 SHA와 PHASE 3.0의 AI 비활성 capability를 먼저 확인하며, 조건이 다르면 업로드 전에 중단합니다. 재시도나 실제 AI 검증은 하지 않습니다.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run check:phase30:ui -- --sha=<deployed-main-sha>
```

## PHASE 3.1~3.2 남은 작업

1. 새 3종 전용 Responses strict 응답 스키마·분류/추출 프롬프트와 블록 후보 복원. 기존 Invoice/PL 프롬프트를 적용하지 않습니다.
2. 선적/신고 역할별 독립 근거 검증: HBL·신고 참조·컨테이너/Seal·당사자·항만·품목·물품/포장 수량·중량의 행·열·단위 연결.
3. 별도 승인을 받은 최소 합성 유료 검증과 모의/PDF 검증 지표 분리. 이전 유료 예산을 재사용하지 않습니다.
4. 다대다 관계·복수 신고·분할선적·동시포장·복수 컨테이너를 고려한 TS 결정적 양자 및 삼각대조. 근거 부족/수정값/거래 충돌은 잠정 상태로 보호합니다.
5. 실제 분류와 업로드 영역 불일치 경고, 의미별 판정·후속 질문·근거 UI와 수정 후 재검토.

상세 실행 결과는 [PROGRESS.md](./PROGRESS.md), 계획은 [PLAN.md](./PLAN.md), 이전 제품 문서는 [보존 README](./docs/legacy-phase23-readme.md)에 있습니다. 과거 유료 호출 ledger/메타데이터는 보존하며 이번 단계에서 호출하지 않습니다.
