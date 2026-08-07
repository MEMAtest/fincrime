/**
 * End-to-end smoke test for the Control Change Lab lifecycle, against a
 * short-lived local `next start` server. Uses fetch for every API call; the
 * one exception is a direct read of object_versions (there is no API route
 * for it), using the already-installed `pg` driver and the same
 * DATABASE_URL / .env.local loading as scripts/db-migrate.mjs.
 *
 * Usage:
 *   npm run build
 *   npx next start -p 3210 &
 *   node scripts/smoke-control-change.mjs
 *   kill %1
 *
 * Exits non-zero on any assertion failure.
 */
import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

function loadEnvLocal() {
  const envPath = join(ROOT_DIR, ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    const isQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

async function api(path, options = {}, headers = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // no body
  }
  return { status: response.status, body };
}

async function main() {
  console.log(`Smoke testing Control Change Lab lifecycle against ${BASE_URL}`);

  // 1. Bootstrap a workspace.
  const bootstrap = await api("/api/workspace/bootstrap", { method: "POST", body: JSON.stringify({ name: "Smoke test" }) });
  assert(bootstrap.status === 201, `bootstrap workspace -> 201 (got ${bootstrap.status})`);
  const workspace = bootstrap.body;
  assert(workspace?.id && workspace?.token, "bootstrap returns {id, token}");

  const authHeaders = { "x-workspace-id": workspace.id, "x-workspace-token": workspace.token };

  // 2. Create a workspace control from the library.
  const controlRes = await api(
    "/api/workspace/controls",
    { method: "POST", body: JSON.stringify({ controlSlug: "transaction-monitoring-thresholds", threshold: "GBP 5,000 per 24h" }) },
    authHeaders
  );
  if (controlRes.status !== 201) {
    console.error("Control create failed, trying a fallback custom control:", controlRes.body);
  }
  let control = controlRes.body?.control;
  if (!control) {
    const fallback = await api(
      "/api/workspace/controls",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Smoke test control",
          objective: "Detect suspicious transaction patterns",
          threshold: "GBP 5,000 per 24h",
        }),
      },
      authHeaders
    );
    assert(fallback.status === 201, `fallback custom control create -> 201 (got ${fallback.status})`);
    control = fallback.body?.control;
  } else {
    assert(controlRes.status === 201, `workspace control create -> 201 (got ${controlRes.status})`);
  }
  assert(!!control?.id, "workspace control has an id");
  const baselineThreshold = control.threshold;
  const baselineVersion = control.version;
  console.log(`  control ${control.id}: threshold=${baselineThreshold} version=${baselineVersion}`);

  // 3. Create a control change; baseline should be snapshotted from the control's current values.
  const changeRes = await api(
    "/api/control-changes",
    {
      method: "POST",
      body: JSON.stringify({
        workspaceControlId: control.id,
        title: "Raise monitoring threshold",
        rationale: "False-positive rate too high at current threshold",
        changeType: "threshold",
      }),
    },
    authHeaders
  );
  assert(changeRes.status === 201, `control change create -> 201 (got ${changeRes.status})`);
  const change = changeRes.body?.change;
  assert(!!change?.id, "control change has an id");
  assert(change?.status === "draft", `control change starts as draft (got ${change?.status})`);
  assert(
    change?.baseline?.threshold === baselineThreshold,
    `baseline.threshold snapshotted from control (${change?.baseline?.threshold} === ${baselineThreshold})`
  );

  const proposedThreshold = "GBP 10,000 per 24h";

  // 4. PATCH proposed {threshold} + step.
  const patchRes = await api(
    `/api/control-changes/${change.id}`,
    { method: "PATCH", body: JSON.stringify({ proposed: { threshold: proposedThreshold }, currentStep: 3 }) },
    authHeaders
  );
  assert(patchRes.status === 200, `control change patch -> 200 (got ${patchRes.status})`);
  assert(patchRes.body?.change?.proposed?.threshold === proposedThreshold, "proposed.threshold set via PATCH");
  assert(patchRes.body?.change?.current_step === 3, `current_step advanced to 3 (got ${patchRes.body?.change?.current_step})`);

  // 5. Create a person to approve.
  const personRes = await api(
    "/api/workspace/people",
    { method: "POST", body: JSON.stringify({ name: "Ada Approver", role: "approver" }) },
    authHeaders
  );
  assert(personRes.status === 201, `person create -> 201 (got ${personRes.status})`);
  const person = personRes.body?.person;
  assert(!!person?.id, "person has an id");

  // 6. POST decision approve.
  const decisionRes = await api(
    `/api/control-changes/${change.id}/decision`,
    { method: "POST", body: JSON.stringify({ outcome: "approve", decidedByPersonId: person.id, rationale: "Looks good" }) },
    authHeaders
  );
  assert(decisionRes.status === 201, `decision create -> 201 (got ${decisionRes.status})`);
  assert(decisionRes.body?.change?.status === "approved", `change status -> approved (got ${decisionRes.body?.change?.status})`);

  // 7. POST implement.
  const implementRes = await api(`/api/control-changes/${change.id}/implement`, { method: "POST" }, authHeaders);
  assert(implementRes.status === 200, `implement -> 200 (got ${implementRes.status})`);
  assert(implementRes.body?.change?.status === "implemented", "change status -> implemented");
  assert(!!implementRes.body?.change?.implemented_at, "implemented_at stamped");
  assert(implementRes.body?.control?.threshold === proposedThreshold, "control threshold now equals proposed value");
  assert(
    implementRes.body?.control?.version === baselineVersion + 1,
    `control version incremented (baseline ${baselineVersion} -> ${implementRes.body?.control?.version})`
  );
  const implementedVersion = implementRes.body?.control?.version;

  // 8. GET the workspace control (list route; there is no GET by-id route)
  // and confirm the threshold and version.
  const controlsAfterImplement = await api("/api/workspace/controls", {}, authHeaders);
  assert(controlsAfterImplement.status === 200, `list workspace controls -> 200 (got ${controlsAfterImplement.status})`);
  const controlAfterImplement = (controlsAfterImplement.body?.controls || []).find((c) => c.id === control.id);
  assert(!!controlAfterImplement, "implemented control found in workspace controls list");
  assert(
    controlAfterImplement?.threshold === proposedThreshold,
    `list reflects implemented threshold (got ${controlAfterImplement?.threshold})`
  );
  assert(
    controlAfterImplement?.version === implementedVersion,
    `list reflects implemented version (got ${controlAfterImplement?.version})`
  );

  // object_versions has no API route; read it directly to confirm the apply
  // path snapshotted a version row (mirroring db-migrate.mjs's DB access).
  // Only meaningful when DATABASE_URL is the same database the target server
  // is using: smoking a remote base URL with a local DATABASE_URL would query
  // the wrong database and report false failures.
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
        `SELECT version, change_note FROM object_versions WHERE subject_type = 'workspace_control' AND subject_id = $1 AND version = $2`,
        [control.id, implementedVersion]
      );
      assert(rows.length === 1, `object_versions row exists for version ${implementedVersion}`);
      assert(
        typeof rows[0]?.change_note === "string" && rows[0].change_note.includes(change.id),
        "object_versions change_note references the control change id"
      );
    } finally {
      await client.end();
    }
  } else {
    console.log("  (skipping object_versions DB check: DATABASE_URL not set)");
  }

  // 9. POST rollback.
  const rollbackRes = await api(`/api/control-changes/${change.id}/rollback`, { method: "POST" }, authHeaders);
  assert(rollbackRes.status === 200, `rollback -> 200 (got ${rollbackRes.status})`);
  assert(rollbackRes.body?.change?.status === "rolled_back", "change status -> rolled_back");
  assert(!!rollbackRes.body?.change?.rolled_back_at, "rolled_back_at stamped");
  assert(rollbackRes.body?.control?.threshold === baselineThreshold, "control threshold restored to baseline");
  assert(
    rollbackRes.body?.control?.version === implementedVersion + 1,
    `control version incremented again (implemented ${implementedVersion} -> ${rollbackRes.body?.control?.version})`
  );

  // 10. Re-implement / re-rollback should now 409 (wrong state).
  const doubleRollback = await api(`/api/control-changes/${change.id}/rollback`, { method: "POST" }, authHeaders);
  assert(doubleRollback.status === 409, `rollback again -> 409 (got ${doubleRollback.status})`);

  const implementAfterRollback = await api(`/api/control-changes/${change.id}/implement`, { method: "POST" }, authHeaders);
  assert(implementAfterRollback.status === 409, `implement after rollback -> 409 (got ${implementAfterRollback.status})`);

  console.log("");
  if (failures > 0) {
    console.error(`${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("All smoke assertions passed.");
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
