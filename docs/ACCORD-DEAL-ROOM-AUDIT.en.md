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
- The 17-item UI and functional acceptance audit below is complete within the disclosed test-asset scope. This does not establish unlimited production financial readiness or reliable autonomous model convergence.

## Prior production deployment

- URL: https://agent-spending-firewall.vercel.app
- Deployment: dpl_FS6artqdb9N48W7evCXFHcmjaRFD (production, READY).
- HTML, JS, CSS and favicon returned HTTP 200 with SHA-256 equality to the tested local build.
- Production /api/live returned HTTP 200, available=true, qwen3-32b and its fresh 60-attempt allowance.
- Final-preview Live session creation and Stop persistence were verified without extra model calls.
- Production browser rendering was inspected and its error log was empty. Screenshot: artifacts/accord-lock/deal-room/production-live-release.png.
- Main includes the release commit 83a91ff and merges the concurrent validation evidence at dc0d93d. That merge adds verification scripts and evidence only; deployed application files are unchanged.
- Post-deploy runtime log inspection showed the production Live GET returning 200 and no error entries in the observed release window. Long-term monitoring/drains were not configured by this task.

## Final UX acceptance refinements

Live Agents now uses the same illustrated participants and two named Gate panels as Guided Demo, with a mobile mandate summary and a transaction timeline. CSV/JSON can also be pasted into custom-task creation; a four-row/four-source synthetic table was created through the actual preview UI and bound to Live negotiation.

A real 1,200-token custom-task response was truncated and safely rejected. Its screenshot is retained as live-truncated-response.png. The completed 20-case comparison in the validation worktree showed nine truncations at 1,200 and none at 2,400; this release raises only the Live output ceiling to 2,400. This prevents observed truncation, not all model mistakes, and does not establish general negotiation reliability. Historical procurement settings stay unchanged.

The durable Live coordinator now retains every reserved model attempt, completion/failure/Stop status and allowlisted usage metadata. Late responses after Stop cannot apply a proposal, but their measured usage remains inspectable. The Proof drawer exposes this attempt ledger; private prompts are not exported.

All 45 targeted tests passed again after these refinements, followed by a focused failure-telemetry/Stop regression. A browser extension setting prevented automated file-picker injection; the existing file-input path remains, and the actual paste/import workflow was verified without changing browser permissions. Three-minute presentation instructions are in ACCORD-THREE-MINUTE-DEMO.en.md.

## Requirement-by-requirement design audit

The numbered rows correspond to the supplied 17-part design brief. Financial execution remains the explicitly disclosed private-EVM test workflow; the separately labeled Sepolia run is historical evidence.

| Item | Implementation inspected | Runtime or source evidence |
| --- | --- | --- |
| 1 | Product flow replaces the quote-form dashboard; protection events and two gates have separate states. | Actual guided authority and invoice blocks, plus current Live mobile screenshot. |
| 2 | Product positioning is agreement enforcement, with payment tied to agreed terms. | Overview headline and value statements; mismatch prevents settlement in browser tests and UI. |
| 3 | Overview is the default route, with animated agent illustration and Run the demo / See public proof actions. | Production rendering; overview() markup, scene animation CSS, pause control and reduced-motion rule. |
| 4 | Deal Room exposes participants, negotiation, mandate, agreement, escrow and activity. | Guided walkthrough and final Live desktop/mobile rendering; liveView activity ledger. |
| 5 | Three distinct server-side policies, separate actor input and identities. Buyer receives no seller floor. | live-negotiation.mjs policy definitions; private-context isolation test; inspected actual public-input drawer. |
| 6 | Guided authority is 40 total / 30 per deal; 22/35/27 offers; 35 > 30 blocks before funding. | Fresh HTTPS guided walkthrough and retained browser-EVM checks. |
| 7 | Guided 18 counter receives 20 revision; acceptance, bilateral workspace signatures and locked agreement are visible. Actual Live terms come from model responses. | Guided browser walkthrough; actual Live signed receipt; both-signature recovery tests. |
| 8 | Invoice 25 against agreement 20 stops payment even inside authority; correction permits exactly 20. | Disabled payment control, corrected payment and VALID receipt observed. |
| 9 | Authority Gate and Agreement Gate are separately named with distinct comparisons and states. | Guided and Live markup, browser render and financial tests. |
| 10 | Protection uses white cards, restrained violation color and no-signature/no-funds facts. | Desktop/mobile protection screenshots; final Live color specificity fix. |
| 11 | Speaker messages differ visually from Accord events; model failures remain events, not accepted proposals. | Current Live timeline and real rejected Buyer attempt with measured usage. |
| 12 | Technical hashes, signatures, transactions and receipts are inspected in a drawer; public evidence is separate. | Download followed by VALID verification; actual model/proof drawer interaction. |
| 13 | Guided Demo is labeled deterministic; Live Agents makes actual qwen3-32b calls with inspectable request IDs, public input, output and usage. | Deployed negotiation/receipt JSON and final custom-task actual request IDs. No recorded message is labeled a new Live call. |
| 14 | Existing source parsing, work, invoice, settlement/refund, Stop and recovery paths are reused. | 45 targeted tests including actual EVM bytecode, persistence and local API; custom table creation through the browser. |
| 15 | Visual hierarchy is participants → proposals → agreement → gate decision → money → optional proof. | Three-column desktop and compact mobile mandate summary; central agreement/protection scenes. |
| 16 | Overview / Deal Room / Deals / Proof are the four primary navigation destinations. | Rendered navigation and persisted task reopening. |
| 17 | White/pale-gray surfaces, cobalt primary, red buyer/violations, blue sellers, muted green success and amber escrow. | Production and mobile screenshots, shared typography/layout and illustration styles. |

The current presentation plan uses one story and explicit clicks. It does not depend on real-model convergence within three minutes. A completed real-model negotiation and its test settlement are retained separately, while failed model runs are preserved rather than replaced with simulated success.

### Custom-input Live UI acceptance

The operator pasted a synthetic four-row, four-source CSV, created “Example Energy CAPEX review,” and ran six actual model calls through the deployed UI. Atlas proposed 35, Buyer countered 30, and Atlas revised to 32. A subsequent invalid Buyer response was rejected with `LIVE_BUYER_AUTHORITY`. Switching to Nexus produced 40 followed by Buyer's 30 counter. All six attempts and 8,889 measured tokens are retained, including the rejected response. The operator then stopped this session without signing or funding it. This run demonstrates custom-source binding, inspectable actual inference, authority protection, seller switching and Stop; it does not demonstrate a completed agreement or payment.

Public evidence: `artifacts/accord-lock/live/custom-negotiation.json`, `custom-attempts.json`, and `custom-demo-input.csv`. Both new JSON artifacts passed the public-data validator. `artifacts/accord-lock/deal-room/live-custom-stopped.png` records the stopped state and failure timeline; `live-mobile.png` records the 390px layout. The full public session is exported without owner hashes, HMAC envelopes, operation records or private policies.


## Final integrated production validation

Deployment `dpl_2vqmTVgnwiy8LFnatuijvojHy7AU` is promoted to [the existing production site](https://agent-spending-firewall.vercel.app). Its application source is commit `e85e155`; the subsequent merge of `b36b816` adds only retained custom-run evidence and documentation. No later application source changed.

[Deployment record](../artifacts/accord-lock/varied-live/deployment.json): HTML, JS, CSS and icons match the verified build byte-for-byte; private source/environment paths return 404. The protected candidate was checked through official Vercel CLI, then the public production URL was checked independently. Live GET returned 200 / qwen3-32b / available, and the actual production Live screen displayed the connected service. The final release made no additional model calls and did not reset the existing ledger. [Production screenshot](../artifacts/accord-lock/varied-live/production-live.png).

The integrated local suite passed **233/233**, all application builds passed, the current Git-visible secret scan found no matches and the dependency audit reported no known vulnerabilities. The [fresh varied Kiln study](ACCORD-LIVE-VALIDATION.en.md) retains all model failures and reports 20/20 private-EVM financial cases with zero unauthorized settlements. Existing 640 generated financial cases are reused with matching contract evidence. This completes the requested connection and validation work; model reliability and independent real-money operations remain explicit limits.
