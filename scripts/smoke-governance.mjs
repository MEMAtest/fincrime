/**
 * Governance Dashboard and Reports smoke test.
 *
 * Proves the portfolio-level roll-up Phase 6 exists for: a brand-new
 * workspace returns a coherent, all-zero portfolio; after seeding exactly
 * one outstanding item of each kind across all six workstreams, the
 * dashboard's counts and items are correct (exact numbers, not just
 * non-zero); cross-tenant isolation on the portfolio endpoint; and the
 * governance pack PDF exports (server-built, requires auth).
 *
 * Usage:
 *   node scripts/smoke-governance.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-governance.mjs
 */
const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3210";
// Three DISTINCT slugs: instantiating the same slug twice in one workspace
// returns the EXISTING row rather than creating a new one (see POST
// /api/workspace/controls), so controlA/B/C would silently collapse into one
// control - and every implemented-not-tested / due-for-testing assertion
// below with it - if they shared a slug.
const LIBRARY_SLUG_A = "customer-identification-verification";
const LIBRARY_SLUG_B = "beneficial-ownership-verification";
const LIBRARY_SLUG_C = "adverse-media-screening";
const ENTITY_TYPE = "corporate";
const JURISDICTION = "uk";

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
const expect = (name, actual, want) => (actual === want ? ok(name, `got ${actual}`) : fail(name, `expected ${want}, got ${JSON.stringify(actual)}`));

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

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function getPortfolio(headers) {
  const res = await fetch(`${BASE_URL}/api/governance/portfolio`, { headers });
  return { status: res.status, data: await body(res) };
}

async function main() {
  console.log(`\nGovernance Dashboard and Reports smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();
  const other = await bootstrap();
  ok("bootstrap two workspaces");

  // --- 1. empty workspace -> coherent empty portfolio ---
  const emptyRes = await getPortfolio(H);
  expect("empty portfolio -> 200", emptyRes.status, 200);
  const ep = emptyRes.data.portfolio;
  expect("empty decisionsRequired", ep?.decisionsRequired?.count, 0);
  expect("empty riskOutsideAppetite.outside", ep?.riskOutsideAppetite?.outside?.count, 0);
  expect("empty riskOutsideAppetite.tolerated", ep?.riskOutsideAppetite?.tolerated?.count, 0);
  expect("empty openConditionsAndBlockers", ep?.openConditionsAndBlockers?.count, 0);
  expect("empty controlChangesInFlight", ep?.controlChangesInFlight?.count, 0);
  expect("empty controlChangesImplementedNotTested", ep?.controlChangesImplementedNotTested?.count, 0);
  expect("empty controlsDueForTesting", ep?.controlsDueForTesting?.count, 0);
  expect("empty failedControlTests", ep?.failedControlTests?.count, 0);
  expect("empty incidents.open", ep?.incidents?.open?.count, 0);
  expect("empty regulatoryCommitments.open", ep?.regulatoryCommitments?.open?.count, 0);
  expect("empty overdueActions", ep?.overdueActions?.count, 0);

  // --- unknown query param -> 400 ---
  const badParam = await fetch(`${BASE_URL}/api/governance/portfolio?bogus=1`, { headers: H });
  expect("unknown query param -> 400", badParam.status, 400);

  // --- supporting fixtures ---
  const person = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, { method: "POST", headers: H, body: JSON.stringify({ name: "Smoke Reviewer", role: "reviewer" }) })
  );
  const personId = person.person?.id;
  if (!personId) return fail("create person", JSON.stringify(person).slice(0, 160));
  ok("create person");

  // --- 2a. PRA assessment: in_review + outside appetite (decisionsRequired + riskOutsideAppetite.outside) ---
  const praOutside = await body(
    await fetch(`${BASE_URL}/api/pra/assessments`, { method: "POST", headers: H, body: JSON.stringify({ productName: "Smoke Product Outside" }) })
  );
  const praOutsideId = praOutside.assessment?.id;
  if (!praOutsideId) return fail("create PRA assessment (outside)", JSON.stringify(praOutside).slice(0, 160));
  const praOutsidePatch = await fetch(`${BASE_URL}/api/pra/assessments/${praOutsideId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "in_review", appetiteResult: "outside" }),
  });
  expect("PRA outside -> in_review + outside appetite -> 200", praOutsidePatch.status, 200);

  // --- 2b. PRA assessment: tolerated appetite only (riskOutsideAppetite.tolerated, NOT decisionsRequired) ---
  const praTolerated = await body(
    await fetch(`${BASE_URL}/api/pra/assessments`, { method: "POST", headers: H, body: JSON.stringify({ productName: "Smoke Product Tolerated" }) })
  );
  const praToleratedId = praTolerated.assessment?.id;
  // status must be a LIVE position (not the default 'draft') for the
  // tolerated appetite result to count at all - riskOutsideAppetite excludes
  // 'draft' (appetite_result can be set mid-journey on an assessment that
  // never gets finished) and 'rejected' (product never launched). 'approved'
  // here (not 'in_review') keeps this row out of decisionsRequired, per the
  // comment above.
  await fetch(`${BASE_URL}/api/pra/assessments/${praToleratedId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ appetiteResult: "tolerated", status: "approved" }),
  });
  ok("PRA tolerated seeded");

  // --- 3. workspace controls: A (failed test), B (implemented change, never tested), C (due soon) ---
  const controlA = await body(await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: H, body: JSON.stringify({ controlSlug: LIBRARY_SLUG_A }) }));
  const controlAId = controlA.control?.id;
  const controlB = await body(await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: H, body: JSON.stringify({ controlSlug: LIBRARY_SLUG_B }) }));
  const controlBId = controlB.control?.id;
  const controlC = await body(await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: H, body: JSON.stringify({ controlSlug: LIBRARY_SLUG_C }) }));
  const controlCId = controlC.control?.id;
  if (!controlAId || !controlBId || !controlCId) return fail("create workspace controls", JSON.stringify({ controlA, controlB, controlC }).slice(0, 200));
  ok("create 3 workspace controls");

  // --- 3a. control_change #1: in_review (decisionsRequired) ---
  const change1 = await body(
    await fetch(`${BASE_URL}/api/control-changes`, { method: "POST", headers: H, body: JSON.stringify({ workspaceControlId: controlAId, title: "Smoke change - in review" }) })
  );
  const change1Id = change1.change?.id;
  await fetch(`${BASE_URL}/api/control-changes/${change1Id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "in_review" }) });
  ok("control change #1 -> in_review");

  // --- 3b. control_change #2: approved, not implemented (controlChangesInFlight) ---
  const change2 = await body(
    await fetch(`${BASE_URL}/api/control-changes`, { method: "POST", headers: H, body: JSON.stringify({ workspaceControlId: controlAId, title: "Smoke change - in flight" }) })
  );
  const change2Id = change2.change?.id;
  await fetch(`${BASE_URL}/api/control-changes/${change2Id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "in_review" }) });
  const decision2 = await fetch(`${BASE_URL}/api/control-changes/${change2Id}/decision`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ outcome: "approve", decidedByPersonId: personId }),
  });
  expect("control change #2 decision approve -> 201", decision2.status, 201);

  // --- 3c. control_change #3: implemented against controlB (never tested) + a condition (controlChangesImplementedNotTested + openConditionsAndBlockers) ---
  const change3 = await body(
    await fetch(`${BASE_URL}/api/control-changes`, { method: "POST", headers: H, body: JSON.stringify({ workspaceControlId: controlBId, title: "Smoke change - implemented" }) })
  );
  const change3Id = change3.change?.id;
  await fetch(`${BASE_URL}/api/control-changes/${change3Id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "in_review" }) });
  const decision3 = await body(
    await fetch(`${BASE_URL}/api/control-changes/${change3Id}/decision`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        outcome: "approve_with_conditions",
        decidedByPersonId: personId,
        conditions: [{ description: "Smoke: complete enhanced monitoring rollout", dueDate: isoDate(30) }],
      }),
    })
  );
  expect("control change #3 decision approve_with_conditions -> conditions recorded", decision3.conditions?.length, 1);
  const implement3 = await fetch(`${BASE_URL}/api/control-changes/${change3Id}/implement`, { method: "POST", headers: H });
  expect("control change #3 implement -> 200", implement3.status, 200);

  // --- 3d. control test on controlA: fail result (failedControlTests) ---
  const test1 = await body(
    await fetch(`${BASE_URL}/api/control-tests`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ workspaceControlId: controlAId, title: "Smoke test - fail", method: "sample", testerPersonId: personId }),
    })
  );
  const test1Id = test1.test?.id;
  await fetch(`${BASE_URL}/api/control-tests/${test1Id}`, { method: "PATCH", headers: H, body: JSON.stringify({ sampleSize: 10, samplesPassed: 3, samplesFailed: 7 }) });
  const complete1 = await body(await fetch(`${BASE_URL}/api/control-tests/${test1Id}/complete`, { method: "POST", headers: H }));
  expect("control test #1 completes with result fail", complete1.test?.result, "fail");
  // Neutralise controlA's own next_test_due (set by completion) far into the
  // future, so it cannot accidentally land in the due-soon window and skew
  // the controlsDueForTesting count this smoke asserts exactly.
  await fetch(`${BASE_URL}/api/workspace/controls/${controlAId}`, { method: "PATCH", headers: H, body: JSON.stringify({ nextTestDue: "2099-01-01" }) });

  // --- 3e. controlC: next_test_due patched directly into the due-soon window (controlsDueForTesting) ---
  const patchDue = await fetch(`${BASE_URL}/api/workspace/controls/${controlCId}`, { method: "PATCH", headers: H, body: JSON.stringify({ nextTestDue: isoDate(10) }) });
  expect("controlC nextTestDue patch -> 200", patchDue.status, 200);

  // --- 4. incident: open, critical, with an overdue action (incidents.open, incidents.pastTarget, overdueActions) ---
  const incident = await body(
    await fetch(`${BASE_URL}/api/incidents`, { method: "POST", headers: H, body: JSON.stringify({ title: "Smoke incident", severity: "critical" }) })
  );
  const incidentId = incident.incident?.id;
  if (!incidentId) return fail("create incident", JSON.stringify(incident).slice(0, 160));
  const incidentAction = await fetch(`${BASE_URL}/api/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "Smoke: root cause analysis", dueDate: "2020-01-01" }),
  });
  expect("incident overdue action -> 201", incidentAction.status, 201);

  // Boundary: an action due exactly TODAY must not count as overdue -
  // listOverdueActions filters `due_date < CURRENT_DATE` (strictly past),
  // not `<=`. This is a DB/SQL predicate (lib/repo/actions.ts), so it can
  // only be proven end-to-end here, not in the pure vitest unit tests.
  const incidentActionToday = await body(
    await fetch(`${BASE_URL}/api/incidents/${incidentId}/actions`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ title: "Smoke: due today, not overdue", dueDate: isoDate(0) }),
    })
  );
  const incidentActionTodayId = incidentActionToday.action?.id;

  // --- 5. readiness assessment: in_review with an unresolved blocker (decisionsRequired + openConditionsAndBlockers) ---
  const readiness = await body(
    await fetch(`${BASE_URL}/api/readiness`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ title: "Smoke readiness", entityType: ENTITY_TYPE, jurisdiction: JURISDICTION }),
    })
  );
  const readinessId = readiness.assessment?.id;
  if (!readinessId) return fail("create readiness assessment", JSON.stringify(readiness).slice(0, 160));
  const genRes = await body(await fetch(`${BASE_URL}/api/readiness/${readinessId}/generate`, { method: "POST", headers: H }));
  expect("readiness obligations generated", genRes.created > 0, true);
  const detail = await body(await fetch(`${BASE_URL}/api/readiness/${readinessId}`, { headers: H }));
  const firstObligationId = detail.obligations?.[0]?.id;
  if (!firstObligationId) return fail("readiness has an obligation to mark as a blocker");
  const blockerPatch = await fetch(`${BASE_URL}/api/readiness/${readinessId}/obligations/${firstObligationId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ blocker: true, gap: "none", dueDate: "2020-01-01" }),
  });
  expect("mark obligation as unresolved blocker -> 200", blockerPatch.status, 200);
  const submitRes = await fetch(`${BASE_URL}/api/readiness/${readinessId}/submit`, { method: "POST", headers: H });
  expect("readiness submit -> in_review -> 200", submitRes.status, 200);

  // --- 6. reg_request: approved (decisionsRequired), a condition (openConditionsAndBlockers),
  //     an overdue commitment, and a due-soon commitment (regulatoryCommitments, overdueActions) ---
  const regRequest = await body(
    await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "Smoke regulatory request", regulator: "FCA" }) })
  );
  const requestId = regRequest.request?.id;
  if (!requestId) return fail("create reg request", JSON.stringify(regRequest).slice(0, 160));
  const question = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions`, { method: "POST", headers: H, body: JSON.stringify({ question: "Smoke question" }) })
  );
  const questionId = question.question?.id;
  await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ response: "Smoke answer", status: "reviewed" }),
  });
  const approveRes = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${requestId}/approve`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        decidedByPersonId: personId,
        conditions: [{ description: "Smoke: deliver remediation evidence", dueDate: isoDate(30) }],
      }),
    })
  );
  expect("reg request approve -> approved status", approveRes.request?.status, "approved");
  expect("reg request approve -> one condition", approveRes.conditions?.length, 1);

  const commitOverdue = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ description: "Smoke overdue commitment", dueDate: "2020-01-01" }),
    })
  );
  expect("overdue commitment created with a tracked action", typeof commitOverdue.commitment?.action_id === "string", true);
  const commitDueSoon = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ description: "Smoke due-soon commitment", dueDate: isoDate(10) }),
    })
  );
  expect("due-soon commitment created", commitDueSoon.commitment?.status, "open");

  // --- assert the whole portfolio in one pass ---
  const seeded = await getPortfolio(H);
  expect("seeded portfolio -> 200", seeded.status, 200);
  const p = seeded.data.portfolio;

  // regRequest is EXCLUDED here: it was approved above (approveRes.request.status
  // === "approved"), and an approved request has already had its decision -
  // its next step is submission, not sign-off - so decisionsRequired (whose
  // caption reads "...waiting on a decision") must not still count it.
  expect("decisionsRequired count", p.decisionsRequired.count, 3); // PRA + change1 + readiness (regRequest is approved, not in_review)
  const decisionSubjects = p.decisionsRequired.items.map((i) => i.subjectType).sort();
  expect("decisionsRequired subject types", decisionSubjects.join(","), ["control_change", "pra_assessment", "readiness_assessment"].sort().join(","));

  expect("riskOutsideAppetite.outside count", p.riskOutsideAppetite.outside.count, 1);
  expect("riskOutsideAppetite.outside item id", p.riskOutsideAppetite.outside.items[0]?.id, praOutsideId);
  expect("riskOutsideAppetite.tolerated count", p.riskOutsideAppetite.tolerated.count, 1);
  expect("riskOutsideAppetite.tolerated item id", p.riskOutsideAppetite.tolerated.items[0]?.id, praToleratedId);

  expect("openConditionsAndBlockers count", p.openConditionsAndBlockers.count, 3); // change3 condition + regRequest condition + readiness blocker
  const openKindCounts = p.openConditionsAndBlockers.items.reduce((acc, i) => ({ ...acc, [i.subjectType]: (acc[i.subjectType] ?? 0) + 1 }), {});
  expect("openConditionsAndBlockers: 2 conditions", openKindCounts.condition, 2);
  expect("openConditionsAndBlockers: 1 readiness_obligation", openKindCounts.readiness_obligation, 1);

  expect("controlChangesInFlight count", p.controlChangesInFlight.count, 1);
  expect("controlChangesInFlight item id", p.controlChangesInFlight.items[0]?.id, change2Id);

  expect("controlChangesImplementedNotTested count", p.controlChangesImplementedNotTested.count, 1);
  expect("controlChangesImplementedNotTested item id", p.controlChangesImplementedNotTested.items[0]?.id, change3Id);

  expect("controlsDueForTesting count", p.controlsDueForTesting.count, 1);
  expect("controlsDueForTesting item id", p.controlsDueForTesting.items[0]?.id, controlCId);
  expect("controlsDueForTesting urgency", p.controlsDueForTesting.items[0]?.urgency, "due_soon");

  expect("failedControlTests count", p.failedControlTests.count, 1);
  expect("failedControlTests item id", p.failedControlTests.items[0]?.id, test1Id);

  expect("incidents.open count", p.incidents.open.count, 1);
  expect("incidents.bySeverity.critical", p.incidents.bySeverity.critical, 1);
  expect("incidents.pastTarget count", p.incidents.pastTarget.count, 1);
  expect("incidents.pastTarget item id", p.incidents.pastTarget.items[0]?.id, incidentId);

  expect("regulatoryCommitments.open count", p.regulatoryCommitments.open.count, 2);
  expect("regulatoryCommitments.overdue count", p.regulatoryCommitments.overdue.count, 1);
  expect("regulatoryCommitments.overdue item id", p.regulatoryCommitments.overdue.items[0]?.id, commitOverdue.commitment.id);
  expect("regulatoryCommitments.dueSoon count", p.regulatoryCommitments.dueSoon.count, 1);
  expect("regulatoryCommitments.dueSoon item id", p.regulatoryCommitments.dueSoon.items[0]?.id, commitDueSoon.commitment.id);
  expect("regulatoryCommitments.dueSoon href points at parent request", p.regulatoryCommitments.dueSoon.items[0]?.href, `/govern/regulatory-response/${requestId}`);

  // --- regression: a commitment on a REJECTED (cancelled) reg_request must
  //     not count as open/overdue, even though its own status stays 'open'
  //     and its due date is in the past - reject() cancels the request but
  //     deliberately does not touch its commitments (they remain an accurate
  //     historical record), so the exclusion must come from the governance
  //     roll-up reading the parent request's status, not from the
  //     commitment's own row. Before the fix, listAllRegCommitments had no
  //     parent-status filter at all, so this would have pushed
  //     regulatoryCommitments.open to 3 and .overdue to 2 here. ---
  const cancelledRequest = await body(
    await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "Smoke request - will be cancelled", regulator: "FCA" }) })
  );
  const cancelledRequestId = cancelledRequest.request?.id;
  if (!cancelledRequestId) return fail("create reg request to cancel", JSON.stringify(cancelledRequest).slice(0, 160));
  const cancelledCommitment = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${cancelledRequestId}/commitments`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ description: "Smoke commitment on a request about to be cancelled", dueDate: "2020-01-01" }),
    })
  );
  expect("commitment-to-be-orphaned created with a tracked action", typeof cancelledCommitment.commitment?.action_id === "string", true);
  const rejectRes = await body(
    await fetch(`${BASE_URL}/api/reg-requests/${cancelledRequestId}/reject`, { method: "POST", headers: H, body: JSON.stringify({ decidedByPersonId: personId }) })
  );
  expect("reg request reject -> cancelled status", rejectRes.request?.status, "cancelled");

  const afterCancel = await getPortfolio(H);
  const pc = afterCancel.data.portfolio;
  expect("regulatoryCommitments.open unchanged after cancelling a request with an open commitment", pc.regulatoryCommitments.open.count, 2);
  expect("regulatoryCommitments.overdue unchanged after cancelling a request with an overdue commitment", pc.regulatoryCommitments.overdue.count, 1);
  const orphanedInOpen = pc.regulatoryCommitments.open.items.some((i) => i.id === cancelledCommitment.commitment?.id);
  expect("cancelled request's commitment absent from open", orphanedInOpen, false);

  expect("overdueActions count", p.overdueActions.count, 2); // incident action + overdue commitment action (NOT the due-today one)
  const overdueSubjectTypes = p.overdueActions.items.map((i) => i.subjectType).sort();
  expect("overdueActions subject types", overdueSubjectTypes.join(","), ["incident", "reg_commitment"].sort().join(","));
  const commitmentOverdueAction = p.overdueActions.items.find((i) => i.subjectType === "reg_commitment");
  expect("overdue reg_commitment action resolves to its parent request", commitmentOverdueAction?.href, `/govern/regulatory-response/${requestId}`);
  const dueTodayIncluded = p.overdueActions.items.some((i) => i.id === incidentActionTodayId);
  expect("action due today is NOT counted as overdue", dueTodayIncluded, false);

  // --- cross-tenant isolation: `other`'s portfolio must remain all-zero ---
  const otherPortfolio = await getPortfolio(other);
  expect("other workspace portfolio -> 200", otherPortfolio.status, 200);
  const op = otherPortfolio.data.portfolio;
  expect("other workspace sees nothing seeded in H", op.decisionsRequired.count, 0);
  expect("other workspace incidents.open", op.incidents.open.count, 0);
  expect("other workspace overdueActions", op.overdueActions.count, 0);

  // --- reports index: the seeded PRA assessment is listed and not yet exportable (still at step 1) ---
  const reports = await body(await fetch(`${BASE_URL}/api/governance/reports`, { headers: H }));
  const praReportRow = reports.records?.find((r) => r.id === praOutsideId);
  praReportRow ? ok("reports index lists the seeded PRA assessment") : fail("reports index lists the seeded PRA assessment");
  expect("seeded PRA assessment not yet exportable", praReportRow?.exportable, false);

  // --- governance pack export: requires auth, builds server-side ---
  const noAuthExport = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module: "governance_pack", assessmentData: {} }),
  });
  expect("governance pack export with no workspace headers -> 401", noAuthExport.status, 401);

  const exportRes = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ module: "governance_pack", assessmentData: {} }),
  });
  expect("governance pack export -> 200", exportRes.status, 200);
  expect("governance pack content-type", exportRes.headers.get("content-type"), "application/pdf");
  const pdfBuffer = Buffer.from(await exportRes.arrayBuffer());
  (pdfBuffer.length > 1000 ? ok : fail)("governance pack PDF has real content", `${pdfBuffer.length} bytes`);
  expect("governance pack PDF magic bytes", pdfBuffer.subarray(0, 4).toString("latin1"), "%PDF");

  // A crafted client payload for `assessmentData` must be ignored, not
  // trusted - the pack is built server-side from the caller's own workspace,
  // so a hostile client cannot forge a governance pack's numbers.
  const forgedExport = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ module: "governance_pack", assessmentData: { portfolio: { decisionsRequired: { count: 999, items: [] } } } }),
  });
  expect("governance pack export ignores a forged client payload -> still 200", forgedExport.status, 200);

  // --- session-mode export: the gap a header-only auth check left behind ---
  // Before this fix, app/api/export/pdf/route.ts only ever accepted the
  // x-workspace-id/x-workspace-token headers (getAuthenticatedWorkspace),
  // so a signed-in user exporting via their session cookie - x-workspace-id
  // but NO token header, exactly what LeadCaptureModal now sends in session
  // mode - got a bare 401 even though every other workspace route already
  // accepted a session. Proves the route now resolves via
  // resolveWorkspaceAuth's session path, and that it resolves to the
  // SESSION's own workspace (claimedWs), never `other` or the unclaimed
  // `orphanWs` below - i.e. exactly the tenant the session's owner sees on
  // the dashboard, not whichever workspace credential happens to be lying
  // around.
  const sessionExportEmail = `smoke-governance-session-${Date.now()}@example.com`;
  const signupForExport = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sessionExportEmail, password: "correct horse battery staple export" }),
  });
  const exportCookie = (signupForExport.headers.get("set-cookie") || "").split(";")[0];
  exportCookie ? ok("session-mode export: signed up a fresh user") : fail("session-mode export: signed up a fresh user");

  const rawWs = await body(
    await fetch(`${BASE_URL}/api/workspace/bootstrap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
  const claimForExport = await fetch(`${BASE_URL}/api/auth/claim-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: exportCookie },
    body: JSON.stringify({ workspaceId: rawWs.id, workspaceToken: rawWs.token }),
  });
  expect("session-mode export: claim workspace -> 201", claimForExport.status, 201);

  // An entirely UNRELATED, still-anonymous workspace - stands in for "a
  // stale anonymous credential left over in this browser's localStorage
  // from before the user signed in." Never claimed by anyone.
  const orphanWs = await body(
    await fetch(`${BASE_URL}/api/workspace/bootstrap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );

  // Exactly what LeadCaptureModal now sends in session mode: the session
  // cookie plus x-workspace-id naming the CLAIMED workspace, and NO token
  // header at all - so there is nothing here for a stale anonymous
  // credential to smuggle through even if the browser also held one.
  const sessionExportRes = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: exportCookie, "x-workspace-id": rawWs.id },
    body: JSON.stringify({ module: "governance_pack", assessmentData: {} }),
  });
  expect("session-mode governance pack export (cookie + x-workspace-id, no token) -> 200", sessionExportRes.status, 200);
  expect("session-mode export content-type", sessionExportRes.headers.get("content-type"), "application/pdf");
  const sessionPdfBuffer = Buffer.from(await sessionExportRes.arrayBuffer());
  expect("session-mode export PDF magic bytes", sessionPdfBuffer.subarray(0, 4).toString("latin1"), "%PDF");

  // Same request but naming the UNRELATED orphan workspace's id while still
  // authenticated by the SAME session - the session holder is not a member
  // of orphanWs, so this must refuse exactly like an unknown/wrong header
  // token would, never silently fall back to serving orphanWs's pack.
  const sessionWrongWorkspaceRes = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: exportCookie, "x-workspace-id": orphanWs.id },
    body: JSON.stringify({ module: "governance_pack", assessmentData: {} }),
  });
  expect("session-mode export naming a workspace the user is NOT a member of -> 401", sessionWrongWorkspaceRes.status, 401);

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
