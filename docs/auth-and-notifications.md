# Auth and notifications: what is actually shipped

Rewritten after the security-review remediation pass that shipped optional
accounts, member management, password reset, email verification, digest
rotation, and actor-attributed auditing. The previous version of this
document opened with "there is no login, no user table, no session" and
argued against building the thing that now exists - that was accurate when
written (end of Phase 7) and is not accurate any more. This file is now a
description of what is actually running, not a proposal. See
[auth-and-notifications-backlog.md](./auth-and-notifications-backlog.md) for
what is deliberately still not built.

## The model: anonymous workspaces, with optional accounts layered on top

The workspace is still the tenant boundary, and the anonymous path is
UNCHANGED and still the default: a `workspaces` row is a random UUID plus a
sha256-hashed 32-byte token; the browser holds `{id, token}` in localStorage
and sends `x-workspace-id` / `x-workspace-token` headers on every API call
(`lib/workspace-client.ts`, `lib/workspace-auth.ts`'s `getAuthenticatedWorkspace`).
Every free tool (TypologyIQ, PartnerControlMap, ScreeningDesigner, the KYC
matrix, and the rest) still works with zero friction and no account - a
workspace is still minted lazily, the first time someone saves something,
and nothing in this phase changed that funnel.

What is new is a **parallel identity layer**: a `users` table (email +
scrypt password hash), a `sessions` table (httpOnly cookie, sha256-hashed
bearer token, sliding 30-day expiry), and `workspace_members(workspace_id,
user_id, role)` joining the two (migration `010_accounts.sql`). A signed-in
user reaches a workspace they are a member of via the session cookie plus
`x-workspace-id` (no token header) - `lib/workspace-auth.ts`'s
`resolveWorkspaceAuth()` tries the header-token path first (byte-for-byte
identical to the pre-accounts behaviour) and falls back to session +
membership. `withWorkspace()` wraps every route handler in this and passes
the resolved actor (a real email, or the literal string `"workspace"` for
the anonymous path) through as a fourth handler argument.

`workspace_people` (named individuals used for approvals) is untouched and
NOT linked to `users` - that remains a real gap (see the backlog).

## Claiming a workspace, and the email-confirmation gate

A user can "claim" an anonymous workspace they hold the token for
(`POST /api/auth/claim-workspace`, and automatically at signup if the
browser's current anonymous workspace's headers verify -
`lib/auth/claim-flow.ts`'s `attemptClaimWorkspace`, shared by both call
sites so neither can bypass the other's protection). Three outcomes:

1. **The workspace already has an owner** (this user or a different one) -
   delegates to `claimWorkspace` (`lib/repo/users.ts`), which is idempotent
   for the same user and refuses (409) for a different one. Claiming is
   one-shot per workspace; this refusal is unconditional regardless of
   `owner_email`.
2. **No owner yet, `owner_email` not set** - claims immediately (first
   claimant becomes owner). There is nobody to confirm with, so this stays
   the original zero-friction behaviour.
3. **No owner yet, `owner_email` IS set** (e.g. backfilled by a PDF export's
   lead capture) - claiming is DEFERRED behind a single-use, 24-hour
   confirmation link emailed to `owner_email`
   (`GET /api/auth/claim-workspace/confirm?token=...`). The requesting
   route returns 202 `{pending: true}` rather than granting access. This is
   the direct fix for "a leaked/stolen token becomes permanent third-party
   access": possessing the raw token is no longer sufficient on its own to
   claim a workspace someone has already associated with a real inbox -
   the attacker would also need access to that inbox.

Confirmation tokens (and password-reset and email-verification tokens) live
in one shared table, `auth_tokens` (migration `012_auth_tokens.sql`):
32 random bytes, only the sha256 hash stored, single-use (consumed
atomically by the same `UPDATE ... WHERE used_at IS NULL AND expires_at >
now() RETURNING ...` that checks validity - no separate select-then-update
race), and never distinguish "unknown token" from "used" from "expired" in
any response.

## Un-claiming: member list and removal

`GET /api/workspace/members` and owner-only `DELETE
/api/workspace/members/[userId]` (surfaced on `/account` under a workspace's
"Members" panel) let an owner see and remove anyone with session access to
a workspace. Removal deletes the `workspace_members` row; the very next
request that user makes against that workspace fails the ordinary
`getMembership` lookup and 401s, exactly like an unknown header token would
- there is no separate revocation list to maintain. The endpoint refuses to
remove a workspace's only owner (would orphan it with nobody able to
administer it - there is no invite flow yet to add a replacement).

Every `workspace.claimed` audit row is now visible where it matters: the
workspace's Recent Activity list (`app/workspace/page.tsx`) renders the
`actor` on every row (previously it did not render actor at all), with a
`workspace.claimed` event specifically called out, so a claim by someone
other than the expected owner is visible to anyone who looks, not only
discoverable by querying `audit_log` directly.

## Password reset and email verification

`POST /api/auth/password-reset/request` (body `{email}`) always returns the
same response regardless of whether the email has an account - a
password-reset request is not the caller asserting an email is theirs the
way a signup submission is, so this one holds the enumeration-resistance
line signup's own 409 deliberately does not (see the signup route's doc
comment for that trade-off, argued honestly rather than justified by the
now-corrected claim that login already reveals existence - it does not; the
review measured flat timing). `POST /api/auth/password-reset/confirm` (body
`{token, password}`) consumes the token, sets the new password, and revokes
**every** existing session for the account - a password reset is the
scenario most likely to mean an old session should not survive it.

Signup also fires a best-effort, non-blocking email-verification link
(`GET /api/auth/verify-email?token=...` writes `users.email_verified_at`).
It gates nothing today - the account is fully usable immediately, session
minted on signup regardless. It exists so `email_verified_at` is not a
column nothing ever writes.

## Actor attribution: threaded through every mutating route

Every route family that used to hardcode `ACTOR = "workspace"` for every
mutation (`pra`, `control-changes`, `control-tests`, `incidents`,
`readiness`, `reg-requests`, `workspace`, `evidence`) now accepts the actor
`withWorkspace` resolves and threads it into every `audit_log` write. A
session-authenticated approval, decision, or control-test completion is now
audited under the real signed-in user's email; the anonymous header-token
path is unchanged and still audited as `"workspace"`. Each family's
`ACTOR` constant remains exported (still the correct value for the
anonymous path in any code that has not been threaded), but no route
handler reads it directly any more - each destructures the `actor` argument
`withWorkspace` supplies.

## Session security details worth stating plainly

- **Cookie `Secure`**: `lib/auth/session-cookie.ts`'s `isHttps()` checks
  `NODE_ENV === "production"` FIRST (authoritative when true) before
  falling back to the request's own protocol / `x-forwarded-proto` header.
  A client-supplied `x-forwarded-proto: http` can no longer strip `Secure`
  in production - the previous version trusted that header outright.
- **Sliding session expiry**: every successful `verifySession` call now
  extends `expires_at` another 30 days from "now" AND stamps
  `last_seen_at` - previously `last_seen_at` was written but never read
  back by anything, which made it dead data; now it is load-bearing.
- **Login revokes the browser's prior session**: `POST /api/auth/login`
  reads whatever session cookie the request already carried and revokes it
  server-side before minting the new one - a shared machine where B signs
  in after A (without A explicitly signing out) no longer leaves A's
  session live for the rest of its 30-day window.
- **Two independent rate-limit buckets on login**: per-IP (`LOGIN_LIMIT`,
  the classic credential-stuffing target) and per normalised email
  (`LOGIN_EMAIL_LIMIT`, catching distributed credential stuffing against
  one known/breached email spread across many source IPs to duck the IP
  bucket). Signup keeps its own separate per-IP bucket.
- **`POST /api/notifications/test`** is now rate-limited keyed on the
  calling user's id (not IP) - it runs a full portfolio aggregation plus an
  SES send per call, so it was a shared-SES-quota abuse vector with no
  limit at all before this.
- **`GET /api/notifications/captured`** (the local smoke-test capture seam)
  now also refuses whenever `VERCEL_ENV === "production"`, independent of
  the `NOTIFICATIONS_CAPTURE` env var check - `NODE_ENV` was deliberately
  NOT used for this second gate, because `next start` forces
  `NODE_ENV=production` for an ordinary local smoke run too, which would
  have 404'd this route during the documented local testing setup; only an
  actual Vercel production deployment sets `VERCEL_ENV=production`.

## Governance pack export: session-mode fixed

`app/api/export/pdf/route.ts` (every module, not just the governance pack)
now resolves the requesting workspace via `resolveWorkspaceAuth`, not the
header-only `getAuthenticatedWorkspace` it used exclusively before. Two
distinct bugs this fixes together: a signed-in user exporting via session
(no anonymous token header at all) previously got a bare 401; and if that
same browser also still held a stale, unclaimed anonymous workspace
credential in localStorage from before signing in, the export would
silently return THAT unrelated workspace's governance pack instead of the
session's own, with no error - `orgInfo` (organisation name, date format)
was equally mis-sourced for every other module for the same reason.
`components/shared/LeadCaptureModal.tsx` now sends only `x-workspace-id`
(relying on the session cookie) when in session mode, and only falls back
to the anonymous localStorage credential otherwise - it never sends both.

## Notification digests

Unchanged in shape from the prior design (digest vs immediate, the
noise-risk mitigations, the event set) except for one correctness fix: the
cron endpoint (`POST /api/notifications/run`, `.github/workflows/notifications.yml`)
caps how many workspaces one invocation processes
(`NOTIFICATIONS_MAX_WORKSPACES_PER_RUN`, default 500). The workspace query
(`lib/repo/notifications.ts`'s `listWorkspaceMembersWithEmail`) used to
order by `workspace_id ASC` - a fixed, deterministic order under which
whichever workspace sorted last alphabetically by UUID would NEVER be
reached by ANY run, permanently. It now orders by each workspace's own last
SUCCESSFUL send timestamp, oldest/never-sent first (`NULLS FIRST`): once a
workspace's digest succeeds, its timestamp advances to "now", pushing it to
the back of the next run's queue - the cap now rotates which workspaces are
deferred instead of permanently starving one tail. The route also declares
an explicit `maxDuration` so a long run fails loudly (a logged timeout)
rather than being silently cut off mid-loop by a platform default.

## Verified end to end

Exercised concretely by nine `scripts/smoke-*.mjs` suites (`smoke-auth.mjs`,
`smoke-notifications.mjs`, `smoke-settings.mjs`, `smoke-governance.mjs`,
`smoke-reg-response.mjs`, `smoke-readiness.mjs`, `smoke-incident.mjs`,
`smoke-control-test.mjs`, `smoke-control-change.mjs`), not merely a claim
about the codebase's general discipline: `smoke-auth.mjs` alone proves
signup/login/logout, session revocation (server-side, not just the
cookie), expired-session rejection, no-enumeration on both login and
password reset, three independent rate-limit buckets, the full claim flow
including cross-account isolation, member listing/removal, password reset
end to end (including session revocation), the shared-machine
prior-session-revocation behaviour, and actor threading into `audit_log`
across two different route families. `smoke-notifications.mjs` proves the
digest noise-risk mitigations, category/frequency preferences, unsubscribe,
`/api/notifications/test`'s rate limit, and (as an opt-in extra run with
`NOTIFICATIONS_MAX_WORKSPACES_PER_RUN=1`) the run-cap rotation. Each of the
seven module suites creates a second workspace and asserts its token is
refused against the first workspace's records. `smoke-governance.mjs`
specifically proves session-mode governance-pack export.

See [auth-and-notifications-backlog.md](./auth-and-notifications-backlog.md)
for what remains.
