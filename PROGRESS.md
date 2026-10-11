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
