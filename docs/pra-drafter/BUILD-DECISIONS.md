# PRA Drafter - build decisions (owner-approved 2026-09-26)

These override or clarify `SPEC.md` (the product spec). Read both before touching code.

## Placement
- A **separate module** called **PRA Drafter**. It is NOT the existing scored PRA
  (`/assess/product-risk`, `app/api/pra/**`, `lib/pra`, `lib/pdf/pra-pdf.ts`). Do not modify
  those. The spec's entity called "PRA" is named `drafter_pra` / "PRA draft" in code and UI
  to avoid a clash.
- Routes: pages under `app/drafter/**`, APIs under `app/api/drafter/**`, library code under
  `lib/drafter/**`, components under `components/drafter/**`, tables prefixed `drafter_`.

## Private
The module is private. It must not be discoverable or usable by the public.
- Access requires a **signed-in account session with a VERIFIED email** (cookie, see `lib/auth/*`,
  `lib/repo/sessions.ts`) whose email is in the env var `PRA_DRAFTER_ALLOWED_EMAILS`
  (comma-separated, case-insensitive, trimmed). Unset/empty = nobody has access.
- The anonymous workspace token path must NEVER grant access.
- Unauthorised requests get **404** (pages via `notFound()`, APIs a 404 JSON) so the module's
  existence is not revealed. Enforce on the server for every page and every API route through
  one shared guard (`lib/drafter/access.ts`), plus a unit test that every `app/api/drafter/**`
  route file uses it.
- Not in the public nav, footer, sitemap, search index (`components/search/searchIndex.ts`),
  methodology or glossary. Pages set `robots: { index: false, follow: false }`. The AppShell
  shows a "PRA Drafter" nav entry only when `/api/auth/me` (or a small drafter endpoint)
  says the signed-in user is allowed.
- Data is shared by all allowlisted users (single-purpose tool, not multi-client, no
  per-client workspaces). Every mutation records the actor email in the drafter audit trail.
- Uploaded originals go to Vercel Blob as **private** blobs (reuse `lib/storage/blob.ts`
  patterns and the authenticated streaming approach used for evidence files). Never a public URL.
- Uploads over the Vercel request body limit: follow the existing evidence-upload cap
  pattern (commit cf2e9ab). If a register or PRA is larger, use client-direct Blob upload.

## Models
- One provider interface (`lib/drafter/llm.ts`) calling any **OpenAI-compatible** chat
  endpoint, configured per role by env:
  `PRA_WRITER_BASE_URL`, `PRA_WRITER_API_KEY`, `PRA_WRITER_MODEL`,
  `PRA_JUDGE_BASE_URL`, `PRA_JUDGE_API_KEY`, `PRA_JUDGE_MODEL`.
  Tag suggestions use the writer config.
- **No approved host is configured yet.** When a role is unconfigured, its model steps are
  disabled with a clear on-screen message; every deterministic step still works. NEVER fall
  back to Groq or any other key for client material.
- A stub provider (`PRA_MODEL_STUB=1`) returns deterministic canned JSON for tests and local
  QA. It must refuse to activate when `VERCEL_ENV === "production"`.
- Writer: low temperature (0.2), JSON output. Judge: temperature 0, JSON output.
- Log every call to `drafter_model_calls`: role, model, prompt_version, input_hash (sha256),
  output, prompt/completion tokens, cost estimate, latency, PRA id, enhancement id.
- Cost cap per PRA (setting, default configurable) enforced before each call; token spend
  shown per draft. Price per 1M tokens per role configurable in settings.
- Prompts live in code with an explicit `PROMPT_VERSION` constant per prompt.

## Runtime
- Drafting and judging run **one enhancement per request**, driven from the browser with
  progress shown, so no request approaches the function timeout. No queue.
- Every generated field stores model name + prompt version.

## Fact boundary (be honest about limits)
- Deterministic: numbers, amounts, percentages, frequencies ("daily", "every 12 months",
  "annually" ...), durations and thresholds in output must appear in the inputs; otherwise
  they are replaced with a bracketed placeholder and logged.
- Roles and system names: build a known-terms set from the inputs; any capitalised
  multi-word term or acronym in the output that is not in the known set is **flagged** as a
  possible unsupported fact (highlighted, added to open items), not silently trusted.
  Do not claim in UI or docs that code guarantees no invented roles/systems.
- Never detect fabrications with a hand-written blocklist of "bad" terms; derive the allowed
  set from the inputs.
- The register's "Rationale" column is never passed to the model.

## Skeleton extraction
Code proposes the skeleton (headings, numbers, customer type, standard wording,
empty-section wording, field labels, section->back office control map); the user reviews and
confirms/edits it on a screen before it becomes a Template version.

## Client-neutral
Default filter values (e.g. "Applicable to Revolut", "Revision Complete") are editable
settings with those as seed defaults, not hard-coded logic. Test fixtures are synthetic;
never commit real client material.

## Engineering rules for this repo (from past incidents)
- Missing or unassessed data must never render as a pass/clean state.
- Repos scope every query; mutations write an audit row.
- `react-hooks/set-state-in-effect` is enforced by `next build`.
- `"use client"` pages reading search params: make `page.tsx` a server component that awaits
  `searchParams` (Suspense+useSearchParams prerenders empty in prod).
- Pin DB dates/times in UTC; compare DATE columns with CURRENT_DATE.
- House style: no em dashes or en dashes in UI copy.
- Migrations: next number is `013_...sql`, applied with `npm run db:migrate` against the
  LOCAL `fincrime_dev` DB only. Never run anything against prod.
