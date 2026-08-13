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
import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";
const scryptAsync = promisify(scryptCallback);

/**
 * Mirrors lib/auth/password.ts's hashPassword() exactly (same algorithm,
 * same format) so a row inserted this way verifies correctly against the
 * real app. Used ONLY to set up test accounts directly in the DB for
 * blocks below that need several distinct accounts but are not themselves
 * testing the signup endpoint - going through POST /api/auth/signup for
 * every one of them would burn through SIGNUP_LIMIT=8/hour/IP
 * (app/api/auth/signup/route.ts) well before this whole script finishes,
 * which is a smoke-script budget problem, not a reason to weaken the real
 * limiter. Every account creation that DOES exercise the signup endpoint's
 * own behaviour (rate limiting, duplicate handling, validation) still goes
 * through the real route elsewhere in this file.
 */
async function directCreateUser(client, email, password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 128 * 16384 * 8 * 2 });
  const hash = `scrypt:16384:8:1:${salt.toString("hex")}:${derived.toString("hex")}`;
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash) VALUES (lower($1), $2) RETURNING id`,
    [email, hash]
  );
  return rows[0].id;
}

/**
 * Mirrors lib/repo/sessions.ts's createSession exactly (32 random bytes,
 * sha256 hash stored, 30-day expiry) to mint a session directly for a user
 * id, bypassing POST /api/auth/login entirely - used only where a block
 * needs a valid pre-existing session cookie for setup (e.g. "prove this
 * session is revoked after X") and does not itself need to exercise the
 * login endpoint, since every real login call shares LOGIN_LIMIT's budget
 * with the rest of this script.
 */
async function directCreateSession(client, userId) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await client.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [userId, tokenHash, expiresAt]);
  return `fincrime_session=${token}`;
}

/** Logs in through the REAL route (exercises real session-creation code, not a DB shortcut) and returns the cookie pair. */
async function loginFor(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, cookie: extractCookiePair(res.headers.get("set-cookie") || "") };
}

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
  // Secure: lib/auth/session-cookie.ts's isHttps() is now `NODE_ENV ===
  // "production" OR the request's own protocol` - NODE_ENV is checked
  // FIRST and wins outright, precisely so a client-supplied
  // x-forwarded-proto header can never strip Secure in a real deployment
  // (the bug this replaced: trusting that header alone let
  // `x-forwarded-proto: http` drop Secure). `next start` (what this smoke
  // suite runs against locally, per every script's usage comment) sets
  // NODE_ENV=production itself when it is not already set - see next's own
  // bin/next - so a local smoke run IS "production mode" for this purpose,
  // exactly like a real Vercel deployment, and Secure must be present
  // regardless of BASE_URL's own scheme or anything a request header
  // claims.
  const isProductionRun = process.env.NODE_ENV === "production" || !process.env.NODE_ENV;
  const hasSecure = setCookie.toLowerCase().includes("secure");
  if (isProductionRun) {
    expect("session cookie is Secure (production-mode run, per next start's own NODE_ENV default)", hasSecure, true);
  } else {
    // Only reachable if this script itself was explicitly launched with
    // NODE_ENV=development against a `next dev` server - not the documented
    // smoke setup, but kept correct rather than assuming.
    console.log("  (NODE_ENV explicitly non-production - Secure assertion follows isHttps' header/protocol fallback, not asserted here)");
  }

  // The actual regression proof for "Secure is derived from a spoofable
  // header" is folded into step 4's `loginRes` call below (which sends
  // x-forwarded-proto: http) rather than a dedicated extra login here -
  // every login call in this script counts against LOGIN_LIMIT=10/15min/IP
  // shared across every section, so this reuses a call this script already
  // needs instead of spending one solely on this assertion.

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

  // x-forwarded-proto: http is the actual regression proof for "Secure is
  // derived from a spoofable header" - before the fix, isHttps() trusted
  // this header outright and this would have stripped Secure from the
  // cookie this call gets back.
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-proto": "http" },
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  expect("login correct credentials -> 200", loginRes.status, 200);
  const loginResSetCookie = loginRes.headers.get("set-cookie") || "";
  const cookiePairLoginA = extractCookiePair(loginResSetCookie);
  cookiePairLoginA ? ok("login sets a session cookie") : fail("login sets a session cookie");
  if (isProductionRun) {
    expect(
      "Secure survives a spoofed x-forwarded-proto: http header on login (production mode)",
      loginResSetCookie.toLowerCase().includes("secure"),
      true
    );
  }

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

  // --- 9c. Actor threading beyond app/api/workspace/settings: a session-
  //     authenticated mutation on a DIFFERENT route family (the generic
  //     actions endpoint, app/api/workspace/actions) also names the real
  //     person, not the anonymous "workspace" fallback. Before this fix,
  //     every route family except app/api/workspace/settings still used
  //     each family's fixed ACTOR = "workspace" constant regardless of how
  //     the request authenticated - this proves the fix generalises, not
  //     just the one route the original code happened to demonstrate it on.
  {
    const sessionActionRes = await fetch(`${BASE_URL}/api/workspace/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA, "x-workspace-id": anonWorkspace.id },
      body: JSON.stringify({ subjectType: "monitoring", subjectId: "00000000-0000-4000-8000-000000000000", title: "Smoke: session-authenticated action" }),
    });
    expect("session-authenticated action create -> 201", sessionActionRes.status, 201);
    const sessionActionBody = await body(sessionActionRes);
    const sessionActionId = sessionActionBody.action?.id;

    const databaseUrlForActionAudit = (process.env.DATABASE_URL || "").trim();
    const targetIsLocalForActionAudit = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
    const dbIsLocalForActionAudit = /@?(localhost|127\.0\.0\.1)/.test(databaseUrlForActionAudit);
    if (databaseUrlForActionAudit && targetIsLocalForActionAudit === dbIsLocalForActionAudit && sessionActionId) {
      const client = new pg.Client({ connectionString: databaseUrlForActionAudit });
      await client.connect();
      try {
        const { rows } = await client.query(
          `SELECT actor FROM audit_log WHERE workspace_id = $1 AND verb = 'action.created' AND subject_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [anonWorkspace.id, sessionActionId]
        );
        expect("session-authenticated action.created audit actor is the user's email", rows[0]?.actor, emailA.toLowerCase());
      } finally {
        await client.end();
      }
    } else {
      console.log("  (skipping actions-family audit-actor DB check: DATABASE_URL not set, points elsewhere, or action id missing)");
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
    // A fresh session for this check, minted directly (directCreateSession -
    // see its doc comment) rather than via a real login call: this section
    // tests expiry rejection, not the login endpoint itself, and every real
    // login call shares LOGIN_LIMIT's budget with several other sections
    // added since this comment about needing "one more real login" was
    // first written - spending it here on pure setup would starve a
    // legitimate login elsewhere in the run.
    const freshSessionClient = new pg.Client({ connectionString: databaseUrl });
    await freshSessionClient.connect();
    let freshCookie;
    try {
      const { rows: emailBRows } = await freshSessionClient.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [emailB]);
      freshCookie = emailBRows[0] ? await directCreateSession(freshSessionClient, emailBRows[0].id) : undefined;
    } finally {
      await freshSessionClient.end();
    }

    if (!freshCookie) {
      console.log("  (skipping expired-session DB check: could not resolve user B's id)");
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

  // --- 10b. Members: list, owner-only removal, removed user then 401s -------
  // Gated on direct DB access, like the expired-session and audit-actor
  // checks above: this block needs two fresh accounts, created directly in
  // the DB (directCreateUser) rather than through POST /api/auth/signup -
  // routing every setup account through the real signup endpoint would
  // burn through SIGNUP_LIMIT=8/hour/IP well before this script's later
  // sections run, which is a smoke-script budget problem, not something
  // that should ever weaken the app's real rate limiter. This block does
  // not test signup itself, only claim/members/removal, so a direct DB
  // insert is a legitimate setup shortcut here (mirrors the expired-session
  // check's own use of direct DB access for setup it has no API for).
  const databaseUrlForMembers = (process.env.DATABASE_URL || "").trim();
  const targetIsLocalForMembers = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
  const dbIsLocalForMembers = /@?(localhost|127\.0\.0\.1)/.test(databaseUrlForMembers);
  if (databaseUrlForMembers && targetIsLocalForMembers === dbIsLocalForMembers) {
    const ownerEmail = freshEmail();
    const ownerPassword = "correct horse battery staple owner";
    const memberEmail = freshEmail();
    const memberPassword = "correct horse battery staple member";

    const setupClient = new pg.Client({ connectionString: databaseUrlForMembers });
    await setupClient.connect();
    try {
      await directCreateUser(setupClient, ownerEmail, ownerPassword);
      await directCreateUser(setupClient, memberEmail, memberPassword);
    } finally {
      await setupClient.end();
    }

    const ownerLogin = await loginFor(ownerEmail, ownerPassword);
    const ownerCookie = ownerLogin.cookie;

    const memberWs = await bootstrapWorkspace();
    const ownerClaim = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ workspaceId: memberWs.id, workspaceToken: memberWs.token }),
    });
    expect("members block: owner claims workspace -> 201", ownerClaim.status, 201);

    // A SECOND distinct user is added as a 'member' row DIRECTLY in the DB
    // for this test - NOT via a second POST /api/auth/claim-workspace call.
    // That is deliberate: claimWorkspace's "already owned by a different
    // account" refusal (proven separately by the cross-account-isolation
    // assertions above, "user B claiming user A's already-owned workspace
    // -> 409") is an existing, preserved guard - claiming stays strictly
    // one-shot-per-workspace via the token path, and this smoke suite must
    // not weaken or route around that. There is currently no public,
    // self-service way to become a SECOND member of an already-claimed
    // workspace at all (member invites are explicit future work - see
    // docs/auth-and-notifications.md's backlog) - workspace_members.role
    // 'member' exists in the schema for exactly that future path. This
    // direct insert stands in for "a member added some other way" (a future
    // invite, or a support/admin action) purely to exercise the
    // list/removal endpoints themselves against a genuine second row,
    // which is the part actually being fixed here.
    const memberLogin = await loginFor(memberEmail, memberPassword);
    const memberCookie = memberLogin.cookie;
    const memberInsertClient = new pg.Client({ connectionString: databaseUrlForMembers });
    await memberInsertClient.connect();
    try {
      const { rows: memberUserRows } = await memberInsertClient.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [memberEmail]);
      await memberInsertClient.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
        [memberWs.id, memberUserRows[0].id]
      );
    } finally {
      await memberInsertClient.end();
    }

    // The 'member' can reach the workspace by session.
    const memberAccessRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
      headers: { Cookie: memberCookie, "x-workspace-id": memberWs.id },
    });
    expect("members block: member can access the workspace before removal -> 200", memberAccessRes.status, 200);

    // GET member list.
    const listRes = await fetch(`${BASE_URL}/api/workspace/members?workspaceId=${memberWs.id}`, { headers: { Cookie: ownerCookie } });
    expect("members block: GET member list -> 200", listRes.status, 200);
    const listBody = await body(listRes);
    expect("members block: two members listed", listBody.members?.length, 2);
    const memberRow = listBody.members?.find((m) => m.email === memberEmail.toLowerCase());
    memberRow ? ok("members block: the second claimant appears in the list") : fail("members block: the second claimant appears in the list", JSON.stringify(listBody));

    // A non-owner cannot remove anyone.
    const nonOwnerRemoveRes = await fetch(`${BASE_URL}/api/workspace/members/${memberRow?.userId}?workspaceId=${memberWs.id}`, {
      method: "DELETE",
      headers: { Cookie: memberCookie },
    });
    expect("members block: non-owner removal attempt -> 403", nonOwnerRemoveRes.status, 403);

    // The owner CANNOT be removed while sole owner (self-removal attempt refused).
    const listForOwnerId = listBody.members?.find((m) => m.email === ownerEmail.toLowerCase());
    const removeSoleOwnerRes = await fetch(`${BASE_URL}/api/workspace/members/${listForOwnerId?.userId}?workspaceId=${memberWs.id}`, {
      method: "DELETE",
      headers: { Cookie: ownerCookie },
    });
    expect("members block: removing the sole owner -> 409", removeSoleOwnerRes.status, 409);

    // The owner CAN remove the member - the actual fix for "a claimed
    // workspace can never be un-claimed".
    const removeRes = await fetch(`${BASE_URL}/api/workspace/members/${memberRow?.userId}?workspaceId=${memberWs.id}`, {
      method: "DELETE",
      headers: { Cookie: ownerCookie },
    });
    expect("members block: owner removes the member -> 200", removeRes.status, 200);

    // The removed user's session now 401s against THIS workspace.
    const memberAccessAfterRemoval = await fetch(`${BASE_URL}/api/workspace/settings`, {
      headers: { Cookie: memberCookie, "x-workspace-id": memberWs.id },
    });
    expect("members block: removed member's session -> 401 on this workspace", memberAccessAfterRemoval.status, 401);

    const listAfterRemoval = await body(
      await fetch(`${BASE_URL}/api/workspace/members?workspaceId=${memberWs.id}`, { headers: { Cookie: ownerCookie } })
    );
    expect("members block: one member left after removal", listAfterRemoval.members?.length, 1);
  } else {
    console.log("  (skipping members block: DATABASE_URL not set or points elsewhere)");
  }

  // --- 10c. Password reset: request never reveals existence, link works, revokes sessions --
  // Also gated on DB access: setup uses directCreateUser (same rationale as
  // 10b above), and the reset-confirm flow itself needs the raw token,
  // which only ever exists in the email SES would have sent - reading it
  // back requires minting one the same way the route does (see below),
  // which needs DB access anyway.
  if (databaseUrlForMembers && targetIsLocalForMembers === dbIsLocalForMembers) {
    const resetEmail = freshEmail();
    const oldPassword = "correct horse battery staple reset old";
    const newPassword = "correct horse battery staple reset new";

    const resetSetupClient = new pg.Client({ connectionString: databaseUrlForMembers });
    await resetSetupClient.connect();
    let resetCookieBeforeReset;
    try {
      const resetUserId = await directCreateUser(resetSetupClient, resetEmail, oldPassword);
      // A pre-existing session, minted directly (not via POST /api/auth/login
      // - see directCreateSession's doc comment) so proving it gets revoked
      // by the reset below does not itself spend any of this script's
      // shared LOGIN_LIMIT budget.
      resetCookieBeforeReset = await directCreateSession(resetSetupClient, resetUserId);
    } finally {
      await resetSetupClient.end();
    }

    const requestKnown = await fetch(`${BASE_URL}/api/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });
    const requestKnownBody = await body(requestKnown);
    const requestUnknown = await fetch(`${BASE_URL}/api/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: freshEmail() }),
    });
    const requestUnknownBody = await body(requestUnknown);
    expect(
      "password-reset request: identical status+shape for a known vs unknown email (no enumeration)",
      requestKnown.status === requestUnknown.status && requestKnownBody.message === requestUnknownBody.message,
      true
    );

    const databaseUrlForReset = (process.env.DATABASE_URL || "").trim();
    const targetIsLocalForReset = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
    const dbIsLocalForReset = /@?(localhost|127\.0\.0\.1)/.test(databaseUrlForReset);
    if (databaseUrlForReset && targetIsLocalForReset === dbIsLocalForReset) {
      const client = new pg.Client({ connectionString: databaseUrlForReset });
      await client.connect();
      let rawResetToken;
      try {
        // There is no API that returns the raw token (it is only ever
        // emailed) - reading it back out of the DB would require reversing
        // a one-way hash, which is by design impossible. Instead this
        // mints a token the SAME way the route does, using the same repo
        // function, to get a raw token whose hash IS in the table -
        // functionally identical to "the token from the email" for the
        // purpose of proving consume-on-use and session revocation work.
        const { rows: userRows } = await client.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [resetEmail]);
        const userId = userRows[0]?.id;
        userId ? ok("password-reset: found the user row to mint a token for") : fail("password-reset: found the user row to mint a token for");

        if (userId) {
          const { randomBytes, createHash } = await import("node:crypto");
          rawResetToken = randomBytes(32).toString("hex");
          const tokenHash = createHash("sha256").update(rawResetToken).digest("hex");
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          await client.query(
            `INSERT INTO auth_tokens (purpose, user_id, token_hash, expires_at) VALUES ('password_reset', $1, $2, $3)`,
            [userId, tokenHash, expiresAt]
          );
        }
      } finally {
        await client.end();
      }

      if (rawResetToken) {
        const badPasswordConfirm = await fetch(`${BASE_URL}/api/auth/password-reset/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawResetToken, password: "short" }),
        });
        expect("password-reset confirm with too-short password -> 400", badPasswordConfirm.status, 400);

        const confirmRes = await fetch(`${BASE_URL}/api/auth/password-reset/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawResetToken, password: newPassword }),
        });
        expect("password-reset confirm -> 200", confirmRes.status, 200);

        // Single-use: the SAME token cannot be replayed.
        const replayConfirmRes = await fetch(`${BASE_URL}/api/auth/password-reset/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawResetToken, password: "correct horse battery staple reset replay" }),
        });
        expect("password-reset confirm replay of the same token -> 400", replayConfirmRes.status, 400);

        // The OLD password no longer works; the NEW one does.
        const loginOldRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail, password: oldPassword }),
        });
        expect("login with the OLD password after reset -> 401", loginOldRes.status, 401);

        const loginNewRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail, password: newPassword }),
        });
        expect("login with the NEW password after reset -> 200", loginNewRes.status, 200);

        // The session that existed BEFORE the reset is revoked end to end.
        const meWithPreResetSession = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: resetCookieBeforeReset } });
        const meWithPreResetSessionBody = await body(meWithPreResetSession);
        expect("a session that existed before the reset -> user null (revoked)", meWithPreResetSessionBody.user, null);
      } else {
        console.log("  (skipping password-reset confirm/session-revocation checks: could not resolve the user row)");
      }
    } else {
      console.log("  (skipping password-reset DB-dependent checks: DATABASE_URL not set or points elsewhere)");
    }
  } else {
    console.log("  (skipping password-reset block: DATABASE_URL not set or points elsewhere)");
  }

  // --- 10d. Login revokes the browser's PRIOR session ------------------------
  // A shared-machine scenario: user C signs in (session cookie minted), then
  // - without ever clicking "Sign out" - user D signs in on the SAME
  // browser (the same cookie is forwarded on the second login request,
  // exactly as a real browser would do automatically). C's session must not
  // remain valid afterwards.
  // Gated on DB access (directCreateUser - see 10b's doc comment for why:
  // this block does not test signup itself, only login's session-revocation
  // behaviour, so creating its two accounts directly keeps this script's
  // total signup-endpoint calls well under SIGNUP_LIMIT).
  if (databaseUrlForMembers && targetIsLocalForMembers === dbIsLocalForMembers) {
    const emailC = freshEmail();
    const passwordC = "correct horse battery staple shared c";
    const emailD = freshEmail();
    const passwordD = "correct horse battery staple shared d";

    const sharedSetupClient = new pg.Client({ connectionString: databaseUrlForMembers });
    await sharedSetupClient.connect();
    try {
      await directCreateUser(sharedSetupClient, emailC, passwordC);
      await directCreateUser(sharedSetupClient, emailD, passwordD);
    } finally {
      await sharedSetupClient.end();
    }

    const loginCRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailC, password: passwordC }),
    });
    const cookieC = extractCookiePair(loginCRes.headers.get("set-cookie") || "");

    const meWhileCIsSignedIn = await body(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookieC } }));
    expect("shared-machine: C's session works before D signs in", meWhileCIsSignedIn.user?.email, emailC.toLowerCase());

    // D signs in, forwarding the browser's existing cookie (C's session) -
    // exactly what a real browser does on a same-origin fetch.
    const loginDRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieC },
      body: JSON.stringify({ email: emailD, password: passwordD }),
    });
    expect("shared-machine: D signs in -> 200", loginDRes.status, 200);
    const cookieD = extractCookiePair(loginDRes.headers.get("set-cookie") || "");

    // C's OLD session (the exact cookie value from before) must now be dead.
    const meWithCsOldCookie = await body(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookieC } }));
    expect("shared-machine: C's session is revoked after D signs in on the same browser", meWithCsOldCookie.user, null);

    // D's own new session is unaffected and works.
    const meWithD = await body(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookieD } }));
    expect("shared-machine: D's new session works", meWithD.user?.email, emailD.toLowerCase());
  } else {
    console.log("  (skipping shared-machine block: DATABASE_URL not set or points elsewhere)");
  }

  // --- 10e. Login rate limiting: a SECOND bucket keyed on the normalised email --
  // Distinct from the per-IP bucket exercised in section 11 below: this
  // proves distributed credential stuffing against ONE known email (many
  // different source IPs, each individually under the per-IP limit) is
  // still caught. Simulated here by spoofing a different x-forwarded-for
  // per attempt while reusing the SAME target email - the IP bucket should
  // see each as a fresh/mostly-fresh IP, but the email bucket accumulates
  // regardless.
  {
    // No signup needed: login returns the same generic 401 whether or not
    // the email has an account (no user enumeration), and the rate limiter
    // itself keys on the normalised email string alone, so a never-registered
    // email trips this bucket exactly the same as a real one would.
    const emailKeyTarget = freshEmail();

    let sawEmailKeyedRateLimit = false;
    for (let i = 0; i < 22; i += 1) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // A distinct spoofed source IP per attempt, via the header
          // getClientIp() trusts from Vercel's own edge in production
          // (x-vercel-forwarded-for) - irrelevant to which bucket actually
          // fires here since this smoke run's requests never pass through
          // that edge, so getClientIp() falls back to x-forwarded-for
          // regardless; the point is that varying it demonstrates the
          // EMAIL bucket trips independent of whatever IP-bucket key is in
          // play, since the email stays fixed across every attempt.
          "x-forwarded-for": `203.0.113.${i}`,
        },
        body: JSON.stringify({ email: emailKeyTarget, password: "wrong on purpose, over and over" }),
      });
      if (res.status === 429) {
        sawEmailKeyedRateLimit = true;
        break;
      }
    }
    sawEmailKeyedRateLimit
      ? ok("login is rate limited on the normalised EMAIL bucket, independent of IP")
      : fail("login is rate limited on the normalised EMAIL bucket");
  }

  // --- 11. Rate limiting ------------------------------------------------------
  // Login: LOGIN_LIMIT=10 per 15 minutes per IP (app/api/auth/login/route.ts)
  // AND LOGIN_EMAIL_LIMIT=20 per 15 minutes per normalised email - whichever
  // trips first. A local smoke run's requests carry no proxy headers, so
  // getClientIp() resolves UNKNOWN_IP and the IP bucket is skipped entirely
  // (see getClientIp's doc comment: fail OPEN on an unresolvable IP rather
  // than share one bucket for everyone behind an unidentifiable
  // connection) - this loop's realistic path to 429 locally is therefore
  // the EMAIL bucket, which is unconditional. emailA has already made a
  // handful of login attempts earlier in this run, so the loop bound is
  // generous enough to cross LOGIN_EMAIL_LIMIT regardless.
  // Runs LAST: once tripped, every other login in this process is blocked too.
  let sawLoginRateLimit = false;
  for (let i = 0; i < 25; i += 1) {
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
