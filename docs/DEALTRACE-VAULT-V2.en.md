# DealTrace Vault V2: make the agreement constrain the money

The original prototype proves why a payment should be allowed. V2 moves a carefully bounded part of that decision into the contract: **even the transaction submitter and delivery evaluator cannot pay 31 when both agents committed to 26.**

The customer and job stay narrow: a research automation team delegates one document-processing job to a registered worker. This is a versioned execution module, not a marketplace, token or new agent protocol. The existing conversation compiler, field provenance and pinned-source validator feed a new on-chain authorization envelope.

## A concrete improvement in the trust boundary

| Control | Original public escrow (V1) | Vault V2 |
|---|---|---|
| Human authority | Controller checks an off-chain mandate | Buyer-signed EIP-712 mandate registered on-chain |
| Seller and cumulative budget | Controller checks allowed sellers and reservations | Contract checks seller list, per-deal ceiling and atomic gross allocation |
| Bilateral agreement | Ed25519 message and Deal signatures checked off-chain | Those records remain; fresh agent and seller EVM signatures bind the execution envelope |
| Excessive invoice | Controller rejects before broadcasting | Contract rejects even an authentic excessive claim accompanied by evaluator approval |
| Delivery truth | Trusted supported-source validator | Still a buyer-selected evaluator; the chain does not interpret documents |
| Failure memory | Company × seller database policy | Buyer address × seller address restriction on-chain, across new mandates |
| Payout | Push transfer during settlement | Settlement creates a credit; separate withdrawal proves the transfer |
| Recipient refuses ETH | Settlement can revert | Credit remains; beneficiary can choose another destination |
| Timeout recovery | Buyer can request refund | Anyone can finalize an expired escrow to the fixed buyer credit |
| Revocation | Controller may refund active work | Blocks new funding; already locked work retains its signed terms |

V1 and V2 have different revocation and budget semantics. They are not interchangeable adapters. Existing receipts, contract address, film and Kiln evidence are preserved. The ordinary workbench's Run button still executes V1. `/vault.html` presents the separate V2 public proof; `dealtrace:vault:demo` executes V2.

## What is signed

1. **Mandate:** buyer, delegated agent, evaluator, hash of the permitted seller list, gross budget, per-deal maximum, expiry and one-use nonce.
2. **Deal:** canonical Deal hash, mandate digest, seller, exact native-unit amount, full delivery window, expiry, negotiation-packet hash and optional preview hash. Both the delegated agent and seller sign the same typed digest.
3. **Claim:** Deal hash, claim ID, exact payee, amount and delivery hash. The seller signs it.
4. **Validation:** Deal hash, the complete claim digest and validation-evidence hash. The selected evaluator signs it.
5. **Preview:** the next Deal hash and preview hash. The evaluator signs it when historical control requires a preview.

The EIP-712 domain includes chain ID, contract address and version. Mandate nonces and terminal Deal states supply replay protection; EIP-712 itself does not. EOA recovery uses OpenZeppelin ECDSA; contract-wallet signatures use ERC-1271. The Shanghai-compatible ERC-1271 address path is implemented locally because OpenZeppelin 5.4's broader SignatureChecker imports a Cancun-only instruction. [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271), [OpenZeppelin cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography).

The Solidity code is non-upgradeable and has no administrator withdrawal or arbitrary recipient override. There is no custom elliptic-curve implementation. Full compiler input, dependency source, compiler settings and bytecode are retained under `artifacts/dealtrace/vault` for reproducibility.

## The adversarial demo

The V2 scenario runs authored dialogue through the existing NegotiationLedger. New canonical Deals bind the V2 contract and chain; old V1 signatures are never silently treated as authorization for another contract.

1. Register a signed 40 DEMO mandate. Compile and bilaterally sign the 26 DEMO job. Fund exactly 26.
2. Bypass application policy. Submit a genuine seller-signed **31** claim, with an intentionally permissive evaluator signature, directly to the contract. Expect a mined failed transaction, no release event and unchanged escrow.
3. Submit the correct signed 26 claim with the actual supported-document validation. Release the credit, then withdraw it to the seller. Both steps have distinct transaction hashes.
4. Under another mandate, fund an intentionally incorrect delivery. Run the existing deterministic validator; the evaluator refunds it and records `PreviewRequired` on-chain. Withdraw the buyer refund.
5. Create a fresh mandate and fully signed Deal with the same buyer and seller. Submit funding without a preview. Expect `PREVIEW_REQUIRED`.
6. The buyer revokes that mandate. Reuse the previously valid Deal signatures. Expect `AUTHORITY_INACTIVE`.

Three failed transactions are deliberate proof artifacts. In normal service operation the local checks prevent these avoidable gas costs. The independent verifier also replays `eth_call` at the historical failure blocks and checks the exact revert reasons, rather than assuming every failed transaction proves the intended boundary.

This run adds **zero model calls**. The real Kiln experiment remains the separate ten-call / 12,073-token public conversation run. We are testing enforcement without asking a model to re-decide arithmetic or authority. No NPU power measurement is claimed.

## Public evidence: 14 transactions, three deliberate failures

Run `ade00002-2960-4000-8000-202609290001` completed on Sepolia. Contract **`0x3df2bFc764488Dd6AE85f98774255359b0520048`** has an exact creation and runtime match on [Sourcify](https://repo.sourcify.dev/11155111/0x3df2bFc764488Dd6AE85f98774255359b0520048). Source verification establishes correspondence to the published code, not a security audit. Automatic forwarding to Etherscan hit its submission limit; we do not claim Etherscan source verification.

| Outcome | Actual transaction |
|---|---|
| Authentic 31 claim reverted | [0x2f9bc02c…](https://sepolia.etherscan.io/tx/0x2f9bc02cb4e8199abb62a39a349de6c0d07af49d5f87780ee88dfdd3432b703b) |
| Corrected 26 released | [0x837344e8…](https://sepolia.etherscan.io/tx/0x837344e81b00244523c3b0d702be05a6a85cb2dd9887f6d3c0cb1b921a8f217a) |
| Seller actually withdrew 26 | [0x3897fd8f…](https://sepolia.etherscan.io/tx/0x3897fd8fc5166e9ef56a759df8830df2f847e2710b74529d3c07b70572f2d7e3) |
| Mismatch refund and preview restriction | [0x9c67e31a…](https://sepolia.etherscan.io/tx/0x9c67e31aef90e12895f940288bbb4a8e67e5fadc730c38c0ede0de2db7f7034b) |
| Buyer actually withdrew refund | [0x6d233546…](https://sepolia.etherscan.io/tx/0x6d23354666c5dd871f6e70f85b1641506b5fe4d05ab1f7bd66ebcda933374c40) |
| New mandate without preview reverted | [0xbf3c465a…](https://sepolia.etherscan.io/tx/0xbf3c465a59ddfe8b0cb07ecad4ff25e74594940057d95bdb27103b5020cd4ac6) |
| Old signatures after revocation reverted | [0x87855308…](https://sepolia.etherscan.io/tx/0x87855308e8c6c2de9ddcae8618cdecc62b8af83edacadaf4281f1d1c7aafb840) |

The 14 receipts include deployment and mandate registrations. Their measured gas fees total **0.003892359492797946 test ETH**; this is neither a fiat cost nor an NPU energy estimate. Tiny DEMO principal conversion is for testing and does not demonstrate economical production micropayments. Final locked principal and withdrawal credits are both zero. A completed-run resume reused all 14 hashes and left relayer nonce 27 and buyer nonce 2 unchanged.

Evidence: [complete report](../artifacts/dealtrace/vault/runs/ade00002-2960-4000-8000-202609290001/report.json), [independent finalized observation](../artifacts/dealtrace/vault/runs/ade00002-2960-4000-8000-202609290001/finalized-verification.json), [source match](../artifacts/dealtrace/vault/runs/ade00002-2960-4000-8000-202609290001/source-verification.json), [resume proof](../artifacts/dealtrace/vault/runs/ade00002-2960-4000-8000-202609290001/resume-proof.json). The read-only verifier's pre-deployment-finality classification fix and original execution bytes are retained alongside the report.

## Accounting and recovery rules

`allocated` is the total principal ever funded under a mandate. A refund does **not** restore permission; another allocation requires enough remaining gross budget or a newly authorized mandate. This prevents retry churn from becoming unlimited spending authority.

The accounting invariant is `vault balance >= totalLocked + totalCredits`; ordinary test flows assert equality. Unsolicited forced ETH can create surplus, so equality is not a universal invariant. Released/refunded credits are separate from actual native-asset withdrawals. Permissionless `withdrawFor` can send only to the beneficiary; only the beneficiary can redirect through `withdraw(destination)`.

State changes precede external transfers and use OpenZeppelin ReentrancyGuard. Reverting receivers and reentrant withdrawal attempts are tested on the EVM, including an ERC-1271 receiver. This follows the [Solidity withdrawal pattern](https://docs.soliditylang.org/en/latest/common-patterns.html#withdrawal-from-contracts).

The runner persists the exact signed raw transaction **before** broadcast. A timeout resumes the same run and transaction hash; it does not create another payment. A conflicting nonce or unresolved transaction stops the run. This V2 runner does not claim the V1 engine's more extensive replacement-reconciliation features. If a funded job expires during interruption, anyone can invoke `refund(dealHash, 2, nonzeroReasonHash)` and the buyer can withdraw its credit. New execution must never be used to conceal an unresolved old one.

## Verification and operation

```sh
pnpm dealtrace:vault:compile
pnpm dealtrace:vault:demo             # Real local EVM; authored dialogue
pnpm ade:test                        # Includes contract attacks and full V2 flow
pnpm dealtrace:start                 # V2 proof at /vault.html
pnpm dealtrace:vault:verify           # Read-only independent finalized Sepolia check
```

Public execution uses an already provisioned project test wallet directory (`DEALTRACE_SEPOLIA_DIR`), `SEPOLIA_RPC_URL`, and an explicit per-transaction gas cap (`DEALTRACE_VAULT_MAX_GAS_WEI`). Deployment needs more gas than an individual escrow operation. The retained run uses a maximum-fee reservation cap of 8,000,000,000,000,000 wei, not a measured fee. Existing free test assets cover principal and gas; the accounting unit is not USD. Use `--sepolia --run=<UUID>` and preserve the private run directory when resuming.

The independent verifier needs only the exported report, the repository's pinned deployment and read-only RPC. It verifies source-manifest and negotiation bindings, typed signatures, exact transaction calldata/value/sender, canonical blocks, required events, historical revert reasons, final escrow states, restriction/revocation and solvency. `VALID` at `latest` is a local/current-state check; the submission proof requires `VALID` at `finalized`. An unavailable or not-yet-finalized observation is not a passing public result.

## Remaining trust and release gates

- The evaluator can dishonestly approve bad work **at the already agreed amount**, or dishonestly trigger a mismatch refund. V2 prevents it from changing the signed price or recipient; it does not remove delivery trust.
- Participant keys are separate roles controlled by one demo operator. Organization onboarding, wallet UX, source attestation and key custody are not production ready. ERC-1271 compatibility tests are not a Safe-wallet integration claim.
- Restriction scope is a buyer/seller address pair, not a Sybil-resistant business identity. A buyer can deliberately choose a new evaluator in a new mandate. That is a new human authorization, not a guarantee of persistent reputation.
- Mandate revocation affects a registered mandate; signed but not yet registered mandates remain usable until expiry. Production cancellation should cover unused signatures and nonce invalidation.
- Preview evidence and all detailed conversation records stay off-chain. On-chain hashes bind bytes; they do not make missing evidence recoverable or true.
- This is tested prototype code, not an independent security audit. Fuzzing, formal specification, organizational signing and externally operated supplier/evaluator pilots are the next release gates.
- The planned three-person comprehension study still needs real responses. Automated attacks and browser checks do not supply those observations.

The judge-facing claim is deliberately concrete: **“Try to pay the wrong bill directly on-chain. It still fails. Then inspect exactly what was signed, what failed, and why the correct payment succeeded.”**
