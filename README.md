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
