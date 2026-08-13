/**
 * Notification digests smoke test.
 *
 * Proves the noise-risk mitigations docs/auth-and-notifications.md argues
 * for are actually wired, end to end: the cron endpoint refuses a missing
 * or wrong CRON_SECRET; a workspace with nothing outstanding sends nothing;
 * a workspace with outstanding items produces a digest; an immediate
 * second run sends nothing because the summaryHash matches the last
 * successful send; a genuinely changed situation DOES send; category
 * toggles are honoured (turning off the only category with outstanding
 * items suppresses the send even though the data is still there);
 * unsubscribe works, is idempotent, and stops the next run; and a
 * workspace with no account-holding members sends nothing at all.
 *
 * Emailing: run the local server with NOTIFICATIONS_CAPTURE=1 set (see
 * lib/notifications/send.ts) - every send this smoke triggers is appended
 * to an in-memory array instead of calling SES, and GET
 * /api/notifications/_captured (itself 404 unless that env var is set)
 * drains and returns it. Nothing is actually emailed during this run.
 *
 * Usage:
 *   CRON_SECRET=test-secret-for-smoke-1234567890 NOTIFICATIONS_CAPTURE=1 \
 *     npx next start -p 3210 &
 *   CRON_SECRET=test-secret-for-smoke-1234567890 node scripts/smoke-notifications.mjs
 *
 * DB-dependent assertions (reading notification_log rows and an
 * unsubscribe_token directly - there is no API for either) are skipped,
 * exactly like scripts/smoke-auth.mjs's expired-session check, when
 * DATABASE_URL is not set or points at a different database than
 * SMOKE_BASE_URL.
 */
import pg from "pg";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";
const CRON_SECRET = process.env.CRON_SECRET || "test-secret-for-smoke-1234567890";

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

function extractCookiePair(setCookieHeader) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(";")[0];
}

let emailCounter = 0;
function freshEmail() {
  emailCounter += 1;
  return `smoke-notifications-${Date.now()}-${emailCounter}@example.com`;
}

async function bootstrapWorkspace() {
  const res = await fetch(`${BASE_URL}/api/workspace/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return body(res);
}

async function runCron(secret) {
  const res = await fetch(`${BASE_URL}/api/notifications/run`, {
    method: "POST",
    headers: secret === undefined ? {} : { Authorization: `Bearer ${secret}` },
  });
  return { status: res.status, body: await body(res) };
}

async function getCaptured() {
  const res = await fetch(`${BASE_URL}/api/notifications/captured`);
  if (!res.ok) return [];
  const b = await body(res);
  return Array.isArray(b.items) ? b.items : [];
}

const dbUrl = (process.env.DATABASE_URL || "").trim();
const targetIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
const dbIsLocal = /@?(localhost|127\.0\.0\.1)/.test(dbUrl);
const dbUsable = !!dbUrl && targetIsLocal === dbIsLocal;

async function withDb(fn) {
  if (!dbUsable) return undefined;
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`\nNotification digests smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  // --- 0. Account + claimed workspace with an overdue control -------------
  const emailA = freshEmail();
  const passwordA = "correct horse battery staple digest";

  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: passwordA }),
  });
  expect("signup -> 201", signupRes.status, 201);
  const cookieA = extractCookiePair(signupRes.headers.get("set-cookie") || "");

  const ws = await bootstrapWorkspace();
  const claimRes = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: ws.id, workspaceToken: ws.token }),
  });
  expect("claim workspace -> 201", claimRes.status, 201);

  const wsHeaders = { "Content-Type": "application/json", "x-workspace-id": ws.id, "x-workspace-token": ws.token };

  // --- 1. Cron auth: missing / wrong secret --------------------------------
  const noAuth = await runCron(undefined);
  expect("cron run, no Authorization header -> 401", noAuth.status, 401);

  const wrongAuth = await runCron("definitely-the-wrong-secret");
  expect("cron run, wrong secret -> 401", wrongAuth.status, 401);
  (typeof wrongAuth.body?.error === "string" && !wrongAuth.body.error.includes(CRON_SECRET))
    ? ok("wrong-secret error does not reveal the real secret")
    : fail("wrong-secret error does not reveal the real secret", JSON.stringify(wrongAuth.body));

  // --- 2. Nothing outstanding: run sends nothing ---------------------------
  const capturedBeforeAnything = (await getCaptured()).filter((e) => e.to === emailA);
  expect("nothing captured for our user before anything is outstanding", capturedBeforeAnything.length, 0);

  const firstRunNothingOutstanding = await runCron(CRON_SECRET);
  expect("cron run with correct secret -> 200", firstRunNothingOutstanding.status, 200);

  const capturedNothingOutstanding = (await getCaptured()).filter((e) => e.to === emailA);
  expect("no email captured for our user - nothing outstanding", capturedNothingOutstanding.length, 0);

  await withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM notification_log WHERE workspace_id = $1 AND kind = 'digest' ORDER BY sent_at ASC`,
      [ws.id]
    );
    expect("no notification_log rows written when nothing outstanding (a skip is not an attempt)", rows.length, 0);
  });

  // --- 3. Create an overdue control -> outstanding item --------------------
  const pastDue = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const createControlRes = await fetch(`${BASE_URL}/api/workspace/controls`, {
    method: "POST",
    headers: wsHeaders,
    body: JSON.stringify({ name: "Smoke overdue control", objective: "Prove the digest fires", nextTestDue: pastDue }),
  });
  expect("create overdue control -> 201", createControlRes.status, 201);
  const control = await body(createControlRes);
  const controlId = control?.control?.id;
  controlId ? ok("control id present") : fail("control id present", JSON.stringify(control));

  // --- 4. Run: outstanding item -> a digest IS sent -------------------------
  const secondRun = await runCron(CRON_SECRET);
  expect("cron run with an overdue control -> 200", secondRun.status, 200);

  const capturedAfterOutstanding = await getCaptured();
  const ourEmail = capturedAfterOutstanding.find((e) => e.to === emailA);
  ourEmail ? ok("digest email captured for our user") : fail("digest email captured for our user", JSON.stringify(capturedAfterOutstanding.map((e) => e.to)));
  if (ourEmail) {
    ourEmail.subject.includes("1 item") ? ok("subject reflects one outstanding item", ourEmail.subject) : fail("subject reflects one outstanding item", ourEmail.subject);
    ourEmail.html.includes("Smoke overdue control") ? ok("email HTML includes the control's name") : fail("email HTML includes the control's name");
    ourEmail.text.includes("Smoke overdue control") ? ok("email TEXT includes the control's name") : fail("email TEXT includes the control's name");
    ourEmail.html.includes(`controlId=${controlId}`) ? ok("email links to the exact control record") : fail("email links to the exact control record");
    ourEmail.text.toLowerCase().includes("unsubscribe") ? ok("plain-text body carries an unsubscribe mention") : fail("plain-text body carries an unsubscribe mention");
  }

  let logHashAfterFirstSend;
  await withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM notification_log WHERE workspace_id = $1 AND user_id IS NOT NULL AND kind = 'digest' ORDER BY sent_at ASC`,
      [ws.id]
    );
    expect("exactly one notification_log row after the first real send", rows.length, 1);
    expect("logged send has no error", rows[0]?.error, null);
    expect("logged item_count is 1", rows[0]?.item_count, 1);
    logHashAfterFirstSend = rows[0]?.summary_hash;
  });

  // --- 5. Immediate second run: unchanged situation -> nothing sent --------
  const thirdRun = await runCron(CRON_SECRET);
  expect("immediate second cron run -> 200", thirdRun.status, 200);
  const capturedAfterRepeat = (await getCaptured()).filter((e) => e.to === emailA);
  expect("no NEW email captured on an immediate repeat run (hash unchanged)", capturedAfterRepeat.length, 0);
  await withDb(async (client) => {
    const { rows } = await client.query(`SELECT * FROM notification_log WHERE workspace_id = $1 AND kind = 'digest'`, [ws.id]);
    expect("still exactly one notification_log row (the repeat was a skip, not an attempt)", rows.length, 1);
  });

  // --- 6. Changed situation -> a NEW digest is sent -------------------------
  const evenMorePastDue = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const createSecondControlRes = await fetch(`${BASE_URL}/api/workspace/controls`, {
    method: "POST",
    headers: wsHeaders,
    body: JSON.stringify({ name: "Smoke second overdue control", objective: "Prove a changed situation resends", nextTestDue: evenMorePastDue }),
  });
  expect("create a second overdue control -> 201", createSecondControlRes.status, 201);

  const fourthRun = await runCron(CRON_SECRET);
  expect("cron run after the situation changed -> 200", fourthRun.status, 200);
  const capturedAfterChange = (await getCaptured()).filter((e) => e.to === emailA);
  expect("a NEW email is captured once the situation genuinely changed", capturedAfterChange.length, 1);

  await withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM notification_log WHERE workspace_id = $1 AND kind = 'digest' ORDER BY sent_at ASC`,
      [ws.id]
    );
    expect("two notification_log rows now (first send + changed-situation send)", rows.length, 2);
    const latest = rows[rows.length - 1];
    (latest?.summary_hash && latest.summary_hash !== logHashAfterFirstSend)
      ? ok("the new send's summaryHash differs from the first send's")
      : fail("the new send's summaryHash differs from the first send's");
    expect("changed-situation digest has item_count 2", latest?.item_count, 2);
  });

  // --- 7. Category toggles are honoured -------------------------------------
  const patchUnknownCategoryRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: ws.id, categories: { notARealCategory: true } }),
  });
  expect("unknown category key -> 400", patchUnknownCategoryRes.status, 400);

  const badFrequencyRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: ws.id, frequency: "hourly" }),
  });
  expect("invalid frequency -> 400", badFrequencyRes.status, 400);

  const disableControlTestsRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: ws.id, categories: { controlTests: false } }),
  });
  expect("disable controlTests category -> 200", disableControlTestsRes.status, 200);
  const disabledBody = await body(disableControlTestsRes);
  expect("controlTests category now false", disabledBody.categories?.controlTests, false);
  expect("other categories left untouched by the partial patch", disabledBody.categories?.decisions, true);

  const fifthRun = await runCron(CRON_SECRET);
  expect("cron run with the only outstanding category disabled -> 200", fifthRun.status, 200);
  const capturedWithCategoryOff = (await getCaptured()).filter((e) => e.to === emailA);
  expect("no email sent while the only outstanding category is toggled off (nothing left worth sending)", capturedWithCategoryOff.length, 0);
  await withDb(async (client) => {
    const { rows } = await client.query(`SELECT * FROM notification_log WHERE workspace_id = $1 AND kind = 'digest'`, [ws.id]);
    expect("notification_log unchanged at 2 rows (the category-off run was a skip)", rows.length, 2);
  });

  // Re-enable: the underlying items have not changed, so this should ALSO
  // skip (same hash as the last successful send) - proving re-enabling a
  // category does not itself force a resend of unchanged content.
  const reenableRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieA },
    body: JSON.stringify({ workspaceId: ws.id, categories: { controlTests: true } }),
  });
  expect("re-enable controlTests category -> 200", reenableRes.status, 200);

  const sixthRun = await runCron(CRON_SECRET);
  expect("cron run after re-enabling the category -> 200", sixthRun.status, 200);
  const capturedAfterReenable = (await getCaptured()).filter((e) => e.to === emailA);
  expect("re-enabling an unchanged situation still does not resend", capturedAfterReenable.length, 0);

  // --- 8. Unsubscribe: works, idempotent, stops the next run ---------------
  let unsubscribeToken;
  await withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT unsubscribe_token, frequency FROM notification_preferences WHERE workspace_id = $1`,
      [ws.id]
    );
    expect("preference row's frequency is still daily before unsubscribing", rows[0]?.frequency, "daily");
    unsubscribeToken = rows[0]?.unsubscribe_token;
    unsubscribeToken ? ok("unsubscribe token present") : fail("unsubscribe token present");
  });

  const unknownTokenRes = await fetch(`${BASE_URL}/api/notifications/unsubscribe?token=not-a-real-token`);
  expect("unsubscribe with an unknown token -> 200 (never reveals validity)", unknownTokenRes.status, 200);
  const unknownTokenText = await unknownTokenRes.text();
  unknownTokenText.toLowerCase().includes("unsubscribed") ? ok("unknown-token response is the same confirmation page") : fail("unknown-token response is the same confirmation page");

  if (unsubscribeToken) {
    const unsubRes = await fetch(`${BASE_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`);
    expect("unsubscribe with the real token -> 200", unsubRes.status, 200);
    const unsubText = await unsubRes.text();
    unsubText.toLowerCase().includes("unsubscribed") ? ok("real-token response confirms unsubscribed") : fail("real-token response confirms unsubscribed");

    const prefsAfterUnsub = await fetch(`${BASE_URL}/api/notifications/preferences?workspaceId=${ws.id}`, { headers: { Cookie: cookieA } });
    const prefsAfterUnsubBody = await body(prefsAfterUnsub);
    expect("preferences now show frequency 'off'", prefsAfterUnsubBody.frequency, "off");

    // Idempotent repeat.
    const unsubAgainRes = await fetch(`${BASE_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`);
    expect("unsubscribing again -> 200 (idempotent, not an error)", unsubAgainRes.status, 200);

    // A third differing situation, to prove 'off' suppresses even a genuinely new item.
    const thirdControlDue = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await fetch(`${BASE_URL}/api/workspace/controls`, {
      method: "POST",
      headers: wsHeaders,
      body: JSON.stringify({ name: "Smoke third overdue control", objective: "Prove unsubscribe stops sends", nextTestDue: thirdControlDue }),
    });

    const seventhRun = await runCron(CRON_SECRET);
    expect("cron run after unsubscribing -> 200", seventhRun.status, 200);
    const capturedAfterUnsub = (await getCaptured()).filter((e) => e.to === emailA);
    expect("no email sent after unsubscribing, even with a new outstanding item", capturedAfterUnsub.length, 0);
  }

  // --- 9. A workspace with no account members sends nothing -----------------
  const orphanWs = await bootstrapWorkspace();
  const orphanHeaders = { "Content-Type": "application/json", "x-workspace-id": orphanWs.id, "x-workspace-token": orphanWs.token };
  await fetch(`${BASE_URL}/api/workspace/controls`, {
    method: "POST",
    headers: orphanHeaders,
    body: JSON.stringify({ name: "Orphan overdue control", objective: "Nobody to notify", nextTestDue: pastDue }),
  });

  const eighthRun = await runCron(CRON_SECRET);
  expect("cron run covering an unclaimed workspace -> 200", eighthRun.status, 200);
  await withDb(async (client) => {
    const { rows } = await client.query(`SELECT * FROM notification_log WHERE workspace_id = $1`, [orphanWs.id]);
    expect("no notification_log rows for a workspace with no account members", rows.length, 0);
  });

  // --- 10. POST /api/notifications/test previews honestly -------------------
  const testNoSessionRes = await fetch(`${BASE_URL}/api/notifications/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: ws.id }),
  });
  expect("test digest without a session -> 401", testNoSessionRes.status, 401);

  if (!dbUsable) {
    console.log("  (DB-dependent notification_log/unsubscribe_token checks skipped: DATABASE_URL not set or points elsewhere)");
  }

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exitCode = 1;
});
