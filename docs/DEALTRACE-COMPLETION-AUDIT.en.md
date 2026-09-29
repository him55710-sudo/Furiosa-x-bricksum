# DealTrace completion audit

This audit distinguishes implementation, observed execution and evidence that still needs real participants. A green test suite does not close an unmet human gate.

## Implemented and demonstrated

| Requirement | Authoritative evidence | Result |
|---|---|---|
| Signed Buyer/Seller messages, independent local keys and stores | `src/dealtrace/agent-service.mjs`; public `agent-evidence.json`; process regression | Implemented; one operator, not external organizations |
| Revisions, field provenance, semantic conflict and bilateral confirmation | `ledger.mjs`; six exported conversation packets; same-hash verification; browser source navigation | PASS |
| Immutable complete Deal, human mandate, recipient, chain and source profile | `claims.mjs`, `domain.ts`, `assurance.test.mjs` | PASS |
| Budget 40 / Deal 26 / signed invoice 31 stops | Public run `34d1da0d`: recorded CLAIM_AMOUNT rejection, locked escrow, unchanged nonce | PASS; no additional funding or payout |
| Corrected 26 invoice and valid delivery pay exactly once | Same run's release hash; concurrent duplicate-claim regression | PASS |
| Failed delivery refunds and changes the next permission | Public refund; new mandate PREVIEW_REQUIRED; recomputed source outcome | PASS |
| Revocation, expiry, merchant, fees and budget boundaries | Public revocation/expiry records and combined automated boundary suite | PASS; public expiry uses injected policy time |
| Recovery and observation uncertainty | Existing recovery/race/reorg tests; public completed-run resume | PASS within tested cases; old recovery proofs retain their original versions |
| Actual Kiln inference and per-flow usage | Public 10 calls / 12,073 tokens; failed expression attempts also retained | PASS |
| Chain funding, release and refund tied to evidence | Four Sepolia hashes and five independently finalized VALID receipts | PASS |
| Portable evidence without app DB or private keys | Standalone CLI on browser-downloaded receipt; altered message INVALID; missing conversation INCOMPLETE | PASS |
| Approval, watch, stop, usable output and export | CUA approval/stop runs; four-row result; byte-identical downloaded receipt; mobile check | PASS as automated UI testing |
| Three-scene demo, short brief, English README | 180-second decoded screenshot film; visually reviewed one-page PDF; README | Produced; film is saved-run evidence, not live footage |
| Main integration preserves existing work | Both research modes and tool families retained; integration report and current full test suite | 139/139 local PASS |
| Audit-screen altered-copy demonstration | Real browser click yields INVALID / DEAL_HASH_MISMATCH; original receipt preserved; `artifacts/dealtrace/audit-copy/browser.json` | PASS; no model, chain query or financial action |
| Rules vs full-transcript vs incremental comparison | Frozen two-conversation, eight-turn experiment plus true full re-extraction follow-up; all 24 model attempts retained | Complete; rules 8/8, incremental 7/8, whole-transcript/newest-patch 3/8; true all-event re-extraction 4/8. Follow-up is not a new held-out evaluation |

## Version boundaries

The public and filmed run was tested before main integration. Its source fingerprint is `c79135af89b4fe1a5b5d1df59942dedc0a11c370408ee66183205bf8c7cde281`. A later UI readiness-label fix is mapped in `post-run-ui-change.json` with original bytes. The filmed presentation's 129-test report is archived at `artifacts/dealtrace/integration/pre-merge-tests.json`.

Main integration adds the existing PDF/content-review workflows and preserves both Kiln tool families. `artifacts/dealtrace/integration/report.json` enumerates the changed and added source inputs. The new DealTrace agent, ledger, claim, engine, chain, domain and verifier files remain unchanged from the actual public execution. A later accounting correction counts rejected Kiln responses from their actual result code; its regression brings the suite to 138. The original public workflow had no failed calls, so its token and transaction totals are unchanged. Do not claim that every source byte was identical across these versions.

The subsequent read-only receipt-copy API/button adds one regression, bringing the current suite to 139. Its browser evidence and a preserved copy of the preceding 138-test report are in `artifacts/dealtrace/audit-copy`. The public financial run and filmed version are unchanged.

## Still open

| Explicit planned gate | Current evidence | What closes it |
|---|---|---|
| Three first-time people reconstruct the workflow | No real participant responses | At least three anonymized original responses to the final-plan questions, recorded with the version shown |

These missing observations are not converted into passing requirements. The software and repository can be released as a testnet prototype while the full evidence goal remains open.

The model choice follows the user's explicit correction to `qwen3-32b`; the actual API model ID is retained. This is not a claim that we independently verified an organizer announcement.

Customer interviews, an external supplier endpoint, production identity/custody and NPU hardware power measurements are pilot or production prerequisites in the final plan, not outcomes established by this demo. The [three-person study kit](DEALTRACE-HUMAN-STUDY.ko.md) is ready; no simulated answers are entered.
