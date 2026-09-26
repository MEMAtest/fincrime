# qabot: a universal QA bot

Point it at **any URL or any codebase** and it hunts for bugs across UI, UX, accessibility, responsiveness, performance, security, the backend/API and code health. Then it writes a report you can hand to a developer.

```bash
qabot run https://staging.example.com        # test a deployed site (read-only safe mode)
qabot run ~/code/my-app                      # detect the stack, start the app, test it, check the code
qabot run ~/code/my-app --url http://localhost:3000   # use a dev server you already have running
```

It works in two layers:

1. **Deterministic checks** (free, fast, repeatable): a crawler, Playwright in three viewports, axe-core, API fuzzing, the repo's own lint/typecheck/tests, dependency audit and secret scan.
2. **Claude on top** (optional, **no API key needed**):
   - a vision **UX review** of every key page (desktop + mobile screenshots)
   - an **explorer** that drives the browser like a human tester through your real user journeys and files bugs with repro steps and screenshots
   - a **triage** pass that groups findings by root cause, flags false positives, points at source files and makes a ship/fix/block call.

## Install

```bash
git clone https://github.com/MEMAtest/qabot && cd qabot
npm install
npx playwright install chromium      # once per machine
npm run build
npm link                             # puts `qabot` on your PATH
```

Requires Node 20+. On macOS it also works with your installed Google Chrome if Playwright's Chromium isn't installed.

## AI without an API key

By default (`--ai-backend auto`) qabot uses **your installed, logged-in Claude Code** (`claude` CLI) in headless mode, so the AI layer runs on your existing Claude subscription with no API key and no separate bill:

- UX review and triage run as `claude -p` calls with a JSON schema; Claude opens the screenshots with its Read tool.
- The explorer gets the browser through a small local MCP server that qabot starts (screenshot, click, click_text, fill, type, scroll, navigate, page_signals, report_issue, finish). Claude Code's own tools (Bash, file edits, web) are switched off for these runs.
- Default model is `sonnet` (fast, light on plan limits). Use `--model opus` for the deepest review, `--model haiku` for the cheapest.
- Runs count toward your plan's usage limits. The report shows an at-list-price estimate so you can see what it would have cost on the API.
- If `ANTHROPIC_API_KEY` is set in your shell, Claude Code bills that key instead of your subscription, so unset it.

In CI, run `claude setup-token` once and store the token as the `CLAUDE_CODE_OAUTH_TOKEN` secret (see `examples/github-action.yml`).

Prefer pay-per-use? `--ai-backend api` calls the Anthropic API directly (needs `ANTHROPIC_API_KEY`) and uses Claude's native computer-use toolset for the explorer. Default model there is `claude-sonnet-5`.

> Subscription use is for running qabot yourself or in your own team's CI. If qabot were ever offered as a product to other people, Anthropic's terms require API-key authentication for that.

## What it checks

| Area | Checks |
|---|---|
| **Functional** | uncaught JS exceptions, console errors (hydration, undefined access…), failed/4xx/5xx requests, pages that crash or 404, broken internal and external links, missing in-page anchors, **clicks every safe button/tab/toggle** and reports ones that throw or do nothing, empty-form submission (silent failures, accepts junk, server crashes), 404 handling |
| **UI / visual** | broken images, clipped text, controls covered by other elements, clicks intercepted by overlays, visual regression against a stored baseline (pixel diff) |
| **Responsive** | real horizontal scrolling (and which element causes it) on tablet/mobile, missing viewport meta, text < 12px on phones |
| **Accessibility** | axe-core WCAG 2.2 A/AA + best practices, **keyboard walk** (focus visible? focus lands on hidden elements?), tap-target size, zoom disabled |
| **Content** | `NaN`, `undefined`, `[object Object]`, `Invalid Date`, `{{unrendered}}` templates, lorem ipsum/TODO left in the UI |
| **Performance** | LCP, CLS, main-thread blocking, page weight, largest assets (downgraded to info against dev servers) |
| **Security** | CSP, clickjacking, HSTS, nosniff, referrer policy, version disclosure, cookie flags, mixed content, CORS reflection, error responses leaking stack traces/SQL/paths, committed secrets and `.env` files, vulnerable dependencies |
| **Backend / API** | every route handler found in code is probed: plain GET, malformed JSON, empty body, wrong types. It reports 5xx on bad input, hangs, leaks and slow endpoints, and **server logs are captured** while testing so backend exceptions get reported even when the UI swallows them |
| **Code health** | the repo's own `lint`, typecheck (or `tsc --noEmit`), `test`, `npm audit`, secret scan |
| **SEO** | titles, meta description, h1s, Open Graph, soft 404s, noindex |

Every finding is de-duplicated across pages and viewports, has a severity, a fix, repro steps where relevant, evidence screenshots, and the **source file** of the page or endpoint it came from.

## How it understands a codebase

`qabot discover <path>` shows what it detects. Supported out of the box:

- **Next.js** (App + Pages Router), **SvelteKit**, **Nuxt**, **Astro**, **Remix / React Router 7**, **Vite/CRA/Angular** SPAs (route config heuristics), **Express/Fastify/Koa/Hono/Nest**, **Django**, **Flask**, **FastAPI**, plain **static HTML**, and OpenAPI specs.
- Pages come from the file-system router, API endpoints from route handlers (with their exported methods), plus the sitemap and a live crawl.
- It picks the package manager from the lockfile, installs dependencies if needed, starts the dev server (or `--mode prod`: build + start) on a free port, warms up routes, and shuts everything down afterwards.

Anything unusual goes in `qabot.config.json` (see `qabot init`).

## Configuration

`qabot init <repo>` writes a starter `qabot.config.json`. The useful bits:

```jsonc
{
  "name": "FinCrime Control Lab",
  "start": { "command": "npm run dev -- -p $PORT", "env": { "FEATURE_X": "1" } },
  "routes": { "params": { "slug": "cash-smuggling", "id": "123" }, "exclude": ["/admin/*"] },
  "journeys": [
    "Run TypologyIQ for an EMI with cross-border payments and open a typology",
    "Start a product risk assessment and get to step 3"
  ],
  "headers": { "x-workspace-id": "${QA_WORKSPACE_ID}", "x-workspace-token": "${QA_WORKSPACE_TOKEN}" },
  "auth": { "steps": [
    { "goto": "/login" },
    { "fill": ["#email", "${QA_EMAIL}"] },
    { "fill": ["#password", "${QA_PASSWORD}"] },
    { "click": "button[type=submit]" },
    { "waitForUrl": "**/dashboard" }
  ] },
  "ignore": ["seo-open-graph", "axe:region"],
  "failOn": "high",
  "ai": { "provider": "auto", "model": "sonnet", "uxReviewPages": 6, "explorerSteps": 40 }
}
```

`${VAR}` values come from the environment, so secrets never live in the file. Extra headers are only sent to the site's own origin.

## Safety

- **Remote targets run in safe mode**: no POST/PUT/PATCH/DELETE probes, no form submissions, and the AI explorer's mutating requests are blocked at the network layer. Opt in with `--allow-mutations` (point it at staging, not production).
- **Local targets** (localhost) allow mutations by default because that's where you want the fuzzing. Use `--safe` to turn that off.
- The crawler never follows logout/delete/unsubscribe links, and the click-tester never clicks buttons labelled delete/pay/submit/sign out and similar.

## Outputs

`qabot-report/<timestamp>/`:
- `index.html`: the report (filters, screenshots per viewport, API table, code checks, explorer timeline)
- `report.md`: compact summary for a PR comment / Slack
- `report.json`: everything, machine-readable
- `screens/`, `ai/`, `explorer/`, `diffs/`: evidence

Exit code is `1` when any finding meets `--fail-on` (default `high`), so it drops straight into CI. `examples/github-action.yml` runs it on every PR against the Vercel preview and posts the Markdown summary as a comment.

## Find → fix loop with Claude Code

Copy `examples/claude-skill/qa/` to `.claude/skills/qa/` in any repo and type `/qa` in Claude Code: it runs qabot, reads `report.json` (findings carry source files, selectors, repro steps and screenshots), fixes the issues in the code and re-runs qabot to verify.

## Development

```bash
npm test            # unit tests + an end-to-end run against fixtures/buggy-site with a mock Claude API
npm run dev -- run fixtures/buggy-site --no-ai
```

`fixtures/buggy-site` is a small site with seeded bugs; the e2e test asserts qabot catches them. `test/fake-claude.mjs` stands in for the `claude` CLI (it drives qabot's MCP browser server as a real MCP client), and `test/mock-anthropic.ts` is a scripted Messages API that validates the computer-use protocol, so both AI backends are tested without spending anything.

See [docs/DESIGN.md](docs/DESIGN.md) for the architecture and roadmap.
