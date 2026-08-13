import { NextResponse } from "next/server";
import { capturedEmails } from "@/lib/notifications/send";

/**
 * Local-only smoke-test seam: returns (and drains) the in-memory
 * capturedEmails buffer that lib/notifications/send.ts fills instead of
 * calling SES when NOTIFICATIONS_CAPTURE=1 is set in the environment. 404s
 * whenever that env var is not set - which is always true in production and
 * in the real GitHub Actions cron, since neither sets it - so this route
 * exposes nothing outside a deliberate local smoke run.
 */
export async function GET() {
  if (process.env.NOTIFICATIONS_CAPTURE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = capturedEmails.splice(0, capturedEmails.length);
  return NextResponse.json({ items });
}
