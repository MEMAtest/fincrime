/**
 * Control Testing lifecycle smoke test.
 *
 * Proves the mechanic that makes assurance defensible: completing a test
 * derives the effectiveness rating from the recorded samples and findings and
 * writes it onto the live control, version bumped and snapshotted, inside one
 * transaction. Also proves the guards (no double complete, no editing a
 * historical record) and cross-tenant isolation.
 *
 * Usage:
 *   node scripts/smoke-control-test.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-control-test.mjs
 *
 * The direct object_versions read is skipped when SMOKE_BASE_URL and
 * DATABASE_URL point at different databases (smoking prod with a local
 * DATABASE_URL would query the wrong database and report false failures).
 */
import pg from "pg";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";
const LIBRARY_SLUG = "customer-identification-verification";

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
const expect = (name, actual, want) => (actual === want ? ok(name, `got ${actual}`) : fail(name, `expected ${want}, got ${actual}`));

const body = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function bootstrap() {
  const res = await fetch(`${BASE_URL}/api/workspace/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const ws = await body(res);
  return { "Content-Type": "application/json", "x-workspace-id": ws.id, "x-workspace-token": ws.token };
}

async function main() {
  console.log(`\nControl Testing smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();
  const other = await bootstrap();
  ok("bootstrap two workspaces");

  const ctlRes = await fetch(`${BASE_URL}/api/workspace/controls`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ controlSlug: LIBRARY_SLUG }),
  });
  const ctl = await body(ctlRes);
  const controlId = ctl.control?.id;
  if (!controlId) return fail("create workspace control", JSON.stringify(ctl).slice(0, 160));
  ok("create workspace control", `version ${ctl.control.version}`);
  const startingVersion = ctl.control.version;

  const person = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name: "Smoke Tester", role: "reviewer" }),
    })
  );

  const testRes = await fetch(`${BASE_URL}/api/control-tests`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      workspaceControlId: controlId,
      title: "Smoke Q3 sample test",
      method: "sample",
      periodStart: "2026-07-01",
      periodEnd: "2026-09-30",
      testerPersonId: person.person?.id,
    }),
  });
  expect("create test -> 201", testRes.status, 201);
  const test = await body(testRes);
  const testId = test.test?.id;
  if (!testId) return fail("capture test id", JSON.stringify(test).slice(0, 160));

  // Validation guards: bad input must be rejected, not silently stored.
  const patch = (payload, headers = H) =>
    fetch(`${BASE_URL}/api/control-tests/${testId}`, { method: "PATCH", headers, body: JSON.stringify(payload) }).then((r) => r.status);
  expect("bad method -> 400", await patch({ method: "telepathy" }), 400);
  expect("negative sample count -> 400", await patch({ samplesPassed: -5 }), 400);
  expect("malformed date -> 400", await patch({ periodEnd: "Q3 2026" }), 400);
  expect("non-uuid tester -> 400", await patch({ testerPersonId: "not-a-uuid" }), 400);

  // Cross-tenant isolation.
  expect("foreign GET -> 404", (await fetch(`${BASE_URL}/api/control-tests/${testId}`, { headers: other })).status, 404);
  expect("foreign PATCH -> 404", await patch({ title: "hijack" }, other), 404);
  expect(
    "foreign complete -> 404",
    (await fetch(`${BASE_URL}/api/control-tests/${testId}/complete`, { method: "POST", headers: other })).status,
    404
  );

  // Record results: 20 samples, 18 pass, 2 fail = 0.90 pass rate, which alone
  // would be "strong". A high severity finding must override that to weak.
  expect("record counts -> 200", await patch({ sampleSize: 20, samplesPassed: 18, samplesFailed: 2, conclusion: "Smoke run" }), 200);

  const findingRes = await fetch(`${BASE_URL}/api/control-tests/${testId}/findings`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      description: "ID document not re-verified on trigger event",
      severity: "high",
      sampleRef: "S-07",
      createAction: true,
      dueDate: "2026-12-01",
    }),
  });
  expect("add high finding with action -> 201", findingRes.status, 201);
  const finding = await body(findingRes);
  finding.finding?.action_id ? ok("finding spawned an action") : fail("finding spawned an action", "action_id missing");

  const completeRes = await fetch(`${BASE_URL}/api/control-tests/${testId}/complete`, { method: "POST", headers: H });
  expect("complete -> 200", completeRes.status, 200);
  const completed = await body(completeRes);

  expect("result is fail (high finding overrides pass rate)", completed.test?.result, "fail");
  expect("applied rating is weak", completed.test?.applied_rating, "weak");
  expect("control effectiveness written back", completed.control?.effectiveness_rating, "weak");
  expect("control version incremented", completed.control?.version, startingVersion + 1);
  completed.control?.next_test_due ? ok("next test due set", completed.control.next_test_due) : fail("next test due set");
  completed.control?.last_tested_at ? ok("last tested at stamped") : fail("last tested at stamped");
  expect("applied_version recorded", completed.test?.applied_version, completed.control?.version);

  // Guards on a historical record.
  expect(
    "second complete -> 409",
    (await fetch(`${BASE_URL}/api/control-tests/${testId}/complete`, { method: "POST", headers: H })).status,
    409
  );
  expect("PATCH after completion -> 409", await patch({ conclusion: "tamper" }), 409);

  // object_versions is append-only and has no API route; read it directly,
  // but only when the DB we can reach is the one the server is using.
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const targetIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL);
  const dbIsLocal = /@?(localhost|127\.0\.0\.1)/.test(databaseUrl);
  if (databaseUrl && targetIsLocal !== dbIsLocal) {
    console.log("  (skipping object_versions DB check: DATABASE_URL points at a different database than SMOKE_BASE_URL)");
  } else if (databaseUrl) {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT version, change_note FROM object_versions
         WHERE subject_type = 'workspace_control' AND subject_id = $1 ORDER BY version DESC LIMIT 1`,
        [controlId]
      );
      rows[0] ? ok("object_versions row exists", `v${rows[0].version}`) : fail("object_versions row exists");
      rows[0]?.change_note?.includes(testId)
        ? ok("change_note references the test id")
        : fail("change_note references the test id", rows[0]?.change_note);
    } finally {
      await client.end();
    }
  } else {
    console.log("  (skipping object_versions DB check: DATABASE_URL not set)");
  }

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
