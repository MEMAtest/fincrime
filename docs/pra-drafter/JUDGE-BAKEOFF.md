# Judge bake-off (2026-09-26)

## Why

A real-model production rehearsal found `minimax/minimax-m3` (the previous
judge default) failing `validateJudgeOutput` on 7 of 8 real enhancements
("criterion X was missing a quote", "quoted text not found verbatim",
"judge response was missing a criteria object"). Three fixes were made
first, independent of which model wins the bake-off:

- **Structured output**: `callDrafterModel` now sends
  `response_format: {type:"json_schema", json_schema:{...strict}}` when a
  schema is given (`buildJudgeJsonSchema()` in `lib/drafter/judge.ts`),
  falling back to `json_object` once if the provider rejects it
  (`lib/drafter/llm.ts`).
- **Tighter prompt**: `buildJudgePrompt` now states the exact schema, gives
  a worked example, and is explicit that a PASS quotes the sentence that
  satisfies the criterion (previously only failing criteria were told what
  to quote).
- **Verbatim matching without going fuzzy**: `isVerbatimQuote` in
  `lib/drafter/judge.ts` normalises whitespace and smart quotes/apostrophes
  on both sides, and tolerates a trailing-punctuation mismatch, but still
  requires the quote to be a word-for-word substring - never a partial or
  paraphrased match.
- **One repair round**: `judgeOneEnhancement` (`lib/drafter/judge-runner.ts`)
  re-asks once, with the specific validation error and the previous
  (broken) JSON attached, on a first invalid response. If the repaired
  response is still invalid, the result stays invalid - never a pass. Both
  calls are logged to `drafter_model_calls`.

## Method

6 synthetic enhancements (2 good, 2 with a minor/non-critical issue, 2 with
a critical issue, including a placeholder-heavy one), each run twice against
every candidate, all through the fixed pipeline above (structured output +
tightened prompt + verbatim matching, no repair round needed in any of these
runs). `provider: {data_collection:"deny", zdr:true}` on every call.

`qwen/qwen3.8-flash` (named in the original brief) has no OpenRouter
endpoint under a zero-data-retention policy (`HTTP 404`, "Filter by Data
Policy" - confirmed by a direct curl, not just the app) - substituted with
`qwen/qwen3-30b-a3b`, a cheap Chinese-family model that does support ZDR.

## Results

| Candidate | Valid JSON | Verdict agreement | Total cost (12 calls) | Avg latency |
|---|---|---|---|---|
| **qwen/qwen3-30b-a3b** (chosen) | 12/12 | **12/12** | **$0.0031** | **2.6s** |
| deepseek/deepseek-v4-flash | 12/12 | 11/12 | $0.0264 | 77.5s |
| openai/gpt-5.6-luna | 12/12 | 8/12 | $0.0160 | 6.5s |
| minimax/minimax-m3 (previous default) | 12/12 | 8/12 | $0.0118 | ~9.9s |

(minimax's raw per-fixture numbers are in the first bake-off run's log;
deepseek/luna are the second run's; qwen is the third, after the ZDR-404
substitution - three separate runs because the model list changed mid-way,
not three re-tries of the same set.)

Every candidate now returns 12/12 valid JSON with the structured-output +
tightened-prompt fix in place - the raw "invalid JSON" failure mode from
production is fixed regardless of which model is chosen. The remaining
differentiator is verdict *agreement* with the expected pass/fail label,
plus cost and latency: qwen/qwen3-30b-a3b agreed with every expected label,
minimax and Luna both missed 4/12 (Luna failed both "good" fixtures
outright - overly strict on plain, correctly-mechanistic text; minimax
missed one "good" fixture and one "minor" fixture), and deepseek missed one
"good" fixture and was 10-30x slower per call.

## Decision

**Default judge changed to `qwen/qwen3-30b-a3b`** (`lib/drafter/llm.ts`
`DEFAULT_MODELS.judge`, `db/migrations/013_pra_drafter.sql` price seed, and
the local dev `drafter_settings` row). It is a cheap Chinese-family model
(satisfies the owner's "cheap Chinese model or Luna, never Gemini" rule),
scored strictly better than Luna on every measured axis here, so the
"prefer non-OpenAI if within a whisker of Luna" tie-break did not even need
to be invoked - it was not a whisker behind, it was ahead.

## Total bake-off spend

$0.0742 across all four candidates' runs (48 real calls total, all
synthetic text, `zdr:true` on every call).
