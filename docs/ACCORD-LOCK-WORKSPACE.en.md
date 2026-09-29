# Accord Lock workspace

Accord Lock connects a concrete data task to a price, human spending authority, inspectable output and an escrow receipt. The English interface is a working local application. Demo assist adds guidance to that application without changing its execution.

## Vercel edition

The hosted edition runs the same task workflow without installing a local server. It processes uploaded CSV/JSON data in the browser, executes the real escrow bytecode on a private browser EVM, and persists tasks and chain history in IndexedDB. It never uses public funds, sends model requests or synchronizes data between devices.

Use the same production domain and browser to reopen saved work. Preview deployment URLs have separate browser storage. Download task results and receipts before clearing site data. The browser controls this private chain, so verification proves consistency with that browser's chain; it is not independent public-network consensus.

The published client has no server API credentials. The pinned Ganache browser bundle is served from the same origin and loads when a blockchain action is first needed. The hosted CSP allows WebAssembly, embedded data-URI WASM and the dynamic JavaScript bindings required by that bundle; inline JavaScript remains disallowed. Uploaded text is rendered with escaping.

Build and verify the release with:

```sh
pnpm ade:hosted:build
pnpm ade:hosted:test
pnpm ade:spending:test
```

`dist-vercel` contains only built assets and public evidence, with an explicit `.vercelignore` allowlist. Link that directory to the existing `agent-spending-firewall` Vercel project. Deploy a preview, test the user workflow, then promote the verified deployment. No database, secret or private key is uploaded with the release.

## Local service edition

```sh
pnpm install --frozen-lockfile
pnpm ade:spending:view
```

Open http://127.0.0.1:3440/#workspace. Keep the process running. Existing `#demo` links open the same workspace with Demo assist enabled. To use another port, set `ADE_SPENDING_PORT` before starting the service.

## Do the work

1. Create a task. Set its name, brief, total budget, per-deal limit and delivery window. Upload a CSV or JSON array, or choose **Try with a sample task**.
2. Request offers. Choose Atlas or Meridian. Send a counteroffer if needed; the local worker accepts or declines using its disclosed pricing rules.
3. Approve and lock funds. The workspace checks the spending limits before signing a private EVM transaction. A blocked offer signs nothing.
4. Run the worker. It reads the actual input, normalizes the table and compares output fields with the original source rows.
5. Review the returned table. Open a row's source, inspect the acceptance checks, download JSON/CSV or submit a replacement delivery for validation.
6. Check the invoice. A bill above or below the exact agreed price blocks payment, even when it fits the overall budget.
7. Approve and pay, or reject and refund. Inspect the transaction's real local hash and block number, export the receipt and verify it against the local chain.

Use **Tasks** to reopen saved work on desktop or mobile. Refreshing or restarting the service preserves the task. If a transaction response is interrupted, **Retry confirmation** reconciles the recorded transaction instead of creating a second deal.

## Input contract

Required columns: `company`, `quarter`, `capex`, `currency`, `source_url`.

Files must contain 1–1,000 rows and be smaller than 1 MB. Use 2025–2026 quarters, nonnegative finite CAPEX values, three-letter currencies and HTTP(S) citations without credentials. Duplicate company/quarter/currency observations are rejected. Quoted CSV commas and newlines are supported. Numeric comma grouping is normalized, and spreadsheet exports escape formula-like cell text.

The worker normalizes supplied data; it does not retrieve arbitrary websites, parse arbitrary PDFs or independently establish the truth of imported claims. The included LG Energy Solution sample preserves the existing reference dataset's values and citations. CAPEX units belong to the dataset; payment amounts are gwei of a local native test asset, never USD.

## Three-minute live walkthrough

| Approximate time | Operator action | What the audience sees |
| --- | --- | --- |
| 0:00–0:25 | Turn on Demo assist, load the sample and create the task. | A concrete research brief, four source rows and explicit spending limits. |
| 0:25–0:55 | Request offers, select Atlas and counter with 150 gwei. | The seller's price changes after the buyer's counteroffer. No funds have moved. |
| 0:55–1:15 | Approve and lock funds, then run the worker. | A real local escrow receipt followed by an inspectable output table. |
| 1:15–2:10 | Open a source. Set the invoice to 180 and check it. | The original and delivered values, then a blocked payment: under budget does not mean the agreed bill. |
| 2:10–2:40 | Restore 150, check the invoice and approve payment. | Human approval, exact settlement and a transaction recorded on the local chain. |
| 2:40–3:00 | Verify the receipt and download the result. | A useful file and evidence that survives a refresh. |

These are presentation suggestions, not timers. The operator controls the pace. For a failed-delivery demonstration, use **Replace delivery** to alter a value or remove a citation, validate it, then choose **Reject & refund**.

## Execution and trust

- Atlas and Meridian are deterministic local worker adapters, not external AI services or independent counterparties. No paid model calls are made.
- Escrow, settlement and refund use the existing Agent Deal Escrow contract on a persistent private local EVM, chain 31338. There are no public funds or explorer links for these transactions.
- Invoice and source comparisons run in the browser for the hosted edition, and in the server for the local service edition. The escrow controller remains trusted for those checks and operator-requested refunds. This UI does not claim to run DealTrace V2's bilateral on-chain invoice enforcement.
- Historical Sepolia proof is clearly separated in the Evidence library. It is not generated by the current task.
- The local service edition binds to loopback and checks Host, Origin and a session token for mutations. It is not configured as a public multi-user service.
- In the local service edition, task inputs, activity and chain keys remain under the ignored `data/private/accord-workspace` directory. Public receipt exports omit private keys and signed transaction bytes.
- The local service build (`dist-spending`) includes the client and allowlisted public evidence and requires the local server. Use `dist-vercel` for the self-contained hosted edition.

## Implementation and verification

`src/accord/workspace.mjs` persists tasks alongside the existing escrow engine. `src/accord/http.mjs` exposes the local API. The client in `web/spending` renders the task state and sends explicit operator actions. It has no autoplay, countdown or simulated progress loop. A spinner appears only while an actual request is pending.

```sh
pnpm ade:spending:test
pnpm ade:spending:build
```

The test suite covers input parsing, policy blocks without a transaction, negotiated price, output matching, invalid deliveries, invoice mismatch, real local payment/refund verification, lost-response recovery without duplicate transactions, restart persistence, English rendering and escaping, same-origin session checks, and allowlisted static serving from a managed checkout.

The local API and rendering modules are covered by the local suite. The browser suite additionally executes the exact Ganache web bundle with IndexedDB, including interruptions after mined transactions, payment/refund verification, reload persistence, stale decisions and private-key exclusion from exported receipts. The deployed HTTPS edition is checked through browser interactions. The earlier localhost browser restriction was not bypassed.
