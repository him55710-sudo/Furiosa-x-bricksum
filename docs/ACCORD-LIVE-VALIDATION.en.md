# Live negotiation validation audit

Audit base: `e08ab81` (`origin/main` on 2026-09-30 KST). This work extends verification; it does not redesign the Deal Room, payment protocol, contract or use case.

| Requested gap | Audit finding | Action |
|---|---|---|
| Live HTTP/UI connection | Main contained the negotiation engine; an already active implementation was connecting the server, persistent state and UI. | Coordinate and verify that implementation; do not build a competing endpoint. |
| Fresh varied bilateral negotiation | Existing live proof used one authored case. The separate 66-call context benchmark extracts supplied transcripts rather than negotiating between agents. | Run 20 predeclared Buyer/Seller cases with actual `qwen3-32b`, retain failures and usage, then exercise their saved signatures through the actual financial workspace. |
| At least 500 generated financial values | Existing sibling work already completed 640 seeded cases across 16 classes, 2,985 checks and 2,025 mined local EVM transactions. Contract source and artifact checksums match this main. | Reuse the canonical run; do not count its same-seed repeat as another 640 unique cases. |
| External seller | Separate sibling work is already evaluating an isolated seller deployment. | Not a prerequisite for this request; no new marketplace or seller feature here. |

The live test plan varies budgets, per-deal limits, seller floors, private delivery capacities, public deadlines, row/source requirements and model-generated counteroffers. Fourteen cases are economically/capacity feasible and six deliberately are not. The synthetic private policies are operator configuration, never accepted from untrusted HTTP bodies or supplied to a competing agent. The browser remains test-asset settlement with a trusted controller.

## Recorded results

The [evidence index](../artifacts/accord-lock/varied-live/index.json) separates cohorts and links the unchanged raw records. All model calls below used actual Kiln `qwen3-32b`; unit-test stubs are not included.

| Metric | Baseline, 1,200 cap | Primary, 2,400 cap |
|---|---:|---:|
| Predeclared cases / feasible cases | 20 / 14 | 20 / 14 |
| Operator-approved signed agreements | 7 | 9 |
| Explicit seller acceptances with an agreement | 5 | 4 |
| Actual calls | 38 | 46 |
| Input / output tokens | 26,230 / 28,474 | 31,894 / 30,331 |
| Total tokens | 54,704 | 62,225 |
| Observed API duration | 418.061 s | 440.631 s |
| Truncated responses | 9 | 0 |
| Validator-rejected outputs | 13 | 11 |
| Wrong acceptance proposals | 1 | 1 |
| Policy-violation proposals | 3 | 10 |
| Signed policy violations | 0 | 0 |

An operator-approved agreement is **not** autonomous model convergence. The harness executes the existing human approval action when a seller response is within authority; only four primary cases also contain an explicit seller `accept`. The validator also applies commercial constraints to declines, so the rejected-output and policy-proposal counts include conservative rejection of decline fields. They must not all be described as dangerous model mistakes. There are no repair retries or substituted responses.

The 2,400 ceiling removes observed truncation in this small cohort; it does not prove an optimal ceiling, lower token cost, or reliable negotiation. Five further calls through the deployed HTTP client across cases 1, 4 and 20 all failed closed (three rejected outputs, no agreements). Their raw subset summary incorrectly counts all 14 planned feasible cases; the index corrects the executed denominator to **2/3**, without changing the original report. The runner is fixed for future subsets.

## Payment safety

The primary cohort's saved actual signatures were imported into the current browser workspace and executed against real private-EVM bytecode: **20/20 cases, 139 checks, nine legitimate payments, zero unauthorized settlements**. The [financial report](../artifacts/accord-lock/varied-live/466ad9f1-9d0b-48ef-921a-46b4e07fbfcf/financial.json) binds the negotiation report by checksum and records the exact financial source files; these match the final integrated financial path.

Checks cover tampered signed price, absence of an agreement, overbilling even below the total budget, invalid delivery, the signed delivery deadline, one valid payment, replay prevention and independent local receipt verification. For example, budget **173**, per-deal limit **91**, actual agreement **88**: invoice **89** is blocked. Settlement and delivery processing are deterministic. The approval bridge is a test fixture; this replay is not another live HTTP model run or a Sepolia proof.

The already completed [640 generated financial cases](../GENERALIZATION-VALIDATION.md) satisfy the requested 500-value coverage: 16 classes, 2,985 checks and 2,025 mined local transactions. The contract and artifact hashes were checked before reuse. A same-seed repeat is not counted as 640 more unique cases.

## HTTP/UI integration and defects fixed

The deployed **Live Agents** flow uses the Vercel `/api/live` service, dedicated Kiln client, private role prompts, durable session/attempt records and bilateral signatures. The browser imports the signed agreement and retains the existing deterministic financial path. Source-count and delivery-window requirements from the signed Live agreement now reach delivery validation and escrow funding. The historical localhost Node workspace remains deterministic; this is not a claim of Live parity on that endpoint.

Seller policies and token limits are bounded server configuration, not untrusted HTTP inputs. Buyer prompts do not receive seller floors. The runtime default is 2,400 output tokens; the separate procurement benchmark remains at its own 1,200-token configuration. Actual UI proof and the final deployment record are linked from the Deal Room audit.

An interrupted four-case comparison and a failed partial financial harness run remain in the repository. The former exposed source-field canonicalization in the harness; the latter exposed aliasing between a tampered session and the expected-price oracle. Canonical parsing and a cloned test session fixed the harness. Neither failure is erased or included in the final success denominator. In-flight usage from the interrupted run is not a complete billing record.

## Reproduce

```sh
# Paid actual inference; requires KILN_API_KEY in the environment.
node scripts/validate-accord-varied-live.mjs --live --ceiling=2400
# Pass the new run's report path; runs local test-asset financial execution.
node scripts/validate-accord-live-finance.mjs --report=artifacts/accord-lock/varied-live/<run>/report.json
pnpm ade:test
```

The raw source snapshots retain working-tree byte order and line endings. Git's normalized files can differ bytewise; use the snapshots to reproduce the measured implementation. The earlier and deployed clients build identical bounded negotiation requests, covered by regression tests; the final client also has separate actual-call smoke evidence.

These observations support fail-closed payment behavior in the tested cases, not a universal security guarantee. Negotiation reliability remains limited. Signer identities and seller policies are operator-controlled; no independent supplier company or real-money custody is claimed. No dollar billing, device power consumption, energy savings or new public-chain execution is inferred from these measurements.
