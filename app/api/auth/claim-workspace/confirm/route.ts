import { NextRequest, NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/repo/auth-tokens";
import { claimWorkspace, getUserById } from "@/lib/repo/users";

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
 * GET /api/auth/claim-workspace/confirm?token=... - completes a workspace
 * claim that lib/auth/claim-flow.ts deferred behind an owner_email
 * confirmation link. No session required to click this link: the person
 * confirming is proving they control the workspace's owner_email inbox,
 * which IS the credential here, exactly like the notifications unsubscribe
 * link. consumeAuthToken is single-use and atomic (see its doc comment),
 * so a token cannot be replayed even if the email is later forwarded or
 * archived.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const consumed = await consumeAuthToken("workspace_claim", token);
  if (!consumed || !consumed.workspaceId) {
    return page("Link expired or already used", "This confirmation link is no longer valid. Ask the person requesting access to try again from your account page.");
  }

  const user = await getUserById(consumed.userId);
  if (!user) {
    return page("Link expired or already used", "This confirmation link is no longer valid.");
  }

  const result = await claimWorkspace(consumed.workspaceId, consumed.userId, user.email);
  if (!result.ok) {
    // "already_member" here just means someone else confirmed a second
    // pending request for the same user in the meantime - still a success
    // from this clicker's point of view. "owned_by_other" means the
    // workspace was claimed by someone else between the request and this
    // click; report that plainly rather than a false success.
    if (result.reason === "owned_by_other") {
      return page("Already claimed", "This workspace has already been linked to a different account.");
    }
  }

  return page("Access confirmed", "The account is now linked to this workspace.");
}
