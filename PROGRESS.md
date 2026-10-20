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
- Gemini 400 요청 거부/406 모델 없음/401·403 권한/429 Google 한도, 응답 길이 제한·차단 메시지 구분. 기존 v1beta 모델 URL, responseJsonSchema, Zod, 실제 텍스트 입력 및 원문 검증 유지. 실제 모델/스키마 수용은 아직 확인 불가.
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

### 확인된 실제 실패 원인: Gemini 모델 406
- 진단 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38161603819 의 공개 알림에서 A–D 각각 두 문서의 `API_MODEL_NOT_FOUND` 확인. Google generateContent가 406를 반환한 단계이며 AI 구조화 결과는 아직 생성되지 않음. PDF 판독/키 미설정으로 단정하지 않음.
- 같은 실행의 Production 알림: SHA `f169c83d6f6f7ad1dfd6ffe796ae31b75b0eca43`, verified=true, ID `dpl_6a4pZdGYzVH2U3ZpamSrHKYsx4Qr`. 관리 API Ready는 아직 직접 확인되지 않음.
- 406에 한해서 서버 키로 models.list를 1회 호출해 Google이 generateContent 지원을 명시한 텍스트 Flash 모델만 선택하고 1회 재시도하도록 수정. 실제 응답 성공 모델은 인스턴스 메모리에만 캐시. 권한/400/429/500에는 조회/재시도 없음. 다른 API/오디오/이미지/Pro 모델을 추측해 사용하지 않음.
- 구조화 출력/Zod/근거 검증/타임아웃은 그대로 유지하며 성공 응답에 실제 사용 모델명을 안전한 메타데이터로 기록. 실제 모델 응답 검증은 다음 명시적 A–D 실행에서 확인.
- 모델 발견 변경의 최초 로컬 검사에서 JSON 요청 객체 괄호 누락으로 구문 검사가 실패 → 수정하고 타임아웃/cache가 JSON body가 아니라 fetch 옵션에 위치하는 회귀 확인을 보강. 실패한 로컬 상태는 커밋/Push하지 않음.

### 모델 복구 후 실제 제공자 거부·서비스/한도 오류
- https://github.com/sw030818/oceanrisk-ai/actions/runs/38162265729 에서 quality/production 성공, live 실패 확인. 배포 SHA `111fb6b504086ed0bff61685877e749d74569620`, ID `dpl_76EXHgR78xSvF5hyqsrbHcig9dFk`, verified=true.
- 실제 결과: A API_ERROR/API_REQUEST_REJECTED, B 요청 거부 2개, C 요청 거부/API_ERROR, D API_ERROR/API_RATE_LIMIT. 모델 406 이후 다른 제공자 단계에 도달했지만 구조화 분석 성공 사례는 아직 없음.
- 정확한 거부 필드/HTTP 상태를 확인하기 위해 원문 메시지를 서버 메모리에서만 읽고 status·고정 설정 필드명·요청 모델·quota window/limit-zero 여부만 화이트리스트로 반환/알림. 키·문서·프로젝트 ID·원시 응답은 출력하지 않음.
- 다음 실행은 `[case-A]` 표시로 A 두 문서만 검사. 일부 범위가 통과해도 전체 A–D completed는 false로 유지. 제공자 429를 확인하면 테스트 도구는 뒤의 사례 호출을 중단하며 Google 한도 변경/우회/자동 재시도를 하지 않음.

### A 최소 진단으로 확인된 HTTP 503
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38162836658 : quality/production 성공, A 실제 분석 실패. 두 문서 모두 모델 gemini-3.8-flash, HTTP 503, status UNAVAILABLE. requestFields 없음, quotaLimitZero=false. 해당 실행에서는 원시 메시지 없이 공급자 서비스 불가를 확인했으며 권한/스키마 오류라고 주장하지 않음.
- 배포 SHA `9855c95e5f6d80d0eea0173cd9fcf1b966ddad34`, ID `dpl_HFwAELmASmfmuCFWJq7sdUWRmnu1`, Production verified=true.
- 406 목록 선택을 단순 최신 버전 우선에서 **안정 모델·원래 버전 계열·공식 Flash alias** 우선으로 변경. 같은 목록에 실제로 있는 모델만 선택하며, 503/429를 받은 뒤 다른 모델로 순환하거나 한도를 우회하지 않음. 원래 버전의 Flash-lite가 목록에 있다면 이를 먼저 사용하여 프롬프트/스키마 호환성과 안정성을 유지. 합성 선택 회귀 검사 추가.
- Google 공개 API discovery 문서 `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`를 실제 HTTP 200으로 확인. generationConfig의 responseJsonSchema/responseSchema/responseMimeType와 새 responseFormat이 존재함을 확인. 기존 필드명이 없다는 추측으로 오류 원인을 단정하지 않음.

### 같은 계열 후보도 실제 406 / 최신 API 형식 정리
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38163293926 : quality/production 성공, A 두 문서 모두 gemini-2.5-flash-lite의 HTTP 406 NOT_FOUND로 실패. Google 목록에 generateContent 모델로 표시돼도 실제 사용 가능성을 보증하지 않음을 확인.
- 소스 SHA `a29ce3edd52f23ed72b31b844d71bf474b40822e`, ID `dpl_AdFxodSYUSw8gy5TCu4rtztv9uyL`, Production verified=true.
- 406 복구는 1회 목록 조회 후 중복을 제거한 최대 2개 후보까지만 확인. 후보도 406인 경우에만 다음 후보를 사용하며 400/429/503에는 중단. 성공한 실제 응답 모델만 메모리 캐시.
- Google discovery가 명시한 최신 GenerationConfig.responseFormat.text(mimeType=APPLICATION_JSON, schema) 형식을 Gemini 3+ 및 공식 최신 Flash alias에 사용. 2.x에는 기존 responseMimeType/responseJsonSchema 경로 유지.
- Zod JSON Schema는 reused=ref로 중복 정의를 공유해 실제 측정 6721→2087 bytes로 축소. 로컬 Zod/근거 검증 조건은 유지. API지원필드 metadata에 $defs/$ref가 명시됨을 확인했지만 실제 생성 성공은 아직 추가 실행으로 확인해야 함.
- 새 요청 형식/후보 406 연속 처리/400·429·503 비재시도 회귀 검사와 최종 단위 **139/139** 통과. 다음은 A 최소 실제 실행이며 전체 A–D 완료로 오인하지 않음.

### 최신 alias 실제 실패 및 텍스트 모델/근거 문맥 회귀 보강
- 실행 https://github.com/sw030818/oceanrisk-ai/actions/runs/38164103963 : quality/production 성공, A 실제 분석 실패. 사용 모델 gemini-flash-latest; 문서별 HTTP 503 UNAVAILABLE / HTTP 400 INVALID_ARGUMENT. 반환된 안전한 설정 필드 힌트 없음. 배포 SHA `3a55d251ea0461d29d2305bb09321ca477c07241`, ID `dpl_H5zos4N7KxeabDeDJDm7rEepUC3H`, verified=true.
- 실제 모델 목록에 포함된 TTS 모델이 기존 preview 이름 패턴을 통과하는 결함을 발견해 audio/TTS/image/live 등 비텍스트 전용 모델을 명시적으로 제외. 안정된 숫자 버전 모델을 alias보다 우선하고, 원래 버전에 가장 가까운 모델을 선택. 실제 목록의 2.5 Flash-lite가 406인 경우 다음 후보는 3.1 Flash-lite이며 400/429/503 뒤에는 재시도하지 않음.
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
- 구현 main **5122cb071044df2dcee86f49406ea9c6c9db99cb**, 일반Push/원격SHA 일치. ship npm ci419/type/lint/**256/256 단위**/Production build/PDF worker/**15/15 브라우저** 모두통과. 공식Production 같은SHA/ID **dpl_mF7oJSDnPJSy8b5Z6rtTFanDB9T9**, Actions **38185179745 quality/production success** 확인.
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
- 추가 유료 호출 **0회**. 실제 OpenAI 검증의 소스 SHA는 계속 **5122cb071044df2dcee86f49406ea9c6c9db99cb**이며 그 결과는 2/2문서·57/57필드·600/400 PCS 확정 일치이다. 이후 안전 보강의 검증은 합성 PDF/모의 AI 회귀이며 실제 API 재검증으로 주장하지 않는다. 승인된 2개 문서 예산은 소진 상태로 유지했다.


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


### PHASE 3.0 실제 GitHub·Production 완료 결과
- 구현 커밋 main **a7f0e9899e6c6bee072a7864e1b8beb0d6db71c0** 일반 Push/원격 SHA 일치. ship 설치/type/lint/**291개 단위/15개 브라우저**/Production build/PDF worker 모두 통과, 작업 트리 깨끗함.
- GitHub Actions **38349262468**의 quality·production 모두 success. Vercel Git 상태 **success / Deployment has completed**, 공식 Production의 SHA 일치 및 ID **dpl_3HPxwsvZanaGjzYY1vJFrzc2AV35** 확인. OpenAI 키 설정은 유지됐지만 추출 capability는 false이다. 관리 API Ready 직접 조회를 주장하지 않는다.
- `check:phase30:ui --sha=a7f0e9899e6c6bee072a7864e1b8beb0d6db71c0` 실제 실행 성공. 공식 HTML/assets·실제 무료 PDF 준비 API에 합성3문서/배치1회를 제출해 원문 준비3개·블록/위치·사용자 수정 구분·1440px 3열·390px 넘침 없음 확인. AI/삼각대조 미실시, **유료 공급자 호출0·재시도0**. 이 검사는 모의 API 재생이 아니라 실제 Production PDF 준비이며, 실제 OpenAI 분석 성공을 뜻하지 않는다.
- 안전 메타데이터는 `docs/validation/phase30-2026-10-13.json`에 보존한다. 이 결과 보존의 마지막 변경은 PROGRESS/검증 JSON만으로 실행 코드가 같으며, 문서 저장도 동일 ship 검사를 거쳐 Push/자동 배포 후 최종 SHA를 완료 보고한다. 다음 개발은 PHASE 3.1의 새 서류 전용 추출·근거 검증부터 시작하며 이번 단계에서 수행하지 않는다.

## PHASE 3.1 — 선적서류 OpenAI 추출·독립 원문 근거 (2026-10-13 KST)

- 깨끗한 main/원격 `ed9840cb128281806c20c250d13af0fd4dadaa30`에서 기존 모델·API·Responses·PDF·근거·UI·291개 단위/15개 브라우저와 기록을 조사했다. 저장소·Vercel·키·과거 ledger 초기화 없음. 로컬 OPENAI_API_KEY/GEMINI_API_KEY는 설정되지 않았고 값은 출력하지 않았다.
- 기존 OpenAI transport를 generic strict format으로 확장하고 Invoice/PL 포맷은 그대로 wrapper로 보존했다. `ai/citations` 공통 블록 복원, `shipping/ai-schema`·`openai`·`analysis`·`ground`·`verify`·`roles`·`layout/shipping-cells`를 추가했다. store:false/서버 키/final_answer-only/안전 usage·오류/45초·전체105초를 유지하며 선적 전용 출력 상한8192, 자동 재시도/유료 폴백0이다.
- House B/L·수출신고필증·House Manifest 실제 제목 근거 분류, 문서별 필드·다중 품목/컨테이너/Seal/화물/신고 참조를 구조화한다. 신고/HS/B/L/컨테이너/Seal은 문자열, 수치와 단위·문서 전체 합계/개별 행을 분리했다. 분류 후보와 사용자 슬롯/최초 슬롯/실제 필드 유형을 독립 보존하고 불일치는 실제 유형의 필드+교체/영역 교환 UI로 안내한다.
- 실제 페이지·ID에서 인용 복원 후 문자 전체값/숫자·라벨 의미·열·동일 데이터 행·단위를 TypeScript로 독립 검사한다. PCS/CTNS, 순/총중량, 다른 상품·컨테이너·화물행, 개별 행을 문서 총계/단위로 인용, 여러 수치가 합쳐진 블록·중복 원문 행/Seal·허위/누락 근거는 확정하지 않는다. 줄바꿈 품명을 수량/HS 셀이 있는 실제 데이터 행에 연결했으며 특정 회사 좌표 하드코딩은 없다.
- `/api/analyze`는 명시적 `operation:analyze`에서 새 추출을 실행한다. `prepare`/생략은 기존 무료 PDF 준비 계약이다. 키/권한/할당량 오류는 배치의 후속 AI를 중단하고 PDF는 보존한다. 문서별 완료/부분 성공/실패·중요 정보 누락·근거 상태·원문 페이지/위치·수정/복원을 연결했다. 사용자 수정은 원문 검증 성공과 구분하며 삼각대조는 언제나 not_performed/checks[]이다. 후속 PHASE 3.2 로직을 추가하지 않았다.
- 검색 가능한 한영 혼합 **실제 2페이지 합성 PDF 3종**과 유형별 정보누락·잘못된 근거·복수Seal 변형을 생성했다. 두 품목/HS선행0/분리수량·단위/두 컨테이너/반복500/순·총중량/Manifest 화물/복수신고 참조를 실제 PDF.js로 추출한다. 공식 세관 진본·업무PDF로 가장하지 않는다.
- 초기 새41회귀 중 줄바꿈 품명과 연관 HS 검사가 실패했다. 모든 설명 블록을 새 행으로 보던 문제를 실제 수치/HS행 앵커로 수정했다. 타입mock fetch인자/const lint, 브라우저 반복문서 selector·숨겨진 복원버튼 index·실제2페이지문구·로딩상태 문구 문제를 수정했다. 근거검사 삭제·무조건 승인·자동 유료 재시도로 해결하지 않았다.
- 무료 실행 관측: 전체 단위 **327/327**, 추가 보강 선적39회귀 **39/39**, 전체 개발 서버 Playwright **21/21**(기존15+새6), typecheck/lint/Production build/PDF worker PASS. 마지막 숫자블록·출력예산2회귀를 더한 최종 **332개 단위/21개 브라우저**·npm ci·타입·린트·Production build·worker 전체는 `ship` 재검사를 통과한 경우에만 main에 저장한다. 실제 완료 SHA/Actions/배포는 후속 관측 기록으로 분리한다.
- 유료 OpenAI 호출 **아직0회**. 이번 사용자 지시9절에 따라 무료 구현/검사를 먼저 완료한 후 새 승인 요청을 한다. 예상 합성3문서(유형별1)/배치1회/최대$0.05/실패재시도0, 이전31개·2개 소진 예산과 별도live-phase31 ledger/archive. 실제 요청 bytes와8192출력 상한을 사전예약한 3문서 보수적상한 **$0.0335478**를 확인했다. 실제 호출 전 exact ProductionSHA/model/key presence와 새 승인·예산을 확인하고 usage미확인 비용은 예약 유지한다. 모의 통과를 실제 OpenAI 정확도로 합산하지 않는다.
- 무료 Production 도구 `check:phase31:ui`는 exactSHA+3.1 capability 뒤 공식HTML/assets에서 prepare만 실제 전송하도록 방어한다. 모바일/데스크톱·원문 블록·사용자수정, 잘못된PDF analyze의 공급자 호출 전 실패를 확인하며 유료호출0이어야 통과한다. 문서/APIraw응답/키를 보고서에 저장하지 않는다.
- 기록: README/PLAN/AGENTS 및 `docs/validation/phase31-2026-10-13.json`. 기존 유료 archives/실행 기록은 보존했다. main 일반Push·GitHub quality/production·Vercel Git 완료·같은ProductionSHA를 확인하고 추가 관측을 기록한다. 미실행 실제유료·관리APIReady 직접조회·실무전체정확도는 완료로 표시하지 않는다.
- 남은 범위: 복잡한 병합/회전 표·스캔OCR·모호한 제목/라벨의 근거확인 한계, 실제 업무양식 일반정확도와 유료실증(새 승인 전 미실행). PHASE3.2 다대다 대응·양자/삼각대조·분할선적/동시포장·위험 판정, CSV/EDI·세관자동신고·실시간/온프레미스는 미구현.

### PHASE 3.1 실제 저장·무료 Production 검증 결과
- 구현 main **3a4605f79e0764d0a1406b96d5572dd38873355b** 일반Push·원격 SHA 일치, 깨끗한 작업 트리 확인. ship **npm ci419/typecheck/lint/332단위/Production build/PDF worker/21브라우저** 모두 통과했다. 단위는 기존291+새41, 브라우저는 기존15+새6이며 테스트 삭제 없음.
- GitHub Actions **38355573500 quality/production success**. Vercel Git **success / Deployment has completed**, 공식 Production 같은SHA/ID **dpl_F96hMtaDn2vhuz4dWSJs89zyxcxk**, PHASE3.1 분류/추출capability true·삼각대조false·OpenAI키설정true 확인. 키유효성/관리APIReady 직접조회는 이 상태 확인으로 주장하지 않는다.
- `check:phase31:ui` 실제 실행 PASS: 공식HTML/assets의1440px데스크톱3열·390px모바일넘침없음, 합성3PDF의 실제 **prepare 배치1회**, 원문페이지/실제블록/좌표·사용자수정구분을 확인했다. 추가 잘못된PDF3개의 shipping-analysis 요청은 PDF 추출에서 INVALID_PDF로 실패하고 aiCalled:false를 확인했다. 총 **유료 공급자 호출0/자동재시도0**, 삼각대조 미실시. 이 결과를 모의/실제AI 성공으로 합산하지 않았다.
- 화면을 시각적으로 점검해 업로드 설명의 중복된 '아직 분석 후' 표현을 바로잡았다. 추출/검증/수치/보안 코드 변경은 없다. 무료 결과 안전메타데이터를 검증JSON에 보존하며 마지막 기록도 ship 전체 통과 후 main 저장·배포한다.
- 사용자의 요청9절에 따른 새 유료 승인 질문을 제출했다: 합성3문서(유형별분류·다중품목/컨테이너·물품/포장/중량·HS·참조)/최대$0.05/배치1회/재시도0. **기록 시점 승인대기·실제OpenAI 호출0**이다. 이전31개/2개 예산은 여전히 재사용하지 않았다. 승인 전에는 실제 정확도·토큰·유료 비용 통과를 보고하지 않는다.

## PHASE 3.2 구현·무료 검증 (2026-10-13 KST)
- 시작 main/원격 c40eeeb87199c245908a1a20361510c9da6b7349 일치, 사용자 변경 없음. 요청된 지침/계획/기록/README/3.1 검증JSON과 shipping/API/UI/회귀 구조를 조사했다. 로컬키 미설정, 값 출력 없음. 신규 요청7절에서 $0.50/최대12 유료문서/자동재시도0 승인 확인; 과거31개/2개와3.1 승인대기 예산을 재사용하지 않았다.
- 먼저 같은 c40eeeb Production에서 HBL/수출신고2개의 실제 GPT-6 Luna 추출을 확인했다. 분류·구조화2/2, 최초 엄격평가값/근거84/85, 반환된 후보의 독립근거89/89. 빠진1건은 이미 검증된 문서 자체HBL 번호를 참조배열에도 중복 요구한 평가항목이며 실제 번호필드는 확인됐다. 의미별 검사는 자체번호/참조배열의 실제 검증된 같은 의미 필드를 허용하도록 수정했고 원본 baseline 관측을 지우지 않았다. 입력15,270/출력3,089, 추정비용$0.00286867, 예약2/12, 재시도0. 이 baseline을3.2 관계/비교 검증으로 주장하지 않는다.
- `review-evidence`·`relationships`·`review` 순수 TS를 서버/클라이언트가 공유한다. 의미별 참조·당사자·명시적선적 범위·출처qualified IDs·행 대응을 판정한다. 컨테이너/품명 유사성 단독 확정 금지, 같은HBL의 복수신고번호 목록 차이는 확인필요로 보호, 강한참조/당사자 충돌과 사용자식별 수정은 관련 수치를 잠정으로 보호한다.
- 세 조합 양자·모든양자연결+공통HBL이 검증된클리크의 삼각대조를 실행한다. 포장/중량/품목수량·단위·컨테이너/Seal/참조/당사자/POL/POD/연결가능HS를 독립 비교한다. 누락은 정보부족, 알 수 없는 단위는 비교불가다. 같은숫자와PCS/CTNS·순/총/신고중량·개별/합계·부분/동시포장 범위 혼용을 금지한다. 이름/항구 표기 차이를 임의 물품/항구 오류로 확정하지 않는다.
- `coverage`는 AI와 별도로 실제 PDF의 의미있는표 데이터행과 인용된 행을 대조한다. 동일HBL의 전체 화물행+서로다른 컨테이너+원문근거/단위/범위가 확인될 때만 합산한다. 복수 신고를 자동합산하지 않고 개별문서/행 관계와 보류 이유를 보존한다. 중복로컬ID는 문서별namespace로 식별하며 모호한bare ID 연결은 거부한다.
- `ShippingReviewPanel`은 상태별 카운트·관계근거/범위·우선불일치·파일/페이지/블록·확정/잠정이유·후속질문을 표시한다. 기존 원문팝업/수정복원을 재사용하며 추가PDF1개(최대4개/기존4MB합계)와 사용자관계확인(잠정)을 지원한다. 수정/복원 시 관련결과 즉시재계산·추가AI호출0. capability와 실제수행/부분실패를 분리한다. 기존3.1응답의 UI는 하위호환미실시로 보존했다.
- 근거추가보강: 실제500PCS/20CTNS/320KG붙은셀의 단위를 해당부모열/동일행에서만 확인한다. 다른페이지의 같은헤더행번호, 여러행단위·다른필드단위 인용을 거부하고 자기표헤더+자기행인용은 허용한다. 새원문근거를 생성하거나 검사기준을 삭제하지 않았다. 별도 Manifest 물품상세/화물표를 모두 추출하도록 프롬프트를 명확히했다.
- 무료 관측: 기존332/332 회귀 유지, 전체373/373 및추가 마지막3회귀로 신규44개 대상검사 통과. 전체30/30 브라우저(기존21+새9) 통과, typecheck/lint 통과. 최종45+332=377단위/30브라우저·npmci·Production build·worker는 ship 전체검사로 검증한 경우에만 저장한다. 합성PDF는실무구조2페이지/한영·복수상품/HS선행0·컨테이너/Seal/화물/참조·정상/차이/정보부족을 포함하며 진짜세관문서로 가장하지 않는다.
- 수정한초기실패: 합성PDF의 동일행같은200을 다른열로 인용한 테스트생성기좌표 선택, 원래문서만 중복상품보류인데 다른문서의 정상비교까지 금지한 새테스트 범위, 신고목록차이의proposed 상태 누락, 입력순서에따른 배열/근거/합산순서 불안정, 사용자확인 UI메모 의존성연결. 실패검사삭제/무조건승인/유료자동재시도 없음.
- 현재 신규3.2 live는 아직미실행. 공식모델가격페이지 HTTP200과 기존표준가격(입력$0.10/캐시$0.01/쓰기$0.125/출력$0.50 per1M), 실제요청bytes·8192상한·10%예약을 확인한다. 결과는 모의/PDF/실제API/Production을 구분한다. 가격은사용량기반추정이며 청구서확인아님. 예산로그는원문/키/raw응답 없이 상태·개수·진단코드·토큰/비용만 기록한다.
- main 일반Push·Actions quality/production·Vercel Git완료/같은SHA 후 실제정상3종/불일치2종/불확실2종을 같은SHA에서 검증한다. 최종실제결과는 validation/phase32-evidence 브랜치의 docs/validation에 정상저장해 테스트된 Production main SHA를 그대로유지한다. 미검증/부족범위는 최종보고에서 명확히구분한다.

- 마지막 사용자 식별필드 삭제도 수정 출처로 유지하는 회귀1개를 추가했다. 최종 신규45개/기존332개=377개이며 실제 표의 필수 품목/컨테이너/화물행 누락은 부분성공으로 표시한다. 추가무료/Production 검사는 exactSHA에서 prepare만 전송하는 check:phase32:ui로 보호한다.

## PHASE 3.3 구현 및 무료 검사 (2026-10-13 KST)
- 시작main/origin928bcc729682cbc6444483c38fbbdce230e9af59 깨끗한상태. 기존증거브랜치/ledger보존, 환경설정setup스킬의기존설치/실행절차 확인. npmci419패키지성공, 로컬OpenAI키미설정(값출력없음). 명시사용자수정에서 신규$0.10/24문서/30요청을 승인하고 이전$2안을철회했다.
- 세유형 File[]·안정ID·동명이인파일·추가/개별삭제교체·최대24개/64MB검토공간, 기존4MB요청/파일·30페이지보호 및2개순차배치/부분실패/완료결과·수정값유지 구현. extra영역/상태와모드라디오제거, AI주버튼·무료PDF보조버튼.
- 같은유형/단일파일배치를정상화하고원본영역/실제AI분류를분리했다. 기존테스트377/30은삭제하지않았으며 새UI/API계약(추가영역제거·배치·단일분석)에해당하는transport/selector/예상요청수만갱신했다. 원문근거·단위·잘못된확정오류방지assertion은유지했다.
- PDF합계행경계·숫자행보다먼저줄바꿈된품명·반복헤더페이지별단위근거·전체표커버리지보강. HBL명시전체신고목록/유일신고번호/서로다른검증품명+HS/같은물품단위/전체범위를 확인한 집계만지원하며중복/공유포장/배분미확인은보류한다.
- 선택OCR은 sparse페이지최대3개PDFsubset과strict전사스키마/기존Responses안전transport를사용한다. 공식PDFinput_file/file_data및gpt-6-luna이미지입력페이지HTTP200확인. OCR출처/ocr_unverified·원본브라우저링크·부분성공, native본문/이미지혼합보존, 페이지불일치/판독실패/제한/타임아웃을구분하며가짜좌표를원문검증으로표시하지않는다. Vercel은외부nativeOCR바이너리가필요없다.
- 무료새평가정답은기존템플릿과다른pdf-lib세로/가로/열순서/다중페이지/반복헤더/줄바꿈,한영혼합등을 렌더전작성했다. 정답/판정은AI프롬프트에전달하지않는다. Holdout은최종실제평가전튜닝하지않는다. 실제고객문서없음.
- 관측무료399/399 및Productionbuild/type/lint통과, 브라우저초기29/38통과후9실패는바뀐계약/셀렉터/테스트multipartcapture와동일File객체재추가원인으로수정해9/9통과. 추가OCR/예산/집계/배치보류/캐시보존 회귀후 최종406단위·41브라우저·빌드/worker는ship전체통과를확인한경우에만배포한다.
- 실제API는이기록시점아직0회이며비용/성능성공을주장하지않는다. 새live-phase33 ledger는원격증거브랜치까지복원·비용/문서/요청예약·미확인usage예약유지·자동재시도0. 실제결과기록은같은ProductionSHA유지를위해validation/phase33-evidence에별도저장한다.

- 최초ship의405단위/41브라우저/npmci/타입/린트/Productionbuild/worker전체는통과했지만 최종인쇄보고서의PDF원문모드미실시표시·OCR본문16000바이트상한·PDF형식오류안내를수정했다. ship의미Stage변경보호가커밋/Push를중단한것을확인했다. 최종소스는전체ship을다시검사하며이전검사만으로배포하지않는다. 복잡6문서평가에는동일파일명의서로다른HBL2개를포함한다.

- 최종다대다검토에서중복HBL버전및다른HBL의동일컨테이너사용을HBL화물행집계의독립보류조건에추가했다. 공동포장/중량배분명시없이확정합산하는회귀를차단한다. 이변경후전체ship을재검사하며예상최종406단위/41브라우저다.

- bb2b9946992f682fb7fa9e557638ccd8c075efee에서실제기준선3문서/신규정상3문서통과. 핵심141/141·91/91,관계3/3씩,확정오탐0. 소모6문서/6공급자요청/$0.00759725. Production무료6PDF/동명파일/3배치/원문/모바일/인쇄미실시/잘못된PDF공급자호출전실패도통과했다.
- 복잡정답자료사전검토에서B선적신고서의포장/중량기본값이A선적값으로남아있어무료검증이정확히2불일치를찾았다. 모델/근거검증을완화하지않고B정답의포장5/총중량50/순중량45로수정했으며정상복잡사례확정불일치0회귀를추가했다. 복잡사례실제호출전수정이다. 배포후최신SHA정상3종을재검증하고기존6문서관측은이전SHA로분리한다. 전체예상23문서/24요청이며최대24/30/$0.10을유지한다. Holdout은아직미실행/튜닝하지않았다.

### PHASE 3.4 — 2026-10-14 구현 및 배포 전 기준선
- 최신 main/원격 e5f8d7c와 깨끗한 시작을 확인했다. 사용자ZIP의 원본3PDF를 실제로 읽었으며 해시는 README 값과 일치했다. 첨부 원본/스크린샷은 저장소 밖 비공개 경로에 보존하며 공개 합성 회귀를 별도로 작성했다.
- 수정 전 같은Production의 실제 OpenAI 3구조화 성공/4문서시도/4공급자요청. 신고필증의 첫45초타임아웃 뒤 단일 재검증 성공. 자동재시도0. 새예산$0.15 중 알려진usage비용$0.00255067, 미확인usage예약$0.011764225 유지. 과거ledger 변경/재사용 없음.
- 기준선은 실제응답에 당시 원본review 코드를 적용해 분류0/3, 필드확인15/106, 원문연결0, 확정일치0/불일치0, 잠정25/확인필요5/정보부족18/비교불가2, 삼각대조보류였다. 사용자의 이전스크린샷 수치와 이번실제재실행 수치를 섞지 않는다.
- 원인: native텍스트는 정상이다. 공백 한글/괄호 제목·일반BL+House발행맥락, 번호/분리라벨, 가운데정렬열과실제셀경계, PCS와CTN혼재를 기존 의미/행검사가 거부했다. AI가 없는슬래시를품명에삽입하거나 화물행을문서합계로인용한 사례는 모델후보오류로분리해 계속미확인으로보호했다.
- 수정: 실제PDF stroked vector셀의상대경계·분리헤더/같은셀/상품/컨테이너/화물행, 명시 count-unit원자, native문서기재범위와전량계약이행구분, 부분/복수신고 보호, 포장문맥CT/PCS/EA/중량·UN/LOCODE·HS6자리/부분품명 구분. 검증기 삭제/숫자전역검색/슬롯분류/Gemini폴백/유료자동재시도 없음.
- UI: 기존다중파일/배치/실패보존/원문/수정복원/OCR를 유지하며 KPI+정렬된통합표+상세패널+선적그룹선택+인쇄표/제한으로교체했다. 원본검사목록/출처를삭제하지않는다. 필터는표시검사와판정·값이맞도록계산한다. 모바일가로넘침수정.
- 관측무료검사: 425개→후속범위보호추가뒤427단위통과, 타입/린트/Productionbuild/worker통과. 초기브라우저42/50과8실패(새텍스트/선택자/모바일넘침)는 수정뒤8/8재검증통과했다. 마지막숫자혼재/다른상품행과새기본전체필터를추가했으므로 최종ship의 전체검사(예상429단위/50브라우저)를 다시통과해야Push한다. 테스트삭제/보호assertion완화 없음. 기존Busan코드의잠정차이assertion은요청된표준화일치로갱신하고unknowncode반례를추가했다.
- 새코드Production의 실제원본 재검증·오류반례·전체Actions/동일SHA는 이 기록시점 미실행이다. 무료실제응답재ground 결과를 새로운OpenAI성공으로보고하지않는다. 원본3문서의최종결과/잔여문제와비용은같은코드SHA검증후별도증거브랜치에보존한다.

- 최초 PHASE3.4 main **024588717cce4f0de7f8114df64326270f2f9091**: ship 429단위/50브라우저/npmci/type/lint/build/worker 전체통과, 일반Push/원격일치, Production **dpl_3ELZgjVC7cirBbATMnakK4fti9Cb** 동일SHA, Actions **38449686643 quality/production success**. 같은SHA 원본3개의실제OpenAI 재분석은 분류3/3·근거72/80·연결3·확정일치18/불일치0·잠정7/확인필요4/정보부족23·삼각3검사로개선됐다. 이 수치는후속소스의검증성공을뜻하지않는다.
- 실제응답에서 분리포장헤더단위2건, 빈컨테이너placeholder가실제Manifest화물근거를가리는문제, 복합합계셀의상품수량미추출을추가진단했다. 기존응답을비공개로무료재ground하며분리헤더를실제셀에연결하고, 실재화물행의CN/Seal을같은cargo ID로비교한다. 빈placeholder나전체AI배열을임의원문검증성공으로승격하지않는다.
- Manifest cargo HS/명시된수량필드를확장했다. 이전wire/문서snapshot은nullable missing기본값으로호환하고 공급자strict schema v34는모든객체키를요구한다. 총수량은명시root 또는완전한native단일품목을그본래item ID로비교하며범위를구분한다. 미확인범위의숫자차이는잠정으로보호한다. 상품규격숫자는품명정규화에서보존한다.
- 실제구획표는원문표범위밖노트로연장하지않고 장식용단일테두리의기존텍스트표검증은유지한다. Title수직분리·Master반례, 다른행/단위·Mixedcount, 구형schema, empty/cargo출처·부분범위의회귀추가. 현재후속소스단위437개통과관측이며 최종ship 전체50브라우저/빌드/worker와추가Production원본·오류검증을다시확인한다.
- UI에서비교대상값과연결식별근거를분리표시하고 guard근거는상세패널에보존한다. 정보없음/근거미확인·표준화CT·부분일치를구분하며모바일표스크롤/고정항목·결과진입상단이동을개선했다. 인쇄표도동일표시계층을사용한다.
- 현재예산 누적7문서/7공급자요청, 알려진비용$0.00778299·미확인예약$0.011764225 유지. 원본SHA변경0·과거예산재사용0·자동retry0. 다음호출은최종Production SHA의원본3문서와필요한독립오류반례로한정한다.
- 추가안전회귀까지 단위 **438/438** 통과. House서비스언급만으로유형확정하지않고실제Carrier/Forwarder 발행라벨과제목/House표시를같은셀·근접열에서검증한다. 수직제목조각과Master제목도독립검사한다. 모델format v34의버전assertion만갱신했으며이전파서/보호회귀는유지한다.
- 동일한기재숫자는검증된HBL의문서기재범위로확인할수있지만, **값이다르고전량범위가미확인이면잠정불일치**를유지한다. 복수신고/부분표시/사용자수정 보호회귀를추가해오탐기준을완화하지않는다. Root수량과완전한단일native품목의본래출처를구분해비교한다. 최종Production검증은아직대기이며실제결과는같은코드SHA의증거브랜치에기록한다.

- 후속 main **6700bf2e93f9c6ed5475c4e278fb73e6339c9323**: ship 438단위/50브라우저와 npmci/type/lint/build/worker 통과, 일반Push/원격동일, Production dpl_FNyzwSAfvzB8gDAsowic1M6JgAFZ 동일SHA. 실제원본3개 분류3/3·근거83/97이지만 회사명+주소와 회사명만의 표기차이가 당사자충돌로 처리되어 연결2/3·삼각보류였다. 이를 최종완료로보고하지않는다.
- 회사명 정규화는 검증된 원문 회사명 행과 주소행을 구분한다. 별도 주소를 제거할 때 완결된 회사법인명 접미사/행/실제블록을 요구하고 모호한 줄바꿈·한영명 차이·양쪽 주소충돌은 보류한다. 다른 실제 회사명은 계속 충돌 경고·수치확정보호한다. 표시값·원본인용은 변경하지않고 정규화 근거를 별도로표시한다.
- 실제6700응답 무료재계산에서 연결3/3·삼각3검사·확정일치28/불일치0, 잠정16/정보부족27. 새소스의 실제OpenAI 호출 성공과는 구분한다. 독립 nativePDF 회사명/주소 및 실제다른당사자 회귀를추가해 전체440/440단위통과. 최종ship 전체50브라우저와 새SHA 실제원본·오류반례는 아직대기다.
- 같은6700 독립합성 오류2문서 실제분석에서 분류2/2·근거56/56·확정불일치5건(포장/중량/Seal 및 관련행중복검사)·연결1을확인했다. 중복검사수를 서로다른오류정확도로 주장하지않는다. 이번예산 누적12문서시도/12공급자요청, 알려진추정비용$0.015916305·미확인예약$0.011764225 유지. 초기45초타임아웃1건을숨기지않고 자동재시도0, 과거ledger재사용0.


## PHASE 3.5 — 2026-10-14
- 시작 main/origin e4e2745b0fb599c7cf43ea71b38296b08c0e8358 일치·깨끗한작업트리. PHASE34 증거브랜치/원본PDF3개/비공개응답 접근을확인했다. 이전예산기록변경없음. 사용자신규$0.50/60문서/75공급자요청승인을확인하고별도ledger정책을작성했다.
- 원인C/D: AI가HBL200/1920을올바른품목행에추출했고원문까지검증됐으나root전용비교·계약전량full조건으로삼각합계가보류됐다. 이미native전체행커버리지가있어HBL기재화물범위로연결할수있다. 동일물리정보의원본검사를반복업무오류로세고, ED고유순중량등을대조누락으로세는문제도분리한다.
- ShipmentFact는원본/단위/표준값/HBL/문서종류/행ID/native범위증명/계산구성/수정출처/원인코드를보존한다. 실PDF표전체행·native벡터셀·유일HBL·동일단위·독립품목/컨테이너의경우만행연결/합산한다. 원본root값은채우지않으며partial/공동포장/중복/부분표/OCR/수정/복수신고배분은보호한다.
- 무료PHASE34 최종응답재생(새유료성공아님)에서원본3종 포장/총중량/상품수량의canonical삼각정합성이확정일치로복구됐다. 원본checks는71개그대로유지하고primary판정/적용불가/근거실패를분리한다. 이미얻은AI응답으로TS를무료조정했다.
- 기존440/440단위유지 확인. 신규19범위회귀 초기18통과/1실패는두번째컨테이너의CTNS데이터셀을새헤더로오인한일반레이아웃문제였다. 실제정렬헤더가있으면반복단위셀로표를재시작하지않도록수정뒤19/19통과. 최종전체검사/브라우저/빌드/실API는아직대기다.

- 단위472/472(기존440+새범위28+새예산4), typecheck/lint/Productionbuild/worker 통과 관측. 브라우저첫53/54의1실패는원본검사표식과primary표식혼합으로원본삼각3검사를13개로센문제였다. 원본표식을관련비교행에별도보존하고필터까지분리한뒤54/54전체통과. 기존정확성assertion은유지했고security의현재phase버전만3.5로갱신했다.
- UI디자인은유지하면서독립KPI·대조대상없음필터/중립표시·구성행/단일행연결·사유코드·원본진단상세·인쇄의집계기준을연결했다. root또는자식수정이원본복제행에가려지지않고free계산의잠정값에반영되며원본복원후회복한다.
- PHASE35 live정책은$0.50/60문서/75요청이며before/after 정확SHA·최악입출력예약·공유ledger/원격증거복원·배타잠금·타임아웃미확인예약·자동재시도0을적용한다. 기존34도동일공통전송모듈을사용하되승인상한.15/30/40을그대로유지한다. 신규유료0회현재. 먼저최종게이트/배포뒤원본3세트반복과독립오류/범위사례를평가한다.
- 최초3.5 main 9b0a1dc는472단위/54브라우저·Actions quality/production·공식Production 동일SHA를 통과했다. 실제원본은HBL 두차례45초타임아웃, 별도수동요청에서는약13초성공; ED/MF도성공했다. 성공문서만합친한세트에서분류3/3·관계3/3·핵심9/9확정일치, 독립일치11/불일치0/확인필요5/N/A14/근거미확인11. 세번반복성공으로주장하지않는다.
- 신규예산누적6문서/6요청, 확인비용$0.00453277·미확인예약$0.0269698 유지. 입력에서원문text가블록내용과완전히같을때만중복text를생략한다. 블록ID/모든문자/좌표/행/페이지/셀경계는보존하고추가문자·OCR·plain-text입력은원문을유지한다. 독립검증기의전체PDF데이터와45초/105초제한은변경하지않는다. 새SHA전체검사·실API반복은아직대기다.
- 공통live의원격예산fetch대상은각phase증거브랜치와일치하도록수정했다. 다른phase원격기록을덮어쓰지않으며예산복원을fail-closed로유지한다.
- cf168f9 main/Production 동일SHA·Actions quality/production성공·475단위/54브라우저통과. 실제독립정상3세트API9/9성공·분류9/9, 핵심9/9는1세트·7/9는2세트. 뒤2세트HBL통합CN/Seal열에서containerNumber:null·Seal실제값은맞지만행연결근거미확인. 근거기준을완화하지않고통합헤더+각자값의독립인용지시를보강한다. 기존원본에만맞춘좌표/식별자하드코딩없음.
- 누적15문서/15요청·측정$0.01572792·기존45초타임아웃2건미확인예약$0.0269698 유지. 새소스의반복/오류/복잡사례는다시검증한다. 이전1/3을안정성완료로보고하지않는다.
- fdd6ad1의원본3세트실제분석은API9/9·분류9/9·관계각3건·핵심9/9세트3/3일관적이었다. 그러나1세트에서한글만추출된품명을영문canonical빈문자열로취급해품명/HS소유행을잘못비교한오탐2건을발견했다. 빈canonical은품명일치/불일치의증거가아니므로실제원문필드보존+SCOPE_UNRESOLVED로보호한다. 서로다른한글품명의빈문자열동일성오탐도막는독립PDF회귀2개추가.
- 실제3세트응답무료재계산은각각독립불일치0건·핵심9/9유지였다. 이는새Production의유료성공으로주장하지않는다. normal live는보조오탐1건이라도발견하면다음반복을중단하도록보강했다. 새게이트/동일SHA실제반복·오류·복잡검증후최종보고한다.
- 6de65c8 실제정상3세트분류9/9·오탐0, 핵심확정9/7/9. Manifest항구2필드의추출값-원문불일치가한세트에서잠정으로보호됐다. 최종공식UI 1440/390px 실제응답재생으로원문블록/수정복원/인쇄/overflow없음 확인·추가공급자호출0. Actions quality/production성공·공식사이트동일SHA.
- 독립오류5종 실제TP5/FP0/FN0, HBL충돌확정보호, 여러품목/여러컨테이너수량·포장·중량확정일치, 부분선적은잠정차이 유지. 복수신고에서는전체HBL집합과개별신고부분집합을같게요구해참조/품명/HS 오탐6건발견. 명시전체신고목록의단일번호포함검사와전체품목대조를분리하고부분품명/HS는DECLARATION_SCOPE_UNRESOLVED로보호했다. 전체독립품목집계는기존결정적declarationGroupChecks를보존한다.
- 공유컨테이너합성생성은quantityUnit열이842pt페이지밖으로넘쳐API호출전에중단됐다. 테스트PDF폭을실제표끝에맞춰산출하며원본PDF는변경하지않는다. 새회귀3개/대상33개통과, 실제응답무료재계산은복수신고오탐0·기존5오류탐지유지. 누적48문서/48요청·알려진비용$0.05049756·미확인예약$0.0269698 유지, 남은12문서에서새SHA정상3·복수신고3·공유/부분표/내부충돌각2문서를검증한다. 이전SHA결과와새SHA검증을분리하고예산상한을초과하지않는다.
- 0b18d1d 실제정상3문서API/분류3/3·핵심8/9·오탐0. Manifest가수량을품목에누락하고근거미확인추가필드에배치하여quantity만EVIDENCE_UNVERIFIED/SCOPE_UNRESOLVED잠정일치. 근거가없는값을승인하지않는다. 실제복수신고3문서분류3/3·확정오탐0·목록포함일치, 원본다중신고집계보존. 최종전체정상화완료로보고하지않는다.
- 공유컨테이너생성의추가원인은baseContainer.name빈문자열이baseRow.name을덮어써없는PDF빈블록인용을만든것이었다. 검증용생성시상품명을명시적으로유지한다. 이변경은테스트CLI만이며Production분석엔진변경없음. 누적54/54·알려진$0.05524141·예약$0.0269698유지; 남은6개로공유/부분표/내부충돌각2개를최종SHA에서검증한다. 새SHA정상세트반복은상한때문에추가미실행이며실제0b18추출+최종동일엔진무료재생과구분한다.

### PHASE 3.6 — 2026-10-14 구현 및 무료 검증
- 시작 main/origin8a79d4f, 기존 코드/과거 예산 보존. onboarding setup 적용, npmci 완료, Node24/Chromium 확인. 로컬 OpenAI/Gemini 키는 미설정(값 출력 없음). 실제 검증은 배포 후 별도 Production 경로에서만 수행한다.
- PHASE35 실제 실패 응답을 원본3PDF 해시 확인 후 무료 재생했다. Manifest 수량 누락과 원문 대신 정규화 항구값/인접 주소 인용을 재현했다. 새 native 복구로 두 실패 세트 모두 핵심9/9가 됐다. 이전 실제 응답 재생을 새 OpenAI 성공으로 주장하지 않는다.
- original/최초 검증 보존·별도 recovery/current·2단계 owner 재평가·native 행/셀/라벨/count-unit 검색·independent verifier·coverage/Fact 재계산. 실제 혼합 CTN/PCS 요약은 문서 기재 총 물품수로만 복구하며 품목 수량으로 복사하지 않는다. 여러 역할 footer/항구 옆 주소/다른 컨테이너·HBL·행/페이지/OCR·중복 숫자/누락행/사용자수정/부분선적 보호.
- 제한된 strict targeted 후보1536 출력/문서당1회/자동재시도0/시간보류·추가usage 기록·실패 시 최초/native 유지. 자동 Production 추가요청은 기본false. 명시적 bounded /api/recover는 검증된 후보만 반환하며 전체분석 성공을 대신하지 않는다.
- 기존482개 유지, 첫502개 및 강화 후520개 전체단위 통과. 마지막 단위 헤더 복구 회귀까지 대상30개 통과; 최종 예상521개는 ship에서 전부 다시 검사한다. 기존54브라우저 보존, 새2개1440/390px 복구이력·무료수정복원 통과; 최종전체56개는 ship 검사 전. 초기 새 브라우저2개 실패는 잘못된 셀렉터를 실제 항목명에 맞춰 수정한 뒤 통과했다. 초기 route모의1실패는 beforeEach가 mock함수를 cleanup으로 반환한 테스트 오류를 수정한 뒤 통과했다. 기존 검증조건 완화/삭제 없음.
- Next개발서버 정상실행·무료prepare200/1문서/1페이지/aiCalledfalse 확인. 별도$0.50/60문서/75요청 ledger 도구·사전 비용예약·미확인usage 유지·원격증거복원·정상5회 A/B/C/복잡/오류/열순서 변경 PDF 검증 경로 구현. 새 실API 호출은 이 기록 시점0회이며 이후 결과는 validation/phase36-evidence에 저장한다.
- 최종ship/Actions/Production 같은SHA와 실제 정상5회·오류·복잡·선택적 추가AI 효용은 아직 미검증이다. 완료로 주장하지 않는다.
- 첫 ship에서521단위/type/build/기존analyze worker는 통과했으나 개발서버 잔존 포트 때문에 브라우저 검사 전 중단됐다. 커밋/Push 없음. 새 recover route의 worker trace 누락도 추가 확인하여 tracing과 runtime검사에 두 PDF경로를 포함하고, 소유 서버 중지·린트 경고 제거 후 전체ship을 재실행한다.
- f9a7e096dd1587b0a91166ff784cf9434909e08e에서 npmci/type/lint/521단위/56브라우저/build 및 analyze+recover worker 전체ship 통과·GitHubmainPush/공식Production 동일SHA/키설정/자동targetedfalse 확인. 새 실API 첫정상3문서 분류3/3·핵심9/9·정답근거20/20, 기본3요청/알려진$0.00540963/자동재시도0. 단, native cargo HS에 인용 라벨까지 포함한 값이 승인되어 보조HS 확정오탐1을 발견해 다음 반복을 중단했다.
- 원인: '(HS ...)' 인용 전체는 원문에 있지만 세번 값은 라벨을 제외해야 한다. native 후보에서 명시HS 라벨만 분리하고 독립 검증기에서도 숫자 세번 문법을 검증하도록 수정했다. 같은 실제응답 무료재생은 핵심9/9·확정오탐0이며 실제 HS6자리 차이 탐지 회귀도 추가했다. 과거3문서/비용은 같은 별도36ledger에 유지, 실제5회는 새최종SHA에서 다시 검증한다. 유료 검증 실패를 숨기거나 이전SHA 관측을 최신성공으로 합치지 않는다.

## PHASE 3.7 — 구현 및 무료 평가 (2026-10-15 KST)
- 시작 main/origin: fd6fa5217da7a872ebeda8a66ba3de9e823689ee. 기존 변경 없음. PHASE36 예산 및 evidence 브랜치는 보존했다. 설치 npm ci 성공, 기존 단위524개 기준선 통과.
- 별도 생성 PDF Development 30선적/93문서: 정상10·오류10·복잡5·불확실5, 10상품군, 영/한/혼용, 카드·텍스트 원장·역순 열·2열 폼·반복 헤더/이어지는 페이지·헤더 단위 양식. 회사/상품/항구/품목 및 컨테이너 구성도 변화시켰다. 고객 원본 복사·번호 변경으로 독립 사례를 늘리지 않았다.
- 동일 fixture의 원래 PHASE36 코드 무료 기준선은 docs/validation/phase37-free-baseline.json. 평가 전용 ignored 소스 스냅샷에서 실행했고 제품 코드/GT를 모델에 제공하지 않았다. 원문 검증률1739/2292(75.87%), 확정 오류TP5/FP1/FN3, 참조 오류 포함 경고10/10, 관계TP39/기대92/FP0. 이 수치는 oracle 추출 후보+실제 PDF 검증이며 실제 OpenAI 성능이 아니다.
- 수정: Unicode 보존과 명시 한영 품목/재질/규격/모델 해석(미지원은 잠정), 한영 병기 동일 라벨/House 한글 제목, native 구조 힌트, 출처/버전/라이선스가 있는 제한 UN/LOCODE 데이터, 잘못된 컨테이너 간 Seal 비교 보호, 누락된 명시 참조의 독립 native 복구, 검증된 신고 참조 및 의미 품목 대응 집계.
- 결과 모델에 업무 문제 원인/선적/개체/관련 검사/근거/후속 조치를 추가했다. 우선 확인 기본값, 필수정보 부족 표시, 전체 검사/상세/원문/수정/인쇄 보존. 기존 PHASE35/36 브라우저 상세 검사는 명시적으로 전체 필터를 연다.
- Blind Holdout 8선적은 구현 평가 전 별도 로컬 manifest로 동결했다. SHA256 527d317209a8d990672ccc38f8a789035f8eabb6c0871a842ac83bde6061047d. 개발 조정에 사용하지 않았으며 최종 소스 SHA 유료 평가까지 보류한다. Holdout도 합성 및 동일 생성 양식 계열이므로 실제 고객 문서 일반화/완전한 범용 번역을 입증하지 않는다.
- 새 live-phase37 상한 $0.50/120문서/150요청/자동 재시도0, SHA 공용 누적 ledger/원격 evidence 복원, 미확인 사용량 예약 유지, 개발 단계 최종 평가 예비비$0.10 구현. 이 기록 시 유료 PHASE37 호출0. 실제 평가 결과는 validation/phase37-evidence에 후속 보존한다.
- 제한: 제한 사전 밖 번역/모호한 속성, 미명시 중복 품목 배분, 헤더 없는 이어지는 표, OCR을 native 증명으로 확정하지 않는다. 전체 신고 합계가 검증되어도 개별 신고와 HBL 전량의 보류 진단이 함께 남을 수 있다. UI 숨김을 엔진 정확도 향상으로 집계하지 않는다. 최종 테스트·Actions·배포·실제 API 결과는 검증 후 별도 보고한다.
- 배포 전 추가 검토로 서로 다른 상품의 동일 HS를 HS번호 오류로 오판하지 않도록 상품 소속 대응을 보호했다. 괄호 속 문자 모델/사이즈도 삭제하지 않는다. 관련 단위133개가 통과했다. 필드 없는 필수정보 문제에도 문서 ID를 보존하고 상세 수정 화면을 연결했다.
- 최초 개발 브라우저 실행은 새 기본 필터에 적응 전 기존 검사5개 실패(53통과). 전체 보기 명시 후 7/8통과했고, 수정 후 상세 패널 ID가 바뀌던 나머지 회귀를 수정해 해당 검사도 통과했다. 새 화면4개 개별 실행 중 cold dev/동시 PDF 평가에서 첫 검사30초 timeout1건, 나머지3개 통과. Production 서버의 최종 전체 ship 검사 결과로 배포 여부를 판단한다. 검사 실패 상태를 강제 배포하지 않는다.
- 실제 평가 산출물은 원래 AI 후보와 native 복구 후의 고정 정답 필드 재현율을 분리한다. 누락값을 빼서 검증률을 올리지 않도록 실제 PDF의 누락된 품목 행도 gold 분모에 보존한다. 선적별 정상/오류/관계/집계/문제 수와 사용량/처리 시간을 함께 기록한다.

### 최초 배포·실제 호출에서 발견한 결함과 수정
- 726c4aa1e8f5000fc15165805a33be86044f7b3b: 로컬 단위591/브라우저60 및 빌드/worker 통과, main Push·Production SHA·GitHub Actions quality/production 성공 확인. 실제 신규 영/한/혼용 3선적9문서9요청, 추정$0.008855410000000001, 미확인비용0. 각 선적의 고정 gold68필드 모두 값/원문 대조68/68이었다.
- 그러나 한국어 House Manifest 1문서는 실제 제목을 인용하면서 유형을 House B/L로 잘못 반환했다. 최초 후보 분류는8/9이며 정상 선적1건의 불필요한 경고25개를 발견했다. 필드100%를 전체 분석 성공으로 간주하지 않았다. 이 실패를 보존하고 유료 추가 호출을 중단했다.
- 인용된 명시적 native 제목과 후보 유형의 충돌만 독립 재검증·복구하도록 구현했다. 최초 분류 original/status/source를 보존하고 current/recovery를 분리하며 실제 유형으로 필드를 구성한다. 누락/위조 인용·unknown·OCR·혼합 제목·Master/일반 B/L은 자동 승인하지 않는다. 한국어 제목 의미도 추출 지침에 명시했다.
- 동일 실제 응답의 무료 재계산: 유형 확인2/3→3/3, 업무 문제25→0. 실제 OpenAI 재호출 성공을 의미하지 않는다. 복구 유형은 AI 분류와 구분해 '원문 제목 판독' 및 최초 AI 이력을 표시한다.
- 유형이 미확인인 후보를 확정 HBL 중복/복수 신고로 세어 정상 문서 쌍을 보류시키던 조건을 분리했다. 명시적인 참조 충돌/신고 포함 보류 원인의 관련 검사만 업무 문제로 통합하며 다른 수치·품목의 오류와 모든 검사·근거는 보존한다. 문제 상세에서는 관련 검사 전체를 확인·수정할 수 있다.
- 추가 분류/격리/문제 통합 단위9개 통과. 기존 분류 위조·unknown 반례를 유지했다. 실제 실패 구조의 로컬 브라우저 회귀도 통과했다. 수정 후 전체 ship 및 새로운 동일 SHA 실제 재검증은 이어서 수행한다. ledger는9/9/$0.00885541 그대로 누적하며 새 SHA에서 초기화하지 않는다.
- gold의 물리 필드 중복 제거는 행 해석 결과가 아닌 실제 블록 인용/역할/값 기준이다. 무료 전후 동일 gold분모2163개, 정확한 위치·근거 검증1613→2159개. 나머지4개는 의도적으로 추출을 누락한 품목 행이며 경고를 유지한다. 값만 재현한 수치와 정확한 행 근거 재현율을 구분한다.

### PHASE 3.7 복수 신고 범위 복구
- b38f30f에서 누적71문서/71요청/추정$0.069969205, 미확인요청0·자동재시도0. 정상5·오류10·복잡5선적을 실제 분석했으며 확정오류8/8·참조경고2/2·확정FP0. 원본 과거 실패 및 71개 누적예산을 validation/phase37-evidence(3734dbe)에 보존했다.
- 실제 복수 신고는 전체 신고목록·102개 gold필드·품목 합계가 모두 검증됐지만 전체HBL 대 개별신고 비교가 보류 문제37개를 만들었다. 완전한 native 행·유일품목·전체 HS·명시신고집합·같은단위를 입증한 결정적 집계에 declarationCoverage를 연결했다. 전체-부분의 수량/품명/HS 비교는 적용범위를 명시하고 기존 품목별/집계 검사로 대체한다. 원본 checks/근거는 삭제하지 않는다.
- Manifest는 원문 HBL 연결과 전체 품목별 품명/HS/수량/단위의 정확한 일대일 대응까지 확인된 경우만 전체 범위로 연결한다. 미분류/부분/공동포장/선적범위 사용자수정/미확인값은 보호한다. 같은 집계의 포장·중량 배분 보류만 하나의 업무 문제로 통합하며 실제 값 차이는 별도 유지한다.
- 같은 실제 응답 무료 재계산에서37→1(포장·중량 배분 확인 유지), 기존 확정오류8종 보존. 경고 감소 자체를 AI 정확도 향상으로 집계하지 않는다. 새로운 OpenAI 호출 성공은 아직 아니며 최종 새SHA에서 정상3·수량오류3·복수신고4·불확실6·Holdout25·반복3개 문서를 남은49개 한도 안에서 수행할 계획이다.
- 새 단위6개 통과. 초기2실패는 복합 합성 사례에서 오류값을 변형 전에 적용해 사라지던 fixture 순서를 수정하고, 선적범위 사용자수정의 보호 조건을 추가해 해결했다. 기존 개별 정상/오류/복잡 PDF bytes는 변하지 않는다. 모바일 집계/전체검사/근거 브라우저 회귀를 추가했다. 최종 ship/유료 평가 전이며 성공을 선행 주장하지 않는다.

## PHASE 3.8 — STAGE A (2026-10-16 KST)
- main/origin231de96, 로컬변경없음 확인·기존코드/기록 보존. 첨부지시문전체읽음. 원본3PDF 확보·비공개 /workspace/private-phase38에보관(공개커밋금지). 기존37ledger115/115/$0.10917903은그대로이며 신규유료승인없음·새공급자호출0.
- 실제Set2 HBL의Bill/of/Lading·Carrier/Forwarder·House/B/L/Ocean/Freight와표헤더/단위가단어별블록이다. 기존검증기는House표시를단일블록으로만검색하고Gross/Weight·No/Kind/of/Packages의분할헤더를연결하지못했다. 명시올바른후보+실제인용 무료baseline은유형미확인·수량/포장/중량과각단위6필드미확인(품명1개확인). 실제당시AI응답은없으므로사용자보고32문제를동일재현했다고하지않는다.
- 원본ID를바꾸지않는physical-spans와닫힌셀/행기반헤더연결,실제발행셀House제목복합증거를구현. 같은후보의원본유형과7필드모두원문확인. 다른셀/다른행/미지원Master/일반제목 보호. 실제PDF.js단어분할을유발하는독립합성다중폰트fixture·다른배율·잘못된필드단위·원본보존복구회귀추가.
- 유형이실제로미확인인문서도native필드증거를수집하되분류/관계확정은유지보류한다. 기존명시지원중단스냅샷은수정하지않는다. 관련75개및추가포함41개선택회귀통과. 새fixture초기실패는누락된후보를확정으로가정한테스트와PDF.js가단어를다시합친생성기문제를수정해해결(기존606검증삭제/완화없음).
- 다음: 의미/원인관계경고·결과/보고서UI·독립PDF오류·전체회귀/배포. 현재새실제AI추출성공미검증. 코드전체검사전Production에반영하지않는다.

- STAGE A 체크포인트: 현재 관련 5파일 90/90 통과(신규9 포함), TypeScript 통과. 새 다중 PDF 통합 검사는 실제 PDF 생성·복구를 포함해 기존 5초보다 긴 15초 명시 예산을 사용한다. 판정 조건은 유지했다. 셀 헤더는 원문/좌표 서명을 포함한 캐시로 반복 계산을 줄여 90개 전체 28.39초. 이후 B/C 수정은 별도 진행 중이며 아직 Production Push 없음.

### PHASE 3.8 STAGE B 체크포인트
- 원인ID→영향필드→비교→원본검사의 관련성을 추가했다. 분류 실패와 독립 필드 실패를 합치지 않으며 확정 불일치를 근거 부족 통합에서 제외한다. 누락값과 근거 실패를 구분하고 원본 checks를 모두 보존한다.
- 현재 미확인/복구를 최초 AI 진단과 분리했다. 지원하지 않는 번역은 보류하며 공통 품목군의 규격 부족은 조건부 일치로 구분한다. HS 숫자가 같아도 품목 소속이 미확인이라면 확정하지 않는다.
- 실제 내용을 변경한 독립 PDF 검사에서 Manifest의 품명 전체 범위를 빈 items만으로 검사하던 원인을 발견했다. items가 없는 Manifest는 독립 확인된 cargoRecords 범위를 사용한다. 부분/중복/누락 보호는 유지한다.
- PDF 재추출을 포함한 중량/상품 수량/Seal/HS/품명/다른 HBL 6사례와 원인/원본 보존/수정/원문 숫자 표기 4사례, 총10/10 및 타입 검사 통과. 새 유료 API0회.
- STAGE A 커밋837668f, B 커밋ac7d6f4는 로컬 체크포인트이며 아직 main Push/Production 반영 전이다. 전체 검사 후 ship으로 함께 보존한다.

### PHASE 3.8 STAGE C / 독립 확인 진행
- 기본 화면에서 대표 문제와 관련 검사 수/영향 항목을 표시하고, 반복되는 파생 비교는 문제당 대표 행으로 줄였다. 전체 필터/상세 패널에 모든 판정·원본 검사·수정/복원을 유지한다. 원문 인용의 숫자 쉼표/소수 자릿수와 같은 소유 단위를 함께 표시한다.
- 현재 근거 미확인/최초 AI 미확인/복구를 분리하며 미확인이 남으면 검토 미완료를 명시한다. 모바일은 같은 비교 DOM을 세로 카드로 배치하며 데스크톱 표를 유지한다. 인쇄는 대상/완료여부/대표문제/비교표/압축 원본검사/한계를 포함한다.
- 625단위/36파일 및 Production 빌드 통과(새 독립 3서류 상품 충돌 반례 추가 전). 3번째 문서의 규격 보류가 나머지 2서류의 입증된 상품 충돌을 가리는 결함도 재현해 유일한 전체 화물행/검증된 양자 관계에 한정한 독립 판정을 추가했다. 부분/미검증/다른HBL 보호 포함 선택13/13 통과.
- 이전 PHASE37 최종SHA의 실제 응답 14선적/44문서를 무료 재계산: 분류44/44, 원문1082/1090, 오류4TP/0FP/0FN, 정상6선적의 불필요 보류0. 새 AI 추출이 아니며 현재 엔진 재계산만 수행했다. 이전 원본 2개 응답 세트의 수치/참조/컨테이너/Seal/항구 회귀도 보존하며 품명·HS 소속은 보류를 유지한다.
- 실제 첨부 Manifest PDF 스트림의 중량/수량/Seal/HBL/HS 5오류 변형을 비공개 생성했다. 덧씌우기 없이 원본 텍스트를 대체하고 PDF.js 재추출로 새 값 존재/종전 문자열 제거를 5/5 확인했다. 무료 원문 수정 검증이며 AI 추출 성능이 아니다.
- 신규 실제 호출은 여전히0. 요청한 별도8문서/8요청/$0.10 승인 대기. 첨부 원본/변형 PDF·전문·raw 응답은 공개하지 않는다.
- Set2 동일 원본/올바른 후보20필드의 확장 무료 평가: 기존231de96 clean archive 유형2/3·숫자/단위14/20 → 수정 코드 유형3/3·20/20. 최초AI/전체판정 성공률이 아닌 원문 검증기 비교다. 같은 셀의 여러 수치 행 중 한 행을 문서 총량으로 승인하지 않는 회귀도 통과했다. 마지막 선택76/76·타입검사 통과.
- STAGE C 기록 및 유료0회 상태를 보존한다. 기본3슬롯·배치·기존UI동작·전체검사·보고서 단일 비교표 계약을 유지한다. 새 유료 러너는 승인 플래그와 별도ledger를 요구하며 승인 전 실행하지 않았다. 실제 오류 변형은 Set2 Manifest 자체 내용에 독립 오류를 넣은5파일이며 새 독립 양식으로 세지 않는다.
- 최종 ship 첫 실행은 npm ci/type/lint 및 단위629/629까지 통과했으나, 배포 전 코드 검토에서 독립 상품 충돌 보완 경로가 개별 신고의 부분 품목 범위를 혼동할 여지를 발견해 자체 중단했다(원격 Push0). 보완 경로는 전체 원문 범위가 검증된 HBL–Manifest 양자에 한정하고, 기존 수출신고/복수신고 판정은 그대로 둔다. 새 실제 PDF 신고 반례 후 최종 전체 ship을 다시 실행한다.
- c59173f는 전체630단위/64브라우저·빌드/worker/Actions quality·production·Vercel Git상태성공과공식Production SHA일치까지확인했다. 실제첨부PDF3개원문보기는2배치/226·92·67블록/모바일·데스크톱으로무료통과(공급자0). 별도Vercel관리API는403으로Ready직접조회불가. 초기무료브라우저스크립트가prepare에서없는비교패널을기대한선택자오류를수정했고실제앱오류는아니었다.
- 최종문제구조검토에서추가확인:같은HBL·같은검증된유일품목소유자·같은전체HS원문·명시충돌없는부분품명의미만보류원인인경우,품명과HS소속의존보류를동일원인으로연결한다. 다른HS·독립수량/Seal/품명충돌·복수/미확인소유자는합치지않는다. 원본/독립검사및상태를변경하지않고대표문제와의존관계를보존한다. 실제HS충돌보호포함선택20/20통과. 이보완도전체ship/동일SHA를다시검증한다. 신규유료승인은계속대기·공급자0회.

## PHASE 3.8.1 — engine-only checkpoint (2026-10-16 UTC)
- 시작 main/origin/main=f174b41fc680fc93cfa371cc7a777df19c9e796b, clean. PHASE38 최종 기록은 validation/phase38-evidence/bbc00f9에 보존되어 있으며 재구현하지 않았다. UI/UX/보고서 파일 변경 없음.
- 실제 Set2 HBL native 파싱은 250과 CARTONS를 각각 정확히 보존했다. 사용자 보고 251의 최초 OpenAI 응답은 저장되어 있지 않아 최초 생성 원인은 확인 불가다. 251을 주입한 별도 무료 재현에서 기존 Native Recovery 실패는 확인했다: 닫힌 용적 셀의 수치가 다른 셀의 포장 라벨에 연결되어 서로 다른 두 후보로 판정됐다. 원본 f174b41 archive와 수정본을 같은 PDF/후보로 비교했다.
- shipping 전용 label fallback을 실제 vector-cell 경계로 제한했다. 같은 원문 재현에서 251 original/unverified를 보존하고 정확한 포장 셀의 250만 current/native/verified로 복구했다. 숫자 다수결·다른 문서 값 복사·전역 동일 숫자 승인은 추가하지 않았다.
- 혼합 화물 설명 전체를 복구 대상에서 제외하던 조건을 제거했다. 검증된 goods 셀의 원문 전체는 보존하고, 서로 다른 물품/포장 단위가 명시된 두 suffix만 비교용 화물 주석으로 분리했다. 모델·용량·규격과 모호한 단일 수량 suffix는 삭제하지 않는다. 기존 goodsEquivalent의 partial 계약도 유지했다.
- 동일 native 품목 셀/행의 한영 2줄에 한해 원문 block ID를 가진 goodsContext를 별도 보존한다. 다른 행/셀/문서/원문에 없는 block/OCR은 연결하지 않는다. 비교용 설명은 original/current 원문값과 분리하며 사용자 수정·명시 속성 충돌·미지원 설명은 자동 병합하지 않는다. Set2 신고필증의 실제 한영 원문 2개 연결, 750mL 누락은 partial, 명시 900mL 충돌은 different. Manifest의 실제 STAINLESS STEEL / VACUUM FLASKS 두 줄도 연결하되 다른 문서에서 문구를 복사하지 않는다.
- 무료 Set2 올바른 후보 검사: 유형3/3·수치/단위20/20 유지, 실제 3문서 oracle 비교 확정 오탐0. 이는 AI 추출 성공률이 아니다. 실제 Manifest의 포장 원문을 변경한 비공개 PDF에서 변경값249를 native 검증하고250으로 되돌리지 않았다. 불완전한 범위의 비교는 provisional_mismatch로 보호한다.
- 독립 합성 PDF 실제 내용을 바꾼 포장/물품수량/총중량/Seal/HS/품명6종은 confirmed TP6/FP0/FN0, 정상 FP0. HBL 참조 충돌은 기존 독립 관계 경고 회귀를 유지한다.
- PHASE37 개발30사례/93문서: 원문필드2292/2292, 오류8 TP/FP0/FN0 + 참조 경고2, 정상10사례 core hold0, 관계88/92. 과거 실제 응답14사례44문서 무료 재계산: 원문1082/1090, 오류4 TP/FP0/FN0, 관계44/46. PHASE36 이전 원본 실제 응답2세트 재생은 핵심9/9 유지; 품명/HS 부분 의미와 미지원 native 필드는 그대로 보류한다. 새 OpenAI 호출과 구분한다.
- 추가14단위 검사 단독14/14 통과(6.63초). 이후 Manifest 실제 두 줄 품명을 별도 후보로 나누는 native 복구 문제를 추가 발견해 배포 전 첫 ship을 중단했다(커밋/Push 없음). 같은 닫힌 셀의 연속된 설명 문단을 실제 원본 ID로 재구성하되 명시 상품 속성 충돌·다른 역할·다른 문단은 합치지 않는2개 회귀를 추가했다. 중간 전체 검사는 이전 변경 snapshot에서642/642 통과. 한 번의 병렬 PDF 평가 중 신규13검사에서3 timeout 발생했고, 단독 재실행14/14로 해소했다. 최종 frozen stage의 npm ci/type/lint/전체647이상/브라우저64/build/PDF workers는 ship에서 검증 예정이며 아직 성공을 선행 주장하지 않는다.
- 유료 문서/공급자 요청/비용 모두0. 새 PHASE38/381 ledger 없음. 기존 PHASE37 ledger115문서115요청/$0.10917903은 변경하지 않았다. 이전8문서 예산 제안은 승인되지 않았으며 실행하지 않는다. 최초 AI 재분석·새 E2E 정확도는 미검증.
- 다음: final ship(main 일반Push) → Actions quality/production → 공개 Production 정확SHA → 최종 sanitized 증거를 validation/phase381-evidence 별도 브랜치에 저장. 원본 PDF/원문/응답/키는 공개 Git에서 제외한다.

- 추가 줄바꿈 복구를 포함한 선택26검사(신규16+기존38단계10) 모두 통과. 실제 Set2 Manifest 동일 missing 후보는 f174b41에서 분리 후보2개/복구 실패, 수정본에서는 전체 품명 후보1개/원본2블록 native 검증으로 복구했다. 첫 ship은 이 추가 결함을 발견해 검증 도중 안전 중단(exit143, HEAD f174b41 유지)했으며 수정 후 전체 gate를 새로 실행한다.

## PHASE 3.9 — 구현 및 무료 검증 체크포인트 (2026-10-16 Asia/Seoul)
- 기준 main/origin/main 1fadc0be1ae5d3bf3ce3dffe6532e4ff35c02281, 기존647단위/64브라우저 유지 대상. PHASE381 최종 Actions/배포 증거는 validation/phase381-evidence eb344fb에 보존되어 있다.
- 기존 사전은 보조 판정으로 유지하되, 미지원 상품도 원문 검증 및 동일 HBL·정확한 품목행을 확인한 뒤 추가 OpenAI 의미 분석 후보에 포함했다. 같은 문서·다른 HBL·다른 참조 충돌·미검증/수정/OCR 값은 제외한다. 다품목은 정확한 대응/중복 보호, 최대40후보 초과는 명시적 확인 필요다.
- 의미 strict schema, 한영 native 문맥/품목 ID/원문 블록 payload, 원문 인용 재검증, 누락 속성 보호, RAM·모델 등 공통 명시 속성 독립 차이 검사를 추가했다. AI 언어 의견은 잠정, 실제 native 기재 숫자/모델/규격 충돌은 범위 입증 시에만 확정한다. 재질·번역 의견만으로 확정하지 않는다. 기존 확정 수치 오류/원본 checks/최초 AI 값/복구/사용자 수정은 보존한다.
- 전체 업로드 배치 후 semantic 요청을 1회 모아 실행한다. endpoint는 서버 원문 자료 HMAC·2시간 만료·배포SHA·동일Origin·3MiB 스트리밍 상한을 검사한다. 서버 비밀키는 클라이언트에 포함하지 않는다. 원문 보기/편집에는 추가 API0회, 공급자 실패 시 기존 결과를 유지하며 자동 재시도/폴백은 없다. UI DOM/스타일/보고서 디자인은 변경하지 않았다.
- 새로운 ReportLab 한영 PDF 54개/18선적을 직접 추출했고 올바른 후보를 준 native 검사에서54/54 분류·1593/1593 현재 필드 근거 확인. 이는 **최초 AI 추출 정확도가 아니다**. 개발17선적의 oracle+MOCK 의미 평가에서 선적별 결함 의미 기준 before10TP/0FP/2FN → after12TP/0FP/0FN. 두 수치는 실제 AI 성능이 아니며 Holdout의 의미 평가는 하지 않았다. 품목 재질 등 잠정 탐지는 확정TP에 포함하지 않는다.
- 개발 자료는 의자/노트북RAM/기계모델/재질·사이즈 의류/낯선 분리막/역순 복수품목/다른HBL 및 수량·포장·중량·컨테이너·Seal·HBL·HS 오류를 포함한다. 합성 자료이며 실제 고객 일반화 성과를 주장하지 않는다.
- 선택 신규 회귀68개 및 브라우저5개(1440/390px·배치 통합·RAM·공급자 실패·원문모드) 통과. 이후 snapshot key/원본검사 보존 2개 추가; 전체 frozen gate 결과는 검증 후 별도 evidence 브랜치에 기록한다.
- 유료 검증 도구는 별도 live-phase39 ledger/committed archive를 복원하고 호출 전 비용·문서·요청을 예약하며 timeout 미확인 비용을 유지한다. 제안 상한 $10/60문서/120요청은 **미승인**, 신규 실제0문서/0요청/$0. 과거PHASE37 ledger SHA256 90d2b5f39a9a1d646653baca45770bdf173c0bf20922a04d214c13e78af68aa6 유지.
- 승인 후 계획: 실제 Set2 3개 + 개발17종 51개 + 최종동일SHA Set2반복3개/BlindHoldout3개 =60문서, 의미요청 포함 최대80공급자요청. 기대 원문 후보 형태로 계산한 요청 예약 추정합 약$0.824이며, 실제 AI 응답 크기에 따라 예약을 다시 산출하고 세 상한 중 하나라도 소진되면 중단한다. 자동재시도0. 실제 신규 E2E 및 모델의 신규 상품 이해 성공률은 아직 미검증이다.
- 남은 단계: 전체 ship/Actions/Production 동일SHA 확인·Set2 무료 prepare·증거 보존·유료 실증 승인 대기. 미검증 코드를 검사 없이 배포하지 않는다.
- 실제 비공개 Set2의 올바른 HBL 후보를 해당 PDF 원문에서 검증한 무료 oracle 평가: 3문서 품목 후보/2개 의미 비교가 연결되며 MOCK 의미 인용 검증 완료, 확정 오탐0. 다만 HBL의 전체 품목 범위가 native로 충분히 입증되지 않은 goods/HS 보류는 유지한다. 이를 AI 성공이나 전체 필드 해결로 보고하지 않는다. 상품/포장·중량·Seal 등 기존 근거 안전성을 완화하지 않았다.
- 최초 후보 누락 주입 시 실제 Set2 Manifest의 분리된 전체 품명이 native로 복구되고 원본 null 보존. 원문 포장 수를 실제249로 바꾼 반례에서는 이전250 후보를 미검증 처리하고 해당 PDF의249를 복구하며 잠정 차이를 보존(범위 미입증으로 확정하지 않음). 과거PHASE37 14선적/44문서 실제 응답 무료 재생:1082/1090 원문, 오류4TP/0FP/0FN 유지. 이는 신규 AI 추출이 아니다.
- 최종 ship 첫 실행은 신규 status enginePhase/semanticAnalysis 메타데이터가 기존 정확 응답 기대값에 없어 보안 계약 테스트1개가 실패했다. 알려진 실패 이후 해당 ship 프로세스만 중단했으며 Commit/Push0. 기존 비밀 비노출/응답 whitelist 기준은 유지하고 새 공개 메타데이터2개만 정확 기대값에 추가했다. 전체 gate를 처음부터 재실행한다.
- 717단위/Production build/PDF worker 통과 후 브라우저 gate 도중, 의미 분석 429 실패가 내부 safe error에만 남고 기존 결과 설명에는 일반 실패로 표시되는 점을 발견했다. Push 전 해당 ship만 중지하고 안전한 오류 메시지를 판정 설명에 연결했다. 기존 화면/스타일 변경 없이 한도 도달 이유를 표시하며 원본 검사는 유지한다. 회귀1개 추가 후 전체 gate 재실행한다.
- 최종 안전성 검토에서 한 품목행에 여러 모델이 함께 있는 KIT를 AI가 임의로 한 모델씩 골라 인용할 경우 확정 차이로 승격될 수 있는 경계를 추가 재현했다. 공통 라벨은 실제 모델/규격 역할의 일반 라벨로 제한(상품 사전 아님)하고, 인용한 속성값이 해당 원문 소유 범위의 모든 동일 라벨 출현과 일관될 때만 확정 가능하게 했다. 상품 단어를 모델 라벨로 재분류하는 반례와 공백 인용 반례도 보호한다. Push 전 gate를 중지했으며 신규 실제 API0회다.
- 속성 소속 보강 이후 타입 검사 및 의미/독립PDF 선택 회귀48개 통과. 최종 frozen gate 대상은 기존647개를 포함한720단위·69브라우저다. 이 이후 소스 변경 없이 전체 ship을 재실행한다.

## 핵심 엔진 최종 안정화 — 2026-10-18 Asia/Seoul
- Git main/origin a57ffaf10e836f74e2e2cffb1d551d632cc4e678 및 사용자 변경 없음 확인. Set2 원본3개 존재. 로컬키 없음, Production 기존 키 보유 경로 사용. 환경 startup 지침 초안을 현 지시 USD2로 저장(적용은 환경설정 저장/Publish와 별개), 로컬dev HTTP200·OpenAI안내·status 확인.
- 실제baseline: Set2 3문서/4공급자요청, 확인비용$0.0064682, 미확인0, 약54.755초. 최초 분류3/3, 최초 존재후보94개 중 원문근거91개, native 후 현재 존재96개 중 원문근거93개(최초null 복구2개로 분모가 다름). 초기 core 일치11/확정불일치0/조치4. 최초 AI 원본·진단·현재 및 actual semantic response는 ignored private에 보존.
- 원인A/C/D: collectionCoverage32가 native 셀의 분리된 헤더 No./of와 닫힌 합계 구역을 실제 행으로 셌다. HBL items/containers 실제1개를2개로 세어 complete=false → semantic whole=false → HS 입증 범위 보류. nativeTableLink에서 실제 같은-band 총합 라벨+anchor heading 없는 닫힘 구역을 구분하고 coverage에서 인정된 header블록만 제외했다. 실제 데이터의 첫줄·Total Packages 표제의 화물행은 유지한다. 처음 broad aggregate 조건이 Manifest 표를 막는 것은 무료재생으로 확인하여 anchor heading 보호를 추가했다.
- 원인E/F: withSemanticReview는 성공한 compatible_incomplete도 provisional_match/attention으로 새primary에 추가했고 reviewIssues가 모두 조치 문제로 집계했다. 성공 언어 의견만 informational로 표시(확정 일치 승격 없음), 검증된 유일 전체품목의 집계 설명에 성공pair를 연결해 중복primary를 통합한다. 원본checks/실제AI decisions/prior 판정과 독립 수치오류는 유지한다. UI/보고서에는 같은 정보성 라벨만 최소 연결.
- 같은 최초 실제 응답/실제 semantic 결정을 추가 호출 없이 현재 검증기로 재생: HBL coverage1/1 입증, core confirmed11→12(HS 포함), goods는AI 정보성1, 조치4→0, 확정오탐0. 이는 신규 API 재추출 성과가 아니다. 최초 AI의 추가필드/중복 참조3개는 현재 원문 미확인으로 남아 있으며 사용하지 않는다.
- Root에만 검증된 품명이 있을 때도 기존 semantic 후보로 연결하되 whole=false, HS/전체 완전성 자동 추정 금지. 별도 물리PDF의 실제2번째품목 누락은 계속 incomplete, 일반 Total Packages 헤더행은 유지, 수량오류와 잘못된근거/수정/OCR 보호. 관련37개+물리/독립2페이지/예산13개 선택검사 및 타입·린트 통과.
- 새PDF는 ReportLab2페이지·우측신원/좌측합계·2페이지역순열·선언가로/운송세로 형태2선적6개이며 합성이고 원본고객자료 아님. 기존17개발/holdout와 구별하여 실제평가한다. 정답/Set2값은 운영코드·AI입력에 추가하지 않았다.
- 예산도구의 오래된10제안을 승인2로 축소하고 사용량은 보존했다. phase39 ledger3문서4요청/$0.0064682, 문서60/요청120 실행보호상한·자동재시도0. 현재실제시험 추가대상은 최종 동일SHA Set2 및 정상/오류/새양식이며 전체ship 후 실행한다. 원격evidence의 cap10 기록도 복원 시2로만 축소하며 측정/미확인 사용량은 버리지 않는다.
- 단계B 최종 선택: 새 물리PDF/루트/정보성/중복/독립양식7회귀 + 예산7회귀 통과. 기존 의미31/독립PDF17/3.8·381 관련 회귀에서 발견한 이미 대체된 check와 새check를 동시에 covered 처리하는 결함은 covered된old를 집계 재처리하지 않게 수정했고 관련37개 재통과. 새 브라우저6개(기존5+정보성/조치분리) 및 타입·린트 통과. 이후 source freeze, 전체728단위·70브라우저 예상(확정 결과는 ship에서 기록).

- 후속 실제검증: 7087aad 전체728단위·70브라우저/Actions/Production 일치 확인. 누적12문서16요청/$0.021366555/미확인0. 정상 Set2의 미검증 중복 root 후보가 같은 원문의 검증된 단일 품목을 가리는 문제, 다품목의 different_product 의견이 중복 매칭으로 계산되는 문제를 실제 저장 응답으로 입증했다. 동일 페이지·블록·문자열의 유일 검증 품목으로만 비교 fallback하며 원본은 보존한다. 다품목은 전체 native 범위와 문서쌍별 일대일 대응을 입증하고 HS를 대응 행별로 비교한다. 같은 HS 집합이라도 행별 코드 충돌은 확정 오류로 유지한다.
- 실제 응답 무료 재생: Set2 조치1→0, 다품목 확인필요10→0. 다품목 원본 합성신고의 Exporter 누락1건은 유지한다. 새 평가 PDF에는 실제 Exporter 라벨을 넣어 자료 부족과 엔진 오류를 구분한다. 미사용 원본 후보의 미검증 기록은 보존하며 활성 비교 근거 상태와 구분한다. 후속59선택검사·타입·린트 통과, 신규 실제 최종SHA 평가는 전체ship 이후 진행.
- Push 전 안전검토에서 같은 pair의 상충 중복응답도 부정 교차 대응으로 건너뛰는 경계를 발견하여 ship을 중지(Commit/Push 없음). 부정 교차 대응은 양끝이 각각 다른 실제 상대 품목에 양성 대응한 경우로 제한했다. 상충 중복 응답을 needs_review로 유지하는 회귀 추가, 관련12검사 통과. 이 테스트 초안은 동일상품으로 의미 후보가0인 자료여서1실패했고, 실제 상이 표현을 가진 후보로 재현하여 통과했다. 전체 gate를 새로 실행한다.

- a4bdcdf 전체733단위/70브라우저 및 Production 동일SHA 확인. 실제 Set2 재추출에서 분류3/3·핵심일치12/확정오탐0이지만, 문서 요약이 다른 헤더를 인용하여 미확인이 되고 독립 검증된 유일 품목 대신 그 요약을 비교해 추가 경고1건이 남았다. 비교용 참조는 native 전체범위의 유일 품목의 독립 근거를 선택한다. 요약의 값/미확인 상태는 변경하지 않고, 복수품목·불완전범위·수정값·다른문서/OCR/무근거 대체는 차단한다. 같은 실제 응답 무료 재생은 추가경고0, 원본 미확인12 유지. 관련60검사 통과.
- 누적15문서20요청/$0.02470832/미확인0. 실행 중 예약을 원격체크포인트에 보존한 뒤 예산복원이 큰 미확인상한을 보수적으로 재선택하여 확인된2요청 비용이 예약으로 되돌아간 운영오류가 있었다. 실제4요청의 공급자 usage 모두 확인 후 문서/요청 수와 모든 기존 비용을 유지하며 해당 예약만 확인비용으로 대조했다. before/after·usage·응답해시 증거 보존, 원격evidence00e1717에도 대조 저장. 이후 원격체크포인트는 실행 잠금이 해제된 경계에서만 수행한다. 추가호출/자동재시도 없음. 최종 새SHA 평가 전 다시 전체ship한다.
- 같은 원인의 누락 요약도 실제품목 비교를 막지 않도록 유일 native품목 참조 선택을 적용했다. 사용자가 요약을 명시적으로 비운 경우에는 그 수정값을 보호한다. 새13선택검사 통과. 요약 누락/사용자비움 경계를 ship 타입검사 단계에서 추가하여 해당 실행은 중지(Commit/Push 없음), 최종 전체 gate는 다시 동결 실행한다.
- 누락 요약 회귀의 테스트 객체에 필수 reason이 빠져 타입검사에서 실패했다. 배포 전 실행을 중단하고 테스트 객체를 실제 스키마에 맞게 수정했다. 중단된 npm ci의 의존성을 재설치한 뒤 타입검사 및13선택검사가 실제 통과한 것을 확인했다. 제품 검증 기준 변경 없음. 최종 frozen gate 대상734단위/70브라우저.

## Set3 긴급 엔진 수정 — 2026-10-18 체크포인트
- 기존 main 85bc3af를 보존하고 사용자 첨부 실제 PDF 3개를 비공개 폴더로 확보했다. UI/보고서/새 엔진 변경 없음.
- 실제 기존 Production 최초 추출을 3문서/4요청으로 저장했다. Manifest 수량10000/PCS는 최초 AI부터 정확했고 p1-b46 품명 셀의 같은 행을 인용했으나 verifier의 허용 열에서 제외되어 role_mismatch였다. 원문과 후보 생성 오류를 구분했다.
- 수정: 같은 native 품명 셀·소유 품목/화물행의 명시적 count atom만 수량/단위로 검증. count annotation을 상품명 복구 후보에서 제외. 신고가격/환율 라벨이 먼 수량 헤더를 상속하지 않도록 의미 경계 추가. 다른 행/문서/합계/모델/중량/OCR/수정값 보호 유지.
- 항구: 출처 CSV의 CAVAN/USVAN/USSEA 기록, 동일 도시명 모호성 보호. 별도 목적국 원문 필드·구버전 스냅샷 nullable 기본값·독립 native 복구를 추가. POD만 같은 문서의 검증된 목적국으로 구분하며 원문을 변경하지 않는다. 미지원/모호/충돌 국가는 확정 판정 금지. 출처 버전/해시/라이선스 적용 범위를 명시했다.
- 무료 저장 응답 재검증: 확정오탐1→0, 조치검토4→0, 일치11→12, 비교근거 미확인2→0. 최초 진단은 보존하며 현재 모든 필드가 검증됐다는 의미는 아니다. 원본 검사61개 유지, 의미 의견은 잠정/정보성 그대로다.
- 신규 합성 PDF 회귀20개: 정상/실제 항구 차이/동명 도시/목적국 수정·OCR/정확한 소유행/숫자·단위/모델·중량 거부/실제 수량·포장 차이/통화 셀/상품명 분리. 전체 회귀·ship 진행 예정.
- 누적 phase39 ledger: 53문서/76요청, 확인 $0.082065545 + 이전 미확인 상한 $0.01262635. 한도 $2/60문서/120요청, 자동재시도0. 기존 ledger 초기화 없음. 원격 evidence 체크포인트 671044b. 최종 동일 SHA 실제 UI3문서 및 변경 PDF 최소 검사 예산을 남겼다. 새 코드의 실제 AI 성공은 아직 미검증이다.

- 중간 전체 회귀752개 중3개 실패(동일한 미지원 literal 항구 코드까지 보류한 변경의 부작용). 코드 동일성 비교와 실재 지점 확인을 분리해 수정했고 기존 PHASE37 67개를 포함한 선택85개가 통과했다. 기존 테스트 삭제/완화 없음. Set2 저장 응답도 일치12·조치0·오탐0 그대로 유지. 수정 후 전체753개가 통과했다. 빌드·worker도 통과했고 브라우저 진행 중, 한 줄 화물명세의 직접 수량/포장 주석 회귀를 추가하기 위해 Commit/Push 전에 중지했다. 기존 cargoDescription/countAtoms를 결합해 같은 소유행에서만 두 주석을 검증·복구하도록 연결했고 신규20검사 통과. 최종 전체754개/70브라우저를 새로 검사한다.

## 신규 범용 실증 체크포인트 — 2026-10-18
- 기준main7884bb3, 사용자추가코드없음. phase39누적59/86/확인추정0.096102395+미확인0.01262635 보존. 새승인150/220/USD2 적용; predecessor60/120만이동, 사용량초기화없음. 예산이동회귀8개통과.
- 독립합성Development6/Holdout4/Stress2, 정상36PDF/오류Manifest8PDF. 7개별페이지구성함수(테두리/무테/좌우분할/다단국문/가로형/수평정의밴드/연속페이지). 사용자Set2/3의업체/번호/양식복사없음. Holdout PDF·truth 해시 최초호출전고정, lock은원격evidence에도보존. 정답은평가만사용.
- 최초실제Development: 18/18분류, 기대핵심444중436최초정확(98.2%), current438/444, 검증374/444(84.2%), 잘못검증0/확정FP0/조치64. 8최초누락: party2와한문서컨테이너행6필드. 첫설정strict출력18/18유효; 반복주요병목은원문검증67개로모델교체/옵션추측없음.
- 코드근본원인: nativePdfCells가페이지전체인접Y만써서다른열의중간선때문에진짜닫힌셀누락; shippingCell이HBL열존재만으로container행거부; 별도상품표가있어도MF의container할당행을상품행으로선택. 최초진단row_mismatch46/role_mismatch30/value_mismatch2(전체후보진단,기대핵심분모와다름).
- 수정후무료저장응답재생: 핵심검증438/444(98.6%), 잘못검증0/확정FP0. 최초436/444는변경없음. 새로eligible해진의미후보는과거응답에없어새AI평가전미완료로보존. 신규layout4검사+이전Set3/381총40선택검사통과. 추가scope회귀진행중.
- 원격예산확인일시실패1건은공급자예약/호출전에중지했고59→62까지유지확인후수동재개. 새유료자동재시도없음. Development후누적77문서108요청/확인추정0.11788126+기존미확인0.01262635. 원장및원본응답보존. 최종전체/실제Holdout/배포는아직미완료.

- 첫 전체 ship은761중759통과/2실패하여 Commit·Push 전에 중단했다. 동일 컨테이너의 전용표/화물표를 서로 다른 개체로 세고, HBL 할당행을 품목표로 중복 계산한 회귀가 원인이다. 컨테이너는 독립 표 사이의 동일 ID 표현만 중복 제거하고 같은 표의 반복 행은 보존했다. HBL열의 상품표 오인 방지를 유지했다. 기존32/33 및 신규layout 80개 모두 통과. 수치 표현 간 충돌은 기존 SOURCE_CONFLICT 판정으로 계속 보호한다. 최종 전체 gate 재실행 전 코드 동결.

- 중간main177d758: 761단위/70브라우저/타입/ESLint/build/worker, Actions quality·production, Vercel success/공개 동일SHA 확인. 실제Development 재추출18문서 444/444 최초정확·444/444 검증, 관계18/18, 확정FP0/독립문제0. 기존374/444에서 개선; 무료 원후보 재생438/444와 구분. 처리시간 중앙값44.439초 대44.949초로 유의한 속도 개선은 입증하지 않았다.
- 물리 변경Manifest8개 실제분석(부모16응답은 같은177d758 Development 재사용): 6/8확정탐지, 경고포함7/8, 확정FP0. HS차이는 보수적 잠정경고이며 의미AI의1응답에 잘못된fieldId가 있어 승인하지 않았다. 모델차이1건은 AI가 문서유형만 반환하고 모든 필드/배열을 누락했는데 기존 Recovery가 이미 생성된 행만 처리해 미탐했다. 실패 결과 보존.
- 구조수정: classified native 닫힌 셀의 독립 검증된 품명행이 있고 items/cargoRecords 전체가 비었을 때만 누락items 복구. OCR/애매후보/사용자수정/기존행 보호, container행/번역/총량 생성 금지. original null/current·recovery 분리. 같은 실패응답 무료재생에서 실제NG95를 복구해 모델충돌 확정. 신규4+기존36/37 포함104검사 및 타입/ESLint 통과. 실제 새SHA 평가는 아직 미실시.
- 평가도구 camelCase case ID가 transport 안전ID 규칙에 거절된1건은 예약/공급자 호출 전 중단. transport ID만 소문자화하고 PDF case/증거명 유지. 자동재시도0. 누적103문서148요청/확인추정0.15867876+기존미확인0.01262635 유지.
- 보충Stress 별도합성4PDF(HBL+2신고+Manifest, 독립2페이지, 모델10000/PCS·CARTONS 주석/한쪽750mL/목적국 있는 VANCOUVER/전체·개별합계) 생성·해시고정. 기존Blind07–10/정답 불변. 최종예산: 새Dev18+모델1+Blind12+기존Stress6+보충4+Set2/3 UI6=47문서, 누적150 이내. 모델/프롬프트 설정 불변, 최초실패를 후속성공으로 삭제하지 않는다.

## Blind 실패 후 구조 수정 체크포인트
- main91c0810은765단위/70브라우저 및Actions/Vercel/공개동일SHA 통과. 새Development 실제18문서444/444 최초·검증, FP0/문제0. 실제모델오류1PDF 재분석은 모델차이를 확정 탐지했으나 같은원인3검사·5문제 중복이 남았다. 평가adapter가 comparison 없는 의미검사2건을 FP로 잘못 집계해, 실제FieldRef의 유일 fieldName으로 역할을 구분하도록 수정했다. 기존원집계(FP2)를 별도보존하며 판정/화면은 변경하지 않았다. 실제잘못된경고가 제거됐다고 주장하지 않는다.
- 최초Blind4거래12PDF: 분류12/12·최초300/300, current298/300·검증245/300·잘못검증2·관계TP8/FN4/FP0·확정오탐0. 조치문제55개(15/16/5/19). 목표미달을 보존하고4거래 전체를Development로 전환. 최초응답/평가JSON/원lock 불변.
- 원인: (1) pure label-cell/value-cell 공통경계 연결 부재, (2) 페이지 다른곳의닫힌표만있어도 무테항구/단위를거절하는global guard, (3) House Bill of Lading 제목을번호라벨로보아 아래안내문을HBL로복구. 회사명/좌표/정답문구 예외처리 없이 실제공통경계·라벨역할·원문수치/단위 소속으로 수정. 문서제목은번호필드라벨이 아니며 explicit No. 라벨을 유지한다. 실제품목표 숫자는 root합계로 승격하지 않는다.
- 같은 실패후보 무료 재생:300/300 current·검증, 잘못검증0, 관계12/12. 남은cached semantic 미완료는 새AI의미분석전 보류. 신규keyvalue4+기존Set3/PHASE37/38오류 포함99선택회귀, 타입/ESLint 통과. 최초Focused에 잘못된set3.test.ts 필터를 넣어 해당파일은 미실행했으며 실제 set3-extraction.test.ts로 정정해99개 검사에 포함했다. 테스트 helper의 string|number 타입오류1건은 제품코드 배포전 수정했다.
- Set2/Set3 비공개 최초후보를 새PDF파서로 무료재생:각일치12·FP0·문제0. 원본Stress11/12 6PDF는 정답후보를 제공한 무료원문검사198/198·잘못검증0이며 실제AI추출성능이 아니다.
- 새Blind4거래13PDF 고정: 새독립 렌더러3개(property matrix / sidebar+footer+2pageallocation / parallel label-columns) 9PDF +미호출보충복합4PDF. 원래Blind 및정답해시변경없음. 새자료로 무료정답검사를 하거나 튜닝하지 않았다. 새코드 전체ship 후 첫실제평가.
- API예산재배분(상한증액/초기화없음): 누적134문서190요청/확인추정0.20134722+미확인0.01262635. 잔여16문서로 새Blind13+최종Set3UI3. 기존Stress6/반복Set2UI3/기존계획의보충4 호출을 새13문서로 대체. 최종누적150/약211요청 계획. 추가유료재시도없음. Holdout 통과 여부는 아직 미검증이다.

## 2026-10-20 — 누적 한도 보존 및 신고 목록/개별 범위 수정
- 시작 main/origin/main 62bdcb91e728a51bef5c411f15a7627141557014, 변경 없음에서 재개. 기존 최종 증거는 validation/phase39-evidence 9b645d99c85d510c106f8a10f80bbc6717d1efec에 보존됨.
- 누적150문서/210요청/확인USD0.2262348/미확인상한0.0254659625 유지. 이번 첨부 지시는 같은150/220/USD2 한도이며 새 유료 호출 승인으로 초기화하지 않음. 추가12문서 제안은 요청 잔여10회와 모순돼 철회. 수정 제안은 추가8문서/최대10요청/예약USD0.30이며, 질문만 제시했으므로 승인 전 호출 금지.
- 실제 실패한 복수 신고 자료 complex13을 Development로 전환(retired-holdout.json), 원본PDF/정답/lock/최초응답 불변. 검증된 명시적 쉼표/세미콜론/줄바꿈 목록을 비교 키로 분해하되 원본 필드/인용은 수정하지 않음. 모호한 범위·자연어·부분문자열·사용자 수정·OCR은 목록 근거로 승격하지 않음.
- 관계, 원본 참조 검사, fact 집계, 신고 그룹에서 같은 목록 의미를 사용. 개별 신고 포함 관계와 운송서류 목록의 동일 범위를 구분. 전체 신고 목록의 근거도 그룹 검사에 포함.
- 관계만 해제하면 전체 컨테이너 목록과 개별 신고 부분 목록의 기존 비교가 확정 오탐4개를 만들었음. 중간 무료 재계산은 미배포 증거로 보존. subset 범위를 명시적으로 보호하고 검증된 전체 신고 그룹 안에서 컨테이너 포함·동일 컨테이너 Seal만 확정하며 실제 오류는 보존.
- 47개 기존/신규 선택회귀 및 새 목록/원문 오류13개 통과. 기존 전체 검사 기준 삭제/완화 없음. 전체782단위·타입·ESLint 통과. 최종 ship의 설치/빌드/worker/브라우저/Push/배포 검사는 진행 예정이며 새 실제 E2E는 미실행.
- 저장된 complex13 응답 무료 재계산: 관계1/5→5/5, 확정 오탐0. 새로 연결된 한영 품목 후보의 의미 결과는 이전 응답에 없으므로 확인필요로 유지(문제51건). 기존34건에서 경고 수 자체가 개선됐다고 주장하지 않음. 다국어 품목 대응/합계는 여전히 미해결이며 새 실제 API 평가 없이 완성으로 보고하지 않음.

- ship 도중 추가 검토로 전체 운송서류 중 하나와만 Seal이 맞아도 목록 합집합으로 승인할 위험을 발견해 해당 실행을 종료(커밋/Push 전). 각 참여 운송서류별 포함 관계를 요구하도록 보강. 실제 원문 Seal 충돌을 넣은 새 회귀를 추가하며 별도 신고의 정상 Seal 포함과 충돌 신고를 구분한다. 이 보강 후 전체 ship을 다시 수행한다.
- 최종 ship의 기본2-worker 실행은783개 중5개 기존 PDF 검사에서 timeout(778통과)으로 중단, 커밋/Push 없음. 값/판정 assertion 실패는 아님. 같은 실패파일44개를 VITEST_MAX_WORKERS=1로 단독 실행하자 모두 통과(25.39초). Vitest의 지원 환경설정으로 병렬도만1로 낮춰 전체 ship 재검증하며 테스트 제한시간/기준/검사 수를 완화하지 않는다. 근본적인 호스트 부하 원인을 확정하지 않는다.

## 2026-10-20 — 범용 정합성 집중 실행 복구 체크포인트
- 기준 main/origin/main 46e8f2708e8a4eb966f34b093568489171946d5e의 기존 기능 보존. 사용자 승인에 따라 같은 live-phase39 상한을 1000문서/1500요청/USD2로 이동, 이전 150/210 및 비용 보존. 새 실제 baseline은 complex13 4문서/5요청, 누적154/215/확인USD0.23522581/미확인상한USD0.0254659625. 원격 원장 체크포인트 validation/phase39-evidence 7c509e9ad82bcd0c291e62336362611f452bd2c8.
- 이전 51개 문제를 각 원본 검사/문서/소유행/참조/근거/관계/범위/파생 검사로 조사: 상품 대응23, 포장·중량 배분20, 컨테이너 범위8. 새 실제 baseline은 AI 응답 차이로47문제/확정FP0. 이 원본 최초 응답과 진단은 비공개 보존.
- 공통 엔진 수정: 실제 AI 의미 의견을 검증된 유일 모델/HS/같은 HBL·전체 신고 범위/일대일 행 대응과 결합. 상품명 사전 추가·정답 제공 없음. 선언 포함 관계와 상품 대응 입증을 분리해 컨테이너별 실제 배분은 번역 보류와 독립 검증. 모든 운송서류별 같은 컨테이너/Seal을 검증하며 부분·공동포장·중복·편집·미검증 보호 유지.
- 위 새 baseline 응답을 현재 코드로 무료 재계산: 관계5/5, 두 품목과1000PCS 신고 합계 확정 일치, 포장50CTNS/총중량500KG 확정, 문제0/FP0. 이는 새 코드의 실제 재분석 성공이 아니며 다음 배포 후 실제 호출로 검증해야 함. 최초AI 진단3개/미확인1개도 숨기지 않고 원본 이력 유지.
- 독립 합성 정상 B(5PDF/3신고), 물리 오류8종, 별도2페이지 Holdout D(4PDF/2신고) 고정. 실제 고객문서/원본응답은 공개하지 않음. 기존 semantic transport/scorer/diagnose 확장, 새로운 예산 원장 없음.
- 진행 중: 선택 회귀와 전체 ship. 첫 선택 검사에서 기존 중복/분할 품목 scope 보호 실패1개를 발견해 구조적 중복 차단을 복구했고 관련17검사 통과. 타입 진단기의 implicit-any1개 수정. 새 코드의 실제 정상/오류/Holdout/UI/최종 SHA 평가·Actions/Production 확인은 아직 미완료.
- 첫 전체 gate에서 기존 PHASE36 한 검사 timeout 및 기존 final-engine 부정 Cartesian 후보 보존 검사 실패로 커밋/Push 전 중단. 같은 두 파일 독립 실행은 PHASE36 33개 모두 통과, 의미 후보 검사만 재현(45통과/1실패). 작은 후보 집합까지 고유 모델로 축소한 것이 원인으로, 작은 집합은 부정 후보 포함 원래 입력 그대로 유지하고 고정 출력 예산을 압박하는 큰 Cartesian 집합만 유일 native 모델 소유 관계로 줄이도록 수정. 기존 assertion/timeout/검사 수 변경 없음.

## 실제 d13edf6 재분석 후 두 번째 수정 루프
- d13edf6ac523e6dcae49c78b12184028b8e283ae: npm ci/타입/린트/전체798단위/70브라우저/빌드/worker, Actions39385431429 quality·production, Vercel success/공식사이트동일SHA 확인. 유료 검증 전 성공으로 종료하지 않음.
- 새 실제 A 4PDF/5요청: 분류4/4·관계5/5, 두 품목/1000PCS 신고 합계/포장50CTNS/중량500KG 확정 일치, FP0. AI가 MF↔신고 의미 비교 한 건에서 UUID 한 글자를 틀려 직접 의견은 사용하지 않았고 확인 문제1개가 남음(원본 immutable). 누적158/220.
- 새 실제 독립 B 5PDF/6요청: 최초 AI 유형5/5·선택필드82/83 정확, Native 복구 후83/83 검증이나, 원문 검증기가 한영 병기 제목 전체를 단일 언어 정규식에 대조해 신고3개의 분류를 보류. 관계1/7/문제90/확정FP0. 무료 수정 후 같은 최초 후보의 유형5/5·관계7/7 복구; 새로 eligible해진 번역은 이전 AI 의견에 없으므로 실제 재분석 전 보류 유지. 단순 경고 숨김 아님.
- 공통 수정: 요청 전용 짧은 Field ID와 strict enum으로 긴 UUID 재작성 오류 방지, 정확한 매핑만 복원/알 수 없는 ID는 미확인, 공급자 원본 ID 응답 별도 보존. 실제 독립 신고 대응·native 동일 원문 운송행의 유일 대응 경로가 이미 입증된 중복 AI 직접 비교만 not_applicable로 기록하고 실패 진단 유지. 서로 다른 상품/속성 충돌·원본 검사 보존.
- 유형 제목은 각 언어의 전체 제목이 같은 유형일 때만 병기로 승인. 다른 유형/임의 suffix/본문 언급/Master 및 다른 페이지의 유형 충돌은 차단. 전역 문자열 부분 일치로 완화하지 않음. quantity 집계의 의미 메타데이터가 선행 신고번호 필드로 표시되던 오류도 수정.
- 평가 adapter는 root numeric additionalFields를 빠뜨린 분모 오류를 정정(이전 B 최초/현재78/83 로그 보존, 정정 최초82/83·현재83/83). 이는 AI 정확도 변경이 아닌 평가 도구 수정임. 현재 ledger163문서/226요청/확인USD0.25341072/미확인상한USD0.0254659625, 원격증거 f38b4477d7b366ce127427a570ed64046b79d6cb. 새 코드 전체검사/실제 A·B 재검증/8오류/미사용Holdout/UI 아직 미완료.
- 두 번째 수정 선택회귀: 짧은ID/원본보존/없는ID차단/대체소유경로/동일유형 병기·다른페이지 혼합·Master·본문 오인 반례와 기존 PHASE37 포함83검사 통과. 타입/ESLint 통과. 기존 PHASE39/final-engine/consistency 65개도 통과했고, 새 transport mock의 developer 메시지를 user payload로 읽던 테스트 helper 오류1개는 실제 user role을 선택하도록 수정 후 통과. 새 실제 호출 전 최종 전체 gate 재실행.
