# Live Playground

Accord Lock enforces agreements between agents. The four agents in this playground are **external test clients**, not the Accord Lock product. Guided Demo stays at `#presentation`; the new experience is at `#playground`. The older operator workflow remains available at `#live`.

## Real inference, bounded execution

- One Buyer and Atlas (honest), Nexus (may over-invoice), and Orbit (may change terms or add fees).
- All offers, counteroffers, acceptances, seller selection and invoice amounts come from actual `qwen3-32b` calls to Kiln's existing API adapter. No recorded response is substituted.
- Seller behaviors are prompts. They do not guarantee a violation, a particular price, a particular selected seller, or acceptance.
- The user supplies a task, budget, per-deal limit, currency, delivery limit, seller allowlist and optional preferences. Amounts are integer cents for USD/EUR/GBP and integer won for KRW. No currency conversion.
- Service preferences guide inference; arbitrary prose constraints are not claimed as machine-verified. Currency, amounts, allowlist, expiry and structured delivery/scope terms are checked mechanically.
- A session has a 20-minute mandate, up to 24 model attempts, and a deployment-wide fixed allowance (default 60 attempts for the separately stored Playground). Rejected/failed attempts consume allowance. Retries are explicit.

## Workflow and visible states

| Persisted state/event | Visual | Human action |
| --- | --- | --- |
| Mandate created | Human budget → Buyer | Start negotiation |
| Actual model request in flight | Corresponding actor pulses; “Thinking…” | Pause after response / Stop |
| Signed offer / counter / acceptance | Directed agent message + structured price | Inspect message |
| Model validation failure | Proposal rejected, reason and attempted-call record | Refresh / retry explicitly |
| Out-of-policy public terms | Terms rejected badge; public proposal preserved | Inspect or change a new mandate |
| Buyer selected an actual eligible offer | Selected seller highlighted | Approve agreement |
| Bilateral signatures | Agreement locked | Request actual seller invoice |
| Signed invoice checked | Budget and Agreement equations, full policy checks | Correct invoice / inspect incident |
| Authorized matching invoice | Payment authorized | Settle test payment |
| Durable test settlement and signed receipt | Amount received + remaining authority | Inspect / export DealTrace |

Negotiation orchestrates three offers and a bounded Buyer/Seller exchange per seller, then a real Buyer selection call. It stops before human approval of the agreement. Invoice generation is another real seller call. Correction is also model-generated; it can fail again. An invoice cannot change the immutable deal. Motion follows actual pending requests and saved events; reduced motion removes animation, not meaning.

## Enforcement boundary and external clients

`src/accord/playground-enforcement.mjs` exports `authorizePlaygroundPayment({mandate, agreement, invoice, identities, now, stopped, settled})`. It has no model dependency. Trusted mandate and identity inputs must come from the integrator's authenticated registry, not from the payment requester.

The endpoint is `/api/live?playground=1`. It reuses the existing signed HttpOnly owner cookie, same-origin/CSRF checks, revision checks, compare-and-swap durable store, operation fingerprints, call accounting and STOP race protection. Its ledger is separate from the existing Live operator ledger.

After a GET establishes the session token, POST actions carry `operationId`, `id`, `revision`, `action` and optional `seller`. Inference actions: `offer`, `counter`, `respond`, `select`, `invoice`. Non-inference actions: `start`, `agree`, `enforce`, `settle`, `stop`.

An external payment client can submit `action: "enforce"` and `payment: {body, signature}` instead of using the playground seller invoice. The body contains `schema`, `id`, `dealHash`, `recipient`, `amountMinor`, `currency`, `scope`, `deliveryMinutes`, `at`. The signature must match the registered selected seller. The same independent checks run for both paths. Browser-origin authentication is currently the deployment adapter; an internet-facing external-agent integration still needs its own authentication and trusted identity registry.

Checks include authority expiry/revocation, bilateral signatures, mandate hash, seller allowlist, commitment authority, seller invoice signature, budget, exact agreed amount, recipient, currency, deal hash and signed scope/delivery. A budget-valid mismatch returns `PAYMENT_BLOCKED / AGREEMENT_PRICE_MISMATCH`. Settlement rechecks all conditions and commits one test-ledger transfer through the existing compare-and-swap store. Neither a model message nor a previous client-side green check can release funds.

## DealTrace evidence

Evidence includes actual message text and structured terms, model request IDs/usage, rejected attempt records, canonical hashes, signatures, selected seller, immutable agreement, each invoice, every enforcement decision and settlement receipt. Events and messages have chained hashes. The server verifies message/receipt signatures and recomputes recorded policy decisions for the Evidence view. JSON export retains the entire session and attempt history.

Signing identities are operator-owned test identities. Verification proves integrity against those included identities, not independent real-world identity certification. Playground traces have their own schema; they do not impersonate historical Sepolia receipts.

## Settlement scope

Inference and enforcement are real. **Settlement is a durable test ledger, not a bank transfer, blockchain transaction, or purchase of a delivered research report.** It transfers test purchasing authority once and records the result. It does not perform external research or verify the truth of a report. The existing Guided/browser EVM and historical Sepolia execution paths are unchanged and separately labeled.

## Run locally

```powershell
node scripts/build-accord-vercel.mjs
node --env-file=.env.local scripts/start-playground.mjs
```

Required: `KILN_API_KEY` and `KILN_MODEL=qwen3-32b`. Optional: `ACCORD_LIVE_SECRET`, `ACCORD_PLAYGROUND_CALL_BUDGET`, `PLAYGROUND_PORT` (default 3451). The local SQLite ledger and fallback signing secret stay in ignored `data/private/playground/`. Hosted mode uses the existing private Blob adapter and `BLOB_READ_WRITE_TOKEN`.

The normal hosted build includes the new route, styles and API implementation. No large animation dependency was added. The static source-file allowlist explicitly includes both new browser modules.

## Validation and evidence

See `artifacts/accord-lock/live-playground/` for recorded actual-call evidence and screenshots. Regression coverage includes dynamic workflow results, overcharge/correction, duplicate settlement, external invoice signature tampering, failed inference, STOP during inference, expiry, exact currency parsing, UI escaping, existing Guided/browser EVM settlement/refund/receipt workflows, and isolated hosted builds.

Remaining limitations: complete model messages arrive after each API response rather than token-by-token; actual inference latency varies; the orchestration uses one counter round per seller; arbitrary semantic preferences are not a delivery validator; external identity registration and real payment rails are integration work, not enabled by this test environment.

## Recorded execution results — 2026-09-30

The initial relevant regression run passed **66 tests, zero failures**. The hosted build and security scan passed. Raw actual-call evidence and a machine-readable validation report are in `artifacts/accord-lock/live-playground/validation.json` and its referenced session JSON files.

- **Atlas:** all three sellers returned actual offers; Buyer selected an $80.00 agreement under a $100.00 budget. The seller invoiced $80.00; enforcement authorized it; the test ledger settled $80.00 once and left $20.00 authority. Signed evidence verified VALID.
- **Nexus:** a live $650.00 proposal exceeded the $70.00 per-deal ceiling and was visibly rejected. An invalid Buyer acceptance failed validation and consumed its attempt. After clarifying minor units in the prompt, a real $70.00 counter was accepted. This session was stopped before settlement.
- **Nexus, separate run:** actual $70.00 terms and invoice were authorized and settled in the test ledger; $30.00 authority remained. Evidence verified VALID. Adversarial persona prompts did not force the model to overcharge.
- No model-generated mismatched invoice was observed in these live runs. The $51 agreement / $58 invoice / $100 budget rejection, corrected invoice and once-only settlement were verified with an injected model client in regression tests, not presented as Live evidence.
- Guided Demo was exercised in the same browser through delegation, negotiation, $25 invoice rejection, correction and $20 private-EVM payment. Live state survived round-trip navigation and a service restart.

Screenshots: `live-transaction-1920.png`, `live-evidence-1920.png`, `live-settled-1440.png`, `live-mobile-390.png`, and `guided-preserved-1920.png` in that artifact directory. Desktop and 390px layouts had no horizontal overflow. Keyboard Enter opened the Evidence view. Reduced-motion CSS and state-preserving behavior were reviewed; this browser connector could not emulate the OS preference. Evidence attachment export is covered by the HTTP regression; the connector did not confirm browser download completion.

Expired sessions remain inspectable during the existing ledger retention window (pruning occurs on new starts after expiry plus 24 hours). Export evidence for longer retention. Local preview dispatches Playground and the original operator API to separate SQLite ledgers, just as hosted mode uses separate Blob keys.
