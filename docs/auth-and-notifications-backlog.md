# Auth and notifications: what remains

The shipped-architecture note ([auth-and-notifications.md](./auth-and-notifications.md))
describes what exists today. This is the honest remainder - not built,
deliberately deferred, or a known limit of what was built. Written at the
same time as that document, so it stays accurate against the same baseline.

## Member invites

There is no self-service way to add a SECOND member to an already-claimed
workspace. `workspace_members.role` already has a `'member'` value and
`GET /api/workspace/members` / owner-only `DELETE .../[userId]` are fully
built and correct against however many members a workspace has - but the
only way membership rows are created today is claiming (one owner, once,
per workspace) or a direct database action. A real invite flow -
owner generates an invite link or enters a colleague's email, the invited
user accepts and gets a `'member'` row - is the natural next piece, and the
member list/removal UI already surfaced on `/account` is exactly where it
would live. Until this exists, "share this workspace with a colleague" is
not a real feature; the sign-up page's copy was corrected to stop
implying it is.

## Immediate (non-digest) notifications

Everything today is either a daily/weekly digest or nothing - there is no
"notify me right now" channel for the small allowlist that would justify
one (a decision assigned to you, a condition you own breaching its due
date, an incident assigned to you). The digest infrastructure
(`lib/notifications/digest.ts`, `lib/governance/portfolio.ts`'s aggregation)
is the right shape to extend, but promoting a subset of events to real-time
sends is unbuilt.

## The event registry

Notification-worthy events are still implicit in `buildDigest`'s category
logic, not an explicit, documented event-type-to-channel-to-audience
registry. This matters more once immediate notifications exist (above) -
right now there is exactly one channel (digest), so the registry's absence
is not yet costing anything concrete, but it will be the first thing that
needs to exist before adding a second channel without the "stale, noisy,
uninstallable" failure mode most notification systems eventually hit.

## Identity-checked approvals

`workspace_people` (name, role, optional email - used for
`decided_by_person_id` on every decision, test completion, incident
closure, etc.) is still NOT linked to `users`. A decision record still only
records which NAMED PERSON the client asserted approved it
(`decidedByPersonId` in the request body) - nothing checks that the
person clicking "Approve" in the browser is the actual named approver
rather than anyone else with access to the workspace. Actor threading (see
the shipped-architecture note) fixed WHO acted at the account/session
level - it did not fix whether that account is authorised to act as the
specific named person a decision is attributed to. The realistic path,
per the original design note this document supersedes: `workspace_people.user_id`
(nullable, `ON DELETE SET NULL`) linking a person record to a real user
WHEN one exists, so `decided_by_person_id` can eventually be checked
against "is this person's linked user the one making this request." This
touches every module with an approval step (PRA decisions, control-test
completion, incident closure, readiness approval, reg-response approval)
and is the largest remaining piece of work in this area.

## Data retention

Unchanged from before this phase: no TTL, no archival job, no "delete my
data" flow, and no anonymisation of `owner_email` or user accounts after a
period of inactivity. An abandoned workspace (anonymous or claimed) keeps
its assessments, evidence, and uploaded files indefinitely.

## OAuth / SSO / MFA

Out of scope, not attempted. The current model is homegrown
email+password with SES magic links for reset/verification/claim
confirmation - deliberately the smallest build that closes the security
gaps identified, not a general-purpose auth platform. If a specific
customer's procurement or audit requirement demands SSO or MFA, that is a
new, separately-scoped piece of work, not an extension of what exists.
