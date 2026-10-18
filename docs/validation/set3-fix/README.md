# Set3 engine fix — 7884bb3c62976c129f0006ce5b6f140791c5720c

POD normalization lacked Canadian port records and treated unresolved raw strings as confirmed differences. The bounded sourced port subset now distinguishes CA/US Vancouver, and only an independently verified own-document destination country qualifies an ambiguous POD. Raw text stays unchanged. Equal literal codes compare as reported codes; different unresolved places remain provisional.

The actual baseline OpenAI Manifest candidate was already correct (10000 PCS, same goods-cell block), but its verifier allowed only quantity/package columns. Literal count atoms and existing cargo-description suffixes can now verify only in the same native owned goods row. Standalone count annotations cannot become product names. Monetary/exchange-rate cell labels prevent a distant quantity header being inherited by declaration amounts. No UI or report layout changes.

Free saved-response replay: confirmed false mismatch 1→0; independent action issues 3→0; matches 11→12; raw checks 61 preserved. Set2 saved-response replay retains 12 matches/0 false mismatch/0 action issues. Changed actual PDF source controls detect quantity, packages and POD differences separately. These are not new AI extraction tests.

Final paid normal Set3: classification 3/3, confirmed mismatches 0, matches 12, action issues 0; same-atom verified quantity/unit true; package proof true; POD match true; quantity match true. Read each live report for first candidates/recovery, reused parents, errors and costs.

Gates: npm ci, typecheck, lint, 754 units/45 files, Production build, analyze+recover PDF workers, 70 browser tests. GitHub Actions and Vercel public SHA evidence are in the adjacent files. Vercel management API Ready was not queried; GitHub deployment state and actual public same-SHA behavior are recorded separately.

Cumulative PHASE39: 59/60 documents, 86/120 requests; measured estimated USD 0.09610239499999998; unresolved prior upper USD 0.012626350000000003; cap USD2, automatic retries0. No old ledger resets.
