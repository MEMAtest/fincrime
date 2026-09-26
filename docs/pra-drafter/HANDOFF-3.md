# PRA Drafter - handoff from coder 3 to coder 4

Scope delivered in this pass: SPEC.md "Template and house style", "Start a
PRA" and "Drafting" (steps 1-2 of the user workflow's remaining phase),
built on coder 1's schema/guard/provider and coder 2's upload/register/
library work. This covers everything up to and including a fully drafted
PRA with lint results and open items. "Review and export" (SPEC.md step 5:
the judge model, the full page viewer with a review panel, apply-fix,
source view, and Word export) is **not built** - that is your scope.

## What exists

### Skeleton extraction (`lib/drafter/skeleton.ts`)
`extractSkeleton(parsed: ParsedDocument)` walks the internal block structure
and proposes:
- Sections: number (e.g. "2.2"), title, lifecycle stage, customer type
  (parsed from a "Title · Stage · Customer type" heading, split on a middle
  dot or " - "), standard opening wording, empty-section wording, and a
  `backofficeControlMap` inferred from that section's first exemplar's
  "Backoffice control impacted" field (**null if the section had no
  enhancement in the approved PRA** - e.g. an empty EDD section - the user
  must fill this in on the review screen before starting a PRA that needs
  it, or section assignment will report the group unassigned; see "Known
  limits" below).
- Field labels: whichever exact label text the document used for each of
  the 4 canonical fields (falls back to the canonical name if never seen).
- Exemplar candidates: one per enhancement found, tagged by section title.

Proven against both the `.md` and `.docx` fixtures (`lib/drafter/__tests__/
skeleton.test.ts`, `skeleton-docx.test.ts`) - every heading, field label,
standard/empty wording and exemplar text intact.

### Templates and StylePacks (`lib/repo/drafter-templates.ts`,
`lib/repo/drafter-stylepacks.ts`)
- A Template is created UNCONFIRMED from the user-reviewed skeleton
  (`POST /api/drafter/templates`), can be edited into further unconfirmed
  versions (`POST /api/drafter/templates/[id]/versions`), and only becomes
  usable on a PRA once confirmed (`POST /api/drafter/templates/[id]/confirm`
  - `POST /api/drafter/pras` refuses an unconfirmed template version).
  Accepted exemplar candidates are stored via `createExemplar` with
  `source: "template"` - this is the ONLY approved-PRA content that crosses
  into anything else, and only as a style reference (never copied as
  another product's control text - proven structurally, see "Fact boundary
  and prompts" below).
- A StylePack is created seeded from SPEC.md's 9 style rules and the
  `banned_phrases`/`control_text_word_limits` settings
  (`POST /api/drafter/stylepacks`), editable into a new version
  (`POST /api/drafter/stylepacks/[id]/versions`).
- `getExemplarsForSectionType` returns 2-3 exemplars matching a section
  title (case-insensitive), falling back to the most recent exemplars of
  any type (flagged `usedFallback`) if none match, so drafting is never
  hard-blocked by a naming mismatch.
- **Not built**: the style brief's own text isn't attached to a StylePack
  row anywhere (no schema column for it) - it's uploaded as a Document but
  never linked. If you need this, it's a small migration (`014_...sql`)
  adding a `style_brief_document_id` or `brief_text` column to
  `drafter_stylepack_versions`.

### Start a PRA (`lib/repo/drafter-pras.ts`, `app/api/drafter/pras/**`)
- `POST /api/drafter/pras` - product/description/entity/customer types,
  pins template + stylepack (+ optional register) versions, creates the
  section skeleton immediately (`ensureSectionsForPra`).
- `GET /api/drafter/pras/[id]/candidates` - `listCandidateControls()` grouped
  reuse/adapt/new/unassessed (from the `coverage` column, unchanged from
  coder 2), with `usedIn` (product + PRA) and `agreedWording` (last approved
  wording - currently always null; nothing writes `drafter_controls.
  agreed_wording` yet, see "Known limits").
- `POST /api/drafter/pras/[id]/candidates {selectedControlIds, gaps}` -
  assigns each selected, non-unassessed control to a section
  (`assignControlsAndCreateEnhancements` -> `assignGroupToSection`) and adds
  any manual gaps as placeholder enhancements
  (`addManualGap` - `control_text` is a bracketed placeholder string,
  `is_gap: true`, no `control_ids`, never touched by the model).

### Section assignment (`lib/drafter/section-assignment.ts`)
`assignGroupToSection` matches on `backoffice_control` (case-insensitive)
first; among multiple candidate sections it prefers an exact customer-type
match, EXCEPT when the group is untagged and the PRA spans multiple
customer types, where it prefers a "both" section (ambiguous otherwise).
This is what makes a legal-person-only product route an untagged EDD
control to the legal-person EDD section (SPEC.md's worked example) - proven
in `lib/drafter/__tests__/section-assignment.test.ts` and reproduced in a
real local run (see "Local HTTP QA" below).

### Drafting pipeline (`lib/drafter/draft-enhancement.ts`, called by
`POST /api/drafter/pras/[id]/enhancements/[enhId]/draft`)
One enhancement per request, per BUILD-DECISIONS:
1. **Reuse** (`coverage = 'yes'`): no model call. Uses
   `control.agreed_wording` if set, else falls back to the control's
   `obligation_description` (nothing sets `agreed_wording` yet - see "Known
   limits"). Rationale is a bracketed placeholder (v1 does not track a
   reused rationale separately) - this shows up as a `critical` lint status
   via the `unfilled_placeholder` rule, which is intentional: it genuinely
   needs review before export.
2. **Empty draft inputs** (adapt/new with nothing in Control Review Notes/
   Uplift/Remediation): no model call, a bracketed placeholder enhancement.
3. **Adapt/new with content**: cost-cap check
   (`isUnderCostCap`) -> `buildWriterPrompt` (2-3 section-matched exemplars,
   product description, draft inputs in SPEC.md priority order) ->
   `callDrafterModel` -> fact boundary on `control_text` and `rationale`
   separately -> lint -> persist. A malformed/failed model response never
   overwrites existing content with a fake pass; it records the error on
   `review_result.error` and returns `ok: false`.
4. New-coverage (`coverage = 'no'`) enhancements get an extra `gap` open
   item ("flag for closer review"), per SPEC.md.
5. Every draft call writes `drafter_open_items` for every placeholder and
   every unsupported-term flag, and an audit row.

### Fact boundary (`lib/drafter/fact-boundary.ts`)
- Numbers/percentages/currency amounts/frequency phrases ("every N
  months", "daily" etc.) not present (case-insensitively) in the exact
  texts the model was shown are REPLACED with `[unsupported figure -
  verify]` and logged.
- Capitalised multi-word terms and acronyms not derivable from those same
  input texts are FLAGGED (kept in the text, added to open items) - never a
  hand-written blocklist, the known-terms set is derived fresh from the
  inputs every time.
- `buildWriterPrompt` (`lib/drafter/prompts.ts`) has no parameter through
  which the register's "Rationale" column could reach the model -
  structurally impossible, not just filtered - and
  `lib/drafter/__tests__/prompts.test.ts` asserts this.

### Code lint (`lib/drafter/lint.ts`)
Pure, reusable (no DB/model access) - banned phrases (with replacement),
REQ IDs/article refs outside Evidence, em/en dashes, "was"/"will" (flagged
for review, not auto-classified as violations - SPEC.md's exact allowed-case
logic needs a bit more nuance than this pass had budget for for), word count
(against the StylePack's `length_limits`), unfilled `[...]` placeholders,
carried-through formula errors. `lintStatus` -> pass/minor/critical. Runs on
draft (server) and on every manual edit (`PATCH .../enhancements/[enhId]`
re-lints immediately, per SPEC.md "Page viewer and editing").

### Basic draft page (`app/drafter/pras/[id]`,
`components/drafter/DrafterPraDraftClient.tsx`)
Candidate selection screen (if no enhancements yet) -> section-by-section
enhancement list with status badge, "Draft this enhancement"/"Draft all
remaining" (one request at a time, progress shown), inline edit + save
(re-lints), lint messages, open items tab. This is intentionally basic -
**your job is the full viewer**: review panel with judge criteria, quoted
sentence + reason + suggested rewrite, "Apply fix", source view (register
rows an enhancement was drafted from), and Word export. The data shapes
(`DrafterEnhancementRow.review_result`, `.placeholders`, `.evidence_refs`)
are kept clean for you to build on - `review_result.status` currently only
ever comes from lint; you'll add a `judge` key alongside `lint` in that same
JSON blob (`{lint: [...], judge: {...}, status}`) rather than a new column.

### Stub fixtures (`test/fixtures/drafter/writer-stub.json`)
One realistic good default response, plus 6 keyed bad-output entries
(`matchIncludes` on a marker string put in a control's Control Review
Notes): invented number/frequency + invented role/system name, banned
phrase, REQ ID inside control text, em dash, over-150-word text, malformed
JSON. `lib/drafter/__tests__/draft-enhancement.integration.test.ts` drives
all 7 through the REAL pipeline against the local DB (creates its own
template/stylepack/PRA/section/control/register rows, drafts, asserts, then
deletes everything it created in `afterAll`). Extend this same file's
`judge` key with judge-role entries when you build the judge - the loader
already supports it (`stubRawContent(role, promptVersion, ...)` is
role-generic).

### Tests
504 vitest tests pass repo-wide (up from 495 at handoff 2), incl. 9 new
integration tests that hit the local `fincrime_dev` DB directly (same DB
vitest already points at via `test/setup-env.ts`) and clean up after
themselves - follow that pattern if you add more DB-touching tests rather
than mocking the DB layer.

## Known limits / not built (budget did not stretch to it)

1. **`drafter_controls.agreed_wording` is never written.** Reuse falls back
   to `obligation_description`, which is honestly labelled in the code
   comment but is a real gap - SPEC.md's "last approved wording" shown on
   the candidates screen will always be null until something (probably: a
   user-approved exemplar-promotion action, or export) writes it back.
2. **An empty section's `backofficeControlMap` is never inferred** (there's
   no exemplar to infer it from - e.g. the fixture's EDD section 2.3,
   which the approved PRA showed as "no enhancements apply"). The template
   review screen lets a user type it in manually; if they don't, any
   control tagged with that back office control will come back
   `unassigned` from `assignControlsAndCreateEnhancements` with a clear
   reason string. Proven and worked around in the local QA run below by
   editing the section before confirming the template - make sure any demo
   script does the same.
3. **PRA status never advances past `draft`** unless a real (non-stub, paid)
   model call happens (`updatePraSpend` is the only thing that flips it to
   `drafting`, and it's only called when `costPence > 0`). Cosmetic, but
   worth a one-line fix (flip status on any successful draft call,
   regardless of cost) before you build status-dependent UI.
4. **Judge model, review panel, apply-fix, source view, Word export,
   calibration set UI** - none of this exists (SPEC.md step 5 entirely).
   The `drafter_calibration_items` table is still unused since coder 1.
5. **`"was"/"will"` tense linting is a flag-for-review, not a precise rule**
   (SPEC.md's exact allowed cases - present perfect for a delivered build
   change, "will" only for something not yet live - need more context than
   a regex has). Consider whether the judge model should own this
   distinction instead of code.
6. Client-direct Blob upload for >4MB files - still not built (unchanged
   from handoff 2; no fixture needs it yet, but a real approved PRA scanned
   from Word could exceed it).

## Local HTTP QA actually performed (this pass)

Built (`next build`), started `next start -p 3107` with `PRA_MODEL_STUB=1`,
signed up `drafter-qa@example.com`, uploaded and confirmed the approved PRA
docx, style brief, and register fixtures, extracted the skeleton (matched
the fixture exactly: 4 sections, all field labels, standard + empty
wording), created and confirmed a Template, created a StylePack, imported
and accepted the register (10 controls built after overriding the fixture's
intentional blocking issues), then **edited the EDD section's
`backofficeControlMap` in a second template version** (see "Known limits"
#2) before starting a real PRA: "Correspondent Banking - EEA Respondents",
legal-person-only. Selected all 5 reuse + 3 adapt + 1 new candidates
(excluded the 1 unassessed one), added a manual gap on section 2.3.
Verified in the response: **0 unassigned controls**, every CDD/EDD control
routed to the legal-person section (none to the natural-person 2.1 section),
correspondent-banking controls to 2.4 - the legal-person-only EDD routing
the spec calls out by name. Drafted all 9 real enhancements one call at a
time (all HTTP 200): reuse enhancements used agreed/obligation text with no
model call, the one truly-empty-inputs control got the placeholder text
with no model call, the rest hit the stub writer and came back with
`model_name: "stub"`. Confirmed 14 open items were logged (unsupported-term
flags on the stub's own `[STUB ...]` marker text - expected, since that
text isn't derivable from any input; a real model won't produce this),
placeholder items for every reused rationale, and the two gap items.
Manually edited one enhancement's control text via PATCH and confirmed it
re-linted immediately (word count warning appeared, unfilled-placeholder
critical on the still-placeholder rationale). Confirmed every new page
(`/drafter/pras`, `/drafter/pras/[id]`, `/drafter/templates`) and every new
API route 404s for an anonymous session and 200s for the allowlisted one.
Local QA data (the test account, documents, template/stylepack/PRA and all
child rows) was fully truncated afterwards in dependency order - `psql`
runs a single `-c "..."` string as one implicit transaction, so if you do
the same, order matters (see the commit history for the exact statement
order that worked, needed a `merge_group_id` nulling step first).

## Gates run

`npx tsc --noEmit`, `npx vitest run` (504 pass), `npm run build`, `npx
eslint` on every changed file - all clean.
