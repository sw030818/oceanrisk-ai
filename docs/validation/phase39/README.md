# PHASE 3.9 — implemented and free-verified; new paid E2E pending

Source / Production SHA: `a57ffaf10e836f74e2e2cffb1d551d632cc4e678`.

This evidence branch records results without changing the deployed source SHA. No actual customer PDF, raw response, source text, API key or business identifier is included. Public PDF fixtures are explicitly synthetic.

## Implemented flow

Per-PDF first Responses extraction → existing independent native proof/recovery → verified same-HBL product candidates across all successful upload batches → one additional strict Responses semantic request → exact field/quote/block and owner checks → existing UI. New commodities do not need to be added to the old product vocabulary. That vocabulary remains an auxiliary deterministic check, not the semantic candidate gate.

`semantic-*.ts`, `/api/semantic`, the signed snapshot attachment in `/api/analyze`, and the workspace's data hook implement this flow. The schema, request builder, candidate context, native validation, orchestration, receipt and final integration are separate modules. Existing source/current/original/recovery, user corrections, numeric/reference/multiple-declaration checks and raw check history remain available. UI/report DOM and styles were not redesigned.

AI language equivalence/difference is provisional. Native common model/size/specification labels and differing actual printed values require independent proof and unique complete item scope for a confirmed difference. Missing qualifiers are not invented. A multi-model KIT cannot be cherry-picked into a confirmed difference. A commodity word cannot be relabelled as a model header. Empty, nonexistent, wrong-owner or stale citations are rejected. Modified user fields invalidate the old semantic result without an automatic AI call.

The server uses an expiring, source-SHA-bound HMAC receipt to reject client-forged verified material before the second paid call. This is transparent request integrity, not a login or access code. Same Origin, streamed 3MiB JSON limit, 24-document bound and timeouts apply. Exact text needs no extra model request; PDF-only mode calls no provider. Failure preserves independently completed extraction/comparisons and displays safe quota/error reasons. No automatic retry or fallback was added.

## Verification categories — do not combine as AI accuracy

| Evidence | Result | What it establishes |
| --- | --- | --- |
| Final local ship | npm ci, typecheck, lint, 720 unit tests / 43 files, Production build, both PDF worker traces, 69 Production-server browser tests pass | Code/runtime/mock regressions, not actual model accuracy |
| Independent ReportLab PDFs | 54 PDFs, 18 shipments, three layout families, native correct-candidate classification 54/54 and current field proof 1593/1593 | Source grounding given oracle candidates, not first AI extraction |
| Development oracle + MOCK meaning | 17 shipments: before 10TP/0FP/2FN → after 12TP/0FP/0FN, independent fault-meaning scoring | Deterministic behavior given explicit mock opinions; provisional suspicions are not confirmed TP |
| Blind Holdout | Native PDF readability only; semantic holdout not evaluated | Not used to tune semantic prompt/rules |
| Private actual Set2 | Three proved source products, two requested semantic edges, MOCK incomplete-equivalence opinions, zero confirmed false positives | Native/oracle + mock behavior; no new first extraction or meaning API result |
| Prior actual PHASE37 responses, free replay | 14 shipments / 44 documents, 1082/1090 source fields, 4TP/0FP/0FN | Current deterministic regression using saved actual earlier responses |
| Prior actual original responses, native replay | Two saved sets, core 9/9 each; goods/HS scope holds preserved | Not another five live repetitions |
| Exact-SHA Production browser | Actual attached Set2 PDFs, three documents / two prepare batches, 226/92/67 blocks, desktop/mobile, provider requests 0 | Real deployed PDF-only path, not AI analysis |
| Exact-SHA semantic endpoint | Invalid unsigned input returns 400 / aiCalled:false | Deployed pre-provider validation |
| New paid OpenAI E2E | **NOT RUN: 0 documents / 0 requests / $0** | New extraction/meaning accuracy, latency and actual cost remain unmeasured |

Development goods include chairs, laptops with RAM differences, industrial model codes, apparel material/size, unfamiliar membranes, reversed item rows, different-HBL input and printed quantity/package/weight/container/Seal/HBL/HS faults. New PDFs are independently generated synthetic forms, not 18 independently sourced customer layouts. `free-final.json` records every development outcome and the exact scoring definition.

The initial release attempt found one strict status response-contract mismatch. Only the two new safe metadata fields were added to its exact expected response; secret non-disclosure checks were retained. Subsequent quota-message and multi-model ownership findings were fixed before Push, with new regressions. Final gate has no test failure.

## GitHub / Production

- main was normally pushed; origin/main, local source and public Production SHA agree.
- Actions run https://github.com/sw030818/oceanrisk-ai/actions/runs/38852023074 completed successfully: quality and production.
- Vercel Git deployment success and public exact-SHA Production response confirmed; deployment `dpl_ADBE52SkAHCaTeGLSMCrsQGm6bRU`.
- No privileged Vercel control-plane Ready query was made; do not equate the public response with a separate management API query.
- Client build scan: 11 JS files, no server secret/signing markers. Previous PHASE37 ledger hash remains `90d2b5f39a9a1d646653baca45770bdf173c0bf20922a04d214c13e78af68aa6`.

## Remaining work / limits

New actual OpenAI E2E is required to complete the requested PHASE3.9 validation, and is awaiting separate user approval. The $10 / 60-document / 120-provider-request policy is a **proposal**, not spend authorization. No earlier budget was reused. The prepared runner keeps a separate live-phase39 cumulative ledger, reserves each request first, retains unconfirmed timeout cost and never resets on a new code SHA. Plan: Set2 first3 + development17×3 + final same-SHA Set2 repeat3 + blind holdout3 =60 document attempts, at most80 normal provider requests. The final six documents are held back in the evaluation plan. Expected source-shape reservation estimate is about $0.824; actual provider requests are bounded individually and stop at the approved caps. Automatic retries:0.

Set2 HBL complete product scope is not fully proved in the oracle case, so related goods/HS holds remain. A correct source number or model opinion does not erase a scope limitation. Actual changed-package source retains its changed value and a provisional difference rather than being silently corrected to another document. Language/material opinions without independent literal proof remain provisional. Semantic candidates currently require verified same HBL; declaration-only/ambiguous multi-shipment associations retain the existing deterministic/manual path. More than40 candidate pairs,24 signed documents or3MiB request data can leave explicitly incomplete semantic review while other checks remain available. No unsupported new OCR, EDI, legal risk or UI redesign was added.
