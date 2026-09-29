# Track B: two recorded stops

Accord Lock uses the negotiated Deal as the payment boundary. These two separate local attempts push different human-authority limits and stop before inference, funding or payment. The [raw capture](../artifacts/accord-lock/track-b-stops.json) contains the exact mandate, attempted Deal, policy checks and retained event chain for each run. The script [records a fresh capture](../scripts/record-track-b-stops.mjs) using the production `DealEngine`; it refuses to overwrite an existing evidence file.

| Run | Input | Exact engine result | Retained stop record | Financial effect |
|---|---|---|---|---|
| **STOP RUN 1** | Budget 40; per-deal maximum 30; seller B offers 35 | `BLOCKED`; failed check `MAX_SINGLE` | `POLICY_CHECKED` then `TRANSACTION_BLOCKED` | 0 Kiln calls; 0 funding, payment or deal transactions |
| **STOP RUN 2** | Budget 40; per-deal maximum 30; allowed sellers A/B/C; registered seller D offers 20 | `BLOCKED`; failed check `SELLER_ALLOWED` | `POLICY_CHECKED` then `TRANSACTION_BLOCKED` | 0 Kiln calls; 0 funding, payment or deal transactions |

`STOPPED` is the Track B outcome shown to judges. `BLOCKED` is the exact application state, and `MAX_SINGLE` / `SELLER_ALLOWED` are the exact existing policy-check names. The capture never substitutes a fabricated Kiln request for a mechanical rejection. There is no public blockchain transaction in either run. Local chain deployment and the separate public proof are outside those deal-transaction counts.

Reproduce without a key or network connection:

```sh
pnpm install --frozen-lockfile
node scripts/record-track-b-stops.mjs > fresh-track-b-stops.json
```

The sample browser workspace separately records its 35-unit offer block in task activity. It uses authored worker pricing and a private browser EVM; the seller-D case is shown from this engine capture because that UI only exposes its sample sellers. The stop records prove deterministic policy behavior. They do not claim an independent seller business, a live Kiln call or public-chain execution.

## Additional agreement-boundary proof

The [representative public V2 report](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/report.json) records five actual Kiln calls negotiating 22 to 20 under a human budget of 40. The seller's genuinely signed claim for 25 is within the budget but violates the escrowed Deal. The [mined Sepolia transaction](https://sepolia.etherscan.io/tx/0x255d855d5e19779fdc0fd12a02c924db0bb1980561fbc3dea98df230135e4e59) has status 0; V2's `CLAIM_MISMATCH` guard checks that the claim amount equals the locked Deal amount. A corrected signed 20 claim [settled](https://sepolia.etherscan.io/tx/0x00b1e35d51542daceacd191caabf6fd0e77b740ecb45eab0b4daa15965ecce2f), followed by [seller withdrawal](https://sepolia.etherscan.io/tx/0x6a322e82f24b1fd1b3c2d40f2215ead29c9b0c4d1899b1bb6f87cecaf95cb7cc). The [independent finalized verifier](../artifacts/dealtrace/procurement/runs/fa5e107c-7a20-4a6d-9970-5f15e8d4f6e9/finalized-verification.json) reports VALID with 47 checks.

The public V2 run and the two local stop attempts are distinct executions. The metered V3 bundle is a different local-EVM proof and has no Sepolia transaction claim here.
