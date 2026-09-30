# Accord Lock — product entry and conversation workflow

This update follows the supplied landing-page and three-column workspace references. The homepage is now the default entry. It explains pain points, the two-gate solution, current technology and future Furiosa × Bricksum expansion, then offers Try Demo or Go Live. Roadmap items are explicitly future directions, not deployed integration claims.

## Primary workflow

The workspace shows a human/agent conversation in the center, editable policy and money summaries on the right, and navigation on the left. The former absolute-positioned graph is no longer the default view. Execution flow is a responsive grid of confirmed/pending stages, with no crossing lines or overlapping graph labels. Detailed Deal Room and historical proof remain separate destinations.

Users can type a task, edit total budget, per-deal maximum and delivery deadline, and send a counteroffer in Demo. Demo uses the existing deterministic worker. Live uses the same workspace with actual Kiln/qwen3-32b responses. Free-text guidance is sent with the next valid offer/counter/respond call, retained in its public input and attempt record, and included in the service operation fingerprint. It cannot change the immutable request, private seller policies, validation, signatures or settlement. No new protocol action, signature schema or contract was introduced.

Editing an unbound Demo policy uses the existing edit transition and resets offers for fresh negotiation. Editing a bound Live mandate or funded deal starts a new purchase; the old transaction remains saved. Higher budgets do not manufacture an Authority Gate incident. Lower limits continue to block commitments through the existing validator.

## Amounts and evidence

All primary prices use the `$` symbol with a persistent **test USD — no real funds** label. This is a presentation denomination for existing whole test units, not a token or currency integration. Red means buyer expenditure, green means seller receipts, amber means escrow, and blue means uncommitted spending authority. The latter is calculated as budget minus paid minus active escrow, not represented as a cash deposit or returned change.

Demo orchestration pauses at actual authority and invoice violations, displaying the reason and a saved-incident inspection action. Conversations remain visible as recorded events. User annotations persist in local storage per task and are explicitly distinct from signed agent messages. Export conversation & incidents downloads the current task, events, notes, public Live messages/attempts, and any available receipt/verification. The original cryptographic receipt is not modified. Historical Sepolia evidence stays separate from current private-EVM execution.

## Validation

**2026-09-30: 241/241 tests passed, zero skipped**, with matching source hashes at the beginning and end of the full Deal Escrow regression suite. See [regression.json](../artifacts/accord-lock/product-workflow/regression.json). The added tests check human guidance transport, idempotency binding, invalid guidance rejected before a billable call, guidance unable to override authority, larger/lower custom Demo limits, and fresh negotiation after policy edits. Existing contract, bilateral signature, settlement, privacy and STOP tests remain intact. Production build and the existing security scan passed.

Browser verification used the actual UI at **1920×1080, 1440×900 and 390×844**:

- Set budget to **$60** and max per deal to **$30** through Edit; sent a custom task through the composer. The actual $35 offer paused at Authority Gate.
- Typed a **$19** counteroffer with a human note. The deterministic seller revised to **$20**. Reload restored both the note and recorded negotiation.
- Approved the deal with Enter. Escrow confirmed, delivery completed, and the actual sample **$25** invoice paused at Agreement Gate. No payment appeared before approval.
- Paid the corrected $20 invoice. Receipt verification returned **VALID**. Exported JSON includes the custom $60 budget, $19 instruction, $20 payment, 18 task events, the blocked incidents and original receipt verification.
- Edited another in-progress Demo to **$80 / $50**, requested offers again, and observed **no current Authority Gate incident**. Earlier events remained in history; negotiation completion from the previous mandate was not reused.
- The nine execution cards had **zero overlapping bounding boxes** at 1920px and 390px; no horizontal overflow. Enter opens gate inspection and Escape closes it. The Reduce motion override produced zero active CSS animations.
- Two fresh actual Kiln calls: direct task entry returned Atlas **$30**; an additional typed instruction returned Buyer **$25**. The latter's public model input contains the exact `humanGuidance`. Request IDs: `chat-a47783132a2c4ff6912e63d04d6c9191` and `chat-f4a6e9babbe44cd098bc197539fc3f6e`; 1,405 and 1,478 tokens respectively. STOP then removed the input and commitment actions. This check does not claim a new full Live settlement.

Evidence under `artifacts/accord-lock/product-workflow/`:

| Artifact | What it shows |
| --- | --- |
| [home-1920.png](../artifacts/accord-lock/product-workflow/home-1920.png), [home-1440.png](../artifacts/accord-lock/product-workflow/home-1440.png) | Product entry, two choices and explanatory sections |
| [home-mobile-390.png](../artifacts/accord-lock/product-workflow/home-mobile-390.png) | Mobile entry |
| [conversation-1440.png](../artifacts/accord-lock/product-workflow/conversation-1440.png) | $19 counter, $20 revision, editable $60 policy |
| [incident-1920.png](../artifacts/accord-lock/product-workflow/incident-1920.png) | Saved $25 invoice incident before payment |
| [flow-1920.png](../artifacts/accord-lock/product-workflow/flow-1920.png) | Separate, non-overlapping execution steps |
| [paid-1920.png](../artifacts/accord-lock/product-workflow/paid-1920.png), [mobile-390.png](../artifacts/accord-lock/product-workflow/mobile-390.png) | Confirmed payment and mobile workspace |
| [edited-policy-1920.png](../artifacts/accord-lock/product-workflow/edited-policy-1920.png) | $80 / $50 authority without a manufactured block |
| [live-direct-message.png](../artifacts/accord-lock/product-workflow/live-direct-message.png) | Actual typed instruction and Kiln response |
| [conversation-export.json](../artifacts/accord-lock/product-workflow/conversation-export.json) | Downloaded Demo task, annotations, incidents and verified receipt |
| [live-conversation-export.json](../artifacts/accord-lock/product-workflow/live-conversation-export.json) | Downloaded public Live input/output and human guidance |

Previous presentation screenshots remain historical. The original [presentation document](PRESENTATION-FLOW.en.md) is marked accordingly.

## Scope and limitations

Production verification: implementation commit `72c0c78` is on main. [The root homepage](https://agent-spending-firewall.vercel.app/) serves production deployment `dpl_BCbNtgiFm9ZzKHgRnfPQji6kWWKW` (READY). Its JS and CSS hashes match the tested build; `/api/live` returned HTTP 200 with qwen3-32b available. Browser warning/error output was empty, and the deployment error/fatal log query returned no entries at verification time. See [deployment.json](../artifacts/accord-lock/product-workflow/deployment.json).

The current worker still normalizes supplied CAPEX source rows; it is not a general web-research agent. Custom files remain available through Detailed Deal Room. Demo free text describes the task or records an annotation; the explicit counteroffer amount drives its deterministic response. Live free text reaches the actual model at the next valid negotiation turn. Financial approval remains an explicit action.

Only the public guidance input plumbing changed in `src/accord/live-service.mjs` and `src/accord/live-negotiation.mjs`. Financial validation, contract units, signatures, settlement, private seller policies, call limits and STOP behavior were not redesigned. Human annotations are browser-local and not cryptographic proofs. Clearing site storage removes browser-local tasks and annotations. OS-level reduced-motion emulation was not available; the shared UI override and CSS media rule preserve the same state meaning.
