# PRA Drafter - handoff from coder 2 to coder 3

Scope delivered in this pass: the stub-file upgrade, the full upload
pipeline (all 4 formats), the register import wizard, the validation
engine, the controls library (tags, merges, grouping), the settings page,
every `app/drafter/**` page and its `app/api/drafter/**` routes, synthetic
fixtures, and a vitest suite. This covers everything up to and including
"Load the register" (SPEC.md steps 1-2 plus the library) - "Start a PRA"
(steps 3-5: product setup, drafting, review, export) is **not built**, by
design (see BUILD-DECISIONS.md's owner sign-off on this split).

## What exists

### Stub upgrade (`lib/drafter/llm.ts`)
- `PRA_MODEL_STUB_FILE=/path/to/fixture.json` (only used when
  `PRA_MODEL_STUB=1`): a JSON file shaped
  `{ "<role>": { "<promptVersion>": { "default": {response|malformed},
  "entries": [{matchIncludes: string[], response|malformed}] } } }`.
  Matching scans `entries` for the first whose every `matchIncludes`
  substring is present in the userPrompt; falls back to `default`, then to
  the built-in canned response if nothing is configured. `malformed: true`
  returns deliberately-broken JSON text; `callDrafterModel` retries once,
  then returns `{ok:false, error}` and logs the failure - it never falls
  back to a "pass" response. Use this to push good/bad writer or judge
  output (invented numbers, banned phrases, REQ IDs in the control text,
  out-of-list tags, malformed JSON) through the real drafting/review
  pipeline once it exists, keyed by whatever text will appear in that
  enhancement's prompt (e.g. a REQ ID or product name).
- Everything else in `lib/drafter/llm.ts` (OpenRouter provider, cost cap,
  role-disabled messaging, model call logging) is unchanged from coder 1's
  handoff.

### Upload pipeline
- `lib/drafter/blocks.ts` - the internal block structure (heading/paragraph/
  list/table with source position) and `detectFormulaError`.
- `lib/drafter/parsers/{markdown,html,docx,xlsx}.ts` - one parser per format.
  docx goes through mammoth -> HTML -> the HTML block walker (mammoth's
  default conversion already reflects only accepted tracked changes).
  xlsx uses `exceljs` (SPEC.md allowed exceljs OR the SheetJS cdn tarball;
  exceljs was chosen - it is a plain npm dependency, no npm `xlsx` package
  involved). `detectHeaderRowIndex` scores the first `scanRows` rows by
  non-empty-cell count and takes the FIRST row reaching the max score (a
  title row above the header has fewer cells; a data row below it doesn't
  exceed the header's cell count) - not assumed to be row 1.
- `lib/drafter/doc-type-detect.ts` - suggests pra/register/policy/
  style_brief from format + content, and flags `registerRejected` for a
  markdown/html "summary" (an explicit "register summary" phrase or a
  `[cite: N]` artifact). Deliberately does NOT flag on REQ IDs alone - a
  real approved PRA legitimately cites REQ IDs in its Evidence field, and an
  earlier version of this detector wrongly flagged `approved-pra.docx` as a
  rejected register for exactly that reason (caught during the local HTTP
  QA run below, fixed before this handoff).
- `lib/storage/blob.ts` - `uploadDrafterDocument` / `getDrafterDocumentStream`,
  mirroring the evidence-upload private-blob pattern under a
  `drafter-documents/` prefix.
- `lib/repo/drafter-documents.ts` - CRUD + `sha256Hex`.
- `app/api/drafter/documents/route.ts` (POST upload, multipart, 4MB cap -
  same rationale as commit cf2e9ab; GET list) and `[id]/route.ts` (GET,
  PATCH to confirm doc type). Confirming `docType: "register"` on a
  non-.xlsx upload is a 400, enforced in code, not left to the user.
  **Not built**: client-direct Blob upload for files over 4MB (SPEC.md
  allows this for an oversized register/PRA) - every fixture here is well
  under the cap so this was never exercised end to end.

### Register import wizard + validation engine
- `lib/drafter/register-schema.ts` - the canonical column/role table from
  SPEC.md ("Register import"), `proposeColumnMapping` (header-name match,
  case/whitespace-insensitive, unmatched headers get role `unused` + a
  slugified field_key), `EXPECTED_HEADERS` for the missing-column check.
- `lib/drafter/validation.ts` - every check in SPEC.md's import-validation
  table: expected column missing (blocking iff the column has a role other
  than `unused`), formula error (blocking for `filter` columns, warning
  otherwise - note this applies to ANY mapped column including `unused`
  ones, e.g. "Current Owner", matching SPEC's own worked example), placeholder
  tag value, contradiction (from `drafter_settings.contradiction_rules`,
  never auto-resolved), duplicate REQ ID (blocking on every row that shares
  the ID), empty draft input, translation == original (info).
- `app/api/drafter/register/route.ts` (GET list, POST: sheet-picker when
  `sheetName` omitted, otherwise imports + auto-maps + validates + creates
  version 1), `[importId]/route.ts` (GET full detail), `[importId]/mapping/
  route.ts` (PUT: saves an edited mapping and recomputes a NEW version from
  the row data already stored keyed by SOURCE HEADER - no re-parse of the
  original bytes needed), `[importId]/versions/route.ts` (GET list, POST
  accept - 409s naming every still-blocked row id if any row is unresolved;
  on success calls `buildControlsFromRegisterVersion`).
- `app/api/drafter/register-rows/[rowId]/override/route.ts` - logs a
  resolve/override with actor + (required for override) a reason; a row's
  `is_blocked` clears only once every blocking check on it has a logged
  resolution.

### Controls library
- `lib/drafter/tagging.ts` - `coverageGroup` (yes/partial/no/blank->
  reuse/adapt/new/unassessed), `buildCodeTags`, `enforceControlledTags`
  (rejects any suggested value not in the controlled list AND anything with
  no evidence phrase - code-enforced, the model cannot invent a tag),
  `proposeMergeGroups` (shared backoffice control + shared CONFIRMED
  risk_addressed tag only).
- `lib/repo/drafter-controls.ts` - builds one control per accepted,
  non-blocked row (v1 is 1:1 with a row; merging happens afterwards via
  `drafter_merge_groups`, never at build time); tag confirm/reject; merge
  group upsert/list/decide.
- `app/api/drafter/library/controls/route.ts` (GET, with tags + group),
  `controls/[id]/tags/suggest/route.ts` (POST - calls the writer/tagger
  role, enforces the controlled list, stores only accepted suggestions as
  unconfirmed), `tags/[tagId]/route.ts` (POST confirm/reject),
  `merge-groups/route.ts` (GET - recomputes candidates from confirmed tags
  each call) and `merge-groups/[groupId]/route.ts` (POST confirm/split/
  reject).

### Settings
- `lib/repo/drafter-settings.ts` + `app/api/drafter/settings/route.ts` (GET
  all, PUT one key at a time). The settings page reads/writes the seed keys
  from migration 013 (controlled lists, filter defaults, contradiction
  rules - read-only in the UI since the app must never resolve one itself,
  cost cap, model prices, judge threshold).

### Pages (`app/drafter/**`)
Home, Documents, Register (list + `[importId]` detail with mapping editor/
validation table/override buttons/accept), Library (grouped, filterable,
tag confirm/reject, merge confirm/split/reject), Settings. Every page is a
server component calling `requireDrafterActorPage()` first, `robots:
{index:false, follow:false}`, and renders a client component that talks to
the API with `credentials: "include"`. `components/layout/AppShell.tsx`
shows a "PRA Drafter" nav entry only when `GET /api/drafter/me` succeeds
(404 otherwise, so the nav check never itself reveals the module).
`components/layout/ToolFrame.tsx` has a `/drafter` breadcrumb entry.

Home's "Standard" status card is honest about what is NOT built: it reports
whether a confirmed PRA doc and a confirmed style brief have been uploaded,
but says explicitly that skeleton extraction is a later phase - it never
renders a fake "ready" state. The "PRA drafts" section is an empty
placeholder with a note that starting a PRA is not built yet, per the brief.

### Fixtures (`test/fixtures/drafter/`, generator `scripts/generate-drafter-fixtures.mjs`)
- `register.xlsx` - header row is row 3 (not row 1), 24 of 29 canonical
  headers present (5 missing, one evidence-role blocking, one
  reference_only-role blocking, three unused-role warnings), `#REF!` in
  "Complete for PRA + Procedures?" (blocking) and "Current Owner" (warning)
  on every one of 10 rows, an Applicability/BackOffice-Reconciliation
  contradiction on REQ-0002, "N/A" Fincrime Product on REQ-0004, a
  duplicate REQ-0007, empty draft input on REQ-0003, translation==original
  on REQ-0007, a realistic CDD/EDD/correspondent-banking spread across Yes/
  Partial/No/blank coverage.
- `register-summary-bad.md` - contains `[cite: 6]`; confirmed rejected.
- `approved-pra.docx` / `approved-pra.md` - numbered sections (2.1-2.4),
  standard wording, one empty-section ("2.3 ... no control enhancements
  apply"), the 4 field labels (Control enhancement / rationale / Backoffice
  control impacted / Evidence of delivery) per enhancement, real Word
  heading styles in the .docx.
- `style-brief.md`.

All synthetic - no real client data anywhere in these files.

### Tests
435 vitest tests pass repo-wide (up from 12 at handoff). New coverage:
all 4 parsers, header-row detection (a real bug was caught and fixed:
the original tie-break picked a data row over the header row), doc-type
detection incl. register-summary rejection, every validation check +
severity, contradiction rules, duplicate REQ ID, controlled-tag enforcement,
merge-group rules, coverage grouping, `PRA_MODEL_STUB_FILE` loading incl.
the malformed-JSON visible-failure path, and the existing route-guard test
(now checks 12 real route files, all pass).

## Running locally as an allowlisted user

1. `.env.local` already has `PRA_DRAFTER_ALLOWED_EMAILS=drafter-qa@example.com`
   and `PRA_MODEL_STUB=1` added in this pass - reuse or change the email.
2. Sign up through the UI (`/start` -> create account) or `POST
   /api/auth/signup {email, password}` with that email - it sets the session
   cookie directly.
3. `GET /api/drafter/me` with that cookie returns 200; every `/drafter/**`
   page and `/api/drafter/**` route now works for that session.
4. With `PRA_MODEL_STUB=1` (and no `OPENROUTER_*` keys), the tag-suggest
   endpoint works but returns no suggestions unless you also set
   `PRA_MODEL_STUB_FILE` to a fixture (see `lib/drafter/__tests__/llm.test.ts`
   for the exact shape).

## Local HTTP QA actually performed (this pass)

Built (`next build`), started `npx next start -p 3107`, signed up
`drafter-qa@example.com`, uploaded all 5 fixtures, confirmed each type
(and confirmed the register-summary-as-register PATCH is rejected with a
400), imported `register.xlsx` (sheet-picker returned 1 sheet, header row
detected at row 3, 10 rows parsed), verified every expected validation
check fired at the expected severity, confirmed accepting the version 409s
while any row is still blocked (naming the blocked row ids), resolved/
overrode every blocking issue (contradiction, duplicate REQ ID x2, formula
error x10) with a required reason, accepted the version (10 controls
built), verified reuse/adapt/new/unassessed grouping matched the coverage
column exactly, manually confirmed a risk tag on two Customer-Due-Diligence
controls and verified a merge candidate appeared and could be confirmed,
and hit all 5 pages plus the register detail page as the signed-in session
(200) and as anonymous (404). Found and fixed one real bug in this pass
(see doc-type-detect note above) directly from this run, not from unit
tests alone. Local QA data (the test account and drafter rows) was
truncated afterwards; the env additions in `.env.local` were left in place
for the next coder's convenience.

## Known limits / not built

1. Client-direct Blob upload for files over ~4MB (documents route 400s
   instead) - not exercised, no fixture needs it.
2. Tag-suggest calls the writer/tagger role for real - with only
   `PRA_MODEL_STUB=1` and no stub file it returns an empty suggestion list
   every time (correct behaviour, just nothing to demo without a fixture
   file).
3. Everything from "Start a PRA" onward (SPEC.md steps 3-5: product setup,
   candidate control selection, template/style-pack skeleton extraction and
   confirmation UI, drafting, judge review, page viewer, .docx export) is
   untouched - the schema, access guard and provider interface for it exist
   from coder 1, and this pass's fixtures (the approved-pra docx/md pair)
   are specifically shaped for the skeleton-extraction step.
4. The register-detail UI shows a resolved/overridden blocking issue with
   the same "resolve/override" buttons still visible after it's cleared
   (the row's `is_blocked` badge does update correctly) - cosmetic, not
   functional.
5. Judge calibration (SPEC.md's 20-30 hand-labelled set) has no UI yet -
   `drafter_calibration_items` exists unused, same as at handoff 1.
