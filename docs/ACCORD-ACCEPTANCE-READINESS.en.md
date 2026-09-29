# Accord Lock acceptance evidence

Accord Lock is the product; DealTrace is its signed agreement enforcement and proof system. No marketplace, protocol, network or use-case expansion was introduced.

## CI and repeatability

The upstream `6a29323` merge fixed the hosted-build dependency: the browser test builds into an isolated temporary directory and injects a fixture test summary. A clean checkout no longer reads an absent `dist-vercel/evidence/hosted-manifest.json`. The deployable build still runs after the real test report is generated. GitHub run 36619493464 succeeded. This change was already merged during the acceptance pass; it was incorporated, not duplicated.

Current checks and deployment for this pass are recorded in `artifacts/acceptance/`. The new cap and preflight tests join the full suite. Historical public-run counts remain historical; the README links the current source-bound test report.

## Deterministic boundary runs

[Actual live-enabled runner results](../artifacts/dealtrace/procurement/boundaries/report.json): seller X requested with only A/B/C permitted, known minimum all-in cost above the authority, and an expired mandate. Each stopped before opening the chain or starting workers: zero Kiln calls, zero tokens and zero funding transactions. No key is needed to reproduce `pnpm dealtrace:boundaries`.

The cost case is a separate adversarial scenario: minimum compatible registered work 18 + explicit fee reserve 23 > budget 40. The reserve reduces available purchase authority; it does not invent or transfer a fee. Unknown external supplier costs cannot establish a minimum and are evaluated after a quote. Private registry floors stay with the operator and are not disclosed to other negotiating agents.

## Stop semantics

The browser and local workspaces expose per-task authorized, committed, paid and unallocated amounts. STOP AGENT persists revocation of **future local commitments for that task**, rejects quote/counter/funding/edit attempts, and leaves existing funded work payable on its original agreement. It is not an on-chain global revoke and does not revoke separate newly authorized tasks. Existing transaction retries reconcile their original intent. Tests and the browser walkthrough show stopped authority, 25 blocked, 20 paid and a VALID receipt.

## Live efficiency experiment

Results are published in [the comparison report](../artifacts/dealtrace/procurement/efficiency/comparison.json). Each run retains actual role-level usage, output validity, latency, truncation, zero retries and negotiated terms. Negotiation-only experiments perform no public-chain or funding transactions. Declining a trade is retained as an unsuccessful agreement, even if its structured output is valid.

The initial experiment compared ceilings 5,000 / 1,800 / 1,200 / 800, three times each. No ceiling achieved three clean agreements. It is not evidence that merely reducing a number makes negotiation reliable. The refined prompt separates buyer and seller instructions, caps prose at 160 characters in both schema and validation, and was tested with both compact latest-state context and full history. Production retains full history in the bounded counteroffer round because the compact variant did not reliably converge in this sample. The complete signed transcript remains available outside the model. The model still chooses prices; there is no fallback fabricated agreement.

A full-conversation control uses the same refined instructions, RFQ, private policies and temperature, but sends the complete signed event history. Compare this separately from the initial prompt experiment. Small samples do not establish population reliability, and independent model runs need not converge to identical prices.

## Canonical proof and disclosure

The primary public run is `fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9`: budget 40, agreement 20, invoice 25 reverted, corrected 20 paid and withdrawn. Three sellers, five actual Kiln calls, five Sepolia transactions and 47 finalized checks. Its seller is A. It is a recorded run, separate from current deterministic browser work and the new negotiation-only experiments.

Measured API usage: 4,145 input + 3,745 output = 7,890 tokens and 64.056 seconds. NPU power, device occupancy and PUE were not measured. Energy estimates use assumed allocated watts multiplied by API duration. **We do not claim measured NPU energy savings.**

The three reviewer scripts are preserved as synthetic examples, with Seller C corrected to the actual Seller A. They are illustrations of receipt reconstruction, not measured usability results.

## Final measured decision

Use **1,200 output tokens**, at most **160 message characters**, full bounded history and the deterministic capability prefilter. The final configuration completed **3/3 agreements**, **4 calls each**, with **0 truncated outputs, 0 invalid calls and 0 retries**. The incompatible forecast-only seller is discovered but receives zero inference requests. No final price is hardcoded.

| Three-run cohort | Calls | Input tokens | Output tokens | Total tokens | Agreements |
|---|---:|---:|---:|---:|---:|
| Full-history baseline | 15 | 14364 | 8029 | 22393 | 3/3 |
| Accord with capability prefilter | 12 | 12209 | 5578 | 17787 | 3/3 |

Observed token reduction: **20.57%** across these cohorts. This is a token measurement, not an energy measurement or a causal estimate independent of model-output variance. Baseline retained one rejected nonselected seller proposal. Initial and refined failures, exact terms, source hashes and an interrupted duplicate's partial usage are retained in the comparison links.

Historical acceptance pass: **212/212 product tests** and **55/55 legacy tests** passed. The current `main` source-bound report is **218/218**; TypeScript and application builds pass, and CI checks the compiled contract artifacts.
