# One transaction, one room

The presentation now identifies Buyer agent and Seller agents 1, 2 and 3. Atlas/Nexus/Orbit remain canonical backend IDs and remain unchanged in original model output, signatures, receipts and exported JSON. Display aliases apply to English, Korean and Simplified Chinese.

## Demo flow

1. Start demo prepares an editable prompt using the current policy and selected language. This creates no mandate and makes no model call.
2. Send to Buyer agent creates the actual sample task and requests deterministic offers. Recorded seller priorities and offers appear as conversation. Authority violations pause for a human decision.
3. Let Buyer negotiate records the counteroffer and seller revision. Approve signed Deal invokes the existing signatures, escrow and worker workflow. The actual mismatched invoice pauses payment.
4. Pay corrected invoice uses the existing invoice correction and exact settlement. The receipt is fetched and verified.

Guided dialogue is explicitly marked as narration based on recorded events. Prices and counteroffers come from those events. Human inputs and original Live model messages remain verbatim. No seller private policy is exposed. Live still calls Kiln through its existing implementation.

## Same-screen inspection

Conversation, execution, saved evidence and detailed transaction inspection use the same purchase screen and URL. Gate incidents open the relevant saved records. Every event can be expanded with its timestamp, event ID and unchanged raw JSON. Detailed inspection includes the execution path, delivery checks, technical proof, result download and receipt verification. Existing full operator routes remain available; custom source-file setup still uses that retained operator workflow.

Browser-local conversation history is explicitly distinguished from signed settlement proof. Current private-EVM execution is distinguished from historical Sepolia evidence. Contracts, authority checks, settlement, STOP, seller privacy, signatures and original evidence formats are unchanged.

## Validation

35 tests passed across conversation-room, i18n, product-workflow, presentation, spending-site, deal-room-chat and live-session-recovery. Production bundle build passed (existing large-bundle warning). Browser verification covered keyboard Start demo, prepared Korean prompt, three named sellers, authority block, negotiation, invoice mismatch, expandable original record, same-URL inspection, corrected settlement and receipt verification VALID. Language changes preserve transaction state. Checked widths 1440, 1920 and 390 with no document horizontal overflow. Reduced-motion UI enabled during settlement. No new live model call was made for this presentation-only change; Live regression tests were run.

Evidence:
- ../artifacts/accord-lock/agent-room/agreement-1440-ko.png
- ../artifacts/accord-lock/agent-room/mobile-390-zh.png
- ../artifacts/accord-lock/agent-room/detailed-1920-en.png

Limits: Guided agents use deterministic rules, not an LLM. The source-table worker is unchanged. Raw evidence is intentionally not translated or renamed. Clearing browser storage removes local history. OS reduced-motion emulation was not available; the UI override and existing media rule remain supported.
