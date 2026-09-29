# Three-minute Accord Lock walkthrough

Use the production site and start on Overview. The guided route is deterministic; Live Agents uses actual model calls whose timing and outcomes vary. All current payments use private-EVM test units.

| Time | Operator action | What to say |
| --- | --- | --- |
| 0:00–0:25 | Show Overview, then Run the demo. | The agreement decides what gets paid. A human gives the buyer a budget of 40 and a per-deal limit of 30. |
| 0:25–0:50 | Send request to all agents. | Three sellers quote. Nexus asks 35. The Authority Gate stops it before signatures or funding because 35 exceeds 30. |
| 0:50–1:20 | Negotiate with Atlas; send 18; accept the revised 20; approve and lock. | Negotiation can change the price. Once both sides sign, Accord fixes the terms and locks exactly 20. |
| 1:20–1:55 | Run worker and inspect returned rows. | This is actual source-table processing. The invoice asks 25. The budget allows 25, but the agreement does not: 25 is not 20. |
| 1:55–2:25 | Request the agreed invoice; approve and pay 20. | Correcting the invoice makes the payment eligible. Exactly 20 is paid once. |
| 2:25–3:00 | Inspect proof; verify the receipt. Optionally show Live Agents. | The signatures, escrow receipt and chain state are inspectable. Guided Demo is deterministic; Live Agents calls Kiln qwen3-32b and exposes each actual request. |

For a real custom task, create a deal and upload or paste a CSV/JSON table. Set its limits and choose Guided Demo or Live Agents. Live negotiation sends the brief, coverage requirements and public dialogue to Kiln; source rows stay in the browser workspace. Source links are preserved, not independently researched. Public Sepolia evidence is a separate historical execution, clearly identified in Proof.
