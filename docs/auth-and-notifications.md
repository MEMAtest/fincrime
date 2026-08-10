# Real authentication and notifications: what they would take

Written at the end of Phase 7. Settings and file-backed evidence shipped this
phase. Auth and notifications did not, deliberately - this document is why,
and what each would actually cost if the owner decides to go ahead. It is a
decision document, not a pitch for either direction.

## Where the product stands today

The whole app is built on one idea: a workspace is anonymous. There is no
login, no user table, no session. A `workspaces` row is a random UUID plus a
sha256-hashed 32-byte token; the browser holds `{id, token}` in
localStorage and sends it as `x-workspace-id` / `x-workspace-token` headers
on every API call (`lib/workspace-auth.ts`, `components/workspace/
WorkspaceProvider.tsx`). "Reviewers" and "approvers" are just named rows in
`workspace_people` (name, role, optional email) with no credentials attached
to them at all - a decision records `decided_by_person_id`, but nothing ever
authenticates that the person clicking "Approve" in the browser is the named
approver rather than anyone else who happens to hold the workspace token.

This is not an oversight. It is the actual product shape: the free tools
(TypologyIQ, PartnerControlMap, the KYC matrix, and the rest) work with zero
friction for an anonymous visitor, and a workspace is minted lazily, the
first time someone saves something. That zero-friction path is the entire
top of the lead-generation funnel - `LeadCaptureModal`, the PDF-export email
gate, the opportunistic `owner_email` backfill in `app/api/export/pdf/
route.ts` all exist because the product's growth model depends on nobody
having to sign up before they get value.

## What real authentication would require

**A parallel identity layer, not a replacement of the workspace model.**
The workspace stays the tenant boundary (it already is one, and every
`lib/repo/*` query is scoped by `workspace_id` - that does not change). What
would be added is a `users` table (email, password hash or OAuth identity,
created_at) and a join between users and workspaces, most naturally
`workspace_members(workspace_id, user_id, role)`. `workspace_people` would
not disappear: it is not the same concept. A "person" today can be someone
with no email at all, entered purely so their name appears as an owner or
approver in a report - that is a legitimate use that has nothing to do with
who can log in. The realistic shape is `workspace_people.user_id` (nullable,
`ON DELETE SET NULL`) linking a person record to a real user WHEN one
exists, so a decision's `decided_by_person_id` can eventually be checked
against "is this person's linked user the one making this request" instead
of trusting whatever name the browser happened to send. That check does not
exist today, and every mutation currently just takes an actor string
(`ACTOR = "workspace"` throughout `lib/*/helpers.ts`) - it is a placeholder
for "someone with this workspace's token acted," not "this named person
acted." Wiring that check through every route that currently accepts an
arbitrary `personId` from the request body is a large share of the actual
work.

**Migration path for existing workspaces.** Every workspace already in the
database was created with the anonymous flow: it has no owner, and its
`owner_email` is either null or an opportunistically-backfilled address from
a PDF export (best-effort, never verified). The realistic path is: the
localStorage token remains valid indefinitely as a fallback identity (so
nothing already using the product breaks), and a workspace additionally gets
a "claim" flow - the holder of the token verifies an email (magic link,
matching the pattern SES already sends elsewhere) and that email becomes the
workspace's owner-user. Anyone else with the raw token could otherwise claim
someone else's workspace, so claiming has to be one-shot and probably
require the token holder to already have `owner_email` set and click a link
sent to that address, not an open self-service form.

**The free tools and the funnel.** This is the strongest argument for
keeping auth strictly optional rather than required. TypologyIQ,
PartnerControlMap, ScreeningDesigner, ControlsMaturity, the KYC matrix - none
of them need a workspace at all today, and none of them should start
needing an account. If auth is added, it must be layered onto the
already-existing workspace/PDF-export flow (add a login option at the point
someone chooses to save formal work), never inserted in front of the free
tools. Get this wrong and the funnel that currently exists (try a tool free,
get value, THEN optionally save it, THEN optionally give an email for the
PDF) collapses into "sign up to try the tool," which is a materially
different, worse-converting product. Any auth implementation has to be
reviewed against that funnel explicitly, tool by tool, not assumed safe.

**Session handling.** Next.js gives two realistic options: a signed httpOnly
session cookie issued after login (simplest, works with the existing
App Router API routes with minimal new infrastructure), or a third-party
auth provider (NextAuth/Auth.js, Clerk, Supabase Auth) that also gives OAuth
"sign in with Google" for free. Given SES is already configured and working
for magic-link-style flows would be the cheapest email-verification path,
a homegrown cookie session plus SES magic links is probably the smallest
total build, at the cost of building password reset / session invalidation
/ "log out everywhere" by hand rather than getting them from a library.
Either way, `withWorkspace()` in `lib/workspace-auth.ts` needs a sibling
(not a replacement - the anonymous path stays) that also accepts a
session cookie and resolves it to a user, then to that user's permitted
workspace(s).

**Roughly how much work.** Ballpark, assuming the httpOnly-cookie-plus-SES
path and NOT counting UI polish: a `users` table and migration (small); a
signup/login/magic-link API surface (medium - this is genuinely new
plumbing, not a wrapper around something already in the codebase); session
middleware alongside `withWorkspace` (small-medium); the workspace-claim flow
described above (small-medium, mostly about getting the one-shot security
property right); linking `workspace_people` to `users` and deciding, route
by route, whether "who can approve" now checks identity rather than trusting
the request body (medium-large - this touches every module: PRA decisions,
control-test completion, incident closure, readiness approval, reg-response
approval, each of which currently lets the client assert `decidedByPersonId`
freely). Call it multiple weeks of focused work for a defensible v1, not
counting anything on top like SSO, MFA, or granular per-route RBAC beyond
"is this person a member of this workspace."

**The argument against building it now.** The product's differentiator
today is that a compliance analyst can go from "curious" to "have a real
committee pack" in minutes, with nothing to sign up for. Every additional
account-creation step measurably loses people at that stage of a funnel;
that is not a hypothesis specific to this app, it is close to universal for
self-serve tools. Auth also does not, on its own, fix anything currently
broken - the workspace-token model already gives real tenant isolation
(every query is workspace-scoped; a foreign workspace's id is already
rejected everywhere per this codebase's own defect-class discipline). What
auth would add is: knowing WHO within a workspace did something (today it's
"the workspace," not "Sarah"), and the ability to restrict who can approve
vs merely draft. Those are real gaps for a firm with more than one person
using the tool seriously, but they are a should-have for a specific,
identifiable customer need (multi-person firms with segregation-of-duties
requirements), not a should-have for the product as a whole. The honest
recommendation is: build it when a specific customer's procurement or audit
requirement demands named-user accountability, not speculatively ahead of
that.

## What notifications would require, once identity exists

Notifications are meaningless without a real identity to notify - "email
the workspace" already sort of exists (the opportunistic `owner_email`,
the PDF-export delivery email) but that is delivery of an artefact the
person explicitly asked for, not a notification about something that
happened. A genuine notification system needs to know WHO to tell, which is
exactly the gap auth fills.

**Digest vs immediate.** Given SES is already wired and working
(`lib/email.ts`, used today for PDF delivery and the daily-briefing-style
patterns used on the MEMA platform sibling project), the mechanically easy
part is sending mail. The hard part is deciding what is worth interrupting
someone for. A reasonable split: immediate (a small allowlist - a decision
assigned to you, a condition you own breaching its due date, an incident
assigned to you) vs a daily digest (everything else that changed: new
evidence added, a test completed, a control change moved status). The
governance dashboard's own aggregation (`lib/governance/portfolio.ts`, the
due-soon window this phase made workspace-configurable) is already the right
shape of query to drive a digest - it is a "what needs attention" roll-up
today computed on page load; a scheduled job computing the same roll-up
per-user and mailing it is a small extension of existing code, not new
architecture.

**Which events actually warrant one.** Candidates, roughly in order of how
defensible an interruption they are: an overdue action or condition where
you are the owner; a decision awaiting your approval; an incident assigned
to you; a control test due within the reminder window (now configurable via
Settings, `reviewReminderDays`) with you as the tester. Weaker candidates
that should probably stay digest-only or be opt-in: every evidence upload,
every comment, every status change on something you merely have visibility
into rather than ownership of. The house style seen elsewhere in this
codebase (deterministic, no silent behaviour) argues for an explicit,
documented notification-event registry (event type to channel to audience),
not an ad hoc `sendEmail()` call sprinkled into whichever route feels like
it deserves one at the time - that is how a codebase ends up with the
"stale, noisy, uninstallable" reputation most B2B tools get for their
notification systems.

**The noise risk.** This is the real threat to the feature being useful at
all. A firm using this tool seriously will have dozens of open actions,
several in-flight assessments, and a control-testing cycle running
continuously - if every one of those generates an email, the notification
system trains its own users to ignore it within a week, at which point it
is actively worse than not having it (a genuinely urgent overdue condition
gets lost in the same inbox as forty routine ones). The concrete mitigation
is what the digest/immediate split above is for, plus a per-user
"notify me about" preference (workspace_people already has a
`role` - it is a short step to add notification preferences alongside it
once `user_id` exists), plus, from day one, a "why am I getting this"
footer on every email linking back to the preference. None of this is hard
engineering; it is discipline about what NOT to send, decided up front
rather than retrofitted after users start muting the sender.

**Sequencing.** Build order, once auth exists: (1) the event registry and a
single "digest" email listing everything relevant to a user, sent daily,
because it is the lowest-risk version (worst case, someone ignores one
email a day); (2) promote the small immediate-notification allowlist above
to real-time sends only once the digest has proven the event data is
accurate and not noisy; (3) per-user preferences last, once there is real
usage data on which events people actually act on versus mute.
