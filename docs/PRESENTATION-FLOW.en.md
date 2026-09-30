# Accord Lock — Presentation flow

> Historical design record. The subsequent [product workflow update](PRODUCT-WORKFLOW.en.md) makes the homepage the default entry and conversation the primary workspace. This document and its screenshots describe the preceding graph-first revision.

## Before implementation: state-to-graph contract

The detailed Deal Room prioritizes the roster, chat, controls and event log equally. Presentation instead prioritizes a transaction graph, one current decision, four financial values and one primary action. Conversation, request IDs, signatures and receipts remain available through Inspect and the unchanged detailed room.

This mapping was written before implementing the view. Graph states are projections, not new persisted protocol states.

| Existing state / event | Graph node | Graph edge | Visible motion, only after confirmation | Available action |
| --- | --- | --- | --- | --- |
| No job | Human, draft mandate | None active | None; future nodes say Pending | Delegate task |
| Task create returns DRAFT, Task created event | Human → Mandate → Buyer | human-mandate, mandate-buyer | One cobalt delegation packet | Continue delegation if interrupted |
| quotes response contains Requested offers + offers | Discovery, Atlas / Nexus / Orbit | buyer-discovery, discovery-seller | Fan-out and returned quote packets with actual offer amounts | Continue from saved quotes |
| BLOCKED with selected offer over budget/perDeal | Authority Gate | selected seller-authority terminates at gate | Restrained red ring; downstream edge inactive | Let Buyer negotiate |
| select Atlas; counter 18 returns counterPrice 20 and events | Negotiation | authority-negotiation; Buyer ↔ seller packets | Actual event amounts 22 → 18 → 20 | Approve signed Deal |
| counter accepted; fund request pending | Proposed Deal | No funded edge | Pending only; never show a confirmed signature or payment | Await / inspect; retry saved operation |
| fund returns agreementSignatures, dealHash, confirmed fund transaction, LOCKED | Bilateral Deal, Escrow | signatures-deal; deal-escrow | Signatures converge; confirmed amount moves to escrow | Execute delivery / resume approval |
| Local Node edition LOCKED without exported bilateral signatures | Committed Deal, Escrow | deal-escrow | Confirmed escrow; do not invent two signatures | Execute delivery |
| run returns output, validation, invoice, REVIEW | Delivery, Invoice | escrow-delivery, delivery-invoice | Evidence packet and actual invoice | Review mismatch or pay valid invoice |
| REVIEW invoice differs from agreedPrice | Agreement Gate | invoice-agreement ends at gate | Red rejection; separate budget and agreement comparisons | Pay corrected invoice (Guided only) |
| invoice correction response equals agreedPrice, validation verified | Agreement Gate | invoice-agreement | Green match; settlement remains Pending | Confirm settlement / resume |
| settle returns COMPLETED and confirmed release | Settlement | agreement-settlement | Confirmed payment packet to seller | Generate / inspect receipt |
| Existing receipt endpoint returns; verify returns VALID | Receipt | settlement-receipt | Receipt reveal; verified claims only from verification result | Inspect technical proof, download receipt |
| Live session created, current.pending / request actually running | Same mandate / selected agent | Same graph, request edge pending | Thinking indicator; no invented price | Stop or refresh |
| Live messages returned, per-seller actor/quote fields | Same seller and negotiation nodes | Same quote / term routes | Actual quoted price and turn; no saved-output replay | Buyer counter / seller response / switch seller |
| Live current.error or rejected attempt | Selected actor / Authority Gate when authority error | Stops at failed node | Proposal rejected; public reason, no success path | Retry valid next step / switch seller |
| Live agreement returned with both signatures | Same Bilateral Deal | signature convergence | Actual signed price | Explicit approve and fund |
| Live authorization + existing live-import/fund/run | Same escrow / delivery / invoice | Same execution graph | Only confirmed workspace state; no authored overcharge | Pay actual matching invoice |
| authorityRevoked / session.stopped | Mandate | Future commitment paths stop | Static stopped marker | Inspect; existing funded obligations retain existing semantics |
| FUNDING / SETTLING / REFUNDING or failed request | Relevant node | No unconfirmed completed edge | Pending / failure; retry from actual persisted state | Resume existing operation, detailed inspection |
| REFUNDED / CANCELLED | Settlement / Mandate | No paid edge | Explicit terminal outcome | Inspect / new story |

## Four Guided actions

1. **Delegate task**: create the existing 40/30 sample, request its three deterministic quotes; the existing automatic sample authority check blocks Nexus 35.
2. **Let Buyer negotiate**: select Atlas and submit the existing 18 counter; display the returned 20 revision. This does not sign or fund.
3. **Approve signed Deal**: accept the returned revision, fund through the existing workflow, execute the source-table worker. Show the actual demo invoice 25 and Agreement Gate rejection against 20.
4. **Pay corrected invoice**: correct to the actual agreed price, settle through the existing exact-invoice checks, retrieve the receipt and verify it. No automatic correction is applied to Live invoices.

Actions are serialized, await every mutation, and resume from the returned job state after failures. Brief visual holds occur only after committed events, not before. The three-minute story does not need a model call.

## Live behavior

The same projector and graph use current Live session messages and workspace execution data. Actual Kiln calls remain explicit, never substituted with Guided outputs. Live mode uses its own route and task binding. Rejection, call limits, stopped sessions and pending requests remain visible. Model evidence is nested inside the Inspect drawer. Detailed mode retains all low-level controls.

## Integrity rules

- No contract, protocol, private policy, Kiln identity, settlement, STOP or evidence-model change.
- A price proposal is not a signed deal. A pending transaction is not a payment.
- A funded deal is shown only from confirmed workflow state; bilateral signature labels require exported signatures.
- Receipt assertions require an actual VALID verification; otherwise show unverified / failed status.
- Current execution remains private-EVM test units. Historical Sepolia is a separately labeled proof destination.
- Reduced motion replaces packets with the same static active paths, amounts, labels and gate outcomes.
- All graph nodes are keyboard-operable inspection buttons; primary actions are native buttons.

## Validation and evidence

Validation date: 2026-09-30. The complete existing Deal Escrow test set plus five new presentation tests passed: **238 tests, zero failures, zero skipped**. The [source-bound report](../artifacts/accord-lock/presentation/regression.json) records unchanged source hashes before and after execution. The static-site allowlist gained the three presentation files; its security assertions remain intact. Canonical historical validation reports and latest-evidence pointers were preserved.

The new tests exercise the four actions against the actual workspace/private-EVM engine, resumption without duplicate settlement, pending transaction boundaries, signature requirements, invalid delivery, revoked authority, Live rejection/STOP, mode isolation and shared graph rendering. The production build completed without a new animation dependency.

| Browser scenario | Result / evidence |
| --- | --- |
| 1920 × 1080 Guided, four actions with Enter | 37.586 seconds including checkpoint screenshots; 35 blocked, 22 → 18 → 20, invoice 25 blocked, 20 paid and receipt verified. Graph and primary action fit without scrolling. |
| 1440 × 900 Guided | Complete flow, persistent summary and action fit; reload restored the actual job. |
| 390 × 844 mobile | No horizontal overflow; vertical graph, sticky financial summary and action; gate inspection remains accessible. |
| Keyboard | Enter completed all four decisions; Tab reached the Agreement Gate; Enter opened Inspect; Escape closed it and restored focus. |
| Reduced motion | Explicit Reduce motion control preserved all amounts/outcomes; computed animation names were all none. The OS media-query rule is covered by source assertions; this browser tool did not expose OS preference emulation. |
| Genuine Live inference | One fresh Atlas request to Kiln/qwen3-32b returned **35** in 8,136 ms, 1,217 tokens; the graph showed Thinking, then blocked 35 > 30. Unrequested sellers retained “—”. No agreement or payment was invented. |
| Live operator controls | Seller switch offered Request Nexus without calling it. STOP removed new commitment actions. Latest build also preserved the Live task through Live → Guided → Live, with no extra inference. |
| Proof | Downloaded actual browser receipt, validated it with the existing validator; in-app local-chain verification returned VALID. Existing Detailed Deal Room opened the same paid task and retained delivery/event/control views. |
| Historical evidence | Separate Proof page retained its recorded-date notice, Sepolia links and 47-check evidence; explicitly distinct from current browser-private EVM. |

Public Live request evidence: [live-model-evidence.json](../artifacts/accord-lock/presentation/live-model-evidence.json), request `chat-6a17fc29036a4854a3f5f19f9eba7310`. This fresh check stopped after the blocked proposal; it does not claim a new end-to-end Live settlement. Existing Live and settlement regressions cover those boundaries without requiring model availability.

Screenshots are under `artifacts/accord-lock/presentation/`:

- [authority-1920.png](../artifacts/accord-lock/presentation/authority-1920.png): Authority Gate rejects 35.
- [negotiation-1920.png](../artifacts/accord-lock/presentation/negotiation-1920.png): actual 22 → 18 → 20 terms.
- [agreement-block-1920.png](../artifacts/accord-lock/presentation/agreement-block-1920.png): 25 < 40 but 25 ≠ 20; no settlement edge.
- [receipt-1920.png](../artifacts/accord-lock/presentation/receipt-1920.png), [receipt-1440.png](../artifacts/accord-lock/presentation/receipt-1440.png): 20 paid, receipt created.
- [mobile-390.png](../artifacts/accord-lock/presentation/mobile-390.png), [mobile-gate-390.png](../artifacts/accord-lock/presentation/mobile-gate-390.png): mobile summary and gate.
- [live-thinking.png](../artifacts/accord-lock/presentation/live-thinking.png), [live-authority.png](../artifacts/accord-lock/presentation/live-authority.png), [live-stopped.png](../artifacts/accord-lock/presentation/live-stopped.png): genuine inference, rejection and STOP.
- [receipt-verification.png](../artifacts/accord-lock/presentation/receipt-verification.png), [browser-receipt.json](../artifacts/accord-lock/presentation/browser-receipt.json): downloadable and verified current execution.
- [detailed-preserved.png](../artifacts/accord-lock/presentation/detailed-preserved.png), [historical-proof.png](../artifacts/accord-lock/presentation/historical-proof.png): retained inspection surfaces.

## Changed surface and preserved functionality

`web/spending/presentation-model.mjs` projects existing state and orchestrates the four Guided actions. `presentation-view.mjs` renders the shared graph and Inspect drawer. `presentation.css` supplies layout, finite event motion, mobile and reduced-motion styling. `app.mjs` binds routes, actions and persisted mode-specific jobs. `deal-room.mjs` only gains the Presentation navigation link; `index.html` loads the stylesheet. The static builder allowlist and static-site tests include these assets. `tests/deal-escrow/presentation.test.mjs` contains the new behavioral coverage.

The default route and `#presentation` open Guided Presentation; `#presentation-live` opens the same graph for Live. `#workspace` / `#live` retain the detailed Deal Room, `#overview` retains the product overview, and `#evidence` retains historical proof. Existing conversation data, technical proof, downloads, local verification, detailed controls and Seller Lab remain available. No files under `src/` or contracts were changed. Settlement, authority, bilateral verification, STOP, Kiln model identity, seller privacy and canonical historical evidence are unchanged.

## Remaining UX limitations

Production is available at [Presentation](https://agent-spending-firewall.vercel.app/#presentation) and [Live Presentation](https://agent-spending-firewall.vercel.app/#presentation-live). Implementation commit `2deac52` was pushed to main. Vercel production deployment `dpl_8Lyor1TQ6ebdwMRyfV45kYmEUom4` is READY; both served JS/CSS files match the tested local build byte-for-byte. The readiness endpoint returned HTTP 200 with qwen3-32b available. The checked browser reported no warnings/errors, and the deployment error/fatal log query returned no entries at verification time. See [deployment.json](../artifacts/accord-lock/presentation/deployment.json), [browser-validation.json](../artifacts/accord-lock/presentation/browser-validation.json) and [production-ready.png](../artifacts/accord-lock/presentation/production-ready.png).

- Guided intentionally uses the existing fixed source-table sample; custom task setup and low-level recovery remain in Detailed Deal Room.
- Live timing, invalid model output and call limits remain real. Live invoices are never automatically rewritten to manufacture the Guided story.
- Current execution uses private-EVM test units and existing operator-managed identities; the graph does not imply a fresh public-chain transaction. The Node edition does not export the browser's bilateral signature object, so it is labeled a committed Deal rather than displaying invented signature checks.
- Mobile uses a vertical scrolling graph instead of the desktop SVG routing. Desktop screen sharing remains the primary presentation format.
- Reduced-motion behavior was tested through the shared in-product override and CSS assertions, not by changing the operating system's accessibility setting.
- The 38-second run is an operator verification, not a first-time-judge usability study. The visual hierarchy makes the six required facts explicit; independent ten-second comprehension testing has not been performed.
