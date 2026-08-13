/**
 * Accounts and authentication smoke test.
 *
 * Proves the whole optional-accounts model end to end: signup, login,
 * logout revoking server-side (not just the cookie), an expired session
 * being rejected (verified by directly ageing a row in the DB, since 30
 * days is not something a smoke run can wait out), duplicate-email and
 * bad-credential handling with no user enumeration, rate limiting on both
 * signup and login, the claim flow (proving possession of an anonymous
 * workspace's token, then reaching that workspace by session alone with NO
 * headers at all), cross-account isolation (user B cannot reach user A's
 * claimed workspace), and that an ordinary unclaimed anonymous workspace
 * still works by header exactly as before accounts existed.
 *
 * Usage:
 *   node scripts/smoke-auth.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-auth.mjs
 *
 * The expired-session check needs direct DB access (there is no API to
 * backdate a session) and is skipped, like the object_versions check in
 * scripts/smoke-control-test.mjs, when DATABASE_URL is not set or points at
 * a different database than SMOKE_BASE_URL.
 */
import pg from "pg";
import { createHash } from "node:crypto";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";

let passed = 0;
let failed = 0;
const ok = (name, note) => {
  passed += 1;
  console.log(`ok: ${name}${note ? ` - ${note}` : ""}`);
};
const fail = (name, note) => {
  failed += 1;
  console.log(`FAIL: ${name}${note ? ` - ${note}` : ""}`);
};
const expect = (name, actual, want) =>
  actual === want ? ok(name, `got ${JSON.stringify(actual)}`) : fail(name, `expected ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`);

const body = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Pulls just the cookie's name=value out of a Set-Cookie header (ignoring attributes). */
function extractCookiePair(setCookieHeader) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(";")[0];
}

async function bootstrapWorkspace() {
  const res = await fetch(`${BASE_URL}/api/workspace/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return body(res);
}

let emailCounter = 0;
function freshEmail() {
  emailCounter += 1;
  return `smoke-auth-${Date.now()}-${emailCounter}@example.com`;
}

async function main() {
  console.log(`\nAccounts + authentication smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  // --- 1. Signup ----------------------------------------------------------
  const emailA = freshEmail();
  const passwordA = "correct horse battery staple A";

  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  expect("signup -> 201", signupRes.status, 201);
  const signupBody = await body(signupRes);
  expect("signup returns user email", signupBody.user?.email, emailA.toLowerCase());

  const setCookie = signupRes.headers.get("set-cookie") || "";
  const cookiePairA = extractCookiePair(setCookie);
  cookiePairA ? ok("signup sets a session cookie") : fail("signup sets a session cookie");
  setCookie.toLowerCase().includes("httponly") ? ok("session cookie is HttpOnly") : fail("session cookie is HttpOnly", setCookie);
  setCookie.toLowerCase().includes("samesite=lax") ? ok("session cookie is SameSite=Lax") : fail("session cookie is SameSite=Lax", setCookie);
  // Secure requires https; a local http smoke run correctly gets a
  // non-Secure cookie (see lib/auth/session-cookie.ts's isHttps) - assert
  // the property that actually holds for this run's protocol rather than
  // hard-coding either direction.
  const isHttpsRun = BASE_URL.startsWith("https://");
  const hasSecure = setCookie.toLowerCase().includes("secure");
  if (isHttpsRun) {
    expect("session cookie is Secure (https run)", hasSecure, true);
  } else {
    expect("session cookie is NOT Secure (http run, correct - Secure would break local dev)", hasSecure, false);
  }

  // --- 2. Signup validation -------------------------------------------------
  const badEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "whatever1234" }),
  });
  expect("signup invalid email -> 400", badEmailRes.status, 400);

  const shortPasswordRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: freshEmail(), password: "short1" }),
  });
  expect("signup short password -> 400", shortPasswordRes.status, 400);

  // --- 3. Duplicate email handled cleanly ------------------------------------
  const dupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: "another password entirely" }),
  });
  expect("duplicate email -> 409 (not a raw 23505)", dupRes.status, 409);
  const dupBody = await body(dupRes);
  (typeof dupBody.error === "string" && !dupBody.error.includes("23505"))
    ? ok("duplicate email error is a clean message", dupBody.error)
    : fail("duplicate email error is a clean message", JSON.stringify(dupBody));

  // Case-insensitivity: same email, different case, still a duplicate.
  const dupCaseRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA.toUpperCase(), password: "another password entirely" }),
  });
  expect("duplicate email (different case) -> 409", dupCaseRes.status, 409);

  // --- 4. Login + no user enumeration --------------------------------------
  const wrongPasswordRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: "totally the wrong password" }),
  });
  const wrongPasswordBody = await body(wrongPasswordRes);
  expect("login wrong password -> 401", wrongPasswordRes.status, 401);

  const unknownEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: freshEmail(), password: "totally the wrong password" }),
  });
  const unknownEmailBody = await body(unknownEmailRes);
  expect("login unknown email -> 401", unknownEmailRes.status, 401);
  expect(
    "no user enumeration: identical status+message for wrong password vs unknown email",
    wrongPasswordRes.status === unknownEmailRes.status && wrongPasswordBody.error === unknownEmailBody.error,
    true
  );

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  expect("login correct credentials -> 200", loginRes.status, 200);
  const cookiePairLoginA = extractCookiePair(loginRes.headers.get("set-cookie") || "");
  cookiePairLoginA ? ok("login sets a session cookie") : fail("login sets a session cookie");

  // --- 5. GET /me reflects the session --------------------------------------
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookiePairLoginA } });
  const meBody = await body(meRes);
  expect("me returns the signed-in user's email", meBody.user?.email, emailA.toLowerCase());

  // --- 6. Logout revokes server-side, not just the cookie --------------------
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", headers: { Cookie: cookiePairLoginA } });
  expect("logout -> 200", logoutRes.status, 200);

  // Deliberately re-send the SAME raw cookie value the client would have had
  // before logout cleared it - this is the point of the test: proving the
  // sessions row itself is gone server-side, not merely that the browser
  // stopped sending the cookie.
  const meAfterLogoutRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookiePairLoginA } });
  const meAfterLogoutBody = await body(meAfterLogoutRes);
  expect("me after logout (same old cookie replayed) -> user null", meAfterLogoutBody.user, null);

  // A workspace route via the (now revoked) session must also refuse.
  const wsAfterLogout = await bootstrapWorkspace();
  const claimAttemptAfterLogout = await fetch(`${BASE_URL}/api/workspace/settings`, {
    headers: { Cookie: cookiePairLoginA, "x-workspace-id": wsAfterLogout.id },
  });
  expect("workspace route via revoked session -> 401", claimAttemptAfterLogout.status, 401);

  // --- 7. Sign back in for the rest of the flow ------------------------------
  const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  const cookieA = extractCookiePair(reloginRes.headers.get("set-cookie") || "");

  // --- 8. Claim flow: bootstrap an anonymous workspace, claim it, then reach it by session alone --
  const anonWorkspace = await bootstrapWorkspace();

  // Sanity: unclaimed anonymous workspace still works by header exactly as before accounts existed.
  const unclaimedHeaderRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    headers: { "x-workspace-id": anonWorkspace.id, "x-workspace-token": anonWorkspace.token },
  });
  expect("unclaimed workspace reachable by header token (unchanged anonymous path)", unclaimedHeaderRes.status, 200);

  const claimWrongTokenRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: anonWorkspace.id, workspaceToken: "0".repeat(64) }),
  });
  expect("claim with wrong token -> 400", claimWrongTokenRes.status, 400);

  const claimNoSessionRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: anonWorkspace.id, workspaceToken: anonWorkspace.token }),
  });
  expect("claim without a session -> 401", claimNoSessionRes.status, 401);

  const claimRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: anonWorkspace.id, workspaceToken: anonWorkspace.token }),
  });
  expect("claim -> 201", claimRes.status, 201);

  // Idempotent re-claim by the same user.
  const reClaimRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: anonWorkspace.id, workspaceToken: anonWorkspace.token }),
  });
  expect("re-claim by the same user -> 200 (idempotent, not an error)", reClaimRes.status, 200);

  // The claimed workspace is now reachable by SESSION ALONE - no
  // x-workspace-token header at all, only x-workspace-id + the cookie.
  const sessionOnlyRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    headers: { Cookie: cookieA, "x-workspace-id": anonWorkspace.id },
  });
  expect("claimed workspace reachable by session alone (no token header)", sessionOnlyRes.status, 200);

  // The audit actor for a session-authenticated mutation is the user's
  // email, not the generic "workspace" string - PATCH /api/workspace/settings
  // is wired to demonstrate this (see lib/workspace-auth.ts's withWorkspace doc).
  const patchViaSessionRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieA, "x-workspace-id": anonWorkspace.id },
    body: JSON.stringify({ name: "Smoke session-audit check" }),
  });
  expect("PATCH via session -> 200", patchViaSessionRes.status, 200);

  // The header token STILL also works after claiming (claiming does not
  // revoke or weaken the anonymous path).
  const stillWorksByHeaderRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    headers: { "x-workspace-id": anonWorkspace.id, "x-workspace-token": anonWorkspace.token },
  });
  expect("claimed workspace still reachable by its original header token too", stillWorksByHeaderRes.status, 200);

  // --- 9. Cross-account isolation: user B cannot reach user A's claimed workspace --
  const emailB = freshEmail();
  const passwordB = "correct horse battery staple B";
  const signupBRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailB, password: passwordB }),
  });
  const cookieB = extractCookiePair(signupBRes.headers.get("set-cookie") || "");

  const crossAccountRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    headers: { Cookie: cookieB, "x-workspace-id": anonWorkspace.id },
  });
  expect("user B cannot reach user A's claimed workspace via session -> 401", crossAccountRes.status, 401);

  // Nor can user B claim it out from under user A (already owned by a different account).
  const secondAnonForClaimAttempt = anonWorkspace; // reuse - B tries to claim the SAME workspace A already owns
  const crossClaimRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieB },
    body: JSON.stringify({ workspaceId: secondAnonForClaimAttempt.id, workspaceToken: secondAnonForClaimAttempt.token }),
  });
  expect("user B claiming user A's already-owned workspace -> 409", crossClaimRes.status, 409);

  // --- 9b. Audit actor: a session-authenticated mutation names the real person --
  {
    const databaseUrlForAudit = (process.env.DATABASE_URL || "").trim();
    const targetIsLocalForAudit = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
    const dbIsLocalForAudit = /@?(localhost|127\.0\.0\.1)/.test(databaseUrlForAudit);
    if (databaseUrlForAudit && targetIsLocalForAudit === dbIsLocalForAudit) {
      const client = new pg.Client({ connectionString: databaseUrlForAudit });
      await client.connect();
      try {
        const { rows } = await client.query(
          `SELECT actor FROM audit_log
           WHERE workspace_id = $1 AND verb = 'workspace.updated'
           ORDER BY created_at DESC LIMIT 1`,
          [anonWorkspace.id]
        );
        expect("session-authenticated PATCH audit actor is the user's email, not 'workspace'", rows[0]?.actor, emailA.toLowerCase());
      } finally {
        await client.end();
      }
    } else {
      console.log("  (skipping audit-actor DB check: DATABASE_URL not set or points elsewhere)");
    }
  }

  // --- 10. Expired session rejected (direct DB check, mirrors smoke-control-test.mjs's pattern) --
  // Runs BEFORE the rate-limit stress test below: login is rate limited per
  // IP (not per email), so once that test trips the limiter, no further
  // logins from this script succeed for the rest of the run - this check
  // needs one more real login first.
  // There is no API to backdate a session (correctly - that would be a
  // vulnerability), so this ages a real session's expires_at directly in
  // the DB and confirms verifySession/withWorkspace both then reject it
  // exactly like an unknown token, only when the DB the server is actually
  // using is reachable and matches SMOKE_BASE_URL.
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const targetIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
  const dbIsLocal = /@?(localhost|127\.0\.0\.1)/.test(databaseUrl);
  if (databaseUrl && targetIsLocal !== dbIsLocal) {
    console.log("  (skipping expired-session DB check: DATABASE_URL points at a different database than SMOKE_BASE_URL)");
  } else if (databaseUrl) {
    // A fresh session for this check, independent of the rate-limit loop above.
    const freshLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailB, password: passwordB }),
    });
    const freshCookie = extractCookiePair(freshLoginRes.headers.get("set-cookie") || "");

    if (!freshCookie) {
      console.log("  (skipping expired-session DB check: rate-limited before a fresh session could be minted)");
    } else {
      const rawToken = freshCookie.split("=")[1];
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      try {
        const { rowCount } = await client.query(
          `UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`,
          [tokenHash]
        );
        expect("expired-session DB fixture: row found and aged", rowCount, 1);

        const meAfterExpiryRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: freshCookie } });
        const meAfterExpiryBody = await body(meAfterExpiryRes);
        expect("me with an expired session -> user null", meAfterExpiryBody.user, null);

        const wsForExpiry = await bootstrapWorkspace();
        const claimedByExpired = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: freshCookie },
          body: JSON.stringify({ workspaceId: wsForExpiry.id, workspaceToken: wsForExpiry.token }),
        });
        expect("claim-workspace with an expired session -> 401", claimedByExpired.status, 401);
      } finally {
        await client.end();
      }
    }
  } else {
    console.log("  (skipping expired-session DB check: DATABASE_URL not set)");
  }

  // --- 11. Rate limiting ------------------------------------------------------
  // Login: LOGIN_LIMIT=10 per 15 minutes per IP (app/api/auth/login/route.ts).
  // This whole smoke run already made several login calls above from the same
  // IP, so a modest number of additional attempts here is enough to trip it.
  // Runs LAST: once tripped, every other login in this process is blocked too.
  let sawLoginRateLimit = false;
  for (let i = 0; i < 12; i += 1) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailA, password: "wrong on purpose" }),
    });
    if (res.status === 429) {
      sawLoginRateLimit = true;
      break;
    }
  }
  sawLoginRateLimit ? ok("login is rate limited (429 after repeated attempts)") : fail("login is rate limited");

  // Signup: SIGNUP_LIMIT=8 per hour per IP (app/api/auth/signup/route.ts).
  // This run already made several signup calls above (real + validation
  // failures - the rate-limit check runs before body validation, so both
  // count), so only a handful more are needed here. Also last: once
  // tripped, nothing after this needs a fresh signup.
  let sawSignupRateLimit = false;
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: freshEmail(), password: "whatever, this just needs to pass validation" }),
    });
    if (res.status === 429) {
      sawSignupRateLimit = true;
      break;
    }
  }
  sawSignupRateLimit ? ok("signup is rate limited (429 after repeated attempts)") : fail("signup is rate limited");

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
