# DealTrace: one negotiation-to-payment workflow

This extension closes the separation between the live Kiln conversation and the on-chain authorization module. The same run now discovers pinned providers, records their offers and a counteroffer, obtains independent execution signatures, funds the signed deal, validates actual work, rejects an excessive signed bill and withdraws the permitted amount.

## Product boundary

The first operator is a small research automation team buying a document-processing job. A second executable package combines that document job, three searches over the pinned document corpus and two CPU hash batches. These are real bounded local operations. They are **not** internet-scale search, rented GPU-hours, an external data license or proof that a supplier company exists. A remote provider can implement the same pinned HTTP interface; an actual independent business integration remains untested.

The primary claim is agreement integrity, not the lowest possible market price. One cheapest eligible first quote is selected deterministically. Kiln chooses the offers, counteroffer and response within each role's private constraints; a fixed final price is no longer prescribed. The demo uses one counteroffer round and stops if it does not produce eligible terms. It is not an unconstrained multi-round market optimizer.

Quantities remain exact unless the human RFQ explicitly supplies `minimum_units`. The optional `--flex-quantity` CLI creates such ranges (at least one of each requested service). A retained live range negotiation stopped without funding because the seller declined; its model calls are included in the usage audit. A cheaper initial quote can also carry fewer permitted units in this mode, so it is not a quality-adjusted utility optimizer.

## What is an agent message?

An outward message includes a short qualitative sentence and a complete structured quote. Kiln produces both through a restricted tool call. Exact amounts, quantities, delivery time and quality are in the signed quote fields; numerical assertions in prose are rejected to avoid two conflicting sources of terms. This is a structured agent negotiation interface, not a claim to compile arbitrary legal prose. The earlier free-text interpretation ledger is retained in the original workbench.

Each event binds the RFQ hash, run, sender role, sequence and previous event hash. Each final field points to the event that supplied its value. Buyer and seller independently validate the full packet against their local transcript, capability/cost constraints and the human-signed mandate, then produce fresh EIP-712 execution signatures. The model cannot access keys or financial tools.

## Two settlement modes

**Fixed job / existing Vault V2:** the full agreed total must match the invoice. The workflow rejects a larger amount even when the human budget would allow it. All required work must pass before the fixed amount is released.

**Successful units / Metered Vault V3:** both parties additionally sign a line schedule containing an immutable service/input identifier, unit rate and maximum quantity. The total maximum is escrowed. The evaluator verifies every signed request result and recomputes successful units. The contract enforces the signed schedule, caps and exact invoice arithmetic, credits the seller for successful units, and credits the buyer for all unused principal. Ordinary `release` cannot bypass metering. A failed request costs zero; a repeated request ID returns the same signed result and adds no new billable unit.

The evaluator is still trusted to attest off-chain outcomes. The chain cannot independently observe API success, factual truth or CPU work. The portable verifier recomputes the supported local jobs to check that attestation; this does not make arbitrary external services trustless.

The V3 extension preserves V2 mandate nonces, gross budget allocation, seller allowlists, revocation, expiry refunds, pull withdrawals and preview memory. Refunds do not renew gross spending permission. Provider identity keys persist locally across runs; changing keys is not a way to preserve a verified business identity.

V3's ordinary `fund` entry point always rejects. Without this restriction, a caller could reuse a signed metered Deal while omitting its schedule, then attempt a fixed payout. Only `fundMetered` can open a V3 escrow. Fixed jobs use the separate V2 domain/deployment. Both funding-path downgrade and release-path bypass are covered by real EVM regressions.

## Run it

```sh
pnpm dealtrace:procurement:compile
pnpm dealtrace:procurement                 # fixed job, actual local V2 EVM
pnpm dealtrace:procurement --metered       # bundle, actual local V3 EVM
pnpm dealtrace:procurement --live          # Kiln-selected negotiation + V2
pnpm dealtrace:procurement --live --metered
pnpm dealtrace:procurement --live --metered --flex-quantity
pnpm dealtrace:procurement:start          # http://127.0.0.1:3421
```

Live mode needs ignored `KILN_API_KEY` and `KILN_MODEL=qwen3-32b`. Sepolia mode also needs the existing test-only identity directory and RPC configuration. `--sepolia` with fixed billing reuses the pinned V2 deployment; metered mode deploys V3. Every public transaction has a per-operation and cumulative gas reservation cap. Financial keys never enter model prompts or browser responses.

```sh
pnpm dealtrace:procurement --live --sepolia
pnpm dealtrace:procurement --live --sepolia --run=<same-run-id> --resume
pnpm dealtrace:procurement:verify report.json trusted-deployment.json
node scripts/recover-dealtrace-procurement.mjs <run-id>
```

Signed transaction bytes are persisted and fsynced before broadcasting. An observation timeout retains the original hash; resume reconciles that hash, not a fresh payment. Ambiguous worker requests require review instead of silently repeating inference. Local chains are ephemeral and cannot be resumed after shutdown. A public funded job retains its signed deadline after Stop; the recovery command can refund an expired lock to the immutable buyer and sponsor withdrawal. It sends nothing before expiry and cannot redirect proceeds.

## Remote provider interface

Pass an ignored JSON registry with `--providers=path/to/registry.json`. Each entry contains `id`, HTTPS origin `url`, expected EVM `address`, and a scoped bearer `token`. HTTP is accepted only on localhost. Redirects are rejected; no model-supplied URL is fetched. Each response must be signed by the pinned address. This is explicit provider registration, not open-web vendor discovery.

Implement these endpoints using the request/response shapes in `worker.mjs` and `protocol.mjs`:

| Endpoint | Required behavior |
|---|---|
| `/discover` | Sign the fresh challenge, capabilities and expiry |
| `/quote` | Sign a complete offer linked to RFQ and transcript head |
| `/commit` | Independently review the complete packet and human mandate before EIP-712 signing |
| `/execute` | Persist one result per scoped unit request ID; sign output or failure |
| `/claim` | Sign the claim's deal, recipient, amount and usage hash |

Requests contain a transport `request_id`; changing its body is rejected. The external operator must pin the execution network and human authority independently, manage its own keys, and implement the published validation profile. Supporting a different service requires a new validator profile, not merely changing the capability name.

## Verification and presentation

The single workbench shows provider comparisons, all negotiation messages, the signed final terms with source navigation, unit outcomes, the blocked invoice, settlement and withdrawal hashes. It exports the complete receipt and invokes an independent verifier. A changed copy fails without modifying the original. Local offline re-verification returns `INCOMPLETE / CHAIN_NOT_QUERIED`; it does not turn a saved screenshot into fresh chain confirmation.

Flow-level token usage includes failed calls and unavailable usage is not treated as zero. No hardware power telemetry has been measured. Automated browser tests are not participant responses; the three-person comprehension gate remains separate.

## Retained execution evidence

- `fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9`: actual Kiln + existing V2 on Sepolia, 5 calls / 7,890 tokens, 20 agreed, signed 25 reverted, 20 settled and withdrawn; 47 independent finalized checks.
- `11ba8d29-1b86-4cb4-8758-3ccb95fb89e8`: actual Kiln + hardened V3 on local EVM, 5 calls / 10,398 tokens; selected seller C, 27.40 maximum, 26.40 payout, 1.00 unused refund; 56 checks.
- `62b04a02`: earlier successful V3 version, 29.00 maximum / 27.50 payout, preserved with its original source rather than attributed to the hardening patch.
- `3d3daebd` and `ed9551dc`: failed actual-model attempts with no purchase funding. The first original report omitted one truncated call; `attempt-usage.json` restores the durable telemetry without altering the original report.

All reports, the aggregate usage audit and source-version mapping are in `artifacts/dealtrace/procurement`. The five runs contain 24 calls and 45,593 tokens in total. These are development observations, not a held-out performance benchmark.
