# 진행 상태

## 저장소 및 범위
- 시작: sw030818/oceanrisk-ai, work 브랜치, f5c857dca207437c0459a71bd9861c653ff94ce5.
- 요청한 oceanrisk-ai-v2는 기존 Git 인증으로 Repository not found 응답. 사용자가 현재 연결된 oceanrisk-ai에 저장하도록 승인.
- 프로젝트를 기존 체크아웃 루트 /workspace/oceanrisk-ai에 생성. 과거 앱 코드 사용 없음. 기존 origin·Git 기록·Vercel 설정 유지.
- 개발 브랜치: feat/oceanrisk-phase-0-1. main 강제 Push/기록 삭제 없음.

## PHASE 0 — 완료
- Next.js App Router, strict TypeScript, Tailwind, Zod, 모듈 구조, 환경변수 템플릿, 문서, ESLint/Vitest/Playwright 구성.
- npm install, typecheck, lint, 단위 테스트 2/2, production build 통과. 개발 서버 HTTP 요청으로 한국어 페이지 검증.
- 커밋: bb2a0705e802ba252b04a301939f3a0a770c765c.
- Push 완료. git ls-remote origin refs/heads/feat/oceanrisk-phase-0-1의 SHA와 로컬 SHA 일치 확인.

## PHASE 1 — 구현 및 검증 완료
- 복수 PDF 업로드, 확장자/MIME/시그니처·개수·크기·전체 요청 크기 검증, 페이지별 원문 추출.
- Gemini 서버 REST 구조화 출력, 문서 분류, 거래당사자·거래 참조·품명·수량·단위·중량·금액·통화 추출 경로 구현.
- 근거 후보와 실제 페이지 텍스트 대조; 수량 라벨·포장 개수·숫자 부분 일치·거래당사자 역할 검증. AI 지시문은 시스템 지시와 분리된 신뢰하지 않는 문서 데이터.
- 확인/수정 UI, 필드별 근거 창·원문, 수정값 별도 상태, 원래 후보 복원, 새 수정 PDF 재업로드.
- 동일 거래 참조/당사자·품명·상품 단위·명시적 전체 선적 조건에서만 수량 비교. 자료 부족·단위 차이·부분선적·중복/누락 품목·사용자 수정값은 검증 불가.
- 네이비/블루/화이트 반응형 UI, 빈/업로드/실패/처리 상태, AI 전송 동의 안내, 키보드 근거 창.

## 실제 실행한 최종 검증
- npm ci: 통과. 저장할 설치 스크립트를 실제 실행하여 재설치 가능성 확인.
- npm run typecheck: 통과.
- npm run lint: 통과, 오류/경고 0.
- npm test: 8개 파일, 55개 테스트 통과, 실패/스킵 0. PDF.js로 실제 생성 합성 PDF 추출, 근거 검증, 수량 정상/불일치/검증 불가, 업로드 제한, API 경계, Gemini 모의 응답/오류/문서 명령 분리, 파이프라인 검증.
- npm run build: 통과.
- Next.js 개발 서버 실행 및 Playwright: 3/3 통과, 실패/스킵 0. 데스크톱 및 390px 모바일 가로 넘침 확인, 실제 서버 2페이지 PDF 추출 및 키 미설정 상태, 합성 응답 수량 불일치/근거/사용자 수정/복원/새 검토, 키보드 포커스/ESC 확인.
- Production npm run start -- --port 3002: 홈·키 상태·실제 2페이지 PDF 업로드 및 추출·API_NOT_CONFIGURED 응답 확인.
- 브라우저 JS 번들에 Gemini 키 환경변수/인증 헤더/제공자 요청 경로가 포함되지 않음을 검사.

## 초기 실패와 해결
- npm 기본 캐시 경로에 쓸 수 없어 다운로드 실패 → .npmrc에서 /tmp 캐시 사용, 정상 설치.
- 초기 타입 검사/빌드의 혼합 필드 제네릭 오류와 Next Link ESLint 오류 → 수정 후 통과.
- 최초 Playwright에서 로컬 개발 Origin 제한 및 초기화 전 파일 선택 실패 → 명시적 로컬 Origin 설정과 클라이언트 초기화 전 입력 비활성화. 재검사 통과.
- Playwright alert 선택자가 Next 경로 안내와 중복 → 실제 오류 내용으로 선택자 구체화.
- 근거 창 키보드 포커스 검사 실패 → 모달 내부 Tab 순환 처리. 재검사 통과.
- 현재 미해결 테스트 실패 없음. npm 설치 시 ESLint 9 upstream deprecation 안내는 있으나 검사 오류 아님.

## 실제 API 및 배포 제한
- GEMINI_API_KEY 미설정. 실제 Google Gemini 호출/추출 정확도 검증은 실행하지 않음. 모의 API 및 합성 결과는 실제 AI 성공이 아님.
- 스캔/OCR·암호 보호 PDF는 지원하지 않음. 최대 파일 4개, 파일당/합계 4 MB, 파일당 30페이지.
- 명시적 근거가 없는 값은 보수적으로 검증 불가. 원문 대조는 문서 진위/전체 위험/법률 판단 보증이 아님.
- main 병합·Vercel Production 배포·새 클라우드 작업 복원 검증은 미실행. PHASE 1 이후 기능은 진행하지 않음.

## 재사용 환경 초안
- install_script, start_skill 및 GEMINI_API_KEY secret 요구사항 저장 완료.
- 요구 HTTPS 목적지 generativelanguage.googleapis.com 추가. 키 값은 저장/출력하지 않음.
- 초안 저장은 현재 머신에 키 적용 또는 게시를 의미하지 않음. 사용자가 환경 설정에서 검토/키 입력/저장 후 Publish 필요.

## PHASE 1 GitHub 보존
이 문서는 PHASE 1 구현 커밋에 포함됩니다. 커밋 후 해당 브랜치로 Push하고 로컬 HEAD와 git ls-remote 결과를 대조합니다. 최종 커밋 SHA와 확인된 Push 상태는 완료 보고에 기록하며 저장된 코드의 SHA는 git rev-parse HEAD로 조회할 수 있습니다. 브랜치 링크: https://github.com/sw030818/oceanrisk-ai/tree/feat/oceanrisk-phase-0-1

## PHASE 1.5 — 안정화 코드 검증 완료 / 실제 Gemini 검증 미완료

### 시작 및 현재 인증
- sw030818/oceanrisk-ai / feat/oceanrisk-phase-0-1을 Fetch하고 fast-forward 확인. 시작 HEAD c039f59e58d115ebe036452808f43333af6f394d, 기존 사용자 변경 없음.
- 실제 프로세스 환경과 Next의 .env 로딩 경로에서 GEMINI_API_KEY 미설정. 환경 초안의 기존 요구사항에도 has_saved_binding=false 확인. 키 값을 조회/출력하지 않았음.
- `npm run test:live` 실제 실행: 종료 코드 2, requestsAttempted=0, completed=false. 합성 PDF 8개 생성. A–D 실제 API 검사는 모두 not_run. API 인증/응답 오류가 발생한 것이 아니라 호출 전 키가 없어 중단된 상태.

### A–D 결과 구분
| 사례 | 실제 생성 PDF + 모의 AI | 실제 Gemini |
|---|---|---|
| A: Invoice/PL 500 PCS 일치 | 통과 · confirmed match | 미실행 |
| B: 500/480 PCS | 통과 · confirmed mismatch | 미실행 |
| C: 상품 500 PCS + 포장 20 CTNS | 통과 · 상품 수량 일치, 포장 수량 제외 | 미실행 |
| D: 거래 참조 누락 | 통과 · unverifiable/candidate, 확정 오류 아님 | 미실행 |

문서 유형, 상품 수량·단위, 실제 원문 근거·2페이지 위치, 정상/불일치/예외/정보 부족 결과는 **모의 AI 응답** 파이프라인에서 검증. 실제 모델의 분류·추출 정확도를 검증했다고 주장하지 않음. 실제 호출 도구는 동일 사례로 실제 provider responses 및 각 기준을 확인하고 키/원시 응답 없이 메타데이터만 저장.

### 수정 내용
- 상품 수량 라벨을 별도로 읽어 같은 블록의 포장 20 CTNS와 혼동하지 않음. PCS/EA 동의 단위, 500PCS 및 Quantity (PCS) 표기를 지원. 다른 단위/중량/포장 라벨은 비교 근거로 사용하지 않음.
- 기존 status API를 유지하고 confidence=confirmed/candidate/unavailable 추가. 원문 수치·품명·단위·같은 거래당사자가 확인됐지만 참조/전체 선적 정보가 부족하면 ‘비교 후보’로 표시. 확정 오류 집계에서 제외.
- 서로 다른 참조, 명시적 부분선적, 사용자 수정값, 미검증 수치는 확정 불일치로 사용하지 않음. 부정된 전체 선적 표현과 상충하는 선언을 제외. 거래당사자 근거 뒤 별도 주소 줄을 허용하되 짧게 잘라낸 회사명은 여전히 거부.
- Production은 private server access code가 없으면 fail-closed. 브라우저 메모리만 사용하고 Google/로그/Git에 실제 접근 코드를 보내거나 저장하지 않음. 기존 Gemini 키는 서버 전용 유지.
- Origin 검사, 인스턴스 10 요청/분·동시 2개·AI 문서 예약 24개/시간, 429/Retry-After. 카운터는 비영구적/비분산이라는 제한을 명시.
- 전체 105초와 모델 25초 제한, PDF/AI 취소 전파, 응답 본문 타임아웃 별도 오류. 출력 8192 토큰/Flash thinking 0 설정.
- 기존 디자인을 유지하며 접근 코드 입력, 실제 응답 대기, 분석 응답 완료/부분 처리/실패, 파일별 원문·오류를 구분. 모바일/근거 창 긴 텍스트 줄바꿈 개선.

### 실제 수행한 검사
- 최종 package-lock 기준 npm ci 통과 (419 packages).
- npm run typecheck 통과.
- npm run lint 통과, 오류/경고 0.
- npm test: 10개 파일 **89/89 통과**, 실패/스킵 0. 기존 55개 유지 + 회귀 34개.
- npm run build 통과.
- Playwright: **7/7 통과**, 실패/스킵 0. 기존 3개 유지 + 회귀 4개. 실제 서버 PDF 추출/판독 불가, 모의 후보/부분 성공/접근 실패/대기, 근거·수정, 390px 모바일 확인.
- 로컬 Production 서버에서 접근 코드 미설정 503, 미인증 401, 인증 후 실제 합성 PDF 추출, 외부 Origin 403, 실제 burst 429/Retry-After 검사 통과. 이 검사는 합성 접근 코드와 Gemini 키 없는 별도 프로세스로 실행하여 유료 호출 없음.
- Production 클라이언트 JS 번들에 GEMINI_API_KEY, ANALYSIS_ACCESS_TOKEN, x-goog-api-key, provider URL이 없음을 확인. src에는 문서/거래 정보를 출력하는 로그가 없으며 CLI는 합성 사례 실행 메타데이터만 기록.

### 작업 중 발견한 실패와 해결
- 취소 신호를 추가하면서 PDF 함수 인자 누락/실 호출 도구의 배열 타입 누락이 초기 검사에서 발견됨 → 수정, 기존 PDF/파이프라인 검사와 최종 전체 검사 통과.
- 새 C 합성 fixture의 근거 후보가 원문의 비연속 줄을 붙여 실패 → 실제 PDF에 상품/포장 줄을 연속 배치하여 정상 근거 fixture로 수정. 검증기를 완화하여 잘못된 인용을 통과시키지 않음.
- Origin을 내부 request.url과만 비교해 127.0.0.1 정상 업로드를 차단 → 실제 Host 및 HTTPS 프록시 protocol 기준으로 수정, 외부/잘못된 Origin 차단 회귀 및 실제 서버 검증 통과.
- 현재 미해결 자동 테스트 실패 없음. 실제 Gemini 검증은 자격 증명 미설정으로 미실행.

### 남은 작업 및 배포 상태
- GEMINI_API_KEY를 안전하게 설정하고 실제 A–D 검증을 실행해야 PHASE 1.5 실사용 검증 완료로 판단 가능. 모델 프롬프트/타임아웃/표 형식·라벨 변형은 실제 모델 결과로 추가 확인 필요.
- Vercel 서버에 ANALYSIS_ACCESS_TOKEN 및 Gemini 키, Google 할당량 설정 필요. 분산 전역 비용 제한은 구현하지 않음. 접근 코드는 로컬 검증용 서버 변수이며 Google proxy secret으로 선언하지 않음.
- 환경 초안에 기존 설치 지침, 갱신한 PHASE 1.5 시작 지침과 ANALYSIS_ACCESS_TOKEN 변수 요구사항 저장. 실제 값/현재 머신 적용/게시와는 별도.
- 안정화 소스 커밋 `876f3d765455979caedb0096c34ae75f00c14355`를 같은 개발 브랜치에 Push 완료. `git ls-remote` SHA 일치, 원격 Fetch 후 `git diff HEAD origin/feat/oceanrisk-phase-0-1` 차이 없음 확인. 이 저장 상태 기록은 별도 문서 커밋으로 보존하며 최종 브랜치 SHA는 완료 보고에서 제공.
- main 직접 Push/강제 Push/기록 삭제/병합/Vercel Production 배포/후속 기능 확장은 수행하지 않음. 코드 검토는 가능하지만 실제 Gemini 검증 및 운영 설정 없이 배포 준비 완료라고 보고하지 않음.

## PHASE 1.6 — 공개 분석 및 검증 후 자동 저장·배포

### 작업 기준과 원격 확인
- 사용자의 PHASE 1.6 요청에 따라 main Push와 기존 Vercel Git 연동 Production 배포가 승인됨. 이전 단계의 배포 금지 지침은 이 요청 범위에 맞게 갱신.
- 깨끗한 작업 트리에서 원격 Fetch, main 동기화. 시작 main SHA: `30ab26922505363f0a02bcc119409a4384ccea1e` (기존 PHASE 1.5 PR 병합 기록 보존).
- 플랫폼 HTTPS Git read 및 main Push dry-run 성공. GH_TOKEN 설정 여부만 확인했으며 값은 읽거나 출력하지 않음. GitHub API는 현재 프록시 Forbidden. GitHub 공개 Actions 페이지는 HTTP 200으로 조회됨.
- Production 도메인의 / 및 /api/status 요청은 CONNECT 프록시 403으로 차단. 실제 사이트 HTTP 오류/배포 실패로 해석하지 않음. Vercel 관리 토큰은 현재 환경 미설정. 프로젝트 연결/Ready/배포 ID는 직접 확인되지 않음.

### 코드 변경
- 접근 코드 입력 UI/state/Authorization 헤더, Bearer 비교, ANALYSIS_ACCESS_TOKEN 의존성, /api/status 인증 필드 제거. 과거 변수가 Vercel에 남아 있어도 코드에서 무시하며 삭제/초기화하지 않음.
- 앱 자체 분당/시간당/동시성 제한, 글로벌 카운터, 제한 관련 429/Retry-After 코드 제거. Google 제공자의 429는 명확한 별도 오류로 유지.
- 파일 형식/시그니처/4개/4 MB 합계/30페이지/100,000자, 본문 메모리 제한, 순차 파일 처리, Origin 검증, 25초 모델/105초 전체 제한과 취소 전파 보존.
- 기존 Production 분석 route trace에 pdf.worker.mjs가 **없음**을 검사에서 확인 → outputFileTracingIncludes로 명시하고 배포 trace 및 worker 파일 존재를 검사하는 verify:runtime 추가. 실제 Vercel 실패 원인으로 확정한 것은 아니며 확인된 패키징 결함을 수정한 것임.
- Gemini 400 요청 거부/404 모델 없음/401·403 권한/429 Google 한도, 응답 길이 제한·차단 메시지 구분. 기존 v1beta 모델 URL, responseJsonSchema, Zod, 실제 텍스트 입력 및 원문 검증 유지. 실제 모델/스키마 수용은 아직 확인 불가.
- 기존 confirmed/candidate/unavailable 수량 규칙, 수정값 출처, 반응형 디자인/원문·페이지·부분 성공·실패 UI 유지.
- /api/status에는 비밀값 없이 키 존재 여부와 Vercel 시스템 배포 SHA/id/환경만 포함. 존재 플래그를 실제 API 성공으로 해석하지 않음.

### 실제 수행한 검사
- TypeScript / ESLint 통과.
- 단위 테스트 **111/111**, 11개 파일 통과, 실패/스킵 0. 기존 PHASE 0/1의 55개 및 A–D 근거/규칙 검사를 유지. 제거한 인증/자체 한도 테스트는 공개 Production·burst 30회·AI 문서 32개·동시 5개 테스트로 교체.
- npm run build:verified 실제 실행 통과: typecheck → lint → unit → Production build → worker trace.
- Playwright **7/7** Production 모드에서 통과, 실패/스킵 0. 접근 입력 없음/인증 헤더 없음, 모델 오류·대기, 실제 PDF·판독 실패, 수정/근거, 비교 후보·부분 처리, 390px 모바일 검사.
- 실제 로컬 Production 서버에 합성 PDF를 인증 없이 12번 연속 업로드. HTTP 200 및 각 2페이지 추출, API_NOT_CONFIGURED 표시, 자체 429 없음. 외부 Origin 403 및 클라이언트 JS의 서버 키/헤더/Google URL 미포함 검사 통과. 실제 Google 호출 없음.
- GitHub workflow YAML 파싱 통과. 이는 Actions 실제 실행 성공을 의미하지 않음.
- 새 업로드 개수 회귀 테스트의 예상 HTTP 코드가 422였으나 기존 검증기는 400을 반환 → 기존 정상 동작에 맞게 기대값 수정. 최종 전체 단위/브라우저 실패 없음.

### 실제 Gemini와 모의 결과 구분
| 사례 | 실제 PDF + 모의 AI 응답 | 실제 Gemini |
|---|---|---|
| A: 500/500 PCS | confirmed match 통과 | 미실행 |
| B: 500/480 PCS | confirmed mismatch 통과 | 미실행 |
| C: 500 PCS 상품 / 20 CTNS 포장 | 포장 제외, 정상 상품 비교 통과 | 미실행 |
| D: 거래 참조 누락 | unverifiable/candidate 통과 | 미실행 |

- 로컬 키 미설정. npm run test:live 종료 코드 2, requestsAttempted=0, completed=false.
- npm run test:production 실제 실행했으나 Production status 조회 단계에서 네트워크 차단. 종료 코드 1, productionStatusChecked=false, keyConfigured=null, serverRequestsAttempted=0, Google 직접 요청 0, A–D not_run.
- report.json과 PDF는 합성 테스트 산출물로 Git 제외. 원시 AI 응답/키를 저장하지 않음.
- 키가 있는 로컬 또는 Production에 접근 가능한 환경에서 test:live/test:production을 실행해야 실제 Gemini 성공/정확도 검증을 완료할 수 있음. 현재 정상화 코드를 구현했으나 실제 분석 성공을 확정하지 않음.

### 자동 저장·배포 방식과 검증 한계
- AGENTS.md에 시작 시 최신 main 동기화 및 종료 시 검토/Stage/ship 실행을 명시.
- ship: main/원격 ancestry/비밀 파일/Push dry-run → npm ci 및 전체 로컬 검사 → Stage/HEAD/원격 재확인 → 의미 있는 커밋 → 일반 main Push → 원격 SHA/소스 일치 → 공개 Production SHA 확인. 실패/충돌/권한 오류 시 중단, Force Push/정책 해제/PAT 저장 없음.
- quality.yml은 main Push/PR 검사, main Push에는 quality 성공 후 Production SHA 확인. contents:read만 사용. 실제 AI 호출·자동 병합·Code Push를 하는 Actions가 아님.
- vercel.json의 buildCommand는 검증 빌드. 타입/린트/단위/빌드/worker 검사 실패 시 빌드가 실패하여 새 Production 버전 준비를 중단. Vercel 연결/프로젝트/환경변수는 삭제하거나 재생성하지 않음.
- 이번 소스는 ship으로 전체 검사와 실제 커밋/Push를 실행하며 확인된 SHA/Push 결과는 완료 보고 및 후속 저장 상태 기록에 제공. 원격 확인 전 저장/배포 성공으로 보고하지 않음.
- 배포 endpoint의 SHA가 일치해도 Vercel 관리 API Ready/실제 AI 성공은 별도. 네트워크가 차단되면 소스 보존과 배포 확인 불가를 분리 보고.

### 운영 위험 및 환경
- 인증/자체 제한 제거로 공개 API 반복 호출·동시 메모리 증가·과금 악용 위험이 존재. Google 측 할당량/예산/알림은 운영자가 설정해야 하며 변경/우회하지 않음. Origin 검사는 API 클라이언트의 호출을 인증하지 않음.
- 환경 초안에 기존 Google 목적지를 보존하며 api.github.com, oceanrisk-ai.vercel.app, api.vercel.com 허용 목적지를 저장. 현재 런타임 네트워크 허용 요청은 승인됐지만 목적지 프록시 제한은 남아 있음. 초안 저장은 현재 프록시 적용/Publish 완료가 아님.
- 폐기된 ANALYSIS_ACCESS_TOKEN 변수 요구사항이 환경 초안/Vercel에 남아 있어도 이 코드에는 필요하지 않음. 기존 환경변수를 임의 삭제하지 않음.
- 후속 기능은 추가하지 않음. 실제 Gemini 검증, Actions 성공, Production Ready/ID/커밋 일치가 확인되기 전 전체 자동화 검증 완료라고 보고하지 않음.

### 확인된 첫 PHASE 1.6 저장·CI·Production 결과
- ship 실제 실행: npm ci 419 packages 및 111개 단위/7개 Production 브라우저/빌드/worker 검사 모두 통과 후 커밋/일반 main Push 자동 수행.
- 소스 SHA `40fb8a7dab9433f0dc5bc4da149f10ed4fe063f7`. 원격 SHA/Fetch된 소스 일치 확인.
- 클라우드 직접 Production 확인은 네트워크 때문에 verified=false로 종료했지만 GitHub 소스는 안전하게 보존됨.
- GitHub 공개 Actions 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38160863388 에서 **Status Success** 확인. quality 1m 11s / production 22s.
- production job은 고정 공식 도메인의 /api/status에서 **동일 소스 SHA·Production 환경·키 설정·인증 필드 제거**를 확인해야만 성공한다. 이 작업의 성공은 Production이 새 소스를 서비스함을 입증한다. 실제 AI 성공/관리 API Ready/id 확인은 별도.
- 이 CI 경로에서는 Production 네트워크가 가능함이 확인되어, 수동 입력 또는 `[verify-live-gemini]`라는 명시적 커밋 표시가 있을 때만 A–D 실제 합성 AI 검증을 실행하도록 확장. 일반 Push/PR/빌드에는 유료 AI 호출을 포함하지 않음. 결과의 안전한 메타데이터를 공개 job summary로 제공하여 클라우드 프록시로 artifact/API를 읽지 못해도 실제 기준별 결과와 공개 deployment id를 확인할 수 있도록 함.

### 실제 Production A–D 첫 실행 실패 및 진단 보강
- 명시적 live 표시 커밋 `a9a88b877daf54157a0a13e0dce81e2ad0c2b0a4`를 검증 후 main Push.
- https://github.com/sw030818/oceanrisk-ai/actions/runs/38161238732 : quality 및 production 성공, **live-gemini 실패 (exit 1)**. 이 실행 결과를 실제 AI 성공으로 보고하지 않음.
- 익명 공개 페이지에서 로그/summary/artifact 세부내용을 읽을 수 없어 원인을 확정할 수 없었음. 안전한 case별 HTTP/오류/검증 상태와 공개 deployment ID를 Actions notice로 제공하도록 진단 보강. 문서 원문·키·원시 모델 응답은 포함하지 않음.
- Gemini 400 응답의 API_KEY_INVALID reason 및 스키마 거부 메시지를 서버 내부에서 분류하되 원문은 반환/로그로 노출하지 않음. 합성 회귀 검사 추가. 진단을 갖춘 실제 A–D 검사를 명시적으로 재실행해 가능한 수정 또는 외부 설정 필요 원인을 확인한다.

### 확인된 실제 실패 원인: Gemini 모델 404
- 진단 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38161603819 의 공개 알림에서 A–D 각각 두 문서의 `API_MODEL_NOT_FOUND` 확인. Google generateContent가 404를 반환한 단계이며 AI 구조화 결과는 아직 생성되지 않음. PDF 판독/키 미설정으로 단정하지 않음.
- 같은 실행의 Production 알림: SHA `f169c83d6f6f7ad1dfd6ffe796ae31b75b0eca43`, verified=true, ID `dpl_6a4pZdGYzVH2U3ZpamSrHKYsx4Qr`. 관리 API Ready는 아직 직접 확인되지 않음.
- 404에 한해서 서버 키로 models.list를 1회 호출해 Google이 generateContent 지원을 명시한 텍스트 Flash 모델만 선택하고 1회 재시도하도록 수정. 실제 응답 성공 모델은 인스턴스 메모리에만 캐시. 권한/400/429/500에는 조회/재시도 없음. 다른 API/오디오/이미지/Pro 모델을 추측해 사용하지 않음.
- 구조화 출력/Zod/근거 검증/타임아웃은 그대로 유지하며 성공 응답에 실제 사용 모델명을 안전한 메타데이터로 기록. 실제 모델 응답 검증은 다음 명시적 A–D 실행에서 확인.
- 모델 발견 변경의 최초 로컬 검사에서 JSON 요청 객체 괄호 누락으로 구문 검사가 실패 → 수정하고 타임아웃/cache가 JSON body가 아니라 fetch 옵션에 위치하는 회귀 확인을 보강. 실패한 로컬 상태는 커밋/Push하지 않음.

### 모델 복구 후 실제 제공자 거부·서비스/한도 오류
- https://github.com/sw030818/oceanrisk-ai/actions/runs/38162265729 에서 quality/production 성공, live 실패 확인. 배포 SHA `111fb6b504086ed0bff61685877e749d74569620`, ID `dpl_76EXHgR78xSvF5hyqsrbHcig9dFk`, verified=true.
- 실제 결과: A API_ERROR/API_REQUEST_REJECTED, B 요청 거부 2개, C 요청 거부/API_ERROR, D API_ERROR/API_RATE_LIMIT. 모델 404 이후 다른 제공자 단계에 도달했지만 구조화 분석 성공 사례는 아직 없음.
- 정확한 거부 필드/HTTP 상태를 확인하기 위해 원문 메시지를 서버 메모리에서만 읽고 status·고정 설정 필드명·요청 모델·quota window/limit-zero 여부만 화이트리스트로 반환/알림. 키·문서·프로젝트 ID·원시 응답은 출력하지 않음.
- 다음 실행은 `[case-A]` 표시로 A 두 문서만 검사. 일부 범위가 통과해도 전체 A–D completed는 false로 유지. 제공자 429를 확인하면 테스트 도구는 뒤의 사례 호출을 중단하며 Google 한도 변경/우회/자동 재시도를 하지 않음.

### A 최소 진단으로 확인된 HTTP 503
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38162836658 : quality/production 성공, A 실제 분석 실패. 두 문서 모두 모델 gemini-3.8-flash, HTTP 503, status UNAVAILABLE. requestFields 없음, quotaLimitZero=false. 해당 실행에서는 원시 메시지 없이 공급자 서비스 불가를 확인했으며 권한/스키마 오류라고 주장하지 않음.
- 배포 SHA `9855c95e5f6d80d0eea0173cd9fcf1b966ddad34`, ID `dpl_HFwAELmASmfmuCFWJq7sdUWRmnu1`, Production verified=true.
- 404 목록 선택을 단순 최신 버전 우선에서 **안정 모델·원래 버전 계열·공식 Flash alias** 우선으로 변경. 같은 목록에 실제로 있는 모델만 선택하며, 503/429를 받은 뒤 다른 모델로 순환하거나 한도를 우회하지 않음. 원래 버전의 Flash-lite가 목록에 있다면 이를 먼저 사용하여 프롬프트/스키마 호환성과 안정성을 유지. 합성 선택 회귀 검사 추가.
- Google 공개 API discovery 문서 `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`를 실제 HTTP 200으로 확인. generationConfig의 responseJsonSchema/responseSchema/responseMimeType와 새 responseFormat이 존재함을 확인. 기존 필드명이 없다는 추측으로 오류 원인을 단정하지 않음.

### 같은 계열 후보도 실제 404 / 최신 API 형식 정리
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38163293926 : quality/production 성공, A 두 문서 모두 gemini-2.5-flash-lite의 HTTP 404 NOT_FOUND로 실패. Google 목록에 generateContent 모델로 표시돼도 실제 사용 가능성을 보증하지 않음을 확인.
- 소스 SHA `a29ce3edd52f23ed72b31b844d71bf474b40822e`, ID `dpl_AdFxodSYUSw8gy5TCu4rtztv9uyL`, Production verified=true.
- 404 복구는 1회 목록 조회 후 중복을 제거한 최대 2개 후보까지만 확인. 후보도 404인 경우에만 다음 후보를 사용하며 400/429/503에는 중단. 성공한 실제 응답 모델만 메모리 캐시.
- Google discovery가 명시한 최신 GenerationConfig.responseFormat.text(mimeType=APPLICATION_JSON, schema) 형식을 Gemini 3+ 및 공식 최신 Flash alias에 사용. 2.x에는 기존 responseMimeType/responseJsonSchema 경로 유지.
- Zod JSON Schema는 reused=ref로 중복 정의를 공유해 실제 측정 6721→2087 bytes로 축소. 로컬 Zod/근거 검증 조건은 유지. API지원필드 metadata에 $defs/$ref가 명시됨을 확인했지만 실제 생성 성공은 아직 추가 실행으로 확인해야 함.
- 새 요청 형식/후보 404 연속 처리/400·429·503 비재시도 회귀 검사와 최종 단위 **139/139** 통과. 다음은 A 최소 실제 실행이며 전체 A–D 완료로 오인하지 않음.

### 최신 alias 실제 실패 및 텍스트 모델/근거 문맥 회귀 보강
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38164103963 : quality/production 성공, A 실제 분석 실패. 사용 모델 gemini-flash-latest; 문서별 HTTP 503 UNAVAILABLE / HTTP 400 INVALID_ARGUMENT. 반환된 안전한 설정 필드 힌트 없음. 배포 SHA `3a55d251ea0461d29d2305bb09321ca477c07241`, ID `dpl_H5zos4N7KxeabDeDJDm7rEepUC3H`, verified=true.
- 실제 모델 목록에 포함된 TTS 모델이 기존 preview 이름 패턴을 통과하는 결함을 발견해 audio/TTS/image/live 등 비텍스트 전용 모델을 명시적으로 제외. 안정된 숫자 버전 모델을 alias보다 우선하고, 원래 버전에 가장 가까운 모델을 선택. 실제 목록의 2.5 Flash-lite가 404인 경우 다음 후보는 3.1 Flash-lite이며 400/429/503 뒤에는 재시도하지 않음.
- 원문 인용에서 포장 라벨 또는 부정어를 잘라낸 경우 검증될 수 있던 문제를 수정. 수량은 실제 페이지의 라벨 문맥을 재확인하고 전체 선적은 실제 원문 줄의 부정어를 검토. 기존 근거 검증을 완화하지 않음.
- 회귀 4개 추가, 단위 **143/143** 통과. 실제 AI 성공 여부는 다음 A 최소 검증 결과로 별도 확인하며 A만 통과해도 전체 A–D 검증 완료라고 보고하지 않음.

### 가까운 안정 모델의 실제 400과 구조화 오류 진단
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38165651864 : quality **성공** (1m 22s), production **성공** (21s), live-gemini **실패** (23s, exit 1). A의 두 문서 모두 모델 gemini-3.1-flash-lite, HTTP 400 INVALID_ARGUMENT / API_REQUEST_REJECTED. 분류·수량·근거·비교는 실제 결과를 얻지 못해 미검증. B–D는 이 최소 실행 범위에서 제외.
- 소스 SHA `9a9248858032c6b98dd2c0a7145463f8a1ff1fd7`, Production ID `dpl_AZL1memC5DobvWb2qKwDanzV7VHw`, 동일 SHA 서비스 및 키 설정 verified=true. 관리 API Ready는 직접 미조회.
- 같은 소스의 ship 전체 검사: npm ci (419), typecheck, lint, 단위 **143/143**, build, PDF worker trace, Production 모드 Playwright **7/7** 성공. 원격 SHA/소스 일치. Post-push 클라우드 직접 Production 확인은 프록시 때문에 exit 1이지만 위 실제 CI 검증은 성공.
- 최상위 메시지에 실패 설정 필드가 없어 아직 400의 근본 원인을 특정하지 못함. Google ErrorInfo의 알려진 reason과 BadRequest의 알려진 설정 필드만 화이트리스트로 추출하도록 보강. 원시 details/description/metadata는 기록하지 않음. 구조화 상세가 없으면 이유를 추정하지 않고 unknown으로 유지.
- 상세 진단 회귀 검사 5개 추가. 다음 검증은 A 두 문서의 최소 범위로만 실행. 400/429/503 자동 재시도나 Google 할당량 변경 없음.

### 구조화 상세에도 원인 없음 / REST 스키마 호환성 최소 확인
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38166034467 : quality 성공 (1m 11s), production 성공 (25s), live-gemini 실패 (21s, exit 1). A 두 문서 모두 gemini-3.1-flash-lite, HTTP 400 INVALID_ARGUMENT. requestFields=none, reasons=none. 알려진 상세 오류 근거가 없으므로 키/스키마/모델 중 하나를 확정 원인으로 주장하지 않음.
- 소스 SHA `ea4843d44074ba027fcc2dc5dd15f63b40aadb19`, Production ID `dpl_G3LHKsb58Vy4vBvKPFzAg3nGAY8Q`, 같은 SHA·키 설정 verified=true. ship: npm ci, typecheck, lint, **148/148** 단위, build, worker trace, **7/7** Production 브라우저 성공 및 main 원격 일치.
- 모델 숫자 버전만으로 새 출력 포맷 수용을 추정하던 분기를 제거. 모든 모델에 공식 REST의 responseMimeType/responseJsonSchema 호환 경로를 사용하며 지원 JSON Schema 키만 전송. minLength/maxLength 및 참조는 전송에서 제외/인라인화하되 로컬 Zod의 모든 원래 제약은 유지. 이 변경으로 실제 400이 해결됐다고 미리 주장하지 않음.
- 전송 스키마 변경에도 긴 거래당사자/근거, 잘못된 페이지, 101개 품목의 HTTP 200 AI 응답이 반드시 거부되는 회귀 5개를 추가. 최종 검사 후 A 두 문서로만 실제 수용 여부를 확인.

## PHASE 1.6 최종 검증 상태 — Gemini 정상화 미완료

### 최종 소스·실제 Production 결과
- 정상화/자동화 소스 SHA: `b1118fb548200f5553d784491d0886befecde2ca`, 브랜치 **main**. 검증 후 ship에서 실제 일반 Push, ls-remote SHA 및 Fetch된 원격 소스 일치 확인. 강제 Push/기록 초기화/프로젝트·환경변수 삭제 없음.
- 실제 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38166437186 : quality **성공** (58s), production **성공** (24s), live-gemini **실패** (25s, exit 1). 전체 workflow **Failure**를 숨기지 않음.
- Production 도메인이 해당 SHA를 서비스하며 서버 키 설정/Production 환경/인증 필드 제거를 확인. 배포 ID `dpl_EPQpU7KDXX72mSYz7eFAx7n1tVck`, verified=true. Git main Push만으로 자동 반영됨; 수동 PR/Redeploy 없이 확인.
- Vercel 관리 API는 네트워크 프록시 차단, VERCEL_TOKEN 미설정으로 Ready 상태 직접 미조회. 실제 HTTP 서비스·SHA 일치를 관리 API Ready 또는 AI 성공과 혼동하지 않음.
- 최종 호환 REST 스키마 요청에도 A 두 문서가 gemini-3.1-flash-lite의 HTTP **400 INVALID_ARGUMENT**, API_REQUEST_REJECTED로 실패. known requestFields/reasons 없음. 실제 분류/수량/원문 근거/비교 결과는 미검증이며 성공 AI 응답은 0개. 400 원인을 키/스키마/모델 중 하나로 확정하지 않음.

### 모의 결과와 실제 분석 결과
| 사례 | 실제 PDF 추출 + 합성 모의 AI 결과 | 실제 Gemini 결과 |
|---|---|---|
| A: Invoice 500 / PL 500 PCS | confirmed match 통과 | 최종 소스에서 두 문서 HTTP 400, 실패 |
| B: Invoice 500 / PL 480 PCS | confirmed mismatch 통과 | 이전 전체 실행에서 요청 거부, 최종 소스에서 미재실행 |
| C: 500 PCS 상품 / 20 CTNS 포장 | 상품 비교 정상, 포장 제외 통과 | 이전 전체 실행에서 요청 거부/서비스 오류, 최종 소스에서 미재실행 |
| D: 거래 참조 누락 | 확정 오류 제외, candidate/unverifiable 통과 | 이전 전체 실행에서 서비스/Google 한도 오류, 최종 소스에서 미재실행 |

- 최종 최소 A 검증은 scope=A, completed=false이며 A도 실패. 전체 실제 A–D 완료 또는 실제 AI가 UI까지 성공했다고 보고하지 않음. 동일 실패 상태에서 불필요한 B–D 추가 호출을 하지 않음.
- Codex 키 미설정은 재확인; Vercel Production 키 설정은 실제 CI status로 확인. Vercel Preview/Development 키 유효성은 별도로 확인하지 않음. 키 값/실제 업로드/원시 Google 응답을 출력·저장하지 않음.

### 최종 로컬·CI 품질 검사
- `npm ci`: **419 packages**, 성공.
- `npm run typecheck`, `npm run lint`, `npm run build`: 모두 성공.
- `npm test`: **153/153**, 14개 파일, 실패/스킵 0. 기존 PHASE 0/1의 55개, 근거/수량/부분선적/단위/수정값 검사 유지. 제거한 인증/한도 회귀는 공개 API 검사로 교체.
- PDF 단위 검사: 실제 합성 PDF.js 페이지 추출, 형식/판독 실패, 원문 위치/상품 포장 수량 구분 통과.
- `npm run verify:runtime`: Production /api/analyze 추적에 worker 포함 및 파일 존재, 성공.
- Playwright: **7/7**, Production Next 서버 실행, 실패/스킵 0. 기존 3개 포함. 인증 없는 업로드, 실제 원문 추출/판독 실패, 기다림·오류·부분 성공, 합성 수량 비교·근거·수정, 390px 모바일 확인. 실제 AI 결과 UI 성공 테스트는 아님.
- CI에서도 동일 소스의 품질 검사 및 실제 Production SHA 확인 성공. 유일한 최종 실제 테스트 실패는 **Gemini A 두 문서의 400**. 클라우드 자체 post-push Production 검사 실패는 프록시 때문에 별도 발생했으며 CI에서 배포를 확인.

### 보존한 기능·안전장치와 남은 작업
- 접근 코드 UI/Bearer/토큰 의존성/인증 401·503 및 자체 분당/시간당/동시성 카운터·429/Retry-After 제거 완료. 기존 ANALYSIS_ACCESS_TOKEN 환경변수는 운영상 불필요하며 남아 있어도 무시.
- PDF/본문/페이지/원문 메모리 제한, Origin, 취소/타임아웃, 서버 키, Zod, 상품/포장 구분, 근거 페이지 검증 유지. 잘린 포장 라벨·전체 선적 부정어의 근거 오검증 회귀 보강.
- 같은 당사자·거래·품명·동의 단위·전체 선적 조건의 확정 비교 및 부족 정보 후보 구분 유지. 사용자 수정/근거 없는 값/서로 다른 거래/부분선적은 확정 오류에 사용하지 않음.
- 남은 최우선 작업: 실제 Google 400 원인 격리와 성공 응답 검증. 키가 설정된 안전한 로컬 환경 또는 Google AI Studio의 같은 프로젝트에서 기본 generateContent 호출과 구조화 요청을 분리 재현해야 함. Codex의 GEMINI_API_KEY 바인딩은 아직 미설정이며 환경 설정에서 안전하게 등록할 수 있음; 채팅/Git에 키를 입력하지 않음. 현재 정보로 provider 설정 문제와 요청 호환성 문제를 확정 구분할 수 없음.
- 기본 호출이 가능해진 뒤 `npm run test:live`/명시적 Production live workflow로 전체 A–D를 다시 실행해야 실제 분석 정상화를 완료할 수 있음. Google 429 시 후속 사례를 중단하며 제공자 한도/과금 설정을 변경·우회하지 않음.
- 인증/자체 한도가 없는 공개 API의 반복 호출·비용·동시 메모리 위험이 존재. 파일/시간 제한은 전역 과금 상한이 아님.
- 환경 설치/시작 지침과 필요한 네트워크 목적지 초안 저장 완료. 저장과 현재 네트워크 적용/사용자 Publish는 별도. 이번 작업은 후속 기능을 추가하지 않았으며 **PHASE 1.6 전체 완료라고 보고하지 않음**.
- 이 최종 결과 문서는 별도 일반 main 커밋으로 보존. 해당 문서 커밋의 최종 SHA와 자동 배포 ID는 완료 보고 및 다음 Actions production notice에서 확인하며 유료 live 표시는 포함하지 않음.


### 2026-10-12 실제 Gemini 최소 검증 A 성공
- PR #2: 기존 스키마 기반 Google 400 INVALID_ARGUMENT 요청이 실패할 경우 동일 모델로 responseMimeType만 설정한 JSON 요청을 1회 시도. 200 응답 도달, Zod 엄격 검증은 유지.
- PR #3: 실제 200 응답의 Zod 불일치 위치를 원문/키 없이 안전한 필드 경로로 분류. 최초 A는 type / 숫자.value 필드에서 SCHEMA_MISMATCH.
- PR #4: Gemini 프롬프트에 허용 타입·숫자·필수 evidence 구조를 명시하고, 명백한 유형 별칭·순수 숫자 문자열만 안전 변환. 통과 못한 값은 원래대로 Zod 거부, 원문 근거 검증 불변.
- 실제 GitHub Actions 실행: https://github.com/sw030818/oceanrisk-ai/actions/runs/38168465687 : quality/production/live-gemini 모두 성공. **합성 A (Invoice 500 PCS + Packing List 500 PCS) 두 문서 실제 Gemini 응답, 분류, 상품 수량, 근거 페이지, 비교 결과 모두 PASS**. 모델 gemini-3.1-flash-lite. 원시 결과/키/사용자 문서 로그 없음.
- A만 테스트했으므로 이 시점에 전체 A–D 완료라고 주장하지 않음. 이어서 명시적인 전체 실제 A–D 검사 수행 후 결과를 각각 기록한다.


## PHASE 2 — 다양한 양식 엔진 및 업로드 개선 (2026-10-12)

### 구현 및 독립 검증
- 최신 main `96a759df83e1fb55ca55c755bad8ecc365bb3235`을 fast-forward로 가져와 기존 Gemini JSON 호환/안전 변환/형식 복구 및 테스트를 보존. 저장소/키/배포 프로젝트 초기화 없음.
- Invoice·Packing List 업로드 2개 영역, 빨간 PDF 아이콘·유형, 파일 선택/드롭/교체/제거, 반응형 2열/1열. 단일 파일 분석 및 두 파일의 단일 요청 지원. slots는 선택적인 API 메타데이터이고 실제 AI type과 별개이며 기존 files-only API는 유지.
- PDF 원문 page/text에 실제 블록 ID/좌표/행/페이지 크기를 추가. Gemini의 다중 블록 인용 후보를 실제 PDF.js 원문과 독립적으로 대조하고 인접 라벨·표 열·상품 행으로 역할을 확인. 회사/템플릿별 운영 좌표 하드코딩 없음.
- 판매자/구매자 교환, CTNS를 상품 수량으로 지정, 다른 상품 행 수량·단위 혼합, 없는 인용/블록, 충돌/수정 거래 식별자를 확정 비교에서 제외. PO/Invoice 참조 별도 근거·수정 UI 추가. 실제 원문/블록 위치 표시 유지.
- 확인된 일치/불일치, 후보/추가 확인, 불가/미실시를 구분. 한 파일은 대상 서류 부족. 비교 미실시를 ‘수량 차이 0건’으로 표시하지 않음.
- 인증·자체 분석 횟수 제한 없음. 서버 키/Origin/파일·총 용량·페이지·텍스트·블록 상한/타임아웃/취소 유지. Google 전송 안내·429 안내·한도 중단 유지. 원시 사용자 서류/키 로그·영구 저장 없음.

### 로컬 검증 (실제 Gemini와 구분)
- 기존 166개 단위 테스트를 유지하고 레이아웃/다중 근거/오탐/선택 영역 회귀 추가. 최종 정확한 개수는 아래 ship 결과에 기록.
- 7개 실제 생성 PDF 양식 조합: 세로 Invoice/가로 PL, 별도 당사자 표, 상품·포장 열 혼재, 600/580 수량 차이, PO 충돌, 품명 줄바꿈, 참조 누락. 실제 PDF.js 추출 + 명시적 모의 AI 응답: **7/7 사례**, 예상 핵심 필드의 올바른 원문 근거 **172/172**. 실 API 정확도가 아님.
- TypeScript/ESLint/build/worker trace 통과. Production 모드 Playwright **10/10**(기존 7개 보존): 선택/드롭/교체/제거, 모바일, 단일/복수 요청, 판독 유형 불일치·교환, 근거 위치, 기존 후보/실패/수정 회귀.
- 첫 브라우저 실행은 8/10: Tailwind 색상이 rgb가 아닌 lab로 반환되는 테스트 기대값과 기존 판매자 label 기대값 때문에 2개 실패. 의미상 빨간 색 검사·실제 label로 테스트를 수정하고 전체 10/10 재실행 통과. 실패를 숨기거나 테스트를 삭제하지 않음.
- 로컬 GEMINI_API_KEY 미설정, Vercel Production 서버 키 설정은 status로 확인. 최신 시작 Production SHA=96a759d..., 실제 다양한 양식 호출은 이번 소스의 배포 이후 별도로 실행한다. 이전 실제 A 성공을 이번 7개 양식 검증으로 대체하지 않음.

### 저장·배포 및 실제 API 검증
현재 구현은 ship 검사 및 main Push를 준비하는 상태이며, 아래에 실제 실행 결과·SHA·미검증을 추가한다. 이 문단 자체는 Push/배포/API 성공의 근거가 아니다.

- 최초 ship은 새 선적 근거 회귀 보강에서 `Full shipment`와 내부 `no`를 문자 비교하는 결함으로 단위 178/185, 7개 실패하여 커밋/Push 전 중단. 명시적 선적 의미와 실제 인용 블록 존재를 별도로 검증하도록 수정. 가짜 블록 ID 회귀도 유지하고 재실행 결과를 아래 기록한다.


### 첫 소스 저장·Production 및 실제 실패 결과
- main 소스 **600ae1d90a78e6e4ce5a7c5a1046c88ee5530af6** 일반 Push 및 원격 SHA/소스 일치 확인. ship: npm ci 419개, type/lint, 단위 **185/185**, build/worker, Production 브라우저 **10/10** 성공.
- 첫 ship의 배포 조회는 Node가 환경 프록시를 사용하지 않아 실패. 이 작업의 해당 조회 프로세스를 종료하고 `NODE_USE_ENV_PROXY=1 npm run check:production -- --sha <SHA>`로 재실행: 5회차에 정확한 Production SHA·서버 키·ID **dpl_8a4NAF5gPCrarVNY5sM8HsHTUfW3** 확인.
- Actions https://github.com/sw030818/oceanrisk-ai/actions/runs/38172996014 : quality/production 성공, live-gemini는 일반 커밋이므로 skipped. Vercel GitHub 커밋 상태 및 Production deployment 상태는 success / Deployment has completed. 관리 API는 HTTP 403, 관리 토큰 미설정: control-plane Ready 직접 조회와 구분.
- 실제 공식 Production의 데스크톱/390px 모바일 UI를 Chromium으로 확인: 두 영역·빨간 PDF·세로 배치·가로 넘침 없음. 프록시 인증서 때문에 별도 공개 페이지 점검 컨텍스트에만 ignoreHTTPSErrors 적용했으며 앱/CI 보안 설정은 변경하지 않음.
- 실제 Gemini 7개 양식 + 첫 양식 반복: 8개 요청/16개 문서, 모델 gemini-3.1-flash-lite. **유효 구조화 분석 0/16, 예상 핵심 근거 0/197, 규칙 사례 0/8**. 9개 문서는 HTTP 200 응답의 SCHEMA_MISMATCH, 7개는 API_ERROR. 유효 결과가 없어서 분류/수량 탐지 정확도·반복 일관성을 평가할 수 없으며 오탐 0이라고도 주장하지 않음. 모의 172/172와 다른 결과임.
- 추가 최소 양식 진단 2개는 Google **503 UNAVAILABLE**로 실패. 기존 실제 정상 샘플 A 2개도 재검사 실패: HTTP 200 SCHEMA_MISMATCH, 주로 evidence.quote 필드 경로. 이 시점의 모든 실제 20개 문서는 구조화 성공 0개. B–D 추가 유료 실행은 하지 않음. 429 없음; 제공자 오류 자동 반복/모델 순환·할당량 변경 없음.
- 기존 실제 A 성공 기록은 이전 배포의 결과이며 이번 배포의 A 실패를 숨기지 않음. 현재 실제 PDF 분석 정상화/범용 정확도 검증은 미완료.

### 인용 구조 계약 보강 및 재진단 준비
- evidence.quote는 문자열, evidence.page는 정수, segments는 별도의 선택 배열임을 명시하고 실제 인용 객체 타입 예시/800자 제한을 프롬프트에 추가. 형식 복구의 필드 목록에 PO/Invoice 참조도 포함. 실제 값/근거 검증을 느슨하게 하지 않고 Zod/원문/행/역할 조건 유지.
- 원문/값을 포함하지 않는 Zod 실패 경로·코드·받은 JSON 타입 진단 추가. quote 배열을 거부하고 민감 텍스트를 진단에 포함하지 않는 회귀 검사 추가.
- 평가 도구에 최소 `--case` 범위와 진행 보고서·안전한 HTTP/형식 진단 추가. subset 통과를 전체 완료로 표시하지 않음. 실패 문서의 필드를 분모에 유지하고 미검증 정답을 근거 성공으로 집계하지 않는 보고 회귀 검사 2개 추가.
- 실제 수정 효과는 새 커밋 배포 이후 최소 검사로 확인하며 Google 503을 코드로 해결했다고 미리 주장하지 않음. 읽기 쉬운 코드 정렬은 함수 동작을 바꾸지 않음.


### 재배포·최소 실제 검사 및 최종 보강
- 인용 출력/진단 소스 **f12b68361b3a996012d7f0d16787254f241f17ec**을 ship으로 일반 main Push, 원격 일치 확인. npm ci/type/lint, **188/188** 단위, build/worker, **10/10** Production 브라우저 통과. 정확한 Production SHA·서버 키·ID **dpl_DFY6yocQrPca5fKknotBTp5kBb7c** 확인. Actions https://github.com/sw030818/oceanrisk-ai/actions/runs/38173939416 성공, Vercel GitHub 상태 success / Deployment has completed.
- 인용 출력 수정 후 최소 양식 검사 **0/2**, 두 문서 모두 **Google HTTP 503 UNAVAILABLE**. provider 응답이 없어 수정 효과는 미검증. 추가 유료 호출 중단. 이번 실제 분석 총 **22개 문서, 유효 구조화 성공 0개**(처음 16 + 같은 소스 진단 2 + 기존 A 2 + 수정 후 최소 2). 실제 Google generateContent 요청 수는 원격에서 직접 계측하지 않았으며 문서 수와 혼동하지 않음. 429/한도 우회 없음.
- 모의 AI+실제 원문 벤치마크는 7개 사례 172/172 유지. 실제 주 벤치마크는 8개 시도 16개 문서, 근거 **0/197**, 불일치 탐지 정확도/반복 일관성은 유효 결과가 없어 **평가 불가**. 이는 실무 전체 정확도를 보증하지 않음.
- quote-only 하위 호환 근거가 실제로 연속된 여러 PDF 블록에 걸치면 유일한 원문 순서 일치만 연결. 비연속 블록은 여전히 정확한 segments 필요; 실제 없는 합성 인용은 미검증. ‘Purchase Order’ 라벨/값의 분리 셀을 특정 콜론 패턴에 의존하지 않고 검증하는 회귀 추가.
- 동일 거래에서 검증된 PO와 Invoice 참조가 각각 다른 generic transactionReference로 선택된 경우, 검증된 공유 PO/Invoice 관계가 존재하고 실제 라벨 종류가 서로 다를 때만 동일 번호 체계로 잘못 비교하지 않음. 같은 종류 번호 충돌/명시적 Invoice 충돌은 계속 차단. 긍정 및 충돌 오탐 방지 회귀 추가.
- 최종 로컬 단위 **191/191**, type/lint 및 모의 벤치마크 통과. 최종 ship은 이 보강·결과 문서를 검증해 main에 저장하고 Production SHA를 확인하며 실제 유료 검사는 다시 자동 실행하지 않음.
- 안전한 합성 검증 메타데이터를 [docs/validation/phase2-2026-10-12.json](./docs/validation/phase2-2026-10-12.json)에 보존. 실제 키/원시 PDF/추출값/원시 제공자 응답은 포함하지 않음.
- **UI·근거/규칙 구현과 Git 저장·자동 배포는 수행했으나 PHASE 2 실제 Gemini 분석 검증은 미완료**. Google 503 해소 이후 quote 구조 보강 효과·전체 양식/이전 A–D·반복 일관성을 다시 확인해야 한다. 503의 원인을 키/스키마로 단정하지 않으며 관리 Ready 직접 조회도 권한 없으므로 미검증.
- 남은 범위: 복잡한 회전/병합 표·스캔 OCR은 미지원/미검증. B/L 전체 검증·계약 법률 위험·포워더 견적·추가비용·수정 이력 DB·전체 대시보드는 PHASE 3 이후로 유지. 이번에 추가하지 않음.


## PHASE 2.2 — OpenAI 전환 (2026-10-11 시작)
- 기존 main 1c93c496f7d1009fe07ff4d6f906f6a4193e8cc3 및 미검증 feat/openai-luna-primary 862e536729d596ddaaaee312dcd7ea74007ce4da 조사. 자동 병합하지 않고 draft의 Responses 구조를 검토해 본 작업에 맞게 수정.
- 현재 클라우드 OPENAI_API_KEY/GEMINI_API_KEY 미설정(값 조회/출력 없음). Vercel의 OpenAI 설정/키 유효성은 새 배포 후 별도 검증 예정.
- 공식 Luna 문서/Structured Outputs/Responses 문서 조회 성공. 기본 gpt-6-luna, reasoning none, Standard 가격 확인. 근거 wire는 page/blockIds 후보로 간결화하고 서버가 실제 블록의 literal quote/segments를 구성한다. 기존 독립 역할/열/행/수량 검증을 보존하며 가짜 ID·숫자·포장/다른 상품 행의 오검증 회귀 추가.
- OpenAI 기본 경로, 엄격한 required/nullable schema, 4096 출력/45초 timeout, safe HTTP/refusal/incomplete 오류, 사용량/비용 추정 추가. Gemini 소스/테스트 보존, 자동 폴백/재시도 없음. UI 전송 안내/키 메시지/활성 status/release 계약을 OpenAI로 변경.
- 공개 앱에는 인증/접근 코드/시간당·일일·동시성 한도를 추가하지 않음. 파일/본문/페이지/Origin/전체 요청 취소 유지. 유료 검증만 공유 ledger의 $0.50/20문서 예산으로 제어하며 비용 미확인 요청은 예약 유지. 자동 유료 CI를 제거해 중복 비용 방지.
- 작업 중 전체 단위 228/228 및 ESLint 통과. 새 테스트 fixture 타입과 스크립트 top-level module 오류를 타입 검사에서 발견해 수정. 최종 ship 검사·실제 API·저장·배포 결과는 후속 기록으로 구분한다. 이 문단은 API/Push/배포 완료 증거가 아니다.
- npm ci 419개 설치 완료. 개발 서버 실제 HTTP 200/홈 OpenAI 안내/status provider=openai 확인. 실제 합성 A Invoice 업로드로 원문 2페이지를 추출했고 키 미설정/API_NOT_CONFIGURED 및 AI 결과 null을 확인(유료 호출 0). 로컬 live 도구는 키 미설정으로 종료 2, API 미실행을 명시.
- 개발 서버와 동시에 수행한 전체 검사는 229개 중 새 PDF fixture 2개가 기본 5초 timeout으로 실패(타입/린트 성공). 서버 종료 후 해당 OpenAI 31/31은 1.59초로 재통과. timeout/검증 조건을 느슨하게 하지 않았고 배포 전 직렬 ship 전체 검사를 다시 실행한다. 개발 서버가 바꾼 next-env.d.ts는 본 작업의 생성 변경만 원래 Production 타입 경로로 복원.
- 모의 7개 양식 172/172 근거/규칙 통과. 비용 preflight의 긴 문맥 배수와 timeout 비용 예약 회귀를 보강. 실무 정확도/실제 API 성공으로 보고하지 않음.
- 첫 ship은 npm ci/type/lint/229개 단위/build/PDF worker 성공 후 Playwright의 포트 충돌로 Push 전에 중단. 이 작업에서 시작한 dev 프로세스가 세션 종료 뒤 남아 있는 것을 확인해 해당 PID/자식만 종료했고 3000 포트 해제를 확인. 기존/다른 사용자 프로세스는 종료하지 않음. 수정된 검증 도구와 문서를 다시 Stage한 뒤 전체 ship을 재실행한다.

### PHASE 2.2 실제 저장·배포·API 결과
- 구현 main 커밋 **5be24ac81cedb9c43492814fcd3e7780d6e36bf4** 일반 Push 및 원격 SHA/소스 일치 확인. ship: npm ci 419개, 타입/린트, 단위 **229/229**, Production build/worker, 브라우저 **12/12** 통과(기존 191단위/10브라우저 보존). 클라이언트 JS에서 OPENAI_API_KEY/GEMINI_API_KEY/Bearer sk- 참조 **0**.
- 기존 Vercel Git 자동 배포: 공개 HTTP 200, 같은 SHA, provider=openai/model=gpt-6-luna/aiConfigured=true, 배포 ID **dpl_FHB9YWLa65MgA1Psv3MQoE27rgTE** 확인. Actions https://github.com/sw030818/oceanrisk-ai/actions/runs/38179102095 : quality/production 모두 success. GitHub Vercel 상태 success, Production deployment **7002496151** status success / Deployment has completed. 관리 API HTTP403 및 VERCEL_TOKEN 미설정으로 control-plane Ready 직접 조회는 미검증.
- 실제 Production 합성 A Invoice 최소 호출 **성공 0/1(실패 1)**: API_AUTH_OR_CONFIG, 원문 2페이지 보존. 다음 pair/B–D/양식 단계 자동 중단. 초기 보고서에 상세 HTTP 코드가 누락돼 safe providerDiagnostics 기록을 보강하고 원인 격리용 단일 Invoice **1건**만 추가 진단. 총 **2개 문서 요청**, 자동 retry **0**, 구조화 결과 **0/2**, 기대 핵심 근거 **0/16**. 두 번째 안전한 진단에서 **OpenAI HTTP401 / invalid_api_key** 확인. 원시 키/응답/서류를 조회·로그·저장하지 않음. 첫 호출의 상세 HTTP는 당시 보고서에 없으므로 401/403 구분 미기록; 오류 코드는 두 건 모두 API_AUTH_OR_CONFIG.
- Production 키 presence=true는 유효한 키나 결제/모델 권한을 뜻하지 않음. 지금은 공급자가 키를 거부하므로 OpenAI payload/schema/모델/실제 양식 정확도를 검증했다고 주장할 수 없음. 등록된 OPENAI_API_KEY를 Vercel의 안전한 Production 환경 설정에서 유효한 키로 수정·반영해야 다음 검증 가능. 앱/빌드 코드는 해당 값을 추출하거나 다른 키로 대체하지 않음. Gemini 키/모듈 보존 및 폴백 없음.
- 유효 usage 응답이 없어 input/output/cached/reasoning token과 실제 청구액은 **미확인**. ledger의 measuredCostUsd=0은 관측 가능한 비용이 없다는 뜻이며 무료 호출 증거가 아님. 비용 미확인 두 요청의 보수적 예약 합계 **$0.0083578**, 승인 상한 $0.50/20문서 미초과. 예산 초기화/임의 확대/추가 유료 호출 없음.
- A pair/B500vs480/CPCSvsCTNS/D정보부족·7개 다양한 양식·반복 실제 검사는 **미실행**. 수량 비교/탐지 정확도/오탐률/반복 일관성은 **평가 불가**. 모의 AI + 실제 PDF 7양식 172/172만 확인됐으며 실제 정확도로 대체하지 않음. single 문서 부족 상태를 검사한 initial ruleCorrect=true는 실제 수량 규칙 검증이 아니므로 보존 보고서에서 별도 singleDocumentUnavailableStateHandled로 구분하고 ruleCorrect=null로 명확히 표시.
- 원인 진단 후 invalid_api_key를 명확히 안내하는 UI 오류 회귀 추가, deployment 성공 문구의 남은 Gemini 명칭을 OpenAI로 수정, 실패 진단/미실시 규칙 보고 강화. 안전한 실제 메타데이터 [docs/validation/phase22-2026-10-11.json](./docs/validation/phase22-2026-10-11.json)에 보존. 이 보강은 인증 키를 고쳤다는 의미가 아니며 유료 검사를 반복하지 않음.
- onboarding install_script/start_skill, 필요한 OpenAI 목적지/OPENAI_API_KEY requirement/OPENAI_MODEL 초안 저장 성공(requires_publish=true). 실제 클라우드 바인딩은 미등록; 저장과 사용자 Publish/키 주입을 구분. 현재 OpenAI 공식 문서 및 API endpoint 도달은 확인됐으나 로컬 키 인증은 미실행.
- **코드 전환·로컬 품질 검사·GitHub 저장·자동 배포는 수행, PHASE 2.2 실제 분석 정상화는 미완료.** 인증 해결 뒤 단일 A부터 남은 승인 예산을 유지하며 검증해야 함. B/L·계약·견적·비용 시뮬레이션·수정 이력DB·대시보드 재작성은 추가하지 않았고 PHASE3 준비 완료로 보고하지 않음.
- 최종 진단 보강 타입 검사와 관련 모의/예산 테스트 **37/37** 통과. 인증 실패는 환경 문제로 남기고 모든 유료 호출 중단을 유지. 새 체크아웃에서도 Git에 보존된 PHASE2.2 안전한 보고서로 이미 소모한 검증 예산을 복원하도록 보강했으며 malformed 보고서는 0으로 초기화하지 않고 실패한다. 최종 오류/보고서 보강은 다시 전체 ship 검사 후 별도 커밋으로 저장·자동 배포하며 아래 최종 보고의 SHA와 구분한다.


### 사용자 키 수정 후 실제 OpenAI 재검증 및 구조 진단
- 진단/예산 보강 main **9c4575433ab986861e88a0f7ea3397057278966d** ship: npm ci/type/lint, **230/230** 단위, build/worker, **12/12** 브라우저 통과. 일반 Push 및 원격 SHA 일치. 자동 Production이 같은 SHA/ID dpl_5yJRaWJx4oZT9vkb7L8tvoFz6E5z를 제공한 뒤 사용자의 키 수정/이전 소스 재배포로 공식 사이트가 5be24ac/새 ID dpl_2RLEZsCQfrMuMK7EMWx5EnJVvv6p로 바뀐 것을 실제 cache-miss 상태 조회에서 확인. 배포 작업 중 추가 Push/유료 검사를 멈추고 사용자 완료 답변 이후 재개.
- 키 수정 완료 후 실제 단일 A 성공: GPT-6 Luna, 주요 필드 **8/8** 및 원문 근거 **8/8**. 실제 A pair 확인된 일치, B 500/480 PCS 확인된 불일치 모두 성공(각 **16/16**). C에서는 Invoice HTTP200 INVALID_JSON, Packing List 구조화/근거 성공; 후속 D/양식 호출을 즉시 중단. 실제 응답 원문·키·추출값 저장 없이 metadata만 보존.
- 전체 누적 **9문서**(키 수정 전 인증 실패2 포함), 구조화 성공 **6/9**, 기대 근거 **48/72**. 키 수정 이후만 구분하면 **6/7**, **48/56**. 측정 가능한 토큰 비용 추정 **$0.002254895**, 초기 실패 비용 미확인 예약 **$0.0083578**; 실제 청구액은 미확인. 자동 retry0. 성공 A/B를 전체 범용 정확도로 확대 주장하지 않음.
- 사용자가 문서 예산 **7개 추가/총27개**를 명시 승인. 비용 상한 **$0.50**은 유지. C 재검증 실패/추가 진단으로 전체 완료에 더 필요한 문서가 생기면 승인 없이27개를 넘지 않음.
- JSON 오류에서 원문을 담을 수 있는 SyntaxError.message는 노출하지 않고 message/text part 개수·문자 길이·객체 경계/fence 여부·숫자 오류 위치만 진단. 여러 응답 중 임의 객체를 선택하거나 JSON을 추측 복구하지 않음. 민감 텍스트가 진단에 섞이지 않는 회귀 추가. --stage=ad --scenario=C로 A/B 유료 중복 검사 없이 최소 진단 가능.
- 새 체크아웃에서 이전 예산 복원/손상 archive 실패 폐쇄 smoke 검증 통과(유료 호출0). 최종 추가 구조 진단 커밋은 모든 ship 품질 검사를 다시 통과한 뒤 Push/자동 배포하며 아래 후속 결과와 구분.


### 양식 검증 실패 원인과 phase-aware Responses 수정
- 구조 진단 소스 main **45db98f1955ce3f474c8450fcca8ac3ba71ffa4a** 일반 Push/원격 일치, npm ci/type/lint/**231단위/12브라우저**/build/worker 모두 통과. 자동 Production 같은 SHA/ID **dpl_HmyV17H7CBNwMNPMAqNnFHAzdkFq**, Actions **38180389649 quality/production success** 확인. 9c45754 Actions quality는 성공했으나 사용자 이전 SHA 재배포 시점에 production 확인만 실패한 이력도 보존.
- 실제 C 최소 재검증 성공(16/16 근거, 상품500PCS/포장20CTNS 혼동 없음). D 성공(14/14, 참조 부족은 후보). 7양식 중 앞6조합 **150/150** 근거 및 규칙 통과. 참조 누락 마지막 양식은 Invoice12/12, Packing List HTTP200 INVALID_JSON, 후속 반복 즉시 중단. 전체 양식 근거 **162/172**, API 구조화 **13/14**, 규칙 성공6/7(마지막은 PL 부재로 평가불가). 모의172/172와 구분.
- safe outputStructure에서 메시지2/text part2/객체로 시작하지 않음 확인. 현재 코드는 모든 메시지를 이어 붙이는 결함이 있음. 공식 SDK ResponseOutputMessage.phase 계약은 commentary / final_answer를 지원한다. 명시적 final_answer 한 개만 선택, 기존 unphased 단일 메시지 하위 호환, 여러 최종/알 수 없는 phase/중간 refusal/최종 미완료는 거부하도록 수정. JSON 추측 복구·원문 수치 생성·근거 완화 없음. 실제 실패 응답의 raw phase는 미저장이라 전체 원인을 단정하지 않고 최소 재검증으로 효과를 확인한다.
- 전체 **27문서**, 구조화 성공 **23/27**, 기대 근거 **240/274**(인증실패2/초기C실패1/마지막PL실패1 포함). 알려진 토큰 비용 추정 **$0.008630045**, 초기 실패 미확인 예약 **$0.0083578**, 실제 청구액 미확인, 자동retry0.
- 사용자 반복 검증용 문서2개 추가로 **총29개/$0.50** 명시 승인. 마지막 양식 실패로 필요한 최소 재검증을 먼저 수행하고 추가 예산이 필요한 반복은 승인 없이29개를 넘지 않음. --stage=repeat를 추가해 이미 통과한7양식 전체를 유료 재실행하지 않도록 함. 단계별 SHA와 실패 이력을 유지하며 기존 성공을 새 SHA 전체검증으로 주장하지 않음.


### PHASE 2.2 마지막 실제 검증·예산 종료
- 최종 메시지 처리 소스 main **64c91ee5ff4875fa3c25e2ca15e2d315dbd273d1** 일반 Push/원격 일치. ship npm ci/type/lint/**237/237 단위**, Production build/PDF worker/**12/12 브라우저** 통과. 공식 Production 같은 SHA/ID **dpl_4QeNXMhZ46Az8cR98U8aV3nRe1Kz**, GitHub Actions **38180818228 quality/production success**, Vercel Git 상태 success / Deployment has completed. 관리 API Ready 직접 조회는 HTTP403로 여전히 미검증.
- phase 처리 수정 후 참조 누락 양식 **2/2 문서, 22/22 필드/근거** 및 후보 상태 통과. 사용자가 마지막 반복 전용2개/총31개를 추가 승인했고 같은 PDF Invoice/PL 반복 **2/2, 25/25** 및 핵심 값·검증 상태 fingerprint 일치(첫실행45db98f→반복64c91ee). 같은 SHA의 두 번 실행으로 주장하지 않음. 이 반복 후 **추가 유료 호출0**, 예산31개/$0.50을 임의 확대하지 않음.
- 실제 사례 결과: A 일치, B500/480 확인된 불일치, C500PCS/20CTNS 혼동 없음, D참조 부족은 후보. 7상이 양식(세로/가로, 당사자 표, 상품·포장 열, 수량 차이, 참조 충돌, 품명 줄바꿈, 참조 누락)의 최신 통과 결과 원문 근거 **172/172**. 실제와 별개인 모의 AI+실제PDF 결과도 **172/172**. 최신 통과 사례12pair 중 예상결과12/12, 확정수량행15개 중 일치13/불일치2, 예상불일치 **2/2**, 추가 확정오탐0(이 합성 자료에 한함). 자료부족/거래충돌을 일치로 세지 않음.
- 모든 유료 시도 이력을 포함하면 **31문서, 구조화27/31(87.1%), 원문 근거287/321(89.4%)**. 인증수정 후만 **27/29(93.1%)**, phase수정 후 실제 **4/4·47/47**. 초기 키 실패2와 JSON실패2를 분모에서 지우지 않음. 최신 통과 사례별 수치는 재검증 선택을 명시하며 전체성공률과 혼합하지 않음.
- 측정된29usage 응답의 input **68,671**, output **14,030**, cached-input **51,337**, cache-write **17,247**, reasoning **0** tokens. 비용 추정 **$0.009692945**, 초기 인증실패2의 미확인 비용예약 **$0.0083578**, 합산 예산회계 상한 **$0.018050745 < $0.50**. 실제 청구액은 직접조회하지 않아 미확인. provider 중간시간3141ms/최대4427ms(알려진usage29개), 자동retry0.
- 검증은 소스3개 SHA에 걸친 기록임: A/B5be24ac, C/D와첫6양식45db98f, 마지막양식/반복64c91ee. 프롬프트·요청설정·스키마·PDF·grounder·수량 엔진 원문이 세 SHA에서 동일함을 Git source 비교로 확인했고 응답 메시지 선택만 수정. 그러나 **최종SHA 단독 전체 live suite는 실행하지 않았으며 report.completed=false를 유지**. 추가비용 승인 없이 재실행하거나 완료 플래그를 바꾸지 않음. 단위/브라우저 전체 검사는 각 ship SHA에서 수행.
- OpenAI 실제 호출과 각 합성 사례 통과를 확인했으나 이를 전체 실무 무역서류 정확도 보증으로 확대하지 않음. 과거 실패 raw phase는 민감원문 보호상 저장하지 않아 정확한 원문 비교 불가. 스캔OCR/회전·병합표/B/L·법률/견적/비용/이력DB/대시보드는 미구현·미검증 후속범위. PHASE3 기능 추가 없음.
- [docs/validation/phase22-2026-10-11.json](./docs/validation/phase22-2026-10-11.json)에 모든 실패·성공 메타데이터/예산/토큰/검증범위 보존. 이 최종 결과 문서만 추가 ship으로 main에 저장·자동 배포하고 실제 유료 검사는 재실행하지 않는다. 최종 SHA는 완료보고/Actions에 기록하며 문서가 자기 SHA를 재귀 수정하지 않음.


## PHASE 2.3 — 독립 교차검증 재설계
- 시작 main **16e1d91af0d190f0d7d0091ac54e3ae5c55a5bc4**, 작업 트리 청결/원격 fetch/fast-forward 확인. 저장소 루트에서 실제 업무 PDF 검색 결과0(생성 산출물/node_modules/빌드 제외). 실제 사용자 업로드 문서는 커밋하지 않고 보고된600/400PCS·Invoice/PO·상품/포장/중량 분리 구조를 합성 fixture로 재현.
- 원인1: 수량 규칙이 당사자·식별자·선적 범위 검사에서 전체 early-return. 원인2: tableLink가 인용한 모든 블록을 같은 열로 묶어 QTY 숫자+분리PCS/헤더 인용을 거부. numericTokens도400PCS/300KG 등을 식별자처럼 거부했고 N.W./G.W./PO No. 등 표준 라벨이 부족. 실제 파일은 없어 그 파일의 정확한 실패 블록 자체를 확인했다고 주장하지 않음.
- 변경: 선택한 Invoice/PL ID를 비교 의도로 수락하고 실제 type/거래 동일성을 별도로 검증. reference/party/product/unit/quantity/weight/packaging/arithmetic/required를 독립 체크로 분리. 기존status match/mismatch/unverifiable를 보존하며 assessment의 확인일치/확인불일치/잠정일치/잠정불일치/확인필요/정보부족6상태 추가. 참조누락/부분선적/사용자수정/충돌도 항목별 비교 계속, 확정불일치 카운트 보호.
- 의미 매핑: own Invoice 번호↔PL의Invoice 참조, PO↔PO, Shipment↔Shipment, Booking↔Booking. PL own문서번호는 거래참조로 비교하지 않음. generic 참조는 실제 원문 semanticRole로만 대응하며 모호한 라벨을 재분류하지 않음. 검증된 같은 의미 참조 충돌은 독립경고/잠정수량으로 보호하고 당사자 등 다른 일치 결과 유지.
- 품목: 유일한 실제SKU/Item Code 또는 표준화품명으로 순서와 무관하게 대응. 중복SKU/품명·여러행↔한행 대응은 임의 확정 금지. 유사품명은 규격숫자/단위/유일성 확인 후 잠정만 허용. PCS/EA동의어 유지, CTNS·중량·총계와 혼동/환산 금지.
- 근거: 실제값 셀을 앵커로 삼되 실제헤더·열·행을 독립 대조. 다른 상품행의 숫자/단위·여러행에 걸친PCS·CTNS열·상품수량을총액으로인용·없는블록/인용은 계속 거부. 줄바꿈 품명/회사명, 숫자붙은단위, 분리단위, 표준 중량라벨 처리. source.semanticRole과 verificationCode(quote/value/role/row/ambiguous/missing 등)로 원문 없는 구조진단 제공. 원문/API응답/키 로그 없음.
- 문서별: Invoice 수량×명시적단가·품목소계/총액, PL/item 총중량≥순중량, 포장수량/단위, 명시된총상품/포장 합계, 기본정보 확인. 통화정밀도·할인·운임·세금·총액정의가 부족한 산술차이는 잠정, 없는금액/중량/단가를0으로추정하지 않음. Backorder/과부족납품조건은 전체선적확정 보호.
- UI: 기존 네이비/화이트·업로드2칸/빨간PDF/모바일/수정/복원/원문 유지. 상단 문서·비교품목·확정일치/불일치·잠정/확인필요·정보부족 카운트, 별도참조경고, quantity핵심카드+독립항목/자체검토접기, 근거버튼 파일/페이지/수정상태 표시. 사용자수정은 즉시잠정재계산. 비교미실시는0건오류로표시하지 않음. 서버도 동일rules를실행하고 원문중복을막는compact결과+evidenceRefs 반환.
- 초기 검사: 기존검사61개 중6개는 이전early-return/id/unavailable기대와 변경된제품정책 충돌. 삭제하지않고 별도참조경고+계속비교+확정오류금지 강화로 갱신. 전체단위253/253 통과. API slot검사의 불완전mock(type만) 1개는 완전한합성GroundedDocument로보강하고 기존분류/slot안전검사 유지. 첫lint 미사용UIimport/도구prefer-const, live도구nullable타입오류 수정.
- 실제 npm ci419/type/lint/단위253/build/PDF worker/Playwright **15/15** 모두통과. 이후 총계잘못인용/다른행단위/Backorder3회귀와compactAPI를 보강했고 최종ship에서 전체검사 재실행. 새핵심회귀19개와 기존237개=예정256개, 기존12브라우저+새3개 유지. 모의AI+실제PDF 검증을 실제OpenAI성공으로 합산하지 않음.
- 새유료검증 사용자명시승인: **2문서/배치1회/최대$0.03/자동재시도0**. 요청byte상한가격사전예약 **$0.0120219**. PHASE2.2의31문서예산과 별도ledger/archive, 호출전예약·중단후예산복원·미확인비용유지. 실행은 새code정확ProductionSHA 후 단1회. live-phase23 도구는 실제API결과를메모리에만보관해 공식ProductionHTML/assets의 실제UI에재생(추가유료호출0), Node의TLS검증프록시전송사용/ignoreHTTPSErrors없음. 아직 실제API성공으로 보고하지 않음.


### PHASE 2.3 실제 저장·배포·OpenAI 결과
- 구현 main **5122cb071044df2dcee86f49404ea9c6c9db99cb**, 일반Push/원격SHA 일치. ship npm ci419/type/lint/**256/256 단위**/Production build/PDF worker/**15/15 브라우저** 모두통과. 공식Production 같은SHA/ID **dpl_mF7oJSDnPJSy8b5Z6rtTFanDB9T9**, Actions **38185179745 quality/production success** 확인.
- 승인된 최소검증 실행: 같은ProductionSHA에서 실제OpenAI GPT-6 Luna Responses 배치1회/문서2개. **구조화2/2**, 핵심 추출값**57/57**, 실제블록/페이지/행/라벨 근거**57/57**. seller/buyer/own문서번호/PO/InvoiceReference/선적/600PCS·400PCS/품명/SKU/중량/포장/Invoice금액을 확인. 독립엔진 실제비교품목2, 확인된수량일치2, 불일치0, 참조충돌없음. Invoice PO와PL InvoiceReference가다르다는이유로전체비교불가가되지않음.
- 2API 실제응답을 메모리에서만 유지해 공식ProductionHTML/CSS/JS와UI에서파일선택·분석·2개확정수량카드·390px모바일넘침없음·원문페이지/블록보기 확인. Node의HTTPS프록시/TLS정상검증으로asset전송, Chrome ignoreHTTPSErrors사용안함. 브라우저의분석응답만이미받은실제응답으로재생했으며 추가유료호출0. 단순mock성공과분리해서기록. 실제사용자업무PDF는없고합성동일구조검증임.
- 실제usage 입력**9,335**, 출력**2,019**, 캐시입력**2,871**, 캐시쓰기**6,458**, 추론**0**. 시간8077/6332ms, 자동retry0. 사용량 기반추정비용 **$0.00184606 < 승인$0.03**. usage미확인없음(회계부동소수점잔여는0반올림), 실제청구서는미조회. **새2문서예산소진/추가유료호출중단**, 이전31문서ledger변경없음.
- 통과후원문문맥보호보강: 단위문자KG/PCS가판매자나포장라벨등잘못된의미의인용에있으면단순존재만으로승인하지않도록문자단위의부모라벨검사/새회귀1개추가. 보고된동일구조positive근거/기존독립행검사는유지. 실제유료검증은5122cb0의결과이며후속보강은로컬전체회귀로확인하고추가유료호출하지않음. 최종ship예정단위257/브라우저15.
- 초기핵심6개old검사기대/불완전mock1개/lint·타입오류는위수정뒤해결. 실패한검사삭제나없는인용승인으로통과시키지않음. 최종무조건전체live성공/실무전체정확도보증으로확대하지않음.
- 남은범위: 실제업무파일자체의원인블록은제공되지않아확인불가. 스캔OCR/복잡병합·회전표/모든기업양식·대형문서의실무정확도미검증. 정체성/근거/전체선적이없으면비교는진행하되잠정상태가정상. 단가/통화/할인·세금·운임/총액정의가부족한금액차이는확정오류로올리지않음. Vercel관리Ready직접조회는관리권한부족과구분하며Git완료·같은SHA서빙을확인. PHASE3기능추가없음.
- 안전메타데이터 [docs/validation/phase23-2026-10-11.json](./docs/validation/phase23-2026-10-11.json)에실제결과/예산보존. 최종보강·기록은전체ship검사후main일반Push/자동Production정확SHA를확인하며최종SHA는완료보고에기록(문서자기SHA재귀수정없음).

- 단위라벨보강/결과보존 main **f17b259b4ce1d921c94a70c9c74c17d267e0b080** 일반Push/원격일치. ship **257단위/15브라우저** 및npmci/type/lint/build/worker 통과. 자동Production 동일SHA/ID **dpl_H5RCuVyfdigUBmdj782FmoqzM5eo** 확인. 추가유료호출0.
- 마지막 총계보호: layout이없는 텍스트형수량의 Total Product Quantity 등은개별상품수량으로승인하지않음. 인용에서Total을잘라낸경우에도 실제페이지의전체행문맥을확인하는기존검사로거부. 원문총계/개별수량구분 회귀1개추가, 정상Quantity·Qty와명시단위는유지. 마지막ship필수검사단위258/브라우저15를통과한코드만저장·배포하며유료검증은추가실행하지않음.


### PHASE 2.3 최종 독립 근거 보호 및 회귀
- 총계 보호 커밋 **ca990f9c1d8b7150aa60f93cd118fbdb812b3573**: main 일반 Push/원격 일치, 258개 단위·15개 브라우저 및 설치/타입/린트/build/worker 통과. 자동 Production 같은 SHA, GitHub Actions **38186160654 quality/production success** 확인. 앞선 f17b259의 Actions **38185804132**도 두 검사 성공.
- 마지막 보강은 실제 셀의 회사명·참조번호·SKU 전체 값을 확인한다. 부분 문자열을 전체 값으로 승인하지 않는다. 검증되지 않은 SKU가 남아 있는 품명 대응은 잠정으로 표시한다. 업로드 칸이 바뀌어도 실제 Packing List 자체 번호를 Invoice 번호로 재해석하지 않는다.
- 한 수량이 다른 상품 행을 인용해도 올바른 품명 행의 중량·SKU·포장 근거를 함께 무효화하지 않는다. 여러 상품인데 원문 행/블록 관계 자체가 없으면 상품 수량의 연결을 확정하지 않는다. 이는 행 구조가 없는 양식의 현재 제한이며, 임의로 다른 행 숫자를 승인하지 않는다. 개별 금액의 통화·회계 정의가 불완전한 합계 차이는 잠정 불일치로 보호한다.
- 마지막 보강 후 실제 실행: 단위 **265/265**(19개 파일), ESLint 통과. 서로 다른 합성 양식 **7/7**, 모의 AI 추출+PDF 원문 근거 **172/172** 통과. 기존 237개 단위와 12개 브라우저를 삭제하지 않고 회귀를 확장했다. 새 PHASE 2.3 핵심 회귀는 28개, 브라우저는 기존 12개+새 3개이다.
- 최종 저장은 `ship`의 npm ci/typecheck/lint/265개 단위/Production build/PDF worker/15개 브라우저 검사를 모두 통과한 경우에만 수행한다. 일반 main Push 후 GitHub quality/production 및 공식 사이트의 정확한 SHA를 확인하고 최종 결과에 실제 SHA를 보고한다. 실패 코드는 Push하지 않는다.
- 추가 유료 호출 **0회**. 실제 OpenAI 검증의 소스 SHA는 계속 **5122cb071044df2dcee86f49404ea9c6c9db99cb**이며 그 결과는 2/2문서·57/57필드·600/400 PCS 확정 일치이다. 이후 안전 보강의 검증은 합성 PDF/모의 AI 회귀이며 실제 API 재검증으로 주장하지 않는다. 승인된 2개 문서 예산은 소진 상태로 유지했다.


## PHASE 3.0 — 신고 전 선적서류 준비 기반 (2026-10-13 KST)

- 기준 저장소 `sw030818/oceanrisk-ai`, main/원격 HEAD **979737e84c759831afb45dd9747318671c90749a**, 시작 시 변경 없음. AGENTS/PLAN/PROGRESS/README 및 PDF/OpenAI/근거/규칙/UI/검사 구조를 조사했다. 기존 저장소·Vercel·키·기록 초기화 없음.
- 현재 제품을 중소 포워더의 House B/L·수출신고필증·House Manifest 신고 전 자료 준비로 전환했다. 새 `ShippingWorkspace`는 기존 네이비·화이트 화면 구조와 UploadSlotCard/EditableField/EvidenceDialog를 재사용한다. 3종 카드, 빨간 PDF 표시, 드롭·교체·삭제, 최소 2종 준비, 3종 삼각대조 자료 준비, 원문 페이지/블록/위치, 실패/부분 성공, 사용자 입력/복원을 구현했다.
- 별도 `shipping` Zod 모델은 사용자 영역과 실제 분류를 분리한다. 원본/현재값·근거 상태·파일/페이지/블록/좌표, 서로 다른 문서 필드와 additionalFields 확장, 물품/포장/중량 단위, 복수 품목/컨테이너/Seal/신고 참조와 다대다 관계를 보존할 구조다. 관계 그룹 밖 항목·잘못된 숫자/문자 유형·수정값의 가짜 검증 상태를 거부한다. 기존 6개 판정 상태는 후속 검증 계약에서 재사용한다.
- 공개 `/api/analyze`는 boundedFormData/Origin/업로드 제한/105초 취소/실제 PDF.js 추출을 재사용하고 **PDF 준비만** 실행한다. 분류 null·typeMismatch null·추출/정합성 검증 not_performed·checks 빈 목록·aiCalled false를 반환한다. 키가 있어도 OpenAI/Gemini/Invoice 규칙에 연결되지 않는다. 기존 Invoice/PL 공개 요청은 409로 거부하고 새 화면으로 새로고침하도록 안내한다.
- GPT-6 Luna Responses/strict 스키마/토큰/타임아웃/phase 파서/근거/수량 규칙·옛 Workspace를 보존했다. 이전 API 처리기는 외부 route가 없는 `analysis/legacy-route.ts`로 보존하고 기존 HTTP 계약 회귀를 그 내부 코드에 연결했다. 기존 단위 265개를 삭제하거나 기준을 완화하지 않았다. 새 공개 API/문서 모델/무료 PDF 준비 회귀 26개를 추가했다.
- UI 계약 변경으로 기존 15개 Playwright 시나리오를 새 3종 업로드·최소 2종·미실시 상태·원문·수정·보안 안내에 맞게 갱신했다. 이전 Invoice 수량 판정은 보존된 핵심 단위 회귀에서 검사한다. 새 서류의 수량 오류를 이전 규칙으로 생성하지 않는다.
- 실제 실행: npm ci **419개 패키지**, typecheck, ESLint, **291/291 단위(20개 파일)**, Production build, **PDF worker trace PASS**, **15/15 Playwright** 통과. 개발 서버 실행과 1440px 데스크톱/390px 모바일 실제 화면 확인 및 가로 넘침 없음. 서버 PDF 준비 2/3종·페이지/블록·원문 위치와 사용자 수정/복원을 실제 합성 PDF로 검증했다.
- 수정한 초기 실패: Zod discriminated tuple/nullable 필드의 타입·const 코드, Next Link lint, 새 UI의 숨겨진 Next route announcer/반복 페이지를 함께 잡는 4개 브라우저 selector, Production 확인 도구의 BodyInit 바이트 타입. 마지막 전체 검사의 브라우저 시작은 시각 확인용 개발 서버 자식의 3000 포트 점유로 중단되었고, 이 작업의 해당 프로세스만 종료 후 15개 전체 브라우저를 재실행해 통과했다. 미해결 테스트 실패를 성공으로 덮지 않았다. 최종 ship은 전체 검사를 다시 실행한다.
- README/PLAN/AGENTS를 현 단계로 갱신하고 이전 README를 `docs/legacy-phase23-readme.md`에 보존했다. 실제 OpenAI 유료 호출 **0회**, 기존 31개/2개 예산/ledger 변경 없음. 문서 DB/실제 업무 PDF/키/원문/API raw 응답을 Git·로그에 추가하지 않았다.
- `check:phase30:ui`는 정확한 Production SHA와 AI 비활성 상태를 확인한 뒤 한 배치의 합성 PDF 3개를 실제 무료 준비 API로 보낸다. 공식 HTML/assets를 TLS 검증된 Node 프록시 전송으로 Chromium에 연결하고 데스크톱 3열/모바일·사용자 수정/실제 블록 보기·분석 미실시를 검사한다. 실제 AI 검증으로 보고하지 않고 재시도하지 않는다.
- 저장/배포: 작업 파일만 Stage한 뒤 AGENTS의 ship 전체 통과를 조건으로 main 일반 Commit/Push, 원격 SHA 대조, Actions quality/production, 기존 Vercel Git 자동 배포/동일 SHA 및 공식 새 UI를 확인한다. 최종 SHA와 실제 완료 여부는 작업 완료 보고에 기록한다.
- **남은 PHASE 3.1**: 새 3종 strict Responses 스키마/분류·필드/품목/컨테이너/복수 참조 추출, 실제 블록 인용 복원, 역할/행/열/숫자/단위 독립 검증, 판독 유형 불일치 경고와 수정 재검토 UI. 유료 검증은 새 예상 호출 수/상한의 별도 승인 필요.
- **PHASE 3.2 이후**: TS 다대다 대응/양자 3조합/삼각대조, 복수 신고·분할선적·동시포장·컨테이너·다른 단위·원문 부족·잘못된 연결의 확정/잠정 판정. 관세청/EDI 제출·실시간 연동·Booking·OCR·온프레미스는 미구현이며 제공 중으로 표시하지 않는다.
