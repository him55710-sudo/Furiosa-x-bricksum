# Context strategy comparison

Run `5823de0f-ea16-4e44-ba3e-0e145996b1d0` used the actual Kiln `qwen3-32b` API on September 29, 2026. This is a small authored engineering experiment, not a customer study, held-out benchmark or hardware-power measurement.

The dataset, expected answers, prompt adapter and source hashes were written before the first call. No failed case was retried or removed. There were two conversations of four turns each: renegotiated price/deadline/acceptance, and conflicting scope/source requirements followed by an ambiguous price. Financial execution was not part of this experiment.

| Arm | Strict correct turns | Exact newest patch / safe stop | Calls | Input + output tokens |
|---|---:|---:|---:|---:|
| Explicit rules | 8/8 | 8/8 | 0 | 0 |
| Incremental interpretation | 7/8 | 7/8 | 8 | 12,669 |
| Full-transcript input | 3/8 | 6/8 | 8 | 15,358 |

Strict correctness requires the expected newest change or safe stop, accumulated term values and last-change message provenance. A mistake can therefore affect later turns; the turn counts are not independent samples. All three arms made zero false acceptances on these authored turns.

Incremental interpretation sends the newest message and its accumulated parsed state. The full-transcript arm sends the initial terms and entire growing message prefix, without prior parsed state. Both use the same production output schema for **only the newest patch**, sentence-bound evidence validation and deterministic numeric conversion. This is not a full transcript re-extraction comparison. The deterministic baseline has explicit rules written for these expressions.

Incremental interpretation made one malformed acceptance response (`KILN_INVALID_TOOL`) and safely stopped at the ambiguous price. The full-transcript arm missed an inherited deadline change, attempted numeric extraction from a nonnumeric repair message, and safely rejected the final ambiguous price; earlier mistakes persisted in its reconstructed state. There were no payments to block or release in this isolated experiment.

Observed total token use was 17.5% lower for incremental input in this single run. Prompt shape, changing context, model nondeterminism and output lengths all affect this number. It is not a universal reduction rate or evidence of measured NPU energy savings. For this controlled vocabulary, rules were best and used no inference. Kiln remains useful for proposing meaning from variable language, with strict validation and bilateral review before action.

The original report's `usage.flows.*.failed_calls` summary incorrectly read an `error` property instead of Kiln's `result` field. Raw attempts and top-level case errors were correct and are preserved. The separate `accounting-correction.json` derives accurate failure counts from those original records; the aggregator and a regression test are now fixed. Token totals were unaffected.

- [Frozen input](../artifacts/dealtrace/context-comparison/5823de0f-ea16-4e44-ba3e-0e145996b1d0/frozen-input.json)
- [Original complete report and individual attempts](../artifacts/dealtrace/context-comparison/5823de0f-ea16-4e44-ba3e-0e145996b1d0/report.json)
- [Accounting correction](../artifacts/dealtrace/context-comparison/5823de0f-ea16-4e44-ba3e-0e145996b1d0/accounting-correction.json)
- [Authored cases](../verification/dealtrace-context-comparison.json)
- [Runner](../scripts/compare-dealtrace-context.mjs)

Reproduce without API calls with `node scripts/compare-dealtrace-context.mjs --rules-only`. For a fresh paid-inference observation, configure the existing Kiln environment and pass `--live`. Each invocation creates a new immutable run directory; never overwrite the retained run to improve a score.

## True full-transcript re-extraction follow-up

The final-plan audit identified a scope mismatch: feeding the whole transcript while returning only the newest patch does not measure the planned strategy of re-extracting the entire conversation. A separate follow-up fixes the experimental scope without changing the original results or production agent.

The follow-up sends initial terms and the growing transcript. At every prefix it requests **one interpretation for every message from the beginning**, then reconstructs terms and provenance from that complete output. It never passes a previous model extraction to the model. The same source-span checks and exact numeric conversion apply; an invalid reconstruction is rejected atomically. Complete-history accuracy is also recorded separately from the earlier strict latest-turn/state metric.

The dataset and expected answers are byte-identical to the earlier experiment. The new runner, prompt, schema and source snapshots were frozen before its first call. This follow-up was designed after seeing the earlier results, so it is not newly held-out evidence. Comparing token counts across these successive runs is observational, not a simultaneous randomized comparison. There are no financial calls.

The completed follow-up made **8 actual Kiln calls**, using **8,812 input + 10,172 output = 18,984 tokens**. Usage was reported for every attempt. It passed **4/8** under the same strict latest-turn/state/provenance metric; the newest patch or safe stop alone passed 5/8. The full historical patch sequence was exact on 4/7 non-ambiguous prefixes. There were zero false acceptances in these cases.

Three responses were rejected: an incorrect event count, a malformed tool response, and the deliberately ambiguous price. The last rejection safely stopped interpretation, but did not repair the stale terms left by the preceding failed source/scope repair, so it did not pass the strict combined metric. The model could also recover earlier errors by reconstructing the entire history on a later turn. Both behaviors are visible in the original report.

| Strategy | Strict correct turns | Calls | Reported tokens |
|---|---:|---:|---:|
| Explicit rules, earlier run | 8/8 | 0 | 0 |
| Incremental, earlier run | 7/8 | 8 | 12,669 |
| Full transcript → newest patch, earlier run | 3/8 | 8 | 15,358 |
| Full transcript → all event interpretations, follow-up | 4/8 | 8 | 18,984 |

Incremental use was 33.3% lower than true re-extraction in these successive observations. This is an observed comparison on this dataset, not a general efficiency guarantee. It gives no direct measurement of NPU electricity use. The model arms did not outperform the tailored deterministic rules.

- [Follow-up frozen input](../artifacts/dealtrace/reextraction/55e66680-57b9-46be-b82b-5d3e98dbf7b0/frozen-input.json)
- [Full record of requests, proposals, errors and usage](../artifacts/dealtrace/reextraction/55e66680-57b9-46be-b82b-5d3e98dbf7b0/report.json)
- [Follow-up runner](../scripts/compare-dealtrace-reextraction.mjs)

`node scripts/compare-dealtrace-reextraction.mjs --fixtures-only` checks the grading path without inference; its synthetic expected outputs are not model-performance evidence. `--live` performs eight new Kiln calls, one per prefix, with no retries or repair prompts.
