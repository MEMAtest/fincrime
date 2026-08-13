import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/repo/notifications";

const CONFIRMATION_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribed - FinCrime Control Lab</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b1020; color: #e5e7eb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { max-width: 420px; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { font-size: 14px; color: #9ca3af; line-height: 1.5; }
    a { color: #14b8a6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been unsubscribed</h1>
    <p>You will no longer receive notification digests for this workspace. You can turn them back on at any time from Settings while signed in.</p>
  </div>
</body>
</html>`;

/**
 * GET /api/notifications/unsubscribe?token=... - one click, no auth
 * required (that is the point of a mail-client unsubscribe link). Always
 * returns the same 200 confirmation page regardless of whether the token
 * resolved to a real preference row - unsubscribeByToken is itself a no-op
 * for an unknown token, and this route deliberately does not distinguish
 * that case in its response, so a token cannot be probed to learn whether
 * it is valid. Setting frequency to 'off' twice is a harmless no-op write,
 * so repeat clicks (a mail client prefetching the link, a user clicking
 * twice) are safe.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  await unsubscribeByToken(token);
  return new NextResponse(CONFIRMATION_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
