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


## PHASE 2
1. 최신 main의 Gemini 정상화 코드를 보존하고 업로드 영역 2개·선택 영역 메타데이터를 추가한다.
2. 원본 페이지 텍스트를 유지하면서 실제 PDF 블록 좌표·행 구조를 추가한다.
3. 다중 블록 인용, 라벨/값 연결, 상품 표의 열·행 검증을 독립적으로 수행한다.
4. 검증된 PO/Invoice 충돌·수정값을 제외하고 확정/후보/불가 상태를 표시한다.
5. 7개 다양한 양식, 기존 A–D 회귀, 단위·Production 브라우저·PDF worker 검사를 실행한다.
6. ship 검증 후 main 일반 Push 및 Production SHA 확인, 실제 합성 Gemini 평가·반복 검사 결과를 기록한다.
7. 후속 B/L·법적 위험·견적·비용·이력 DB·대시보드 전면 재작성은 제외한다.

PHASE 2 진행 상태: 구현·로컬 모의 검사·main Push·Production SHA 확인을 수행했다. 실제 Gemini 22개 문서 모두 구조화/제공자 오류로 실패하여 실사용 분석 검증은 미완료. 최종 로컬 단위 191개와 브라우저 10개 통과, 상세 실패와 SHA는 PROGRESS.md/안전한 검증 JSON에 보존한다. 과거 PHASE 1.6의 실패 기록은 당시 결과이며 최신 main에서는 실제 A 성공이 확인됐다.


## PHASE 2.2
1. main과 미검증 OpenAI feature branch를 조사하고 공식 모델/Responses/strict schema 계약을 확인한다. 브랜치를 자동 병합하지 않는다.
2. 기본 공급자를 OpenAI로 전환하고 AI의 값·블록 후보를 실제 PDF에서 재구성/독립 검증한다. Gemini 소스/회귀/키를 보존하며 폴백하지 않는다.
3. 사용량·안전한 오류·타임아웃·출력 제한·검증 전용 예산 ledger를 구현하고 기존 UI/규칙 회귀를 유지한다.
4. npm ci/type/lint/단위/build/worker/Production 브라우저를 실행하고 ship으로 일반 main Push·원격 SHA·Production/Actions를 확인한다.
5. 배포된 OpenAI를 단일 A→pair→A–D→7양식→반복 순서로 실제 검증한다. $0.50/문서20개 이전 중단·별도 추가 승인 규칙을 지키고 모의/실제/남은 검증을 구분한다.
6. 실제 메타데이터/PROGRESS를 보존하고 설정 초안을 저장한다. 모든 실제 검증 미완료 시 부분 완료로 보고한다. 후속 기능은 추가하지 않는다.

PHASE 2.2 실행 결과: OpenAI Responses 기본 전환, phase별 최종 JSON 처리, 독립 PDF 근거 검증과 기존 UI를 보존했다. 실제 합성 A–D/7양식/반복의 통과 결과를 확보했으며, 총31문서 예산에서 종료했다. 초기4실패를 포함한 실제 구조화27/31과 최신 양식근거172/172를 구분한다. 최종SHA 단독 전체 live suite 및 실무 양식 일반정확도는 미검증이며, 이 단계의 후속 기능은 추가하지 않는다. 자세한 소스/배포/예산은 PROGRESS.md 및 validation JSON을 따른다.
