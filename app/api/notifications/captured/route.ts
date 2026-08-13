import { NextResponse } from "next/server";
import { capturedEmails } from "@/lib/notifications/send";

/**
 * Local-only smoke-test seam: returns (and drains) the in-memory
 * capturedEmails buffer that lib/notifications/send.ts fills instead of
 * calling SES when NOTIFICATIONS_CAPTURE=1 is set in the environment. 404s
 * whenever that env var is not set - which is always true in production and
 * in the real GitHub Actions cron, since neither sets it - so this route
 * exposes nothing outside a deliberate local smoke run.
 *
 * VERCEL_ENV === "production" is a second, independent gate on top of the
 * env var check: NOTIFICATIONS_CAPTURE=1 is the intended local smoke-run
 * trigger, but env vars can be misconfigured or leak into a deployment they
 * were never meant to reach. If that ever happened in production, this
 * route without this check would become an unauthenticated cross-tenant
 * dump of every captured digest's full content (email addresses, control
 * names, due dates). VERCEL_ENV (not NODE_ENV) is the right signal here:
 * Vercel sets VERCEL_ENV=production ONLY for the actual production
 * deployment and is not attacker-controlled, whereas NODE_ENV is forced to
 * "production" by `next start` itself for EVERY production-mode run,
 * including the documented local smoke setup (`npx next start -p 3210`,
 * see this repo's scripts/smoke-notifications.mjs) - gating on NODE_ENV
 * would 404 this route during ordinary local smoke testing too, which is
 * not the deployment this check is meant to protect against.
 */
export async function GET() {
  if (process.env.VERCEL_ENV === "production" || process.env.NOTIFICATIONS_CAPTURE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = capturedEmails.splice(0, capturedEmails.length);
  return NextResponse.json({ items });
}
