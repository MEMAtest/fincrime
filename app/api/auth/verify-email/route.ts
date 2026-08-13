import { NextRequest, NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/repo/auth-tokens";
import { markEmailVerified } from "@/lib/repo/users";

function page(title: string, message: string): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - FinCrime Control Lab</title>
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
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/account">Go to your account</a></p>
  </div>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * GET /api/auth/verify-email?token=... - marks users.email_verified_at.
 * Never gates anything today (accounts are fully usable before this is
 * clicked) - see app/api/auth/signup/route.ts's doc comment for why this
 * exists anyway: an email_verified_at column that nothing ever writes is
 * worse than not having the column at all.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const consumed = await consumeAuthToken("email_verification", token);
  if (!consumed) {
    return page("Link expired or already used", "This verification link is no longer valid.");
  }
  await markEmailVerified(consumed.userId);
  return page("Email verified", "Thanks - your email address is now confirmed.");
}
