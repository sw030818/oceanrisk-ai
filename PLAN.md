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

## PHASE 1.5
기존 개발 브랜치 최신 상태에서 안정화. A–D 실제 호출 도구, 상품/포장 수량 근거 분리, 비교 후보와 확정 결과 분리, 서버 접근/인스턴스 요청량 제한, 취소/타임아웃, 부분 성공 UI, 회귀 검사. 후속 기능·main 병합·Production 배포는 제외. 실제 Gemini 성공은 현재 키가 없어 미검증이며 완료 조건으로 남겨 둔다.

## PHASE 1.6
- 기존 원격 main을 동기화하고 접근 코드·앱 자체 사용량/동시성 제한을 제거한다.
- PDF 안전 제한/타임아웃/원문 검증을 보존하고 Vercel PDF worker 배포 추적을 보강한다.
- 로컬/Production A–D 실행 도구와 명확한 모델/요청/응답 오류를 확인한다.
- 검증 → 커밋 → 일반 main Push → 원격 SHA → Production SHA 확인을 실행하는 ship, 최소 권한 Actions, Vercel 검증 빌드를 구성한다.
- 실제 Gemini, GitHub Actions, Vercel Ready는 각각 실행 근거가 있을 때만 완료로 보고한다. 키/네트워크 차단은 미검증으로 기록한다.

## PHASE 1.6 현재 상태
접근 코드·자체 한도 제거, PDF worker 패키징/근거 문맥 회귀 수정, 검증 후 main Push와 기존 Vercel Git 자동 반영은 실제 실행으로 확인. 최종 소스는 단위 153개·Production 브라우저 7개 및 타입/린트/빌드 검사를 통과했다. 실제 Gemini A 분석은 HTTP 400 INVALID_ARGUMENT로 실패하여 정상화가 미완료다. 최종 소스의 B–D 실제 검증, Google 400 원인 격리, Vercel 관리 Ready 직접 확인이 남아 있다. 자세한 SHA/배포/실패 근거는 PROGRESS.md를 따른다.
