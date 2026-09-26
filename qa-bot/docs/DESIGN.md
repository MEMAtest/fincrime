# qabot design

## Goal

One tool you can point at any of your sites or codebases that behaves like a meticulous QA team: a
functional tester, a UX/UI reviewer, an accessibility auditor, a backend/API tester and a code
reviewer. It should need no per-project setup to be useful, and it should get sharper with a little
config (journeys, auth, test data).

## Architecture

```
            ┌────────────────────────── qabot run <url | repo> ──────────────────────────┐
            │                                                                            │
 repo ──►  detect stack ─► discover routes + API endpoints ─► install / build / start app │
            │                  (file-system routers, route handlers,   (free port, logs  │
            │                   OpenAPI, sitemap)                      captured)         │
            ▼                                                                            │
   ┌──────────────── deterministic layer (no AI, free, repeatable) ────────────────┐     │
   │ crawler + Playwright × {desktop, tablet, mobile}                              │     │
   │   console/page errors · failed requests · axe-core · layout audit ·           │     │
   │   keyboard walk · click-every-safe-control · empty-form probe · perf ·        │     │
   │   security headers/cookies · content sanity · screenshots + visual diff       │     │
   │ link checker (internal + external)                                            │     │
   │ API prober: GET / malformed JSON / empty body / wrong types · CORS · leaks    │     │
   │ server-log watcher: backend exceptions while testing                          │     │
   │ code: lint · typecheck · tests · npm audit · secret scan                      │     │
   └───────────────────────────────────────────────────────────────────────────────┘     │
            ▼                                                                            │
   ┌──────────────────── AI layer (Claude, optional) ──────────────────────────────┐     │
   │ UX review: screenshots (desktop slices + mobile slices) + page context        │     │
   │   → structured findings (schema-validated JSON)                               │     │
   │ Explorer: computer_toolset_20260801 over a Playwright page + custom tools     │     │
   │   (navigate, page_signals, page_text, report_issue, finish)                   │     │
   │ Triage: root-cause grouping, false-positive flags, fix-first list, verdict    │     │
   └───────────────────────────────────────────────────────────────────────────────┘     │
            ▼                                                                            │
   FindingSink (dedupe across pages/viewports, severity, source files) ─► score, verdict │
            ▼                                                                            │
   index.html · report.md · report.json · screenshots ─► exit code for CI               │
            └────────────────────────────────────────────────────────────────────────────┘
```

Key decisions:

- **Deterministic first, AI second.** Most bugs (JS errors, 5xx, broken links, a11y, overflow) are
  found reliably and for free by code. Claude is used where judgement is needed: design quality,
  multi-step journeys, and prioritisation. The bot is useful with no API key at all.
- **Everything maps back to code.** Routes and endpoints are discovered from the repo, so a finding on
  `/typology-iq/results` carries `app/typology-iq/results/page.tsx`, and an API crash carries its
  `route.ts`. Element selectors are also matched back to the components and stylesheets that define
  their class names (e.g. a header overflow points at `components/layout/Header.tsx`). That is what makes
  findings actionable, and what an auto-fix step needs.
- **Browser-level computer use, not OS-level.** The explorer uses Claude's computer-use toolset, but
  the "screen" is a Playwright page. That's more reliable and much safer than letting it drive your
  whole Mac: it can't open other apps, it can't leave the site under test (navigation off-origin is
  reverted), and in safe mode its POST/PUT/PATCH/DELETE requests are blocked at the network layer.
  It also gets superpowers a human tester doesn't have: `page_signals` shows it the JS exceptions and
  failed API calls behind each action.
- **Safe by default on remote targets**, aggressive on localhost.

## How a run works (repo target)

1. `detectStack`: package.json deps → framework; lockfile → package manager; Python / static fallbacks.
2. `discoverRoutes` / `discoverEndpoints`: file-system routers, exported HTTP methods, Express-style
   registrations, Flask/FastAPI decorators, OpenAPI. Dynamic routes are tested when `routes.params`
   supplies values; otherwise they're listed as untested (and given to the explorer as hints).
3. `launchApp`: install if needed, start on a free port (dev by default, `--mode prod` builds first),
   wait until it answers, capture its logs. Build/start failures become critical findings.
4. Warm-up (dev servers compile on first hit), then the browser suite crawls from the start page +
   code routes + sitemap up to `maxPages`, running every check on desktop and re-rendering each page on
   tablet and mobile.
5. Link check, API probes (code endpoints + endpoints seen in the browser's network traffic), server log
   scan.
6. AI UX review and explorer (if enabled), app shutdown, code checks, AI triage.
7. Findings are merged, scored per category and overall, and written as HTML/Markdown/JSON.

## Where it runs

| Mode | What it looks like | Status |
|---|---|---|
| **CLI on your Mac** | `qabot run ~/code/app --open`. Uses Playwright's Chromium or your installed Chrome. `--headed` to watch it work. | ✅ built |
| **CI on every PR** | GitHub Action against the Vercel preview URL (read-only) or against the app built in CI (full fuzzing). Posts `report.md` as a PR comment, uploads the HTML report, fails the check on high/critical findings. | ✅ example in `examples/github-action.yml` |
| **Scheduled monitoring** | Nightly safe-mode run against production, alert on new findings (compare `report.json` finding ids with the previous run). | config only: cron + a diff step |
| **Claude Code integration** | A `/qa` skill: run qabot, read `report.json`, fix the top findings in the codebase, re-run to verify. This closes the loop from *finding* bugs to *fixing* them. | ✅ `examples/claude-skill/qa` |
| **Desktop app / dashboard** | A small web UI (or Tauri/Electron shell) listing projects, run history, trends, and a "run now" button; the CLI stays the engine. | roadmap |
| **Hosted service** | Workers in a container pool, runs triggered by webhooks, results stored per project. | roadmap |

For your use (several codebases, mostly Next.js + Vercel), the high-value setup is **CI on every PR +
a Claude Code `/qa` skill locally**. The Mac app is nice to have, not essential: a browser tab with the
HTML report plus the CLI covers it.

## What else it should have (roadmap, roughly by value)

1. **Fix loop.** Hand `report.json` to Claude Code / the Agent SDK with the repo checked out: fix,
   re-run the failing checks, open a PR. Findings already carry source files and repro steps.
2. **Run-to-run memory.** Store finding ids per project; report *new* vs *resolved* vs *still open*,
   trend charts, and a "known issues" suppression list with expiry.
3. **Journey recorder → regression tests.** Convert the explorer's successful journeys into Playwright
   spec files committed to the repo, so every bug it finds once is tested forever, deterministically.
4. **Auth and role matrix.** Log in as several roles and verify access rules (user A can't read user
   B's workspace: IDOR checks). For fincrime this means workspace token isolation tests.
5. **Deeper backend testing.** OpenAPI contract tests, schema-aware fuzzing (valid-but-edge-case
   payloads, not just junk), idempotency/double-submit checks, rate-limit checks, DB-state assertions
   on a disposable database, simple load tests (k6) for key endpoints.
6. **More browsers and conditions.** WebKit (Safari) and Firefox, dark mode, 200%/400% zoom reflow,
   reduced motion, slow 3G + CPU throttling, offline mode, RTL / very long strings / i18n.
7. **Output verification.** fincrime generates PDFs and DOCX: download them in the journey and check
   they open, have content and match the on-screen data. Same for emails (capture via a local SMTP sink).
8. **Security DAST.** OWASP ZAP baseline scan in safe mode; auth/session checks (cookie rotation,
   logout invalidation, password reset token reuse).
9. **Visual design system checks.** Flag off-palette colours, inconsistent spacing scales and font
   sizes by comparing computed styles against the design tokens in the repo.
10. **Issue tracker integration.** Create GitHub/Linear issues for new high+ findings, de-duplicated by
    finding id; Slack/Teams/email digests.
11. **Browser toolset.** Claude's `browser_toolset_20260801` (DOM-aware navigate/find/read_page/
    form_input/read_console/read_network) is an alternative to pixel-level computer use for the
    explorer; it would cut screenshot cost and be more precise on dense forms. Worth an A/B.
12. **Native apps.** For desktop/mobile apps (not web), the same explorer loop can drive an OS-level
    computer-use sandbox (a VM with VNC) or a mobile emulator. That needs a separate executor; the rest
    of the pipeline (findings, triage, reports) is reusable.

## Costs

The deterministic layer is free. With Claude (default `claude-opus-5`, prompt caching on) a full run
with 6 UX-reviewed pages, a 40-turn explorer session and triage is roughly a few dollars (an estimate:
the explorer dominates, and it scales with `explorerSteps`). Tune with `--ux-pages`,
`--explore-steps`, `--effort`, or `--no-ai` for quick loops.

## Known limits (v0.1)

- Dynamic routes need `routes.params`; the crawler finds linked instances, but unlinked ones are skipped.
- SPA routes are found by regex heuristics (React Router / Vue Router configs), so some can be missed;
  the crawl usually covers the rest.
- Perf metrics against dev servers are pessimistic (reported as info); use `--mode prod` for real numbers.
- The empty-form probe and click tester are conservative on purpose; the explorer does the deep form work.
