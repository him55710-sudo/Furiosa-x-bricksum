# Accord Lock

**Accord Lock controls delegated agent spending by binding payment to the deal the agents actually agreed on, while DealTrace preserves and verifies the agreement, delivery, invoice, and settlement evidence.**

[Open Accord Lock](https://agent-spending-firewall.vercel.app/#home) · [Kiln + Sepolia proof](https://agent-spending-firewall.vercel.app/#evidence) · [CI status](https://github.com/him55710-sudo/Furiosa-x-bricksum/actions/workflows/verify-system.yml) · [Product workflow](docs/PRODUCT-WORKFLOW.en.md)

[Submission video · 165 seconds](artifacts/accord-lock/submission/accord-lock-track-b-165s.ko.mp4) · [Submission deck · 8 pages](output/pdf/accord-lock-track-b.pdf) · [Track B submission guide](docs/TRACK-B-SUBMISSION.ko.md)

**Example only: budget $40 → negotiated deal $20 → invoice $25 BLOCKED → $20 PAID.**

**$25 < $40, but $25 ≠ $20.** A spending budget does not authorize a seller to rewrite an agreed price. AI proposes terms; deterministic policy and the settlement contract authorize money movement.

Amounts such as **$40, $25 and $15 are illustrative examples, not fixed product limits or pricing**. The new interface displays **test USD ($)**: one displayed dollar represents one existing whole test unit, with **no cash value, USD deposit, or stablecoin claim**. The contract's units and settlement semantics are unchanged. Human budgets and per-transaction limits are editable in both Demo and Live setup. Changing a bound Live mandate starts a separate purchase instead of rewriting signed authority.

The [main page](https://agent-spending-firewall.vercel.app/#home) offers **Try Demo** and **Go Live**. In Demo, follow the deterministic agent conversation, submit a counteroffer and pause at saved gate incidents. In Live, type a task or negotiation guidance directly into the composer; it reaches actual Kiln inference and is retained with the public model input. Messages cannot override spending rules or signed terms. Conversation/incident export and the original receipt verification remain separate and accessible. [Product workflow and validation](docs/PRODUCT-WORKFLOW.en.md).

| Acceptance criterion | Inspect the evidence |
|---|---|
| Function | [Negotiated agreement, delivery, invoices and payment](artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json) |
| Boundaries & stopping | [Two separate local tasks record a blocked 35 offer and a blocked 25 invoice](artifacts/accord-lock/submission/track-b-runs.json); [seller, all-in budget and expiry stop before inference or funding](artifacts/dealtrace/procurement/boundaries/report.json); **STOP AGENT** preserves existing funded work |
| Kiln & efficiency | [Five-call public negotiation and per-flow usage](artifacts/dealtrace/procurement/usage-audit.json) · [Output-ceiling experiment](docs/ACCORD-ACCEPTANCE-READINESS.en.md) |
| Blockchain | [Five Sepolia transactions; signed 25 invoice reverted, 20 settled and withdrawn; 47 finalized checks](artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/finalized-verification.json) |
| Human control & reconstruction | Budget, watch, stop, receipt export and verification in the workspace. [Inspect the settled local receipt](artifacts/accord-lock/submission/run2-receipt.json) |
| Regression | **Integrated verification: 233/233 pass** · [source-bound automated test report](artifacts/deal-escrow/tests.json) |

## One product, explicit execution modes

**Demo Mode:** deterministic workers process an uploaded CSV/JSON CAPEX table, enforce limits and execute a private EVM in the browser. No model calls or public funds. The [recorded walkthrough](artifacts/accord-lock/submission/accord-lock-track-b-165s.ko.mp4) leaves Task 1 blocked when a 35 offer exceeds the 30 per-deal limit, then creates Task 2: negotiate Atlas from 22 to 20, lock funds, run the worker, block a 25 invoice, correct it to 20 and pay. Stop revokes this task's future local commitments; an already funded deal retains its terms.

**Live Agents:** actual Kiln Buyer/Seller proposals flow through the hosted HTTP service into a signed agreement and the same deterministic browser settlement path. [Varied live validation](docs/ACCORD-LIVE-VALIDATION.en.md): 20 primary cases, 46 actual calls, 9 operator-approved agreements, 20/20 financial checks by case and zero unauthorized settlements; negotiation failures are retained. [640 randomized financial cases](GENERALIZATION-VALIDATION.md) cover amounts beyond the authored demo.

**Proof Run:** the Evidence screen presents a recorded execution by Kiln-powered agents and Sepolia. Three sellers → five calls → 22 to 20 negotiated → a genuinely signed 25 invoice reverted → 20 settled → seller withdrawal. It is historical evidence, not a claim that the current browser task made those API calls or public transactions. DealTrace is the enforcement and proof system inside this product story.

Browser amounts are test units (1 local gwei each). Public proof uses DEMO accounting units (100 Sepolia gwei each). Neither has a cash price; operator gas is separate. The chosen public run is `fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9`.

**Separate efficiency cohort:** 1,200-token output ceiling; 160-character messages. Three successful runs used four calls each. Capability prefiltering reduced measured total tokens by **20.57%** versus the matched full-history cohort. These are not the five calls in the canonical public run. Failed experiments are retained; no measured NPU energy savings are claimed.

## Run and verify

```sh
pnpm install --frozen-lockfile
pnpm ade:test
pnpm ade:hosted:build
pnpm ade:spending:view
# http://127.0.0.1:3440
pnpm dealtrace:boundaries
```

The browser integration test builds its own isolated hosted fixture, so a fresh checkout does not need a pre-existing `dist-vercel` or historical test report. CI builds the deployable client again after tests, with the current result. Source pushes do not automatically publish the manually managed Vercel project.

**Measured public run:** 5 Kiln calls, 4,145 input + 3,745 output = 7,890 tokens; 64.056 seconds of API latency. **Not measured:** NPU wattage, device occupancy or datacenter PUE. An energy estimate is assumed allocated watts × observed API duration. We do not claim measured NPU energy savings.

**Scope:** source-linked quarterly CAPEX processing is a concrete integration example. Customer demand and independent supplier operations remain unverified. The browser controller and public delivery evaluator are trusted; signatures do not prove arbitrary source truth. This is a testnet prototype, without production custody or an independent security audit.

[Implementation and historical scenarios](README.technical.md) · [Acceptance work and experiment results](docs/ACCORD-ACCEPTANCE-READINESS.en.md)
