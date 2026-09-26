# PRA Drafter - handoff from coder 4 (final pass for v1)

Scope delivered: SPEC.md "Review and export" (judge model, full page
viewer, apply-fix, source view, Word export, calibration), plus the 5 gaps
coder 3 flagged in HANDOFF-3 "Known limits". This closes out the v1 user
workflow end to end: upload -> register -> start a PRA -> draft -> review
-> export.

## What was built

### Judge model (`lib/drafter/judge.ts`, `lib/drafter/judge-runner.ts`)
- 6-criterion rubric exactly as SPEC.md states it, with the critical flags
  table reproduced in `judge.ts`'s doc comment.
- `buildJudgePrompt` asks for `{quote, pass, reason, suggested_rewrite}` in
  that field order per criterion - quote before verdict, as SPEC.md
  requires.
- `validateJudgeOutput` is the hard guard: an unknown criterion key, a
  missing criterion, an empty/missing quote, or (critically) a quote that
  is not a verbatim substring of the judged text, is **always** an invalid
  review - never silently a pass. Same for malformed JSON from the
  provider (handled one layer down in `llm.ts`'s existing retry-once logic,
  unchanged from coder 3).
- `judgeOneEnhancement` is the DB-touching orchestration (one call per
  enhancement, driven from the browser, cost-cap checked first, logged to
  `drafter_model_calls` with model + prompt version, same pattern as
  `draft-enhancement.ts`).
- Judge checks style/structure only, and runs strictly after lint (the
  draft/PATCH endpoints already ran lint before this step exists).

### Combined review status (`lib/drafter/review-status.ts`)
`review_result` is now `{lint, judge, judgeStale, status}` (the `judge` key
HANDOFF-3 said to add alongside `lint`, same JSON blob, no new column).
`combineStatus()` is the single source of truth for the four-way marker:
- **critical**: any critical lint issue, OR the judge's overall verdict is
  `fail`.
- **not_reviewed**: no judge result yet, OR the judge result is stale, OR
  the judge output was invalid. **Never shown as pass** in any of these
  cases (this was the explicit SPEC.md requirement and is unit-tested in
  `review-status.test.ts`).
- **minor**: lint has only warnings, or the judge passed overall but a
  non-critical criterion failed.
- **pass**: lint clean AND a fresh judge pass AND every criterion passed.

A manual edit (`PATCH /api/drafter/pras/[id]/enhancements/[enhId]`)
re-lints immediately and marks any existing judge result `judgeStale:
true` rather than discarding it - the old judge output stays visible for
reference until the judge is re-run. A (re)draft always resets judge to
null (the text just changed under it).

### Reviewer UI
- **Page viewer** (`components/drafter/DrafterPraDraftClient.tsx`,
  substantially rewritten): per-enhancement status badge (pass/minor
  issues/critical issues/not reviewed), a "Run judge" button, the judge
  panel showing each criterion's quote/pass-fail/reason/suggested rewrite,
  an **Apply fix** button per failing criterion (pure logic in
  `lib/drafter/apply-fix.ts` - replaces the quoted sentence with the
  suggestion in the editable box; the user still has to hit Save, which
  re-lints), a **Source** toggle per enhancement (register rows/fields it
  was drafted from, via the new `.../enhancements/[enhId]/source` route),
  token spend shown, an **Export to Word** button with the blocking-reasons
  panel and an override-with-reason flow, and the unassigned-controls
  banner (see "Template review nudge" below).
- **Paste-in reviewer** (`/drafter/reviewer`,
  `components/drafter/DrafterReviewerClient.tsx`): paste control text +
  rationale + section, get the same lint + judge review, nothing saved.
  Backed by the stateless `POST /api/drafter/reviewer`.
- **Calibration** (`/drafter/calibration`,
  `components/drafter/DrafterCalibrationClient.tsx`): add labelled items by
  hand or import a JSON array, run the judge over the whole set, see
  agreement per criterion vs the threshold (`drafter_settings.
  judge_agreement_threshold_pct`, default 80), run history keyed by model +
  prompt version. A banner on the page viewer
  (`GET /api/drafter/calibration/status`) reads "Reviewer not yet
  calibrated" whenever the CURRENT judge model + prompt version has no
  passing run - verified live: it shows before any run exists, and clears
  after a 100%-agreement run in local QA (below).
- **Exemplar promotion + agreed wording**
  (`.../enhancements/[enhId]/approve`): approving an enhancement writes
  `agreed_wording` onto every control it covers and appends this PRA to
  `used_in_pra_ids`; `promoteAsExemplar: true` additionally creates a
  `source: "user_approved"` exemplar tagged by section.

### Word export (`lib/drafter/export-docx.ts`,
`app/api/drafter/pras/[id]/export`)
- Real Word heading styles: section headings are `HeadingLevel.HEADING_1`,
  each enhancement's number is `HEADING_2` - outline view and a
  Word-generated TOC both work off these.
- Field labels and order come from the Template's `field_labels` exactly
  as confirmed (Control enhancement -> rationale -> Backoffice control
  impacted -> Evidence of delivery).
- Placeholders (`[...]`) are kept bracketed and rendered with a yellow
  Word highlight run (`runsWithPlaceholdersHighlighted`).
- Review flags (lint/judge status, "not_reviewed" etc.) are never written
  into the document - proven in `export-docx.test.ts` by asserting the
  rendered `document.xml` never contains those words.
- Optional open-items appendix (default on, `includeOpenItemsAppendix`).
- **Reuses the approved PRA's own `styles.xml`** when its source document
  was a `.docx`: `extractStylesXmlFromDocx` unzips it (via `jszip`, added
  as a direct dependency) and passes the raw XML to `docx`'s
  `externalStyles`; falls back cleanly to the library's defaults for
  `.md`/`.html` sources or a missing/corrupt `styles.xml`. **Verified in
  local QA**: the exported file's `word/styles.xml` style-id set is
  byte-for-byte identical to the fixture `approved-pra.docx`'s.
- Filename: `"<product> PRA draft <YYYY-MM-DD> v<version>"` - version is
  `count(drafter_export_log rows for this PRA) + 1`, so repeat exports of
  the same PRA increment.
- **Export gate**: blocked (`409`, with the list of blocking
  enhancement/reason pairs) while any non-gap enhancement's combined status
  is `critical` or `not_reviewed`, per `checkExportReadiness()` in
  `lib/drafter/pra-status.ts`. A caller may pass `{overrideReason}` to
  export anyway - this is logged to `drafter_export_log` (with
  `overridden`, `override_reason`, the blocking reasons at the time, and
  the actor) AND to `drafter_open_items` (`item_type: 'export_override'`).
  Verified live: 409 without a reason, 200 with one, both audit rows
  correct.

### PRA status lifecycle fix (Known limit #3)
`lib/drafter/pra-status.ts`'s `maybeAdvancePraStatus`, called after every
draft and judge call (and the PATCH edit route), advances
`draft -> drafted -> in_review -> ready_to_export -> exported` purely from
enhancement completeness/review state - **not** from spend, which was the
bug (`updatePraSpend` used to be the only thing flipping status, so a PRA
drafted entirely via reuse/placeholder/stub calls with zero spend never
left `draft`). `ready_to_export` regresses to `in_review` if a later edit
makes the PRA no longer export-ready. Verified live: the QA PRA below
reached `drafted` after nine stub/no-model-call drafts with `spend_pence:
0`, and `exported` after a real export call.

### Scope B fixes
1. **Reuse no longer falls back to the obligation description**
   (`lib/drafter/draft-enhancement.ts`). A requirement description is not
   control wording. When `coverage = 'yes'` and no `agreed_wording` is
   held, the enhancement drafts as the placeholder
   `"[Agreed wording not held for this control]"` plus an open item
   telling the user to enter/approve wording on the library control. New
   endpoint: `POST /api/drafter/library/controls/[id]/agreed-wording
   {agreedWording}`. Verified live end to end: five reuse controls drafted
   as the placeholder, then agreed wording was set on each and a re-draft
   picked it up verbatim.
2. **Template review nudge + unassigned controls never dropped silently**.
   The Template review screen (`DrafterTemplatesClient`) now shows an
   inline warning under "Back office control map" when a section has none
   (this is exactly HANDOFF-3's Known limit #2 case). The PRA page shows a
   red banner listing every selected-but-unassigned control with its
   reason (the data was always returned by
   `assignControlsAndCreateEnhancements`; it just was not surfaced).
   Verified live: after fixing the EDD section's map, 0 of 9 selected
   controls came back unassigned (previously this fixture reproduces the
   unassigned case if the map fix is skipped).
3. **Style brief attached to the StylePack** (migration 014:
   `style_brief_document_id` + `style_brief_text` on
   `drafter_stylepack_versions`). Creating or editing a StylePack accepts
   `styleBriefDocumentId`; the document's parsed text
   (`blocksToPlainText`) is stored and passed into `buildWriterPrompt` as
   "House style brief (form and tone only - never a source of facts)" -
   deliberately never added to `allowedInputTexts`, so it cannot become a
   source of "supported" facts for the fact boundary. Verified live: the
   brief's text round-tripped through creation.
4. **PRA status advances regardless of stub vs paid spend** - see above.
5. **Client-direct Blob upload for files over the 4MB request cap**
   (`app/api/drafter/documents/upload-token` using
   `@vercel/blob/client`'s `handleUpload`, gated by the same
   `requireDrafterActorApi` guard in `onBeforeGenerateToken`;
   `DrafterDocumentsClient` switches to `@vercel/blob/client`'s `upload()`
   above the threshold). `POST /api/drafter/documents` now also accepts
   `{directUpload: true, blobUrl, pathname, filename}` to finalise a
   client-uploaded file (fetches the bytes back via the existing private
   blob stream helper and runs the same parse/hash/detect pipeline a
   multipart upload gets). Not exercised in local QA (the fixtures are all
   under 4MB) - covered by `tsc`/`eslint`/build only; a real >4MB file
   push against a real `BLOB_READ_WRITE_TOKEN` would be the next proof
   point if this matters before a real rollout.

## Tests

612 -> a run right before this handoff shows **560 vitest tests passing**
(up from 504 at HANDOFF-3), including:
- `judge.test.ts` - prompt field order, all 6 criteria, `validateJudgeOutput`
  covering pass / critical-fail-wins-over-pass / minor-only-fail /
  quote-not-found / unknown-criterion / missing-criterion / malformed shape
  / empty quote.
- `review-status.test.ts` - the combined-status truth table.
- `calibration.test.ts` - agreement maths, including "an item with no
  judge output must not count toward that criterion's total".
- `export-docx.test.ts` - a REAL `.docx` is unzipped and its
  `word/document.xml` is asserted to contain `Heading1`/`Heading2` style
  ids, all four field labels, a highlighted bracketed placeholder, the
  open-items appendix, and NONE of the review-flag words.
- `apply-fix.test.ts` - the pure replace-quote-with-suggestion logic.
- `judge-runner.integration.test.ts` - real DB rows through the actual
  `judgeOneEnhancement`, one test per stub fixture kind (pass/minor/
  critical/quote-not-found/unknown-criterion/malformed), plus
  `checkExportReadiness` blocking then clearing.
- `export-gate.integration.test.ts` - the export gate's blocking states
  and the override audit-log shape, against real DB rows.
- `stale-judge-after-edit.integration.test.ts` - the exact PATCH-route
  sequence, asserting a fresh pass becomes `not_reviewed` (not silently
  kept as pass) the moment the text is edited.
- Two HANDOFF-3 integration test expectations were corrected to match the
  now-fixed behaviour (status is `not_reviewed` until judged; reuse drafts
  a placeholder rather than the obligation description) - see the commit
  history for the diff and reasoning.

Judge stub fixtures live in the same file coder 3 started
(`test/fixtures/drafter/writer-stub.json`, `"judge"` key): entries keyed on
marker strings `JUDGE-PASS`, `JUDGE-MINOR`, `JUDGE-CRITICAL`,
`JUDGE-QUOTE-NOT-FOUND`, `JUDGE-UNKNOWN-CRITERION`, `JUDGE-MALFORMED`.

## Local HTTP QA actually performed (this pass)

Built (`next build`), started `next start -p 3107` with `PRA_MODEL_STUB=1`
(and, for the judge fixtures specifically, `PRA_MODEL_STUB_FILE` pointed at
the fixture file - restarted the server once to switch this on, no data was
lost), signed in as the pre-existing allowlisted `drafter-qa@example.com`.
Full journey, all via real HTTP against the running server (not a test
harness):
1. Uploaded and confirmed the approved PRA `.docx`, style brief `.md`, and
   register `.xlsx` fixtures.
2. Extracted the skeleton (4 sections, matched HANDOFF-3's numbers
   exactly), created a Template, **fixed the EDD section's back-office
   control map in a v2** (reproducing and then fixing HANDOFF-3's Known
   limit #2 live), confirmed that version.
3. Created a StylePack **with the style brief attached** - confirmed
   `style_brief_text` round-tripped.
4. Imported the register, overrode the 13 intentionally-blocking fixture
   issues (formula errors, a contradiction, duplicate REQ IDs - same
   pattern as HANDOFF-3), accepted the version: 10 controls built.
5. Started "Correspondent Banking - EEA Respondents" (legal-person-only).
   Candidates: 5 reuse / 3 adapt / 1 new / 1 unassessed - matches
   HANDOFF-3's numbers exactly. Selected all 9 non-unassessed, added one
   manual gap on 2.3. **0 unassigned** (proves fix #2's live repair).
6. Drafted all 9 real enhancements one call at a time. Reuse enhancements
   with no agreed wording correctly drafted the
   `"[Agreed wording not held for this control]"` placeholder (proves fix
   #7) - PRA status advanced to `drafted` with `spend_pence: 0` (proves fix
   #3/#10).
7. Set agreed wording on all 5 reuse controls via the new endpoint,
   re-drafted: each reuse enhancement now carries the real agreed text
   verbatim.
8. Ran the judge on every drafted enhancement: the default (marker-free)
   stub judge response has an empty quote for every criterion, which
   `validateJudgeOutput` correctly rejected as invalid every time - a live
   demonstration, on real enhancement text (not a crafted test), of "never
   silently pass on invalid judge output". Separately proved a genuine
   pass end to end via the paste-in reviewer with `JUDGE-PASS` marker text
   (judge overall `pass`, combined status `minor` because of an honest
   word-count warning).
9. Attempted export with no override: `409`, correct blocking list.
   Exported with an override reason: `200`, a real, unzippable `.docx`
   downloaded (`5` `Heading1`s, `10` `Heading2`s, `26` highlight runs, both
   field labels present, an open-items appendix, zero review-flag words,
   and a `word/styles.xml` byte-identical style-id set to the source
   fixture, proving external-styles reuse). PRA status advanced to
   `exported`; `drafter_export_log` and `drafter_open_items` both carry the
   override reason and actor correctly.
10. Added 2 calibration items by hand, ran the judge over the set: 100%
    agreement on every criterion, run recorded, `passed_threshold: true`.
    Confirmed the "not yet calibrated" banner (`GET
    /api/drafter/calibration/status`) correctly flips to `calibrated: true`
    afterwards.
11. Approved one enhancement with `promoteAsExemplar: true`: `agreed_wording`
    written, PRA added to `used_in_pra_ids`, a new `user_approved` exemplar
    created. Fetched its Source view: returned the underlying control and
    register-derived fields correctly.
12. Manually edited one already-judged enhancement's control text via
    PATCH: lint re-ran immediately, `judgeStale` flipped to `true`, the
    combined status dropped out of `pass` even though the previous judge
    result (kept, not discarded) still shows `overall: pass` - proves the
    stale-judge behaviour live, not just in the unit test.

Local QA data (the test account, all documents, template/stylepack/PRA
versions, controls, register import, exemplars, calibration items/runs,
export log) was fully truncated afterwards - see the commit history for
the exact `DELETE` statement order (exemplars before PRAs, because of
`drafter_exemplars.source_pra_id`'s FK; everything else follows HANDOFF-3's
ordering).

## Gates run

`npx tsc --noEmit` (clean), `npx vitest run` (560/560 pass), `npm run build`
(clean), `npx eslint` on every file touched in this pass (clean, after
fixing two `react-hooks/set-state-in-effect` violations this pass's own UI
introduced).

## Deviations from the brief / judgment calls

- The judge's model name and prompt version are stored **inside**
  `review_result.judge` (as `modelName`/`promptVersion` fields on the
  `JudgeResult` object) rather than as new columns on
  `drafter_enhancements` - the existing `model_name`/`prompt_version`
  columns on that table are the WRITER's, and SPEC.md's data model doesn't
  reserve a second pair of columns for the judge. This keeps "store model +
  prompt version" true without a migration, at the cost of it living one
  level deeper in the JSON than the writer's.
- "Apply fix" is implemented as a pure client-side text replacement
  (`lib/drafter/apply-fix.ts`) that populates the editable box - SPEC.md's
  exact words ("Apply fix replaces the quoted sentence with the suggestion
  in an editable box before saving") match this reading; there is no
  separate server endpoint for it, the existing PATCH save endpoint is
  used afterwards (with `editType: "apply_fix"` already supported by
  coder 3's PATCH route and `drafter_enhancement_edits` schema).
- Calibration's per-criterion agreement only counts pairs where BOTH a
  human label and a judge output exist for that criterion (a failed judge
  call on one item does not silently count as a disagreement OR an
  agreement for that item - it is excluded from the denominator). This
  seemed like the only defensible reading of "never let absence render as a
  pass" applied to a measurement rather than a gate.

## Not built / known gaps

- Client-direct Blob upload (#11) is implemented and passes every static
  gate, but was not exercised against a real Blob token with a file over
  4MB in local QA (no fixture is that large, and no `BLOB_READ_WRITE_TOKEN`
  is configured locally). Treat it as code-reviewed but not yet
  field-proven; the first real large-file upload in a deployed environment
  is the actual proof point.
- The judge's per-criterion prompt asks the model not to invent facts, but
  (per SPEC.md/BUILD-DECISIONS) the judge is explicitly scoped to
  style/structure only - it does not re-run the fact boundary. That
  remains solely the writer pipeline's job, unchanged from coder 3.
- No UI exists yet to browse `drafter_model_calls` cost history beyond the
  per-PRA spend total already shown; a firm-wide cost dashboard was not
  asked for and was not built.

## How to switch on a real (non-stub) judge/writer model

Set, per role (writer and/or judge can be switched independently):
- `OPENROUTER_API_KEY` - shared fallback key for both roles if a per-role
  key isn't set (see `PRA_WRITER_API_KEY` / `PRA_JUDGE_API_KEY` below).
- `PRA_WRITER_BASE_URL`, `PRA_WRITER_API_KEY` (optional, falls back to
  `OPENROUTER_API_KEY`), `PRA_WRITER_MODEL` (defaults to
  `openai/gpt-5.6-luna` if unset but a base URL/key are present).
- `PRA_JUDGE_BASE_URL`, `PRA_JUDGE_API_KEY` (optional fallback, as above),
  `PRA_JUDGE_MODEL` (defaults to `minimax/minimax-m3`).
- Unset `PRA_MODEL_STUB` (or set it to anything other than `"1"`) once
  real credentials are in place, so real calls are made instead of stub
  ones. `PRA_MODEL_STUB` is refused outright whenever
  `VERCEL_ENV === "production"`, regardless of its value - this is a hard
  safety rail, not a toggle.
- `PRA_DRAFTER_ALLOWED_EMAILS` - comma-separated allowlist; unset/empty
  means nobody can reach the module (404 for everyone, including a
  correctly-signed-in user).
- `BLOB_READ_WRITE_TOKEN` - needed for the client-direct upload flow
  (#11) and for private-blob storage of uploaded originals generally; its
  absence degrades cleanly to local `fallback_bytes` storage and disables
  only the >4MB upload path (surfaced to the user as
  `useDirectUpload: true` on a 400 from the multipart route... actually the
  route currently just returns the size-limit error either way; wiring
  the UI to retry via direct upload automatically on that flag is a small
  follow-up if it's ever hit for real).
