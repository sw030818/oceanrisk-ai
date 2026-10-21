# OceanRisk AI — final consistency evaluation

한영 복수 신고 품목 대응: A 2/2, B 3/3 실제 성공.

복수 신고 전체 수량 합계 검증: A/B 각각 1,000 PCS; B 신고 EA와 운송 PCS 호환, 포장 50 CTNS 및 총중량 500 KG 확인.

확인 필요 문제: 기존 A 51 → 0, B 90 → 0.

신규 실제 OpenAI 검증: 재개 기준 215/288 이후 249 문서 시도 / 328 공급자 요청; API 문서 응답 성공 246 / 실패 3; 모든 실패 보존. 최종 오류 8종 8/8 확정, 정상 거래 확정 오탐 0.

Source main: [68e168e66011b5ca4faafeb7736e4cae806fa111](https://github.com/sw030818/oceanrisk-ai/commit/68e168e66011b5ca4faafeb7736e4cae806fa111). Final actual output and official Production used this same SHA. All actual 68e168e results are distinct from 2813, 986, 06a and 7f runs. Final-source paid document attempts were 70/70 successful, with no provider document failure.

## Observed results

| Metric | Earlier evidence | Final same-source actual |
| --- | --- | --- |
| A shipment relationships | historical 1/5 | 5/5 |
| A/B bilingual assignment | pending / failed title verification | 2/2 and 3/3 |
| Declaration goods total | withheld | 1,000 each, confirmed |
| A business issues | 51 | 0 |
| B business issues | 90 | 0 |
| Confirmed normal FP | 0 | 0 |
| Canonical eight faults | historical 7 firm / 1 provisional | 8 firm / 8 |
| Seal packet issues | 7 at 2813 | 1 |
| Duplicate declaration issues | 84 at 7f, 29 at 2813 | 1 |
| Foreign HBL issues | 60 at 7f, 19 at 2813 | 1 |
| Missing reference issues | 53 at 7f, 2 at 2813 | 1 |

Final B first-candidate field accuracy was 82/83 and after native recovery 83/83, with 83/83 selected fields independently verified. Recovery is not initial AI accuracy.

The 51 original issue IDs are individually audited by physical PDF hash / field / page / native row: 47 native proofs and 4 whole-versus-member scope proofs. The four are not treated as numerical equality (600 is not 1,000). Original checks remain available.

The Seed/recitation correction independently rechecks actual cited HS/quantity cells and their shared native row, then verifies the full cargo-description cell while preserving product/model identity. Count annotations do not become model attributes; original candidates and citation failures remain untouched. Missing containers are seeded only from closed native rows with proved unique HBL scope; user edits/OCR/foreign HBL and ambiguous candidates remain protected. After anchor recovery, the original numeric citation is checked again against that exact owner rather than arbitrarily selecting a repeated number.

Allocation hints attach soft dependent checks to a proved reference cause. Identical duplicate-number allocation records are collapsed only inside a causal hypothesis, never in actual shipment membership or arithmetic approval. Duplicate and missing-reference packets still do not have a confirmed declaration sum; literal foreign HBL conflicts remain confirmed. Different actual values remain separate.

## Independent evidence and limits

Blind D was frozen before its first paid call and never used for tuning. An earlier 986 response/evaluation file was withheld and not inspected for the independent Development HS-cause fix; its results were not used as this final-source success. A separate 06a evaluation also passed 58/58 and was preserved; the later bilingual-country fix was driven solely by the Set2 response, not D. The same frozen D was evaluated again on the final SHA, separately preserved. It is one synthetic shipment / 4 PDFs: 58/58 selected native fields, classification 4/4, business issues 0, confirmed FP 0. This is limited evidence, not broad real-customer or scanned/OCR accuracy certification. Truth was evaluator-only and never sent to the provider.

Canonical eight errors use 8 newly analysed physically modified Manifest PDFs and two same-source actual parent results per packet (16 reuses, not 16 new calls). All six parent shipments were newly analysed on this source. A missing parent-list entry interrupted one evaluator after the quantity extraction; that paid result was preserved and used after the parents were added. No duplicate extraction was charged for that pause.

Paid calls, free original-candidate verification and MOCK unit tests are separately labelled. New native evidence invalidated old semantic keys: no stored opinion was relabelled as a new call. 3 provider document failures are separately recorded (the first two were 45-second limits on intermediate 2813); each unknown upper cost stayed reserved and successes were retained. Intermediate direct API recovery retried only failed/unattempted PDFs. The earlier 06a A browser flow had one Manifest timeout (three successes preserved); its partial page and receipts were archived, then a separate manually initiated complete browser flow was evaluated with four new PDFs, rather than relabelling that partial page as success. No automatic retry or Gemini fallback was added.

## Quality, UI and preservation

860 unit / 70 browser tests, npm ci, strict TypeScript, ESLint, Production build and analyze/recover PDF worker traces passed. Intermediate unit timeouts and deliberate aborted gates are recorded in main PROGRESS.md; timeouts/assertions were not weakened. Native heading lookup equivalence: 3,744 queries / zero differences; microbench is not an API latency claim.

Three additional actual official-site browser flows (A / Set2 / Set3) passed desktop and 390px mobile with fresh extraction + meaning, correct sources/count units, zero action issues for normal inputs, and no horizontal overflow. Original user PDFs, provider bodies and screenshots remain private.

The initial five-minute local deployment observer expired while the deployment was pending; a later observer verified the same SHA without changing code or rerunning the quality gate. GitHub quality and production checks passed; Vercel Git deployment success and official exact SHA were checked. No authenticated Vercel management Ready query was available. Evidence commits are on validation/phase39-evidence so the validated main SHA remains unchanged.

## Cumulative budget

Same live-phase39 ledger: 464 document attempts / 616 requests; measured estimated USD 0.6798426100000009; unknown maximum USD 0.07450616250000036. Caps remain 1,000 / 1,500 / USD 2. Earlier usage and unknown costs were never reset or combined with phase36/37 budgets. Actual billing is not independently queried. The bilingual-country qualification fix was validated across the existing fifteen supported countries, with code/name conflicts and unknown qualifiers still rejected. Set2 document-wide count recovery was already valid: the browser verifier was corrected to inspect proved document-wide quantity instead of incorrectly requiring an item-row value.

Remaining limits include source-unproved optional fields, unsupported layouts/scans and complex product identities where model/ownership evidence cannot establish a unique counterpart. Such cases remain provisional; the additional multi-product model-conflict packet was conservatively provisional on the prior source and was not converted into a firm verdict by hiding checks.
