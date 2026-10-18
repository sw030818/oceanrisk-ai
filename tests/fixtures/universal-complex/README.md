# Supplemental synthetic complex stress

One independent normal shipment with four PDFs: HBL, two separately declared
items, and Manifest. Two-page native tables; numeric model `10000`; explicit
HBL/two declaration references; separate item totals and container allocations;
Manifest goods-cell PCS/CARTONS annotations; Korean-only additional 750mL
specification; VANCOUVER vs VANCOUVER, CANADA with explicit destination country.

No original attachment, company, or template bytes are used. This supplementary
stress does not replace or modify the locked blind holdout or its truth hashes.
The four PDF hashes and evaluation-only truth are pinned before its first call.

Reproduce with `python generate.py --font=/path/to/Korean-capable.ttf`.
The live runner reads the manifest/PDF only, never truth.json. All missing and
unresolved scopes must be reported, including normal multi-declaration holds.
