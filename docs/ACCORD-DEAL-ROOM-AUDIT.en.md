# Accord Lock release audit — 2026-09-30

## Product requirements

| Brief | Delivered behavior | Evidence |
| --- | --- | --- |
| 1–4, 15–17 | English Overview, illustrated agreement story, Deal Room, Deals and Proof. Cobalt/white, red buyer, blue sellers. Persistent mandate and payment controls. | Desktop and 390px browser inspection; no horizontal overflow. Stripe sandbox reference was inspected earlier. |
| 5, 13 | Guided simulation and actual Kiln qwen3-32b negotiations are distinct. Atlas, Nexus and Orbit have server-only private policies. Buyer receives public messages and its own mandate. | Protocol privacy tests; actual requests and bilateral signatures in artifacts/accord-lock/live. |
| 6–10 | 40 budget, 30 per deal; offers 22/35/27; 35 > 30 protection; counter 18, revised/accepted 20; 25 ≠ 20 blocks payment; corrected 20 pays once. | Fresh final-preview browser walkthrough, verified private EVM receipt VALID. |
| 11 | Speaker messages and Accord enforcement events have separate visual treatments. Live messages expose actual model, request ID, public input, output and usage. | Browser Live walkthrough and rendered metadata. |
| 12 | Current signatures, escrow hash, transactions and receipt verification in a proof drawer. Historical Sepolia evidence remains separate. | Download then verification works; actual signatures checked against current agreement. |
| 14 | Custom CSV/JSON, explicit worker execution, editable invoices, rejection/refund, Stop, persisted deals and retry recovery retained. | 45 targeted tests pass; real browser EVM funding and settlement exercised. |
| Manual three-minute demonstration | Operator drives each step. Guided story can be presented in three minutes without waiting for external inference. Live actions show what each model is doing and can be stopped. | Guided walkthrough; tour duration checks; actual Live request/response walkthrough. |

## Actual Live evidence

- The dedicated server transport calls the fixed Kiln endpoint and requires the actual qwen3-32b model, request ID and validated structured tool output. Truncated, malformed or substituted outputs fail closed.
- Private Vercel Blob persists sessions, revisions, authorizations and a shared call ledger. Atomic writes, signed HttpOnly owner cookies, same-origin request tokens and request-size limits protect the endpoint.
- Each session allows at most eight model attempts. The default environment-wide allowance is 60 lifetime attempts; failed calls count. This is a bounded pilot, not an unlimited inference service.
- Stop supersedes in-flight inference. Repeated operation IDs do not repeat paid work. Agreement authorization binds one task.
- Six direct verification model calls were retained, including the first agreement rejected for exceeding authority. Three deployed model calls produced 35 → 30 → 30, signed by both participants. A private browser escrow then blocked 29 and 35 invoices, paid 30 exactly once, and verified VALID. All retained evidence JSON passed the public-data validator.
- Latest browser enforcement binds both live signatures, source hash, row/source counts and negotiated delivery deadline to the escrow agreement. Automated tests specifically cover the eight-minute deadline and missing second source.

## Verification

45 targeted tests passed across browser EVM, local workspace, public build allowlist, tour, Live protocol, durable coordination, HTTP authentication and dedicated transport. A subsequent malformed Unicode-token regression passed after tightening token comparison.

Final UI artifact: index-VqtpDt7l.js / index-DmbklS-X.css. Final preview: https://agent-spending-firewall-hyx3oyl3a-mongben.vercel.app. A final server-only token validation fix was built after that preview; browser assets are identical.

## Honest boundaries

- Hosted Live negotiation uses actual inference. Delivery is the existing deterministic source-table worker; it does not perform autonomous web research.
- Current financial execution uses browser-private EVM test units, not real money or public-chain consensus. Signing keys are operator-controlled. Historical public Sepolia proof is clearly labeled.
- The older localhost Node workspace retains its deterministic worker and escrow flow; the new Live HTTP adapter is deployed on Vercel. Local Live parity is not claimed.
- Model negotiations can decline or produce invalid/truncated output. Such outputs cannot authorize funds. Broader model benchmarking is separate from this release's measured evidence.
- The larger design goal remains subject to its final acceptance audit. This release audit does not claim unlimited production financial readiness.

## Production deployment

- URL: https://agent-spending-firewall.vercel.app
- Deployment: dpl_FS6artqdb9N48W7evCXFHcmjaRFD (production, READY).
- HTML, JS, CSS and favicon returned HTTP 200 with SHA-256 equality to the tested local build.
- Production /api/live returned HTTP 200, available=true, qwen3-32b and its fresh 60-attempt allowance.
- Final-preview Live session creation and Stop persistence were verified without extra model calls.
- Production browser rendering was inspected and its error log was empty. Screenshot: artifacts/accord-lock/deal-room/production-live-release.png.
- Main includes the release commit 83a91ff and merges the concurrent validation evidence at dc0d93d. That merge adds verification scripts and evidence only; deployed application files are unchanged.
- Post-deploy runtime log inspection showed the production Live GET returning 200 and no error entries in the observed release window. Long-term monitoring/drains were not configured by this task.
