# Independent synthetic evaluation corpus

12 new shipments / 36 normal PDFs + 8 physically rendered faulty Manifest PDFs.
No attachment bytes, private company documents, Set2/Set3 templates or identifiers.

Seven separate page compositions (`boxed`, borderless `ledger`, `split`, Korean
`form`, `landscape`, definition-band `stacked`, and multi-page `continuation`)
share only low-level text/table primitives. Different roles use different
compositions within the same shipment. Every PDF is visibly synthetic.

Development 01–06, locked holdout 07–10, complex/stress 11–12. The holdout lock
pins the PDF and truth hashes BEFORE the first paid baseline. Only the scorer
reads `truth.json`; the live runner reads PDF bytes and `manifest.json` only.
If holdout results drive a code change, retire that holdout for tuning and
create a fresh locked partition before claiming blind results.

The producer takes an explicitly supplied Korean-capable font. Embedded font
bytes allow deterministic native PDF text extraction. Generated binaries and
hashes are committed as public synthetic fixtures for reproducibility.
