# OceanRisk AI

2026 해운·항만·물류 AX 혁신 아이디어 공모전 해운 AX 트랙을 위한 해상운송 서류 검토 웹 앱. 대상: 중소 화주 및 초보 무역 담당자.

## 개발
Node.js 24, npm 11. 저장소 **루트**에서 실행합니다. 중첩 프로젝트 폴더를 만들지 않습니다.

```sh
npm ci
cp .env.example .env.local # 기존 파일이 없을 때만; 키는 안전하게 직접 설정
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Next.js App Router / strict TypeScript / Tailwind CSS / Zod / Vitest / Playwright.
`GEMINI_API_KEY`는 서버 전용입니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 이름을 사용하지 않습니다.

## 구조
- `src/app`: 페이지와 서버 API
- `src/modules/upload`: 파일 제한 및 검증
- `src/modules/pdf`: 페이지별 원문·텍스트 블록·좌표·행 추출
- `src/modules/layout`: 원문 라벨과 값, 표 열과 상품 행의 위치 관계 검증
- `src/modules/ai`: Gemini 분류·추출
- `src/modules/evidence`: 원문 근거 검증
- `src/modules/rules`: TypeScript 교차검증
- `src/modules/documents`: Zod 모델
- `src/components`: 사용자 인터페이스
- `tests/unit`, `tests/e2e`: 검증

## 범위 및 원칙
PHASE 0–1.6 기반을 보존한 PHASE 2 Commercial Invoice / Packing List. 텍스트 PDF만 지원하며 OCR, B/L, 위험 예측, DB 저장은 범위 밖입니다. AI 값은 근거 검증 없이 확정 오류에 사용하지 않습니다. 민감한 파일/추출값을 로그에 남기지 않습니다. 테스트용 합성 문서는 실제 분석 결과가 아닙니다.

## 배포
기존 Vercel 프로젝트/저장소 설정은 유지합니다. Node.js 24, Next.js 프레임워크, 루트 디렉터리 기본값. 서버 환경변수는 Vercel 환경 설정에서 입력합니다. 이 작업의 빌드는 배포 성공을 의미하지 않습니다.

## PHASE 1 기능 및 사용 흐름
1. Commercial Invoice(상업송장)와 Packing List(포장명세서) 영역에 텍스트 PDF를 각각 선택하거나 드롭합니다. 하나만 있어도 분석할 수 있고 두 파일은 한 요청으로 전송합니다. UI는 영역당 1개, 기존 API는 최대 4개, 파일당/합계 4 MB, 파일당 30페이지입니다. 합계 제한은 Vercel 함수의 요청 크기 제한을 고려한 값입니다.
2. Google Gemini로 추출 텍스트가 전송된다는 안내를 확인하고 분석을 시작합니다. 파일명과 키는 Gemini 프롬프트에 넣지 않습니다.
3. 필드별 ‘원문 대조 완료/근거 미확인/정보 없음’을 확인합니다. 배지를 누르면 파일명·페이지·근거 후보와 실제 원문을 볼 수 있습니다. ‘원문 대조’는 문서 진위나 의미의 정확성 보증이 아닙니다.
4. 값을 수정하면 ‘사용자 수정’으로 표시되고 확정 비교에서 제외됩니다. ‘AI 추출값 복원’으로 원래 후보를 복원할 수 있습니다. 실제 수정 서류는 ‘새 서류 검토’로 다시 업로드합니다.
5. 규칙은 Invoice 1개와 Packing List 1개의 **동일 거래당사자·거래 참조·정확히 같은 품명·상품 단위·명시적 전체 선적 범위**가 근거에서 확인되는 경우만 상품 수량을 비교합니다. 거래 참조나 전체 선적 범위만 부족하고 나머지 상품 근거가 확인된 경우에는 수치를 ‘비교 후보’로 보여 주되 확정 오류로 표시하지 않습니다. 중복/누락 품목, 다른 단위, 포장 개수, 명시적 부분선적, 수정/미검증 수량은 비교 불가입니다. PCS/EA 등 명시된 동의 단위만 대응하며 수치 단위 변환·부분선적 합산·퍼지 품목 매칭은 하지 않습니다.

## API 및 데이터 처리
- `GET /api/status`: 키 설정 여부와 공개 배포 식별 메타데이터(commitSha/id/environment)를 반환합니다. 키 값이나 접근 인증 정보를 반환하지 않습니다. 설정 여부는 키 유효성/실제 AI 성공의 보증이 아닙니다.
- `POST /api/analyze`: `multipart/form-data`의 `files` 필드. 선택적인 `slots` JSON 배열은 파일 순서별 사용자 지정 영역(invoice/packing_list)이며 기존 files-only 클라이언트도 지원합니다. AI 판독 유형을 변경하지 않고 응답의 uploadSlot/typeMismatch로 구분합니다. 파일별 원문/근거 후보/검증 결과/오류를 반환하며 `Cache-Control: no-store`를 설정합니다. 본문은 제한된 크기로 읽고, PDF 시그니처·텍스트·페이지를 검증합니다.
- Gemini REST `generateContent`, 기본 모델 `gemini-2.5-flash`. 서버 `x-goog-api-key` 헤더와 JSON Schema 구조화 출력 사용. 타임아웃/요청 한도/권한/불완전 응답을 구분합니다. 실키 미설정 시 PDF 원문만 추출하고 `API_NOT_CONFIGURED`를 표시합니다.
- 문서 내 지시문은 별도 시스템 지시가 아닌 신뢰하지 않는 사용자 데이터로만 전달합니다. 모델에 외부 도구를 제공하지 않습니다. 반환값은 Zod 및 별도 근거 검증을 거칩니다.
- 앱은 DB·파일 영구 저장·문서 로그를 만들지 않습니다. 처리를 위해 서버 메모리와 현재 브라우저 상태에 존재하며 Gemini 분석 시 Google에 전달됩니다. 제공자/호스팅의 데이터 처리 정책까지 ‘미저장’으로 보증하지 않습니다.
- PHASE 1.6부터 분석 API는 사용자 인증과 앱 자체 요청량/동시성/시간당 예약량 제한 없이 공개됩니다. Google 할당량은 유지합니다. 파일/텍스트/시간 제한과 Origin 검증은 계속 적용합니다.

## 테스트
단위 테스트는 pdf-lib로 생성한 **합성 PDF**를 실제 PDF.js로 추출합니다. Gemini 성공/오류 테스트는 모의 HTTP 응답이며 실 API 성공이 아닙니다. Playwright는 실제 Production 모드 서버의 키 미설정 PDF 추출과 합성 응답의 수량 비교·수정·근거 UI를 각각 검증합니다.

```sh
# 일반 환경에서 브라우저 설치가 필요할 때
npx playwright install chromium
npm run test:e2e
# 이 클라우드 머신에는 Chromium이 이미 설치되어 있습니다.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

완료/실패/미검증 및 GitHub 보존 상태는 [PROGRESS.md](./PROGRESS.md)에 기록합니다. PHASE 1.6부터 승인된 코드 변경은 검증 후 main에 일반 Push합니다. GitHub 저장과 Vercel 배포 확인은 별도로 기록합니다.

## PHASE 1.6 공개 분석 및 실제 검증

PDF 선택 → 데이터 처리/Google 전송 안내 확인 → 분석 시작. 접근 코드 입력이나 사용자 인증이 없습니다. 이전 `ANALYSIS_ACCESS_TOKEN` 변수는 코드에서 사용하지 않으며 Vercel에 남아 있어도 무시합니다. 기존 서버 환경변수와 프로젝트를 삭제/초기화하지 않습니다.

실제 실행 상태는 PROGRESS.md를 따릅니다. 과거 PHASE 1.6의 Google 400은 후속 변경으로 실제 A 분석 성공이 확인됐습니다. 현재 클라우드의 키와 Production의 키는 별개이며, 설정 여부만 조회합니다. 로컬 모의 검사와 실제 Google 호출 결과를 혼동하지 않습니다.

```sh
# 로컬 서버 자격 증명을 안전하게 설정한 경우
npm run test:live
# Vercel에 등록된 서버 키로 공개 Production 파이프라인을 확인
npm run test:production
```

합성 Invoice/PL 8개를 2페이지 PDF로 생성합니다. A: 500/500 PCS, B: 500/480 PCS, C: 상품 500 PCS와 포장 20 CTNS, D: 거래 참조 누락. 실제 PDF → AI 응답 → 원문 근거 → 규칙을 검사합니다. 로컬 모드는 문서 8개를 Google로 분석하고 Production 모드는 합성 파일 2개씩 4번 서버 업로드합니다. 모델 404 복구 시 목록 조회와 후보 요청이 추가될 수 있습니다. 유효한 키가 있으면 사용량이 발생할 수 있으며 일반 품질 검사/CI/빌드에는 실제 호출을 자동 포함하지 않습니다.

`test-results/live-gemini/report.json`과 `test-results/live-gemini-production/report.json`에는 상태/기준/오류 코드만 기록합니다. 원시 응답/키는 저장하지 않으며 합성 PDF와 보고서는 Git에서 제외합니다. 전체 범위에서 실제 A–D 모두 통과하면 종료 코드 0 및 completed=true입니다. 단일 사례 범위는 selectedCasesPassed만 검사하며 성공해도 completed=false입니다. 실행/검증 실패는 1, 로컬 키 미설정으로 미실행은 2입니다. Production 접속 불가는 1이며 AI 요청 전에 중단합니다. Production 보고서의 requestsAttempted는 직접 관찰한 로컬 Google 호출 수, serverRequestsAttempted는 앱 업로드 수입니다. 원격 Google 호출 수는 직접 관찰하지 않습니다.

수량 규칙의 `status`(match/mismatch/unverifiable)와 `confidence`(confirmed/candidate/unavailable)를 유지합니다. 후보는 검증된 상품 수치만 표시하고 확정 오류에 집계하지 않습니다. 같은 당사자·품명·상품 단위를 확인하되 거래 참조/전체 선적 정보가 부족하면 후보로 처리합니다. 서로 다른 거래·명시적 부분선적·사용자 수정·미검증 수량은 확정 오류에 사용하지 않습니다. PCS/EA만 동의 단위로 대응하고 포장 환산·수량 추측은 하지 않습니다.

Gemini 모델 기본값은 gemini-2.5-flash, REST v1beta generateContent 및 Zod 검증을 사용합니다. 모든 선택 모델에 문서화된 REST responseMimeType/responseJsonSchema를 사용합니다. 전송 스키마는 지원 키만 포함하며 참조를 인라인으로 펼칩니다. 서버 Zod는 문자열 길이·페이지·수량·품목 제한을 포함한 전체 제약을 그대로 검증합니다. 모델 없음(404), 요청 거부(400), 권한(401/403), Google 한도(429), 불완전/길이 제한 응답을 안전한 한국어 오류로 구분합니다. 실제 모델/키/스키마 수용 여부는 실제 호출 후에만 확정합니다. PDF worker를 서버 추적에 명시해 배포 패키지 누락을 방지합니다.

업로드 제한 4개·파일당/합계 4 MB·30페이지·문서 텍스트 100,000자, Gemini 25초/전체 105초 제한 및 취소 전파를 유지합니다. 응답 완료/부분 처리/실패를 구분하고 원문·파일별 오류·근거 페이지·사용자 수정을 보존합니다.

공개 API에는 인증과 앱 자체 요청량 제한이 없으므로 직접 API 클라이언트의 반복 호출, 여러 서버 인스턴스의 사용량, 동시 요청 메모리 증가에 의한 비용/서비스 악용 위험이 있습니다. Origin 검사는 브라우저의 다른 사이트 요청을 줄일 뿐 API 인증이 아닙니다. Google 제공자의 할당량/예산/알림을 운영자가 관리해야 하며 이 코드가 전역 과금 상한을 보장하지 않습니다.

## 검증 후 자동 저장·배포

```sh
# 작업 시작: 깨끗한 체크아웃에서만 최신 main 동기화
 git fetch origin refs/heads/main:refs/remotes/origin/main
 git switch main
 git merge --ff-only origin/main
# 수정 후 해당 작업 파일만 검토하고 Stage
 git add <task-files>
 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run ship -- --message "fix: describe the actual change"
```

ship은 main/원격 ancestry/Stage/비밀 파일/Push dry-run을 검사하고 npm ci → typecheck → lint → 단위 → 빌드 → PDF worker 추적 → Production Playwright를 실행합니다. 실패하면 커밋/Push하지 않습니다. 성공 후 원격을 다시 확인하고 검증된 파일을 커밋·일반 Push한 뒤 원격 SHA와 소스를 대조합니다. Stage/HEAD/원격이 바뀌면 중단합니다. 자동 브랜치 전환·병합·Force Push·PAT 저장은 하지 않습니다.

main Push 이후 기존 Vercel Git 연동이 Production 배포를 요청합니다. 새 `vercel.json`은 npm run build:verified를 실행하므로 타입/린트/단위/빌드/worker 검사 실패 시 빌드를 실패시킵니다. Playwright는 ship/Actions에서 실행합니다. 기존 Vercel 프로젝트·Git 연결·환경변수는 재생성하지 않습니다.

GitHub Actions의 quality job은 main Push/PR 품질 검사를 실행합니다. main Push에는 quality 통과 후 production job이 공개 status endpoint의 정확한 SHA를 최대 약 5분간 확인합니다. Actions 자체에는 contents:read만 부여하고 코드 Push·자동 병합은 포함하지 않습니다. 실제 AI 호출은 별도 명시적으로 선택한 live-gemini job에만 포함됩니다. Push는 Codex의 플랫폼 Git 인증과 ship이 실행합니다. main 보호 정책으로 거절되면 작업 브랜치/PR 보존 경로가 필요하며 보호 정책을 해제하지 않습니다. 필수 PR 검사/자동 병합 설정은 저장소 권한이 있어야 구성할 수 있습니다.

```sh
# Push 후 Production 식별만 다시 확인 (AI 분석을 호출하지 않음)
npm run check:production -- --sha <main-commit-sha>
```

Production 상태에 Vercel 시스템 환경변수의 SHA/환경/id를 포함합니다. 변수 노출 설정이 비활성화되면 SHA/id 확인이 불가능할 수 있습니다. 같은 SHA를 서비스하는 HTTP 응답은 배포된 코드의 근거지만 **Vercel 관리 API Ready 상태 또는 실제 AI 성공을 증명하지 않습니다**. 배포 확인 실패 후에도 이미 Push된 소스는 보존합니다. 보고서는 test-results/deployment/report.json입니다.

과거 클라우드의 GitHub API/Production 도메인 프록시 403은 사이트 장애를 의미하지 않았습니다. PHASE 2에서는 Production 직접 접근이 가능해졌으며 각 환경의 현재 접근 가능 여부를 다시 확인합니다. 네트워크 설정에서 api.github.com/oceanrisk-ai.vercel.app/api.vercel.com을 허용해야 원격 검사에 접근할 수 있습니다. 알려진 네트워크 차단 상태에서는 PRODUCTION_CHECK_ATTEMPTS=1로 반복 대기만 줄이며 성공을 주장하지 않습니다.

이후 Codex에 수정 요청을 하면 AGENTS.md의 검증·Stage·ship 절차를 기본으로 사용합니다. Git 쓰기 권한, 최신 main, Vercel Git 연결, 정상 품질 검사, 네트워크가 필요한 전제입니다. 지침 작성만으로 모든 후속 작업이 무조건 자동 배포된다고 보증하지 않습니다.

실제 AI 검증이 필요한 경우 Actions를 수동 실행하면서 verify_live_gemini를 선택하거나, 검증 실행 목적의 커밋 메시지에 `[verify-live-gemini]`를 명시합니다. quality와 Production SHA 확인이 먼저 성공해야 live-gemini job이 실행됩니다. 일반 커밋에는 이 표시를 넣지 않으며 유료 검사를 실행하지 않습니다. 배포 ID·SHA와 안전한 기준별 결과는 공개 Actions notice/job summary 및 단기 보관 artifact로 제공합니다. 원문·키·원시 모델 응답은 포함하지 않습니다.

설정된 모델이 실제 404를 반환할 때만 Google models.list를 1회 조회합니다. generateContent 지원이 명시된 텍스트 Flash 모델만 선택하며 TTS/audio/image/live/Pro 모델은 제외합니다. 같은 버전의 안정 모델, 가까운 버전의 안정 모델, 공식 Flash alias, preview 순으로 선택합니다. 목록에 포함됐다는 이유만으로 실제 사용 가능하다고 보증하지 않습니다. 최대 2개 후보를 확인하고 다음 후보로 넘어가는 조건은 이전 후보의 404뿐입니다. 400·권한·429·503에는 재시도하지 않습니다. 성공 응답 모델만 프로세스 메모리에 캐시하며 실제 모델명을 결과에 표시합니다. Google 할당량·과금 한도는 변경하거나 우회하지 않습니다.

실패 진단은 `[verify-live-gemini] [case-A]`로 A 두 문서만 실행할 수 있습니다. LIVE_GEMINI_CASE=all이 기본이고 A/B/C/D를 지정하면 해당 사례만 실행합니다. 단일 사례 성공은 전체 A–D 완료가 아닙니다. Google 429가 확인되면 다음 사례 호출을 중단합니다. provider diagnostics는 HTTP 상태·고정 설정 필드명·공개 모델명·quota window/limit-zero 여부만 담으며 키·문서·원시 오류·프로젝트 ID는 제외합니다.

현재 최종 소스의 품질 검사는 단위 **153개**, Production 모드 브라우저 **7개** 및 타입/린트/빌드/worker 검사를 통과했습니다. 실제 Production A 두 문서는 gemini-3.1-flash-lite에서 HTTP 400 INVALID_ARGUMENT로 실패하며 안전한 오류 상세에도 거부 필드/사유가 없습니다. 따라서 **실제 분석 정상화는 미완료**이고 최종 소스의 B–D는 미재실행입니다. 동일 프로젝트의 기본 Google generateContent 호출과 구조화 요청을 키가 있는 안전한 환경에서 분리 재현해야 근본 원인을 구분할 수 있습니다. Codex의 키는 환경 설정에서만 등록하고 키 값을 채팅이나 Git에 저장하지 마세요.


## PHASE 2 — 다양한 양식과 독립적인 근거 검증

두 업로드 영역은 데스크톱 2열·모바일 1열입니다. 빨간 PDF 아이콘/배지는 파일 종류를 뜻하며 카드 전체는 네이비·화이트를 유지합니다. 파일 제거·교체·드롭을 지원합니다. AI 판독 유형이 선택 영역과 다르면 ‘서류 종류 확인 필요’를 표시하고 재업로드 또는 두 칸 교환으로 수정할 수 있습니다. 칸 교환은 실제 판독 유형을 바꾸거나 새 유료 분석을 실행하지 않습니다.

PDF.js의 실제 페이지 좌표·블록 ID·행 정보를 기존 page/text에 추가합니다. Gemini에는 이 원문 구조를 신뢰하지 않는 데이터로 전달해 역할/표를 해석하도록 요청합니다. 인용은 기존 page/quote 또는 선택적인 segments[{blockId, quote}]를 사용합니다. 여러 블록의 인용은 각 블록에 실제로 존재해야 하며 합친 quote와도 일치해야 합니다. 존재하지 않는 인용/블록/페이지는 검증하지 않습니다.

별도 TypeScript 모듈이 실제 라벨과 인접 값, 표 제목의 열 범위와 데이터 행을 연결합니다. SELLER 아래 회사명, Purchase Order 옆 값, QTY 아래 수량, 줄바꿈 품명 등을 처리하며 회사별 좌표를 하드코딩하지 않습니다. 품명·수량·단위가 같은 표의 같은 상품 행이어야 하고 CTNS 열은 상품 수량에서 제외합니다. 근거 창에 원문과 실제 블록 위치를 표시합니다. 모호한 역할/열/행은 미검증으로 남깁니다. 회전·복잡한 병합 셀·스캔 문서 전체를 지원한다고 보증하지 않습니다.

검증된 주문번호·Invoice 참조 충돌과 수정값을 제외한 뒤 동일 거래·단위·선적 범위를 판단합니다. 상태는 확인된 일치 / 확인된 불일치 / 비교 후보·추가 확인 필요 / 비교 불가·분석 미실시를 구분합니다. 한 문서만 있으면 대상 서류 부족으로 표시하며 ‘수량 차이 0건’으로 오해시키지 않습니다. 부분선적 정보가 부족하면 검증된 상품 수치를 후보로 제공하고 확정 오류로 집계하지 않습니다.

```sh
# 실제 PDF 추출·합성 AI 응답: 7개 양식 조합, 외부 호출 없음
npm run test:layouts
# 배포된 동일 SHA와 서버 키 확인 후 실제 Gemini: 7개 조합 + 첫 조합 1회 반복
npm run test:layouts:production -- --sha=<deployed-main-sha> --repeat=2
```

실제 테스트 스크립트는 정상 세로/가로 양식, 별도 당사자 표, PCS/CTNS 혼재, 수량 차이, 거래번호 충돌, 줄바꿈 품명, 참조 누락을 검사합니다. 예상 필드/근거 확인 수·분류·규칙·오류 코드·반복 결과 해시만 보고서에 기록하고 원시 문서 값/키는 저장하지 않습니다. 429가 발생하면 후속 사례를 중단하며 제공자 한도를 변경/우회하지 않습니다. 보고서는 Git에서 제외된 test-results/live-layouts에 있습니다. 합성 표본의 수치는 실무 전체 서류의 정확도가 아닙니다.
