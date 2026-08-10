/**
 * Entity and Market Readiness smoke test.
 *
 * Proves the go/no-go this module exists for: generating the obligation
 * register from the REAL data/kyc library for a real (entityType,
 * jurisdiction) pair, mapping a control and classifying gaps, and that a
 * launch blocker (blocker = true, gap != 'full') stops both approvals until
 * resolved - approve-global must additionally refuse until approve-local has
 * happened first. Also proves generate is idempotent (a user's mapping/gap
 * work survives a re-generate), cross-tenant isolation, and input validation
 * against the real KYC enums.
 *
 * Usage:
 *   node scripts/smoke-readiness.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-readiness.mjs
 */
const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";
const LIBRARY_SLUG = "customer-identification-verification";

// A real, authored (entityType, jurisdiction) pair from data/kyc/profiles/corporate.ts.
const ENTITY_TYPE = "corporate";
const JURISDICTION = "uk";
const EXPECTED_TITLES = ["Verify legal identity & existence", "Identify & verify beneficial owners"];

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
  console.log(`\nEntity and Market Readiness smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();
  const other = await bootstrap();
  ok("bootstrap two workspaces");

  const ctl = await body(
    await fetch(`${BASE_URL}/api/workspace/controls`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ controlSlug: LIBRARY_SLUG }),
    })
  );
  const controlId = ctl.control?.id;
  if (!controlId) return fail("create workspace control", JSON.stringify(ctl).slice(0, 160));
  ok("create workspace control");

  const foreignCtl = await body(
    await fetch(`${BASE_URL}/api/workspace/controls`, {
      method: "POST",
      headers: other,
      body: JSON.stringify({ controlSlug: LIBRARY_SLUG }),
    })
  );
  const foreignControlId = foreignCtl.control?.id;
  ok("create foreign workspace control", foreignControlId ? "ok" : "MISSING");

  const person = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name: "Smoke Approver", role: "approver" }),
    })
  );
  const personId = person.person?.id;

  const foreignPerson = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, {
      method: "POST",
      headers: other,
      body: JSON.stringify({ name: "Foreign Approver", role: "approver" }),
    })
  );
  const foreignPersonId = foreignPerson.person?.id;

  // --- create assessment for a REAL (entityType, jurisdiction) pair ---
  const createRes = await fetch(`${BASE_URL}/api/readiness`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      title: "Smoke: UK corporate onboarding readiness",
      entityType: ENTITY_TYPE,
      jurisdiction: JURISDICTION,
      riskLevel: "high",
      ownerPersonId: personId,
    }),
  });
  expect("create assessment -> 201", createRes.status, 201);
  const created = await body(createRes);
  const assessmentId = created.assessment?.id;
  if (!assessmentId) return fail("capture assessment id", JSON.stringify(created).slice(0, 160));

  // --- generate the obligation register from the real KYC library ---
  const genRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/generate`, { method: "POST", headers: H });
  expect("generate -> 200", genRes.status, 200);
  const gen = await body(genRes);
  (gen.created > 0 ? ok : fail)("generate produced a realistic obligation count > 0", `created=${gen.created}`);
  expect("generate: existing is 0 on first run", gen.existing, 0);

  const detailRes1 = await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, { headers: H });
  const detail1 = await body(detailRes1);
  const titles1 = (detail1.obligations ?? []).map((o) => o.title);
  const allExpectedPresent = EXPECTED_TITLES.every((t) => titles1.includes(t));
  (allExpectedPresent ? ok : fail)(
    "generated titles match buildRequirements output for this profile",
    JSON.stringify(titles1).slice(0, 200)
  );

  // --- re-generate: idempotent, and a user's edits survive ---
  const firstObligation = detail1.obligations?.[0];
  const mapRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${firstObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ workspaceControlId: controlId, gap: "full", notes: "Covered by existing CIP control" }),
  });
  expect("map control to first obligation -> 200", mapRes.status, 200);

  const regenRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/generate`, { method: "POST", headers: H });
  expect("re-generate -> 200", regenRes.status, 200);
  const regen = await body(regenRes);
  expect("re-generate: created is 0 (idempotent)", regen.created, 0);
  (regen.existing > 0 ? ok : fail)("re-generate: existing > 0", `existing=${regen.existing}`);

  const detailAfterRegen = await body(await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, { headers: H }));
  const survivedObligation = (detailAfterRegen.obligations ?? []).find((o) => o.id === firstObligation.id);
  expect("mapped control survives re-generate", survivedObligation?.workspace_control_id, controlId);
  expect("gap survives re-generate", survivedObligation?.gap, "full");

  // --- mark a second obligation as a launch blocker, gap partial ---
  const secondObligation = detail1.obligations?.[1];
  const blockerRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${secondObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ blocker: true, gap: "partial" }),
  });
  expect("mark second obligation as blocker, gap partial -> 200", blockerRes.status, 200);

  // --- spawn an action against the blocker obligation ---
  const obligationActionRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${secondObligation.id}/action`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "Close beneficial ownership gap", ownerPersonId: personId, priority: "high" }),
  });
  expect("create obligation-scoped action -> 201", obligationActionRes.status, 201);

  // --- submit for review ---
  const submitRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/submit`, { method: "POST", headers: H });
  expect("submit -> 200", submitRes.status, 200);
  const submitted = await body(submitRes);
  expect("status is in_review after submit", submitted.assessment?.status, "in_review");

  // --- approve-local BLOCKED by the unresolved blocker ---
  const blockedLocalRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/approve-local`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId }),
  });
  expect("approve-local with unresolved blocker -> 409", blockedLocalRes.status, 409);
  const blockedLocalBody = await body(blockedLocalRes);
  expect("409 reason is unresolved_blockers", blockedLocalBody.reason, "unresolved_blockers");

  // --- resolve the blocker to gap full ---
  const resolveRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${secondObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ gap: "full", workspaceControlId: controlId }),
  });
  expect("resolve blocker to gap full -> 200", resolveRes.status, 200);

  // --- approve-local now succeeds ---
  const localRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/approve-local`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId, rationale: "Local sign-off, all blockers resolved" }),
  });
  expect("approve-local -> 200", localRes.status, 200);
  const local = await body(localRes);
  expect("status is approved_local", local.assessment?.status, "approved_local");
  (local.decision?.id ? ok : fail)("approve-local recorded a decision");

  // --- approve-global before approve-local, on a FRESH assessment, must 409 ---
  const freshRes = await body(
    await fetch(`${BASE_URL}/api/readiness`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ title: "Smoke: fresh assessment for global-before-local probe", entityType: "trust", jurisdiction: "us" }),
    })
  );
  const freshId = freshRes.assessment?.id;
  await fetch(`${BASE_URL}/api/readiness/${freshId}/generate`, { method: "POST", headers: H });
  const freshSubmit = await fetch(`${BASE_URL}/api/readiness/${freshId}/submit`, { method: "POST", headers: H });
  expect("fresh assessment submit -> 200", freshSubmit.status, 200);
  const globalBeforeLocalRes = await fetch(`${BASE_URL}/api/readiness/${freshId}/approve-global`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId }),
  });
  expect("approve-global before approve-local -> 409", globalBeforeLocalRes.status, 409);
  const globalBeforeLocalBody = await body(globalBeforeLocalRes);
  expect("409 reason is not_locally_approved", globalBeforeLocalBody.reason, "not_locally_approved");

  // --- approve-global on the properly-approved assessment ---
  const globalRes = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/approve-global`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId, rationale: "Global sign-off" }),
  });
  expect("approve-global -> 200", globalRes.status, 200);
  const global = await body(globalRes);
  expect("status is approved_global", global.assessment?.status, "approved_global");

  // --- guards on a historical record ---
  const patchAfterGlobal = await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ summary: "tamper" }),
  });
  expect("PATCH after approve-global -> 409", patchAfterGlobal.status, 409);

  const obligationPatchAfterGlobal = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${firstObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ notes: "tamper" }),
  });
  expect("obligation PATCH after approve-global -> 409", obligationPatchAfterGlobal.status, 409);

  const deleteAfterGlobal = await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, { method: "DELETE", headers: H });
  expect("DELETE after approve-global -> 409", deleteAfterGlobal.status, 409);

  const generateAfterGlobal = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/generate`, { method: "POST", headers: H });
  expect("generate after approve-global -> 409", generateAfterGlobal.status, 409);

  const secondGlobal = await fetch(`${BASE_URL}/api/readiness/${assessmentId}/approve-global`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId }),
  });
  expect("second approve-global -> 409", secondGlobal.status, 409);

  // --- reject path, from a fresh draft, is not blocked by outstanding gaps ---
  const rejectSourceRes = await body(
    await fetch(`${BASE_URL}/api/readiness`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ title: "Smoke: reject path", entityType: "fund", jurisdiction: "sg" }),
    })
  );
  const rejectId = rejectSourceRes.assessment?.id;
  await fetch(`${BASE_URL}/api/readiness/${rejectId}/generate`, { method: "POST", headers: H });
  await fetch(`${BASE_URL}/api/readiness/${rejectId}/submit`, { method: "POST", headers: H });
  const rejectRes = await fetch(`${BASE_URL}/api/readiness/${rejectId}/reject`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId, rationale: "Not ready" }),
  });
  expect("reject -> 200", rejectRes.status, 200);
  const rejected = await body(rejectRes);
  expect("status is rejected", rejected.assessment?.status, "rejected");
  const rejectAgain = await fetch(`${BASE_URL}/api/readiness/${rejectId}/reject`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId }),
  });
  expect("reject a rejected assessment -> 409", rejectAgain.status, 409);

  // --- cross-tenant probes ---
  expect("foreign GET -> 404", (await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, { headers: other })).status, 404);
  expect(
    "foreign PATCH -> 404",
    (
      await fetch(`${BASE_URL}/api/readiness/${assessmentId}`, {
        method: "PATCH",
        headers: other,
        body: JSON.stringify({ summary: "hijack" }),
      })
    ).status,
    404
  );
  expect(
    "foreign generate -> 404",
    (await fetch(`${BASE_URL}/api/readiness/${assessmentId}/generate`, { method: "POST", headers: other })).status,
    404
  );
  expect(
    "foreign obligation PATCH -> 404",
    (
      await fetch(`${BASE_URL}/api/readiness/${assessmentId}/obligations/${firstObligation.id}`, {
        method: "PATCH",
        headers: other,
        body: JSON.stringify({ notes: "hijack" }),
      })
    ).status,
    404
  );

  // --- validation probes ---
  const badEntityType = await fetch(`${BASE_URL}/api/readiness`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", entityType: "shell_company", jurisdiction: "uk" }),
  });
  expect("bad entityType -> 400", badEntityType.status, 400);

  const badJurisdiction = await fetch(`${BASE_URL}/api/readiness`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", entityType: "corporate", jurisdiction: "jp" }),
  });
  expect("bad jurisdiction -> 400", badJurisdiction.status, 400);

  expect("non-uuid path param (assessment) -> 404", (await fetch(`${BASE_URL}/api/readiness/not-a-uuid`, { headers: H })).status, 404);
  expect(
    "non-uuid path param (obligation) -> 404",
    (await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/not-a-uuid`, { method: "PATCH", headers: H, body: "{}" })).status,
    404
  );

  const foreignControlMap = await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/not-a-real-one`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ workspaceControlId: foreignControlId }),
  });
  expect("non-uuid obligation id with a body -> 404", foreignControlMap.status, 404);

  const freshDetail = await body(await fetch(`${BASE_URL}/api/readiness/${freshId}`, { headers: H }));
  const freshObligation = freshDetail.obligations?.[0];

  const badGapRes = await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/${freshObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ gap: "total" }),
  });
  expect("bad gap enum -> 400", badGapRes.status, 400);

  const foreignControlRes = await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/${freshObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ workspaceControlId: foreignControlId }),
  });
  expect("foreign control id -> 400", foreignControlRes.status, 400);

  const foreignOwnerRes = await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/${freshObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ ownerPersonId: foreignPersonId }),
  });
  expect("foreign owner person id -> 400", foreignOwnerRes.status, 400);

  const malformedDateRes = await fetch(`${BASE_URL}/api/readiness/${freshId}/obligations/${freshObligation.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ dueDate: "yesterday" }),
  });
  expect("malformed dueDate -> 400", malformedDateRes.status, 400);

  const foreignProductRes = await fetch(`${BASE_URL}/api/readiness`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", entityType: "corporate", jurisdiction: "uk", productId: "11111111-2222-3333-4444-555555555555" }),
  });
  expect("unknown productId -> 400", foreignProductRes.status, 400);

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
