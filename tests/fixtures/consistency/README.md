# Independent synthetic multi-declaration evaluation

These PDFs contain invented businesses and transactions. No customer PDF or raw
provider response is included. `generate.py` renders native PDF text and cells;
it does not call a provider. `manifest.json` supplies only input file hashes and
types to the existing live transport. `truth.json` is evaluator-only and is never
imported by request code.

- Development B: five PDFs, three declarations/products/containers, bilingual
  descriptions, explicit model identifiers, separate property ribbons.
- Holdout D: four PDFs, different products/company/models, side-by-side property
  ledger and a separate container allocation page. Hashes and evaluator truth
  were frozen before its first provider call in `holdout-lock.json`. Do not use
  its result for tuning without retiring it and creating a new holdout.
- Eight fault packets physically change quantity, model, HS, seal, declaration
  membership, duplicate declaration, total, or HBL ownership. Each packet is
  independently extracted; a fault is never injected into an AI response.

Run `scripts/universal/complex.ts --corpus=consistency --case=<case>` with the
explicit existing phase39 approvals and exact deployed source SHA. Score using
`scripts/universal/score.ts --consistency-input=<private response> --out=<safe summary>`.
Private response files stay in ignored test-results. Free MOCK/native tests and
new paid analyses must be reported separately. Normal packets should produce no
confirmed false positive; fault packets are scored against their specific cause,
not against any unrelated warning.
