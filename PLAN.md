# 구현 계획

## PHASE 0
루트 Next.js App Router·TypeScript strict·Tailwind 구성. 모듈 구조와 Zod 데이터 모델, 환경변수·문서·테스트 도구. 설치, typecheck, lint, 단위 테스트, build 후 별도 커밋 및 원격 보존.

## PHASE 1
1. 복수 텍스트 PDF 업로드 및 서버 검증
2. 페이지별 원문 추출, Gemini 구조화 추출
3. 필드별 원문 근거 대조 및 확인/수정 UI
4. 동일 품목 수량 비교 (단위·부분선적·근거 게이트)
5. 실패/빈/진행 상태, 반응형 디자인
6. 단위·브라우저·빌드·서버 검증, 별도 커밋 및 원격 저장 확인

PHASE 1 이후 기능은 이 작업에서 진행하지 않는다.

## 완료 상태
PHASE 0/1 구현 및 로컬 검증 완료. 실제 Gemini 검증은 키 설정 후 수행. main 병합/Production 배포와 PHASE 2 이후 기능은 수행하지 않음.
