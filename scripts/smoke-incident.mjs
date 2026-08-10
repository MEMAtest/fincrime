/**
 * Incident and Assurance Workspace smoke test.
 *
 * Proves the traceability chain this module exists for: an incident can be
 * linked to a failed control and the control test that surfaced it, gets a
 * remediation action, and can only be closed once that action is done AND a
 * root cause is recorded - closing over an open remediation or with no root
 * cause must 409, not silently succeed. Also proves cross-tenant isolation
 * and input validation.
 *
 * Usage:
 *   node scripts/smoke-incident.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-incident.mjs
 *
 * Direct-DB assertions are skipped when SMOKE_BASE_URL and DATABASE_URL
 * point at different databases, mirroring scripts/smoke-control-test.mjs.
 */
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
  console.log(`\nIncident and Assurance Workspace smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();
  const other = await bootstrap();
  ok("bootstrap two workspaces");

  // Supporting fixtures: a live control, a control test against it, and a
  // person to own things.
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
      body: JSON.stringify({ name: "Smoke Owner", role: "owner" }),
    })
  );
  const personId = person.person?.id;

  const foreignPerson = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, {
      method: "POST",
      headers: other,
      body: JSON.stringify({ name: "Foreign Owner", role: "owner" }),
    })
  );
  const foreignPersonId = foreignPerson.person?.id;

  const test = await body(
    await fetch(`${BASE_URL}/api/control-tests`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ workspaceControlId: controlId, title: "Smoke test for incident linkage" }),
    })
  );
  const testId = test.test?.id;
  ok("create control test", testId ? "ok" : "MISSING");

  // --- create incident ---
  const createRes = await fetch(`${BASE_URL}/api/incidents`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      title: "Smoke incident: sanctions alert not actioned",
      source: "internal_detection",
      severity: "high",
      detectedAt: "2026-07-01T09:00:00.000Z",
      ownerPersonId: personId,
    }),
  });
  expect("create incident -> 201", createRes.status, 201);
  const created = await body(createRes);
  const incidentId = created.incident?.id;
  if (!incidentId) return fail("capture incident id", JSON.stringify(created).slice(0, 160));

  // --- patch containment and affected population ---
  const patch = (payload, headers = H, id = incidentId) =>
    fetch(`${BASE_URL}/api/incidents/${id}`, { method: "PATCH", headers, body: JSON.stringify(payload) }).then(async (r) => ({
      status: r.status,
      body: await body(r),
    }));

  const containRes = await patch({
    status: "contained",
    containment: "Alert queue paused pending review",
    containedAt: "2026-07-01T12:00:00.000Z",
    affectedPopulation: { customersAffected: 3, transactionsAffected: 5, valueGbp: 12000, identificationMethod: "manual review" },
  });
  expect("patch containment + affected population -> 200", containRes.status, 200);
  expect("affectedPopulation.customersAffected persisted", containRes.body.incident?.affected_population?.customersAffected, 3);

  // --- link a failed control and a control test ---
  const linkControlRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "failed_control", targetId: controlId, note: "Root cause candidate" }),
  });
  expect("link failed_control -> 201", linkControlRes.status, 201);

  const linkTestRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "control_test", targetId: testId }),
  });
  expect("link control_test -> 201", linkTestRes.status, 201);

  const dupLinkRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "control_test", targetId: testId }),
  });
  expect("duplicate link -> 409", dupLinkRes.status, 409);

  // --- same targetId, differing targetRef: targetRef is meaningless for a
  // workspace-owned linkType (keyed by targetId), and the unique index keys
  // on COALESCE(target_ref, ''), so a caller supplying an arbitrary,
  // unvalidated targetRef alongside the same targetId used to slip past the
  // duplicate check entirely (three POSTs, three distinct index keys, three
  // 201s). Both a first-time and a repeat POST with a stray targetRef must
  // be rejected outright now, rather than being allowed to create - or
  // recreate - a link the duplicate index can't see as a duplicate.
  const wrongAxisLinkRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "failed_control", targetId: controlId, targetRef: "anything" }),
  });
  expect("failed_control link with targetId AND a stray targetRef -> 400", wrongAxisLinkRes.status, 400);

  const wrongAxisLinkRes2 = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "failed_control", targetId: controlId, targetRef: "anything2" }),
  });
  expect("failed_control link with the same targetId and a DIFFERING stray targetRef -> 400", wrongAxisLinkRes2.status, 400);

  const enforcementWrongAxisRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "enforcement_case", targetRef: "national-westminster-bank-plc-2021", targetId: controlId }),
  });
  expect("enforcement_case link with a stray targetId -> 400 (mirror case)", enforcementWrongAxisRes.status, 400);

  const foreignTargetLinkRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "failed_control", targetId: foreignControlId }),
  });
  expect("link to a foreign workspace's control -> 400", foreignTargetLinkRes.status, 400);

  const neitherTargetLinkRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "failed_control" }),
  });
  expect("link with neither targetId nor targetRef -> 400", neitherTargetLinkRes.status, 400);

  const detailRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}`, { headers: H });
  const detail = await body(detailRes);
  expect("detail: two links resolved", (detail.links ?? []).length, 2);
  const resolvedLabels = (detail.links ?? []).map((l) => l.label).filter(Boolean);
  resolvedLabels.length === 2 ? ok("both links carry a resolved label") : fail("both links carry a resolved label", JSON.stringify(resolvedLabels));

  // --- add a remediation action ---
  const actionRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "Retrain alert triage team", ownerPersonId: personId, priority: "high" }),
  });
  expect("add remediation action -> 201", actionRes.status, 201);
  const action = await body(actionRes);
  const actionId = action.action?.id;

  // --- attempt close: open action must block ---
  const closeBlockedByAction = await fetch(`${BASE_URL}/api/incidents/${incidentId}/close`, { method: "POST", headers: H });
  expect("close with open action -> 409", closeBlockedByAction.status, 409);

  // --- complete the action, but root cause still missing ---
  await fetch(`${BASE_URL}/api/workspace/actions/${actionId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "done" }),
  });

  const closeBlockedByRootCause = await fetch(`${BASE_URL}/api/incidents/${incidentId}/close`, { method: "POST", headers: H });
  expect("close with no root cause -> 409", closeBlockedByRootCause.status, 409);

  // --- set root cause, close ---
  const rootCauseRes = await patch({ rootCause: "Alert triage staff not trained on new sanctions list format", rootCauseCategory: "human_error" });
  expect("set root cause -> 200", rootCauseRes.status, 200);

  const closeRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/close`, { method: "POST", headers: H });
  expect("close -> 200", closeRes.status, 200);
  const closed = await body(closeRes);
  expect("status is closed", closed.incident?.status, "closed");
  closed.incident?.closed_at ? ok("closed_at stamped") : fail("closed_at stamped");

  // --- guards on a historical record ---
  const secondClose = await fetch(`${BASE_URL}/api/incidents/${incidentId}/close`, { method: "POST", headers: H });
  expect("second close -> 409", secondClose.status, 409);
  const patchAfterClose = await patch({ summary: "tamper" });
  expect("PATCH after close -> 409", patchAfterClose.status, 409);
  const deleteAfterClose = await fetch(`${BASE_URL}/api/incidents/${incidentId}`, { method: "DELETE", headers: H });
  expect("DELETE after close -> 409", deleteAfterClose.status, 409);
  const linkAfterClose = await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "enforcement_case", targetRef: "national-westminster-bank-plc-2021" }),
  });
  expect("add link after close -> 409", linkAfterClose.status, 409);

  // --- generic actions route must also refuse to touch a closed incident's
  // remediation action: the incident-scoped routes above all guard on
  // isFinalIncidentStatus, but /api/workspace/actions/[id] resolves an
  // action by id+workspace only and previously had no visibility into the
  // parent incident's status, letting a "done" action on a closed incident
  // be reopened or deleted straight through - falsifying the closed
  // incident's own audit trail (which says it was closed because this
  // action was complete).
  const reopenActionAfterClose = await fetch(`${BASE_URL}/api/workspace/actions/${actionId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "open" }),
  });
  expect("PATCH a closed incident's action back to open -> 409", reopenActionAfterClose.status, 409);

  const deleteActionAfterClose = await fetch(`${BASE_URL}/api/workspace/actions/${actionId}`, {
    method: "DELETE",
    headers: H,
  });
  expect("DELETE a closed incident's action -> 409", deleteActionAfterClose.status, 409);

  // --- reopen ---
  const reopenRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/reopen`, { method: "POST", headers: H });
  expect("reopen -> 200", reopenRes.status, 200);
  const reopened = await body(reopenRes);
  expect("status is investigating after reopen", reopened.incident?.status, "investigating");

  const secondReopen = await fetch(`${BASE_URL}/api/incidents/${incidentId}/reopen`, { method: "POST", headers: H });
  expect("second reopen -> 409", secondReopen.status, 409);

  // --- cross-tenant probes ---
  expect("foreign GET -> 404", (await fetch(`${BASE_URL}/api/incidents/${incidentId}`, { headers: other })).status, 404);
  expect("foreign PATCH -> 404", (await patch({ summary: "hijack" }, other)).status, 404);
  expect(
    "foreign close -> 404",
    (await fetch(`${BASE_URL}/api/incidents/${incidentId}/close`, { method: "POST", headers: other })).status,
    404
  );
  expect(
    "foreign link create -> 404",
    (
      await fetch(`${BASE_URL}/api/incidents/${incidentId}/links`, {
        method: "POST",
        headers: other,
        body: JSON.stringify({ linkType: "failed_control", targetId: controlId }),
      })
    ).status,
    404
  );

  // --- validation probes ---
  const badSeverity = await fetch(`${BASE_URL}/api/incidents`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", severity: "catastrophic" }),
  });
  expect("bad severity enum -> 400", badSeverity.status, 400);

  const badSource = await fetch(`${BASE_URL}/api/incidents`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", source: "gossip" }),
  });
  expect("bad source enum -> 400", badSource.status, 400);

  const badRootCauseCategory = await patch({ rootCauseCategory: "bad_luck" });
  expect("bad root_cause_category enum -> 400", badRootCauseCategory.status, 400);

  expect("non-uuid path param -> 404", (await fetch(`${BASE_URL}/api/incidents/not-a-uuid`, { headers: H })).status, 404);

  const malformedDate = await fetch(`${BASE_URL}/api/incidents`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", detectedAt: "yesterday" }),
  });
  expect("malformed date -> 400", malformedDate.status, 400);

  const foreignOwner = await fetch(`${BASE_URL}/api/incidents`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", ownerPersonId: foreignPersonId }),
  });
  expect("foreign ownerPersonId -> 400", foreignOwner.status, 400);

  // --- occurredAt/detectedAt cross-field check: must 400, and must NOT
  // wedge the incident for later, unrelated PATCHes (the original bug: the
  // string-vs-Date comparison was always false, so a bad row saved with 200,
  // and then - once both stored sides were Dates - the same broken
  // comparison flipped to "always true" and 400'd every later PATCH,
  // including currentStep, freezing the journey stepper).
  const occurredAfterDetected = await patch({
    occurredAt: "2026-05-01T00:00:00.000Z",
    detectedAt: "2026-02-01T00:00:00.000Z",
  });
  expect("occurredAt after detectedAt -> 400", occurredAfterDetected.status, 400);
  const unrelatedPatchAfterRejectedDates = await patch({ currentStep: 3 });
  expect("unrelated PATCH after the rejected date PATCH still 200", unrelatedPatchAfterRejectedDates.status, 200);

  // --- hostile timestamp/date inputs that new Date() alone accepts but a
  // real calendar/clock does not; these must 400, not 500 from Postgres. ---
  for (const containedAt of ["2026", "0", "5", "2026-02-30"]) {
    const res = await patch({ containedAt });
    expect(`containedAt "${containedAt}" -> 400`, res.status, 400);
  }

  const evidenceDateRes = await fetch(`${BASE_URL}/api/incidents/${incidentId}/evidence`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ type: "note", title: "x", evidenceDate: "2026" }),
  });
  expect('evidenceDate "2026" -> 400', evidenceDateRes.status, 400);

  // --- reportable/reportedAt/regulatorReference coherence: a report cannot
  // be dated or referenced for something recorded as not reportable. ---
  const incoherentReportable = await patch({
    reportable: false,
    reportedAt: "2026-02-02",
    regulatorReference: "FCA-1",
  });
  expect("reportable:false with reportedAt/regulatorReference set -> 400", incoherentReportable.status, 400);

  const reportableTrue = await patch({ reportable: true, reportedAt: "2026-02-02", regulatorReference: "FCA-1" });
  expect("reportable:true with reportedAt/regulatorReference -> 200", reportableTrue.status, 200);
  const clearedOnTransition = await patch({ reportable: false });
  expect("reportable transitions to false -> 200", clearedOnTransition.status, 200);
  expect(
    "reportedAt nulled server-side on the transition",
    clearedOnTransition.body.incident?.reported_at,
    null
  );
  expect(
    "regulatorReference nulled server-side on the transition",
    clearedOnTransition.body.incident?.regulator_reference,
    null
  );

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
