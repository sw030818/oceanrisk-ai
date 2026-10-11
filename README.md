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
- `src/modules/pdf`: 페이지별 텍스트 추출
- `src/modules/ai`: Gemini 분류·추출
- `src/modules/evidence`: 원문 근거 검증
- `src/modules/rules`: TypeScript 교차검증
- `src/modules/documents`: Zod 모델
- `src/components`: 사용자 인터페이스
- `tests/unit`, `tests/e2e`: 검증

## 범위 및 원칙
PHASE 0 기반 → PHASE 1 Commercial Invoice / Packing List. 텍스트 PDF만 지원하며 OCR, B/L, 위험 예측, DB 저장은 범위 밖입니다. AI 값은 근거 검증 없이 확정 오류에 사용하지 않습니다. 민감한 파일/추출값을 로그에 남기지 않습니다. 테스트용 합성 문서는 실제 분석 결과가 아닙니다.

## 배포
기존 Vercel 프로젝트/저장소 설정은 유지합니다. Node.js 24, Next.js 프레임워크, 루트 디렉터리 기본값. 서버 환경변수는 Vercel 환경 설정에서 입력합니다. 이 작업의 빌드는 배포 성공을 의미하지 않습니다.

## PHASE 1 기능 및 사용 흐름
1. 텍스트 기반 PDF를 선택합니다. 최대 4개, 파일당/합계 4 MB, 파일당 30페이지입니다. 합계 제한은 Vercel 함수의 요청 크기 제한을 고려한 값입니다.
2. Google Gemini로 추출 텍스트가 전송된다는 안내를 확인하고 분석을 시작합니다. 파일명과 키는 Gemini 프롬프트에 넣지 않습니다.
3. 필드별 ‘원문 대조 완료/근거 미확인/정보 없음’을 확인합니다. 배지를 누르면 파일명·페이지·근거 후보와 실제 원문을 볼 수 있습니다. ‘원문 대조’는 문서 진위나 의미의 정확성 보증이 아닙니다.
4. 값을 수정하면 ‘사용자 수정’으로 표시되고 확정 비교에서 제외됩니다. ‘AI 추출값 복원’으로 원래 후보를 복원할 수 있습니다. 실제 수정 서류는 ‘새 서류 검토’로 다시 업로드합니다.
5. 규칙은 Invoice 1개와 Packing List 1개의 **동일 거래당사자·거래 참조·정확히 같은 품명·상품 단위·명시적 전체 선적 범위**가 근거에서 확인되는 경우만 상품 수량을 비교합니다. 거래 참조나 전체 선적 범위만 부족하고 나머지 상품 근거가 확인된 경우에는 수치를 ‘비교 후보’로 보여 주되 확정 오류로 표시하지 않습니다. 중복/누락 품목, 다른 단위, 포장 개수, 명시적 부분선적, 수정/미검증 수량은 비교 불가입니다. PCS/EA 등 명시된 동의 단위만 대응하며 수치 단위 변환·부분선적 합산·퍼지 품목 매칭은 하지 않습니다.

## API 및 데이터 처리
- `GET /api/status`: 키 설정 여부와 접근 제한 설정 여부만 반환합니다. 실제 비밀값을 반환하지 않으며 키의 유효성/사용 가능성을 보증하지 않습니다.
- `POST /api/analyze`: `multipart/form-data`의 `files` 필드. 파일별 원문/근거 후보/검증 결과/오류를 반환하며 `Cache-Control: no-store`를 설정합니다. 본문은 제한된 크기로 읽고, PDF 시그니처·텍스트·페이지를 검증합니다.
- Gemini REST `generateContent`, 기본 모델 `gemini-2.5-flash`. 서버 `x-goog-api-key` 헤더와 JSON Schema 구조화 출력 사용. 타임아웃/요청 한도/권한/불완전 응답을 구분합니다. 실키 미설정 시 PDF 원문만 추출하고 `API_NOT_CONFIGURED`를 표시합니다.
- 문서 내 지시문은 별도 시스템 지시가 아닌 신뢰하지 않는 사용자 데이터로만 전달합니다. 모델에 외부 도구를 제공하지 않습니다. 반환값은 Zod 및 별도 근거 검증을 거칩니다.
- 앱은 DB·파일 영구 저장·문서 로그를 만들지 않습니다. 처리를 위해 서버 메모리와 현재 브라우저 상태에 존재하며 Gemini 분석 시 Google에 전달됩니다. 제공자/호스팅의 데이터 처리 정책까지 ‘미저장’으로 보증하지 않습니다.
- PHASE 1.5부터 Production 분석 API는 서버 접근 코드로 제한됩니다. 요청량 제한은 인스턴스 메모리 기반이며 지속적/분산 전역 할당량 관리나 사용자 계정 기능은 포함하지 않습니다.

## 테스트
단위 테스트는 pdf-lib로 생성한 **합성 PDF**를 실제 PDF.js로 추출합니다. Gemini 성공/오류 테스트는 모의 HTTP 응답이며 실 API 성공이 아닙니다. Playwright는 실제 서버의 키 미설정 PDF 추출과 합성 응답의 수량 비교·수정·근거 UI를 각각 검증합니다.

```sh
# 일반 환경에서 브라우저 설치가 필요할 때
npx playwright install chromium
npm run test:e2e
# 이 클라우드 머신에는 Chromium이 이미 설치되어 있습니다.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

완료/실패/미검증 및 GitHub 보존 상태는 [PROGRESS.md](./PROGRESS.md)에 기록합니다. Vercel Production 브랜치 `main`은 임의 변경하지 않았으며 기능 브랜치 Push는 Production 배포나 main 병합을 의미하지 않습니다.

## PHASE 1.5 안정화 및 실제 검증

현재 Gemini 키가 없으므로 **실제 Gemini A–D 검증은 미완료**입니다. 모의 AI 응답 검사와 실제 호출 검사는 별도입니다.

```sh
npm run test:live
```

이 명령은 안전한 합성 Invoice/PL 8개를 실제 2페이지 PDF로 생성하고, 키가 설정된 경우에만 최대 8회 Gemini를 호출합니다. A: 500/500 PCS, B: 500/480 PCS, C: 상품 500 PCS와 포장 20 CTNS, D: 거래 참조 누락. 실제 PDF 추출 → 실제 Gemini → 근거 대조 → 규칙까지 검사합니다. `test-results/live-gemini/report.json`에는 실행 여부/요청 횟수/검증 기준/오류 코드만 기록하며 키·원시 AI 응답은 기록하지 않습니다. PDF는 합성 파일이며 Git에서 제외됩니다. 종료 코드 0은 모든 실제 사례 통과, 1은 실제 검사 실패, **2는 키 미설정으로 미실행**입니다. 설치/빌드에는 유료 실제 호출을 자동 포함하지 않습니다.

수량 검사 결과의 기존 `status`(match/mismatch/unverifiable)는 유지합니다. 새 `confidence`가 confirmed/candidate/unavailable을 구분합니다. 후보는 status=unverifiable이며 확인된 상품 수치만 표시하고 확정 경고 수에 포함하지 않습니다. 다른 거래 참조, 명시적 부분선적, 사용자 수정 근거는 후보에도 사용하지 않습니다. PCS/EA 같은 동의 단위만 정규화하며 값의 단위 변환은 하지 않습니다. 상품/포장 개수가 같은 근거 블록에 있을 때 명시적 상품 수량 라벨만 읽습니다. 부정된 전체 선적 표현과 상충하는 선적 선언도 확정 근거에서 제외합니다.

### Production 접근 설정

Vercel의 **서버 환경변수**에서 다음 값을 안전하게 설정합니다. `NEXT_PUBLIC_` 이름을 사용하지 않습니다.

- `GEMINI_API_KEY`: Google Gemini 서버 인증 키.
- `ANALYSIS_ACCESS_TOKEN`: 운영자가 정한 무작위 32–256자 접근 코드. 허용 문자 A–Z/a–z/0–9/_/-. 앱 서버에서 직접 비교하며 Google로 전송하는 프록시 비밀이 아닙니다. 실제 코드를 Git/문서/로그에 적지 않습니다.

Production에서는 접근 코드가 없거나 형식이 잘못되면 분석 API가 **503 ACCESS_NOT_CONFIGURED**로 차단됩니다. 사용자가 화면에 입력한 접근 코드가 틀리면 401, 다른 사이트의 Origin이면 403입니다. 올바른 코드는 이 앱에만 Authorization 헤더로 보내고 브라우저 메모리에만 유지합니다. HTTPS를 사용하는 운영 환경이 필요합니다. 개발 환경도 접근 코드를 설정하면 동일한 제한을 적용합니다.

추가 보호: 인스턴스당 10 요청/분, 동시 분석 2개, 시간당 AI 문서 요청 예약 24개, 429 및 Retry-After 안내. 실패/취소 예약도 환불하지 않는 보수적 제한입니다. 카운터는 프로세스 메모리 기반이므로 재시작 시 초기화되며 **Vercel 인스턴스끼리 공유되지 않습니다**. 서버 접근 제한과 Google 측 할당량 설정을 함께 사용해야 전역 비용을 제한할 수 있습니다. 분산 저장소/계정 인증은 이 단계에서 추가하지 않습니다.

Gemini 요청은 25초, 전체 처리/업로드는 105초의 제한을 적용합니다. 취소 신호를 PDF/모델 요청에 전달합니다. 모의 응답 검사에서는 모델 응답 수신 타임아웃도 검증했습니다. gemini-2.5-flash는 이 추출 작업에 thinkingBudget=0, 출력 토큰 상한 8192를 사용합니다. 실제 지연 시간·추출 품질은 키 설정 후 검증해야 합니다.

UI는 분석 응답 완료/부분 처리 완료/분석 실패를 구분합니다. ‘응답 완료’는 필드 정확성이나 전체 거래 안전성의 보증이 아닙니다. 부분 성공 시 원문과 완료된 필드는 유지하며 파일별 오류를 보여 줍니다.

현재 `main` 병합 및 Vercel Production 배포는 수행하지 않았습니다. 실제 A–D 통과와 서버 접근/비용 설정 확인 후 배포를 검토해야 합니다.
