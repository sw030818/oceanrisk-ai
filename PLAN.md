# 현재 방향 — PHASE 3.1

OceanRisk AI는 중소 포워더의 **House B/L·수출신고필증·House 적하목록 신고 전 정합성 검토**로 전환한다. 아래 PHASE 0~2.3 계획과 실행 결과는 당시 이력이며 현재 제공 기능을 뜻하지 않는다.

## PHASE 3.0 완료 기반

- 최신 main/HEAD/변경 확인, 기존 PDF·OpenAI·근거·규칙·UI/테스트 재사용 범위 조사.
- 새 3종 업로드 UI, 최소 2종 자료 준비, 3종 삼각대조 자료 준비 상태.
- 별도 Zod 문서 모델, 원본/수정값, 페이지/블록/위치, 복수 품목·컨테이너·신고 참조, 다대다 관계와 분할/동시포장 범위.
- 실제 PDF 텍스트·위치 추출/원문 보기/사용자 입력. 새 분류·AI 추출·양자/삼각대조는 안전하게 비활성화. 공개 Invoice/PL 경로 종료, 기존 핵심 모듈은 내부 회귀로 보존.
- 유료 OpenAI 호출 **0회**. 설치/타입/린트/전체 단위/전체 브라우저/build/worker/보안/모바일·데스크톱 검사.
- ship 전체 검사 후 main 일반 Commit/Push, Actions quality/production, Vercel Git 자동 배포 및 동일 SHA/공식 새 UI 확인.

## PHASE 3.1 구현 상태

3종 전용 strict 추출·실제 제목 분류·블록 복원·독립 의미/행/열/단위 검증과 다중 결과·수정/복원·불일치 UI를 구현했다. 기존 공통 OpenAI transport/최종 JSON 파서·PDF/보안·원문 UI·과거 회귀는 유지한다. 무료 회귀/Production build/worker·main ship·Actions/동일 Production SHA를 확인해 결과를 PROGRESS에 기록한다. 유료 호출은 새 승인 전 미실행이다. 사전예약 예산은 합성3문서/한 배치/최대$0.05/자동재시도0이며 이전 예산과 분리한다.

실행 확인: main 구현 3a4605f79e0764d0a1406b96d5572dd38873355b, ship 332단위/21브라우저 및 설치·타입·린트·빌드·worker 통과. Actions quality/production·Vercel Git 완료·Production 같은SHA와 무료 실제 PDF/모바일 검증 통과. 실제 유료 검증은 새 승인 질문 제출 후 대기이며 호출0이다. 결과 보존·마지막 문구 수정도 ship 검사를 거쳐 저장한다.

## PHASE 3.1 상세 작업

1. 3종 전용 strict Responses 응답 스키마, 문서 분류와 요청 영역 분리, 다중 신고/컨테이너/품목/참조의 구조화 추출.
2. 실제 PDF 블록만 사용한 인용 복원 및 원문 라벨/행/열/역할 검증. 기존 generic literal/block 검증과 숫자 lexer를 재사용하되 Invoice/PL 역할 규칙은 그대로 호출하지 않기.
3. 상품 수량·포장 수량·신고 중량·총중량의 의미와 단위 분리, HS Code/식별자 문자 보존, 여러 행 인용·잘못된 블록·누락·중복 참조 회귀.
4. 추출값/원본 근거/사용자 수정/원래 값 복원 UI 연결 및 분류 불일치 경고.
5. 새 승인에 따른 최소 유료 합성 검증, 호출 수/비용 상한 사전 보고, 모의·원문·실제 지표 분리. PHASE 2.3 예산 재사용 금지.

## PHASE 3.2 상세 작업

문서 대응 관계를 먼저 독립 검증하고 HBL↔Manifest, 신고↔Manifest, HBL↔신고와 공통 항목 삼각대조를 TS에서 수행한다. 복수 신고·컨테이너·분할선적·동시포장·서로 다른 수량 단위·거래 연결 충돌·근거 부족을 확정/잠정/확인 필요/정보 부족으로 구분한다. 한쪽 없는 필드를 무조건 오류로 처리하지 않고 수출신고 물품 수량을 B/L 포장 수량과 직접 비교하지 않는다.

---

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

## PHASE 2.3
의미별 참조 매핑과 비교 의도를 분리하고 개별 항목 상태·독립 품목 대응·원문 숫자/단위/중량 셀 근거·문서별 산술/포장 검토를 구현한다. 기존 UI를 보존하며 요약/원문/수정 재계산을 개선한다. 합성 보고구조19개 회귀·기존검사·15개 브라우저·ship을 실행한 뒤 main과 정확ProductionSHA를 확인한다. 새 승인2문서/$0.03만 실제OpenAI검증하고 모의결과와분리보고한다. 실제업무PDF는없으므로 그파일자체를검증했다고하지않는다.

## PHASE 3.2 — 실사용 대조 엔진

1. 기준 main c40eeeb·332단위/21브라우저·스키마/원문/Responses 조사 완료. 새 예산12문서/$0.50/재시도0으로 기존3.1의 HBL/신고2문서 실제 추출 baseline 성공(최신3.2 검증 아님).
2. 관계 엔진·문서별 qualified IDs·행 대응, 세 조합 양자/검증된클리크 삼각대조, 원문 전체행 포함/중복 확인·수량/포장/중량 의미·단위/부분범위 보호 구현. 사용자 수정/관계확인 재계산·추가 PDF1개 UI 연결.
3. 기존 회귀와 새 정상/오류/불확실/다대다/표근거/수정/모바일 테스트 후 ship으로 main 정상 저장·자동배포/Actions/정확SHA 확인.
4. 같은 Production SHA에서 정상3종·불일치2종·정보부족2종 실제 추출→관계→비교 통합 검사. 실패 원인 분리 후 필요하면 남은3문서까지 최소 재검증. 최대12/$0.50 초과 금지. 현재 baseline2건 외 추가호출 전.
5. 실제 결과/예산은 별도 validation/phase32-evidence 브랜치에 보존해 main Production 테스트SHA를 유지한다. 실제 테스트하지 않은 범위, OCR/복잡표/미명시 다대다 배분·법적 위험/자동세관신고는 완료로 주장하지 않는다.

## PHASE 3.3 — 다중 자료·실무 평가
1. 최신 main928bcc7/원격/기존377단위·30브라우저·원문/AI/관계 계약 조사 완료.
2. 세 유형 File[]·안정ID·추가/삭제/교체·단일유형입력·안전한 순차배치·성공/수정결과유지·AI기본/무료원문보조 구현.
3. 반복 헤더/줄바꿈/합계 경계·OCR출처/표누락 보호·명시적 복수신고의 서로다른품목 집계·인쇄보고서 구현.
4. 독립 PDF 정답(tuning/holdout)·407단위·41브라우저 목표 및 전체 ship/Actions/Production 동일SHA 검사.
5. 새$0.10/24문서/30요청 예산에서 기존3종 기준선·신규3종·불일치2·복잡6·불확실2·회전스캔1·Holdout3을 최소 실제 검사한다. 기존성과/예산과 섞지 않고 필요충족시 중단한다.
6. 실제 증거는 validation/phase33-evidence 별도브랜치. 진짜업무문서 일반정확도·저화질/OCR독립좌표확정·미명시 배분·EDI/법률판정은 지원완료로 주장하지 않는다.

## PHASE 3.4 — 사용자 제공 실패 PDF 및 결과 화면
1. 최신main/e5f8d7c·첨부ZIP 원본SHA와 스크린샷 확인. 원본3개 실제분석 기준선과45초타임아웃1건을 신규$0.15ledger에 보존.
2. 제목/House맥락·번호라벨·PDF실제벡터셀·여러블록·count/unit·native기재범위·UN/LOCODE·관계/삼각대조 수정. 잘못된 행/단위/합계/인용과부분/복수신고 보호.
3. 기존407단위/41브라우저를 보존하며 독립 합성경계/반례와새대시보드/비교표/상세/인쇄·1440/390px 검증.
4. ship으로 main 일반Push·Actions quality/production·PDFworker·같은ProductionSHA 확인.
5. 같은SHA에서 원본3개 및최소오류반례 실제OpenAI 재검증. 실제/모의/응답무료재생을 구분하고$0.15이하로종료. 별도validation/phase34-evidence 기록.


## PHASE 3.5
1. PHASE3.4 원본/실제응답의 추출·근거·범위·판정4단계 진단.
2. Native coverage와 HBL Fact scope/provenance/derivation, 적용가능성 및 원인코드, 중복 없는 primary outcomes 구현.
3. 단일/복수행·컨테이너·신고·부분/공동포장·정확한근거·수정/결정성 회귀; 기존440/50 유지.
4. 전체ship/main/Production 동일SHA, 새$0.50/60문서/75요청내 원본3회반복·오류·복잡사례 실API검증.
5. PHASE35 증거브랜치에성과/FP/FN/보류/원문실패/한계/비용보존. UI/OCR/서류종류확대하지않음.

## PHASE 3.6
1. 기존 main8a79d4f와 PHASE35 수량/항구 실패 응답을 원본 PDF에 무료 재생하여 원인을 분류한다.
2. 최초 original 보존/approved recovery/current·독립 근거 검증·native 행/역할 검색·coverage/Fact 재계산을 구현한다.
3. 선택적 추가 AI strict 후보1536/문서당1회/원문 재검증/실패 보존/기본 비활성, 별도 $0.50/60문서/75요청 도구를 구현한다.
4. 기존482단위/54브라우저와 신규 복구·반례·예산·1440/390px 회귀, npmci/type/lint/build/worker/dev smoke 후 ship한다.
5. 최종 동일 Production SHA에서 정상3종5회 및 오류/복잡/독립양식 최소 실API 검증. 단계별 정확도·오탐·비용·보류를 증거 브랜치에 저장한다.

## PHASE 3.7 최종 진행
범용 의미/원문/관계/업무문제 엔진 및 독립 평가 체계 구현. 실제 복수 신고의 전체-개별 범위 중복 보류를 결정적 집계 근거로 해결하고 원문·필수정보·미검증·수정 보호를 유지한다. 전체 ship 후 새 최종SHA 정상/오류/복수신고/불확실/동결Holdout/새PDF반복을 누적$0.50·120문서·150요청 내 평가한다. 과거예산·SHA 사용량을 초기화하지 않으며 결과는 validation/phase37-evidence에 보존한다.

## PHASE 3.8
A 원본Set2 확보·실제원인재현·분할블록/헤더/발행문맥/독립native복구. B 의미/단위·원인→후속검사 통합·확정오류보존. C 현재근거실패/대표문제/서류별원문비교/간결보고서. D 실제PDF+독립합성정상/오류·606/62회귀·전체ship/main/Actions/Production·별도evidence. 신규유료API승인없음; 승인전0호출, 기존ledger보존. STAGE A선택검사완료,나머지진행.
- A 완료:837668f · 분할 원문/House 발행 근거. B 완료:ac7d6f4 · 원인 연결/독립 오류 PDF/표기 보존. C 진행: 현재·최초 증거 분리/대표 비교/모바일 카드/인쇄. D 대기: 전체회귀/기존 실제 응답 무료 재생/ship/Production·Actions/증거 브랜치. 신규 유료8문서8요청/$0.10 승인 질문 대기(자동재시도0), 승인 전 호출 금지.

## PHASE 3.8.1 — 현재 작업 (이전 UI 계획 종료)
1. 완료: main f174b41 clean 복원, 실제 Set2 native source/원본 응답 부재 확인. 251 주입 회귀와 f174b41 archive 비교.
2. 완료: native 셀 경계 라벨 연결, 포장/용적 분리, 혼합 화물 설명 원문 보존/비교 정규화, 실제 동일 품목 한영 원문 context. UI/보고서 변경 없음.
3. 완료: 신규14 선택 회귀 및 Manifest 실제 줄바꿈 전체 품명 복구 추가2 회귀, Set2 올바른 후보20/20·오탐0, 변경된 실제 포장 원문 보존, 독립6오류/기존37평가/이전36응답 무료 재생. API0, 기존ledger 보존.
4. 진행 예정: frozen stage ship의 npmci/type/lint/전체 단위/64브라우저/build/worker, main 일반Push, Actions quality/production 및 공식사이트 정확SHA 확인.
5. 최종 메타데이터는 validation/phase381-evidence에 보존한다. 최초251 생성 경로와 새 OpenAI 추출 성능은 원본 응답·신규 유료 승인 부재로 미확인이다. 기존 예산/제안 재사용 금지.

## PHASE 3.9 — 현재 작업 체크포인트
1. 완료: main 1fadc0b 복원, 기존 사전 의존 goods/HS 보류 경로와 OpenAI transport/네이티브 검증 분석.
2. 완료: strict 의미 스키마/Responses 모듈/검증된 후보 그래프/원문 인용 검증/속성 독립 비교/원본 보존·수정 무효화. 서버 서명 자료를 사용하는 별도 semantic endpoint와 전체 업로드 배치 후 1회 연결. UI 디자인 변경 없음.
3. 완료: 별도 ReportLab 54합성PDF/18선적(개발17·의미 미평가 Holdout1), native oracle/MOCK 평가, 서버 무결성·오류·모바일/원문모드 회귀 및 별도 신규예산 runner. 승인 전 실제0호출, 기존ledger 보존.
4. 진행: frozen ship npmci/type/lint/전체 단위/Production build/PDF worker/69브라우저, main 일반Push/Actions/정확 Production SHA 및 실제 Set2 무료 prepare.
5. 대기: 사용자 신규 $10/60문서/120요청 명시 승인. 계획60문서/최대80요청(자동재시도0, 최종6문서 확보), oracle request 형태의 예약 추정합 약$0.824이며 실제 요청마다 상한을 재예약한다. 승인 전 E2E 완료 주장 금지. 소스 SHA를 유지하고 validation/phase39-evidence에 최종 무료 성과·승인상태를 보존한다.

### PHASE 3.9 최종 체크포인트
- 구현/무료독립평가/720단위/69브라우저/빌드·worker/main Push/Actions quality·production/공식 동일SHA/Set2 무료UI 완료. 소스 a57ffaf10e836f74e2e2cffb1d551d632cc4e678, 증거 validation/phase39-evidence.
- 실제 신규 first extraction 및 semantic E2E는 승인 대기, 실제0/$0. 제안 $10·60문서·120요청, 계획 최대80요청/최종6문서 확보/자동재시도0. 이전 ledger 초기화·재사용 금지. 승인 없이 남은 유료실증을 실행하지 않는다.
