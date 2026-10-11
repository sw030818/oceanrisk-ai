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
