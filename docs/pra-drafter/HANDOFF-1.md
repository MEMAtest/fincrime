# PRA Drafter - handoff from coder 1 to coder 2

Scope actually delivered in this pass, given the budget: the full schema
(migration 013), the private access guard + its enforcement test, and the
model provider interface with stub/cost-cap/logging. Everything else in the
brief (upload pipeline, register import wizard, controls library UI,
settings page, `app/drafter/**` pages, synthetic fixtures, and most of the
validation/parsing vitest suite) is **not built yet** - see "What's missing"
below. Treat this as a schema + guard + provider foundation, not a working
feature.

## Schema summary (`db/migrations/013_pra_drafter.sql`, applied locally)

All tables prefixed `drafter_`, no `workspace_id` (data is shared across all
allowlisted users; every mutation should write a `drafter_audit_log` row with
the actor email - the audit table exists but nothing writes to it yet).

- `drafter_documents` - every upload; `blob_url`/`blob_pathname` for Vercel
  Blob, `fallback_bytes BYTEA` for local dev with no blob token, `parsed_content
  JSONB` for the internal block structure, `content_hash`.
- `drafter_templates` / `drafter_template_versions` - skeleton from an
  approved PRA; `sections` and `field_labels` JSONB; `confirmed` flag (user
  must confirm before a version is usable).
- `drafter_stylepacks` / `drafter_stylepack_versions` - house style rules,
  banned phrases, length limits.
- `drafter_exemplars` - approved enhancements tagged by `section_type`.
- `drafter_register_imports` / `drafter_register_versions` /
  `drafter_column_mappings` / `drafter_register_rows` /
  `drafter_validation_overrides` - register import + versioning + saved
  column mapping (role + field_key per source header) + rows with
  `validation_issues JSONB` and `is_blocked`.
- `drafter_controls` / `drafter_control_tags` / `drafter_merge_groups` -
  controls library; tags have `origin` (`code` vs `suggested`), `confirmed`,
  `evidence_phrase`; merge groups keyed on backoffice control + confirmed
  risk tag.
- `drafter_settings` - single JSONB-per-key store, seeded with
  `filter_defaults`, `banned_phrases`, the three controlled tag lists
  (`controlled_tags_risk_addressed` / `_customer_type` / `_lifecycle_stage`),
  `contradiction_rules` (seeded with the Applicability-vs-BackOffice rule),
  `cost_cap_pence_per_pra`, `model_prices_per_million_tokens_pence`,
  `judge_agreement_threshold_pct`, `control_text_word_limits`.
- `drafter_pras` / `drafter_sections` / `drafter_enhancements` /
  `drafter_enhancement_edits` / `drafter_open_items` - the draft itself;
  `review_result JSONB` holds lint + judge output and a status; edits
  history is one row per manual/apply-fix edit.
- `drafter_model_calls` - every model call (role, model, prompt_version,
  input_hash, tokens, cost, latency, linked to pra/enhancement).
- `drafter_calibration_items` - hand-labelled set for judge calibration.
- `drafter_audit_log` - `{actor, action, entity_type, entity_id, details}`.

Read the seed `INSERT` block at the bottom of the migration for exact key
names/shapes in `drafter_settings` before building the settings page.

## Access guard (`lib/drafter/access.ts`)

- `requireDrafterActorApi(request)` - call first in every
  `app/api/drafter/**/route.ts` handler; returns `{ response }` (a 404 JSON)
  when not allowed, `{ actor }` otherwise. There's a vitest
  (`lib/drafter/__tests__/access.test.ts`) that walks every
  `app/api/drafter/**/route.ts` file and asserts it contains a call to
  `requireDrafterActorApi` - it currently passes vacuously because no routes
  exist yet, but it will fail the moment a route is added without the guard.
  **Keep this test in place and don't weaken it.**
- `requireDrafterActorPage()` - call in server-component pages under
  `app/drafter/**`; calls `notFound()` (Next's `notFound`) when not allowed.
- `isDrafterAllowedEmail(email)` - for the AppShell nav-entry visibility
  check and a small `/api/drafter/me`-style endpoint (not yet built).
- Gate: signed-in session cookie (`fincrime_session`, via
  `lib/auth/session-cookie.ts` + `lib/repo/sessions.ts` + `lib/repo/users.ts`)
  AND email in `PRA_DRAFTER_ALLOWED_EMAILS` (comma-separated, case-insensitive,
  trimmed). Empty/unset env = nobody has access. The anonymous
  `x-workspace-id`/`x-workspace-token` path (`lib/workspace-auth.ts`) is never
  consulted.

### Running locally as an allowlisted user
1. `.env.local` already points `DATABASE_URL` at `postgres://localhost/fincrime_dev`.
2. Add to `.env.local`: `PRA_DRAFTER_ALLOWED_EMAILS=you@example.com`
3. Create a local account through the app's existing signup flow (see
   `app/api/auth/signup` / `lib/repo/users.ts::createUser`) with that email,
   or insert directly:
   `INSERT INTO users (email, password_hash) VALUES ('you@example.com', '<bcrypt hash>')`
   (easier: sign up through the UI, it hashes for you).
4. Sign in normally; the session cookie now satisfies
   `requireDrafterActorApi`/`requireDrafterActorPage` for that email.
5. For model steps without a configured host, set `PRA_MODEL_STUB=1` in
   `.env.local` (refused automatically if `VERCEL_ENV=production`).

## Model provider update (owner decision, 2026-09-26, after this handoff was drafted)

The host is **OpenRouter**. `lib/drafter/llm.ts` was updated accordingly:
- `PRA_WRITER_API_KEY`/`PRA_JUDGE_API_KEY` still work per-role, but either
  falls back to a single shared `OPENROUTER_API_KEY` when unset.
- `PRA_WRITER_BASE_URL`/`PRA_JUDGE_BASE_URL` fall back to `OPENROUTER_BASE_URL`
  (set this to `https://openrouter.ai/api/v1` in env - deliberately not
  hardcoded as a literal default in code, so a deploy always states
  explicitly which host it talks to).
- Default models when `PRA_WRITER_MODEL`/`PRA_JUDGE_MODEL` are unset:
  writer `openai/gpt-5.6-luna`, judge `google/gemini-3.8-flash` (different
  family, per BUILD-DECISIONS).
- Every request body now includes
  `provider: { data_collection: "deny", zdr: true }` alongside
  `response_format: {type:"json_object"}` - required so OpenRouter never
  retains or trains on this app's client material. Do not remove it.
- Token usage read from the response's `usage.prompt_tokens` /
  `usage.completion_tokens` (unchanged - OpenRouter uses the same shape).
- Pricing setting renamed to `model_prices_per_million_tokens_usd_cents`
  (migration 013's seed + local DB both updated), shape
  `{ writer: {model, in, out}, judge: {model, in, out} }`, seeded with
  luna $0.20 in / $1.20 out and gemini-3.8-flash $0.75 / $3.75 per 1M
  tokens. `drafter_model_calls.cost_estimate_pence` is USD-cent-equivalent
  now, not GBP pence - the column name predates this decision and was kept
  to avoid a second migration; treat it as "smallest unit of whatever
  currency the configured prices are in."
- Set `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` in `.env.local` to
  exercise real calls locally; `PRA_MODEL_STUB=1` still works with none of
  this configured.

## Model provider (`lib/drafter/llm.ts`)

- `callDrafterModel({ role, promptVersion, systemPrompt, userPrompt,
  temperature, praId?, enhancementId? })` - one OpenAI-compatible
  `/chat/completions` call, `response_format: json_object`. Every call is
  logged to `drafter_model_calls` including refusals (role unconfigured,
  HTTP error, or stub).
- Role config from env: `PRA_WRITER_BASE_URL/_API_KEY/_MODEL`,
  `PRA_JUDGE_BASE_URL/_API_KEY/_MODEL`. Tagger reuses the writer config.
  **No fallback to any other key/host if unset - the step is disabled**, and
  `roleDisabledReason(role)` gives the on-screen message to show.
- `isStubMode()` - true only when `PRA_MODEL_STUB=1` AND
  `VERCEL_ENV !== "production"`. `isRoleConfigured(role)` is true in stub mode
  regardless of env, so you can build/test the UI without a host.
  `stubResponse()` inside `llm.ts` returns canned JSON per role - extend the
  shape there if the writer/judge JSON contract changes.
- `isUnderCostCap(praId)` - sums `drafter_model_calls.cost_estimate_pence`
  for the PRA against the `cost_cap_pence_per_pra` setting. **Call this
  before every writer/judge call** and show the cap message instead of
  calling when it returns `underCap: false`.
- `PROMPT_VERSIONS` constants - bump the relevant one whenever a prompt
  changes; it's stored per generated field/model call as required.

## What's missing (not started - budget did not stretch to it)

1. Upload pipeline (parsers for docx/md/html/xlsx, doc-type detection,
   blob storage with the bytea fallback, sha256 hashing).
2. Register import wizard UI + validation engine (all checks in the SPEC
   table), contradiction-rule evaluation, override flow.
3. Controls library build-out: tag suggestion calls, merge-proposal logic,
   reuse/adapt/new/unassessed grouping.
4. Settings page UI (the settings rows exist in the DB; no UI reads/writes
   them yet).
5. All `app/drafter/**` pages (home, documents, register import, library,
   settings) and `app/api/drafter/**` routes - **none exist yet**, so the
   access-guard test currently has nothing to check against.
6. Synthetic xlsx/md/html fixtures under `test/fixtures/drafter/`.
7. The bulk of the vitest suite (parsers, header detection, formula errors,
   every validation check, contradiction rules, tag controlled-list
   enforcement, merge proposals, grouping) - only the access guard and the
   LLM stub/cap logic are tested so far (12 tests total).

## Reusable idioms worth copying (from the existing evidence-upload feature)

- `lib/storage/blob.ts` - `isBlobConfigured()` / `uploadEvidenceFile()` /
  streaming download pattern; mirror this for `drafter_documents`, adding the
  `fallback_bytes BYTEA` path when the token is absent locally (this decision
  is left to you/coder 3 - the column exists, nothing writes to it yet).
- `lib/repo/*` - one file per entity, every query explicit, no ORM; copy this
  structure for `lib/repo/drafter-*.ts`.
- `scripts/db-migrate.mjs` - numbered, transactional, idempotent (`IF NOT
  EXISTS`) migrations; next one is `014_...sql`.
