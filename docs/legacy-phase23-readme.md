# 보존 기록 — PHASE 2.3 시점 README

이 문서는 이전 Invoice/PL 제품의 이력입니다. 현재 공개 UI/API 사용 지침이 아니며, 유료 검증 실행을 승인하지 않습니다. 최신 README.md를 따르세요.

# OceanRisk AI

2026 해운·항만·물류 AX 혁신 아이디어 공모전 해운 AX 트랙을 위한 해상운송 서류 검토 앱. 중소 화주·초보 무역 담당자가 Commercial Invoice / Packing List를 검토합니다.

## 개발 환경
Node.js 24, npm 11. 현재 저장소 루트에서 작업하며 중첩 폴더/worktree를 생성하지 않습니다.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

Next.js App Router / strict TypeScript / Tailwind / Zod / Vitest / Playwright. 다른 머신에서는 `npx playwright install chromium`으로 브라우저를 설치합니다. 환경변수는 기존 파일을 덮어쓰지 않고 안전한 환경 설정에서 등록합니다.

## PHASE 2.2 — OpenAI 전환
- 활성 공급자는 OpenAI Responses API `/v1/responses`, 기본 모델 `gpt-6-luna`입니다. 서버 전용 `OPENAI_API_KEY`, 선택 변수 `OPENAI_MODEL=gpt-6-luna`. `NEXT_PUBLIC_`에 키를 넣지 않습니다. 기존 Gemini 모듈·회귀 테스트·환경변수는 보존하지만 기본 분석이나 실패 폴백으로 사용하지 않습니다.
- 공식 모델 문서에서 Responses / Structured Outputs / `reasoning.effort:none`을 확인했습니다. `text.format:{type:"json_schema",strict:true}`로 모든 필드를 required/nullable로 정의하고 객체의 추가 키를 금지합니다. 사용자 지정 다른 모델에는 미확인 reasoning 옵션을 보내지 않습니다.
- AI는 문서 유형·값·페이지·실제 블록 ID 후보를 반환합니다. 서버는 존재하는 PDF 블록만 사용해 page/quote/segments를 만들고, 기존 독립 검증 엔진이 문자·라벨 역할·열·상품 행·수량 단위를 대조합니다. 잘못된 ID/페이지/행/포장 열/없는 숫자는 검증하지 않습니다. AI가 검증 상태나 인용문을 생성하지 않습니다.
- 원본 PDF 페이지 텍스트·PDF.js 블록 좌표·행 추출과 UI의 근거 창을 유지합니다. 이미지/OCR·파일 업로드 도구·외부 도구 호출을 기본 경로에 추가하지 않습니다.
- 요청당 최대 출력 4096토큰, 공급자 45초/전체 요청 105초, 자동 재시도 0회. `store:false`, Standard tier 사용. 400/404 요청 거부, 401/403 권한, 429 제공자 한도/잔액, 5xx, 타임아웃, incomplete/refusal/JSON/내부 스키마 오류를 안전한 한국어 메시지로 구분합니다. raw 응답·키·서류를 로그에 남기지 않습니다.
- `aiUsage`에는 모델·요청/재시도 횟수·시간·입력/출력/캐시/추론 토큰과 추정 비용만 포함합니다. 미수신 사용량·알 수 없는 모델/서비스 티어는 비용 null로 표시합니다. 추론 토큰은 output_tokens에 포함되므로 중복 과금 계산하지 않습니다. 실제 청구액은 OpenAI Dashboard와 확인해야 합니다.
- 공식 Luna Standard 텍스트 요금(2026-10-11 확인): 입력 $0.10 / 캐시 입력 $0.01 / 캐시 쓰기 $0.125 / 출력 $0.50, 각 1M tokens. 272K 초과 긴 문맥 배수도 계산합니다. [공식 모델·요금](https://developers.openai.com/api/docs/models/gpt-6-luna), [구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create).

## 사용·데이터 처리
1. 두 업로드 영역에 PDF를 선택/드롭합니다. 한 문서도 분석 가능하고 두 문서는 한 요청으로 처리합니다. 영역별 교체/제거/교환, 빨간 PDF 표시, 모바일 배치를 유지합니다.
2. 추출 텍스트와 레이아웃이 OpenAI로 전송된다는 안내에 동의하고 분석합니다. 파일명·키는 프롬프트에 포함하지 않습니다. 앱은 문서 DB/영구 파일 저장/문서 로그를 만들지 않지만 OpenAI·Vercel의 처리 정책 전체를 미저장으로 보증하지 않습니다.
3. AI 추출 후보와 원문 대조 완료/근거 미확인/정보 없음 상태를 확인합니다. 배지에서 파일명·페이지·블록 위치와 실제 원문을 봅니다. 원문 일치는 문서 진위·모든 의미의 정확성을 보증하지 않습니다.
4. 수정값은 사용자 수정으로 구분하고 확정 비교에서 제외합니다. 원래 AI 후보 복원·수정 서류 재업로드를 지원합니다.
5. 동일 거래의 검증된 상품 행/단위/명시적 전체 선적만 확정 비교합니다. 검증된 참조 충돌·다른 당사자·포장 단위·수정/미검증 수량은 확정 오류로 사용하지 않습니다. 참조/전체 선적만 부족하면 후보로 구분하며, 한 문서는 대상 서류 부족입니다. PCS/EA 동의어만 정규화하고 환산·추측은 하지 않습니다.

## API·안전 제한
- `GET /api/status`: provider/model, 키 설정 여부, 공개 배포 SHA/ID/environment만 반환합니다. 설정 여부는 키 유효성/실제 호출 성공이 아닙니다.
- `POST /api/analyze`: multipart `files`, 선택 `slots` JSON 배열. 기존 files-only 클라이언트를 지원합니다. 사용자 영역과 AI 판독 유형을 별도로 반환하며 filename으로 분류하지 않습니다. 파일별 PDF/근거/오류/사용량 메타데이터, no-store.
- UI 영역당 1개, API 최대 4개, 파일당/합계 4 MB, 파일당 30페이지/100,000자/10,000블록. Origin·본문 제한·취소/타임아웃 유지.
- 로그인·접근 코드·앱 자체 시간당/일일/동시성 분석 한도 없음. 제공자 429는 우회하지 않습니다. 공개 호출에 실제 비용/과부하 위험이 있으며 파일 제한/Origin 검사는 전역 과금 상한이나 인증이 아닙니다. 운영자가 OpenAI 프로젝트 예산·알림·최소 키 권한을 관리해야 합니다. 이 저장소가 제공자 예산을 변경하거나 상한을 보장하지 않습니다.

## 모듈
`src/modules/pdf` 원문 추출, `layout` 표/라벨 위치, `ai/openai*` 활성 추출/스키마/사용량, `ai/gemini*` 비활성 이전 공급자, `evidence` 독립 검증, `rules` 수치 비교, `documents` Zod/타입, `upload` 파일 제한, `analysis` 파이프라인/결과 상태. `src/components` UI, `tests/unit`/`tests/e2e` 검증.

## 실제 검증과 비용 예산
일반 단위/브라우저/빌드/Actions는 실제 키를 비워서 실행하며 유료 호출을 자동 포함하지 않습니다. 모의 OpenAI 및 보존된 Gemini HTTP 테스트를 실제 호출로 보고하지 않습니다.

```sh
# 공식 Production의 정확한 SHA/활성 provider/키 설정을 먼저 확인
NODE_USE_ENV_PROXY=1 npm run test:production -- --sha=<deployed-main-sha>
# 최소 단일 Invoice 단계 (실제 연결/모델/스키마와 문서 근거를 함께 확인)
NODE_USE_ENV_PROXY=1 npm run test:production -- --sha=<SHA> --stage=single
# 로컬 키를 안전하게 등록한 경우
NODE_USE_ENV_PROXY=1 npm run test:live -- --local --stage=single
# 다양한 양식만; 앞서 사용한 예산과 공유
NODE_USE_ENV_PROXY=1 npm run test:layouts:production -- --sha=<SHA> --repeat=2
# 특정 양식만 (전체 완료가 아님)
NODE_USE_ENV_PROXY=1 npm run test:layouts:production -- --sha=<SHA> --case=portrait-landscape
```

`test-results/live-openai/ledger.json`에 호출 전 문서 수/보수적 비용을 예약하고 결과의 실제 tokens로 정산합니다. timeout/불명확한 비용은 예약을 유지하며 자동 재시도하지 않습니다. 여러 실행은 같은 ledger를 사용합니다. 새 체크아웃에서 ledger가 없으면 Git에 보존한 PHASE 2.2 안전한 보고서의 소모량을 복원하며 손상된 보고서는 초기화하지 않고 중단합니다. 기본 예산은 $0.50 또는 문서 20개, 먼저 도달하는 조건입니다. 이는 검증 스크립트만의 제한이며 앱의 분석 횟수를 제한하지 않습니다. 예산을 초기화하거나 임의로 추가 승인 플래그를 사용하지 마세요. 사용자에게 실제 소모/남은 사례를 보고하고 명시적 추가 승인 후에만 `--approved-extra-documents=N`을 사용합니다. 각 단계 실패 시 다음 유료 단계를 멈춥니다. 보고서는 키·문서 값·raw 응답을 저장하지 않습니다.

단일 A Invoice → A 두 문서 → B/C/D → 7개 양식 → 첫 양식 반복을 모두 독립 호출하면 최소 25개 문서여서 20개 예산을 초과합니다. 가능한 검증을 먼저 완료하고 추가 실행은 별도 승인이 필요합니다. 중단/일부 통과를 PHASE 2.2 전체 완료로 보고하지 않습니다. 합성 표본 지표를 모든 실무 서류의 정확도로 일반화하지 않습니다. 이전 Gemini 실제 실패 이력은 PROGRESS.md에 보존합니다.

## 검증 후 저장·자동 배포
기존 Vercel 프로젝트/Git 연결/환경변수/기록을 초기화하지 않습니다. AGENTS.md의 main 동기화·검토·Stage·ship 절차를 사용합니다.

```sh
git fetch origin refs/heads/main:refs/remotes/origin/main
# 작업 파일만 검토 후 Stage
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run ship -- --message "fix: describe the validated change"
npm run check:production -- --sha <main-commit-sha>
```

ship: Push dry-run → npm ci → typecheck/lint/단위 → Production build/worker → Production Playwright → 원격 변경 재확인 → 일반 커밋/Push → 원격 SHA/소스 대조 → Production 같은 SHA/OpenAI 설정 확인. 실패한 소스를 강제 배포하지 않습니다. main Push의 기존 Git 연동으로 배포하며 Actions quality/production과 Vercel 검증 빌드를 유지합니다. 실제 유료 검사는 자동 CI job에서 제거해 승인된 예산 밖의 중복 호출을 막습니다. Vercel Ready 관리 상태는 공개 SHA와 별도 확인하며 접근 불가를 숨기지 않습니다.

상세 실제 실행 결과·미검증·SHA는 [PROGRESS.md](./PROGRESS.md). 후속 B/L·계약 법률 위험·견적·비용 시뮬레이션·이력 DB·대시보드 재작성은 PHASE 3 이후 범위입니다.

## PHASE 2 — 다양한 양식과 독립적인 근거 검증

두 업로드 영역은 데스크톱 2열·모바일 1열입니다. 빨간 PDF 아이콘/배지는 파일 종류를 뜻하며 카드 전체는 네이비·화이트를 유지합니다. 파일 제거·교체·드롭을 지원합니다. AI 판독 유형이 선택 영역과 다르면 ‘서류 종류 확인 필요’를 표시하고 재업로드 또는 두 칸 교환으로 수정할 수 있습니다. 칸 교환은 실제 판독 유형을 바꾸거나 새 유료 분석을 실행하지 않습니다.

PDF.js의 실제 페이지 좌표·블록 ID·행 정보를 기존 page/text에 추가합니다. OpenAI에는 이 원문 구조를 신뢰하지 않는 데이터로 전달해 역할/표를 해석하도록 요청합니다. 인용은 기존 page/quote 또는 선택적인 segments[{blockId, quote}]를 사용합니다. 여러 블록의 인용은 각 블록에 실제로 존재해야 하며 합친 quote와도 일치해야 합니다. 존재하지 않는 인용/블록/페이지는 검증하지 않습니다.

별도 TypeScript 모듈이 실제 라벨과 인접 값, 표 제목의 열 범위와 데이터 행을 연결합니다. SELLER 아래 회사명, Purchase Order 옆 값, QTY 아래 수량, 줄바꿈 품명 등을 처리하며 회사별 좌표를 하드코딩하지 않습니다. 블록 ID가 없는 quote-only 근거도 실제 연속 블록의 유일한 문자 일치만 연결하고, 비연속 인용은 segments를 요구합니다. 품명·수량·단위가 같은 표의 같은 상품 행이어야 하고 CTNS 열은 상품 수량에서 제외합니다. 근거 창에 원문과 실제 블록 위치를 표시합니다. 모호한 역할/열/행은 미검증으로 남깁니다. 회전·복잡한 병합 셀·스캔 문서 전체를 지원한다고 보증하지 않습니다.

검증된 주문번호·Invoice 참조 충돌과 수정값을 제외한 뒤 동일 거래·단위·선적 범위를 판단합니다. 상태는 확인된 일치 / 확인된 불일치 / 비교 후보·추가 확인 필요 / 비교 불가·분석 미실시를 구분합니다. 한 문서만 있으면 대상 서류 부족으로 표시하며 ‘수량 차이 0건’으로 오해시키지 않습니다. 부분선적 정보가 부족하면 검증된 상품 수치를 후보로 제공하고 확정 오류로 집계하지 않습니다.

```sh
# 합성 AI 응답 + 실제 PDF.js (외부 API 호출 없음)
npm run test:layouts
```

Responses의 중간 `commentary`와 최종 `final_answer` 메시지를 구분합니다. 명시적인 최종 메시지가 하나일 때만 JSON을 파싱하며, 기존 단일 unphased 메시지는 지원합니다. 여러 최종 메시지·알 수 없는 phase·refusal·불완전한 출력은 안전하게 거부합니다. 중간 설명과 최종 JSON을 이어 붙이거나 JSON을 추측 복구하지 않습니다.

이미 다른 단계가 끝난 경우 `test:production -- --sha=<SHA> --stage=ad --scenario=C` 또는 `--stage=repeat`로 해당 최소 검사만 실행할 수 있습니다. 예산과 실패 이력은 모든 실행에서 공유합니다.

## PHASE 2.3 — 선택 의도와 거래 동일성을 분리
Invoice·Packing List 칸의 선택은 비교 대상 지정입니다. 거래 동일성은 별도로 확인합니다. 참조가 없거나 다른 의미로 표현되어도 모든 품목 비교를 중단하지 않습니다. Invoice 자체 번호와 PL의 Invoice 참조, PO, Shipment, Booking을 각 의미별로 대조하며 PL 자체 번호는 거래번호로 사용하지 않습니다. 같은 의미 참조 충돌은 독립 경고이며 거래에 의존하는 수량·중량은 잠정 상태로 보호합니다.

확인된 일치/불일치, 잠정 일치/불일치, 확인 필요, 정보 부족을 구분합니다. 기존 status는 하위 호환을 유지하고 assessment가 상세 의미를 나타냅니다. SKU/품명/단위/실제 행으로 유일한 상품을 대응하며 중복·유사성만 있는 대응은 확정하지 않습니다. 사용자 수정은 원문 성공으로 표시하지 않고 즉시 잠정 재계산합니다.

실제 PDF 값 셀·열/행·인접 라벨을 검증합니다. 분리된 숫자/단위와400PCS/300KG도 실제 동일 상품행을 확인하며 다른행/CTNS/총계·없는인용은 거부합니다. doc own금액/중량/포장/총계 검사와 교차검사를 분리하고 할인·운임·세금·통화정밀도·총액정의가 부족하면 잠정/정보부족입니다. API의 compact review에 원문 반복을 줄인 evidenceRefs를 반환하고 UI는 수정된문서의 동일규칙을 다시실행합니다.

실제PHASE2.3검증은 이전31문서예산을 재사용하지 않습니다. 새로 승인된2문서/$0.03상한을 scripts/live-phase23.ts와별도ledger/archive로 보존합니다. 정확ProductionSHA 확인 후 한배치만호출하고 재시도하지 않습니다. 실제응답을 메모리에서ProductionUI에재생하는브라우저검사는 추가호출0이며 로컬mock회귀와별도로기록합니다. 승인없이실행/예산초기화하지 마세요.

```sh
NODE_USE_ENV_PROXY=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:phase23:production -- --sha=<exact-deployed-sha> --approved-documents=2 --approved-max-cost-usd=0.03
```
