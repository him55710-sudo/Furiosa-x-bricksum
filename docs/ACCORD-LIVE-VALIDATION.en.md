# Live negotiation validation audit

Audit base: `e08ab81` (`origin/main` on 2026-09-30 KST). This work extends verification; it does not redesign the Deal Room, payment protocol, contract or use case.

| Requested gap | Audit finding | Action |
|---|---|---|
| Live HTTP/UI connection | Main contained the negotiation engine; an already active implementation was connecting the server, persistent state and UI. | Coordinate and verify that implementation; do not build a competing endpoint. |
| Fresh varied bilateral negotiation | Existing live proof used one authored case. The separate 66-call context benchmark extracts supplied transcripts rather than negotiating between agents. | Run 20 predeclared Buyer/Seller cases with actual `qwen3-32b`, retain failures and usage, then exercise their saved signatures through the actual financial workspace. |
| At least 500 generated financial values | Existing sibling work already completed 640 seeded cases across 16 classes, 2,985 checks and 2,025 mined local EVM transactions. Contract source and artifact checksums match this main. | Reuse the canonical run; do not count its same-seed repeat as another 640 unique cases. |
| External seller | Separate sibling work is already evaluating an isolated seller deployment. | Not a prerequisite for this request; no new marketplace or seller feature here. |

The live test plan varies budgets, per-deal limits, seller floors, private delivery capacities, public deadlines, row/source requirements and model-generated counteroffers. Fourteen cases are economically/capacity feasible and six deliberately are not. The synthetic private policies are operator configuration, never accepted from untrusted HTTP bodies or supplied to a competing agent. The browser remains test-asset settlement with a trusted controller.

Success of a model proposal and safety of payment are different metrics. An invalid tool output, false acceptance, refusal or failure to converge is retained as an unsuccessful negotiation. A financial check fails if an invalid invoice, invalid delivery or replay produces a payment. No missing measurement is replaced with zero. Final aggregate results are pending the retained experiments and source-bound financial replay.
