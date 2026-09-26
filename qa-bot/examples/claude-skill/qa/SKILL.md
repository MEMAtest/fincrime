---
name: qa
description: Run the qabot QA sweep on this repo (UI, UX, accessibility, API, code health), then fix the findings and re-verify. Use when asked to QA, test the app end to end, or "find and fix bugs".
---

# QA sweep with qabot

Copy this folder to `.claude/skills/qa/` in any repo. It expects qabot to be installed (clone MEMAtest/qabot, `npm install && npm run build && npm link`), so `qabot` is on PATH.

## 1. Run it

```bash
qabot run . --out qabot-report/latest --fail-on none $ARGUMENTS
```

- Add `--url http://localhost:3000` if the dev server is already running.
- Add `--no-ai` for a fast deterministic pass. With AI on, qabot uses your logged-in Claude Code, so no API key is needed.
- Journeys, auth and dynamic-route params live in `qabot.config.json` (`qabot init .` creates one).

## 2. Read the results

Read `qabot-report/latest/report.json`. Work from `ai.topPriorities` if present, else from `findings` sorted by severity. Each finding has `files` (source file of the page/endpoint), `occurrences` (URLs, viewports, selectors), `steps`, and screenshots under `qabot-report/latest/`. Look at the screenshots for visual/UX findings before changing any styles.

Skip findings with `aiNote` starting "Likely false positive" unless the user asks otherwise, and ignore `info` severity.

## 3. Fix

For each critical/high finding, then medium:
- Reproduce it from the evidence (read the source file, open the screenshot).
- Fix the root cause in the code. Group findings that share one (e.g. one layout component causing the same a11y issue on 20 pages).
- Don't silence checks to make the report green. If a finding is intentional, add its rule id to `ignore` in `qabot.config.json` with a comment in your summary explaining why.

## 4. Verify

Re-run qabot with the same arguments and compare finding ids: report which were fixed, which remain, and anything new. Run the repo's own tests/lint. Summarise for the user with the report path.
