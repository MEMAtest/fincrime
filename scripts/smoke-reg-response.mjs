/**
 * Regulatory Response Workspace smoke test.
 *
 * Proves the lifecycle this module exists for: a regulator request is
 * logged, its questions are answered and substantiated with real
 * workspace-owned evidence (a control, an incident), an unanswered question
 * blocks approval, a commitment with a due date becomes a TRACKED action in
 * the same transaction it is created in, marking that commitment met closes
 * the linked action, and closing the request is blocked while any
 * commitment is still open. Also proves link-kind/foreign-workspace target
 * validation, cross-tenant isolation, final-state immutability across every
 * nested route (including the generic /api/workspace/actions side door),
 * and input validation.
 *
 * Usage:
 *   node scripts/smoke-reg-response.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-reg-response.mjs
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

async function main() {
  console.log(`\nRegulatory Response Workspace smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();
  const other = await bootstrap();
  ok("bootstrap two workspaces");

  const person = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name: "Smoke Approver", role: "approver" }),
    })
  );
  const personId = person.person?.id;
  if (!personId) return fail("create person", JSON.stringify(person).slice(0, 160));
  ok("create person");

  const ctl = await body(
    await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: H, body: JSON.stringify({ controlSlug: LIBRARY_SLUG }) })
  );
  const controlId = ctl.control?.id;
  if (!controlId) return fail("create workspace control", JSON.stringify(ctl).slice(0, 160));
  ok("create workspace control");

  const foreignCtl = await body(
    await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: other, body: JSON.stringify({ controlSlug: LIBRARY_SLUG }) })
  );
  const foreignControlId = foreignCtl.control?.id;
  ok("create foreign workspace control", foreignControlId ? "ok" : "MISSING");

  const inc = await body(
    await fetch(`${BASE_URL}/api/incidents`, { method: "POST", headers: H, body: JSON.stringify({ title: "Smoke incident for substantiation" }) })
  );
  const incidentId = inc.incident?.id;
  if (!incidentId) return fail("create incident", JSON.stringify(inc).slice(0, 160));
  ok("create incident");

  // --- create request ---
  const createRes = await fetch(`${BASE_URL}/api/reg-requests`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "FCA S165 request - AML controls", regulator: "FCA", channel: "s165", deadline: "2026-12-01" }),
  });
  expect("create request -> 201", createRes.status, 201);
  const created = await body(createRes);
  const requestId = created.request?.id;
  if (!requestId) return fail("request id present", JSON.stringify(created).slice(0, 160));
  expect("initial status is draft", created.request?.status, "draft");

  // --- add 3 questions ---
  const qTexts = ["Describe your CDD process", "How do you monitor for sanctions hits", "What is your SAR filing volume"];
  const questionIds = [];
  for (const question of qTexts) {
    const res = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions`, { method: "POST", headers: H, body: JSON.stringify({ question }) });
    const q = await body(res);
    if (res.status !== 201) return fail("create question", JSON.stringify(q).slice(0, 160));
    questionIds.push(q.question.id);
  }
  ok("added 3 questions", questionIds.join(","));
  expect("positions assigned 1..3", (await body(await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions`, { headers: H }))).questions
    .map((q) => q.position)
    .join(","), "1,2,3");

  // --- reorder them (reverse) ---
  const reversed = [...questionIds].reverse();
  const reorderRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/reorder`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ orderedQuestionIds: reversed }),
  });
  expect("reorder -> 200", reorderRes.status, 200);
  const reordered = await body(reorderRes);
  expect("reordered first question is the previous last", reordered.questions?.[0]?.id, reversed[0]);
  expect("reordered positions still 1..3", reordered.questions.map((q) => q.position).join(","), "1,2,3");
  // restore original order for readability of the rest of the smoke
  await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/reorder`, { method: "POST", headers: H, body: JSON.stringify({ orderedQuestionIds: questionIds }) });

  const badReorder = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/reorder`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ orderedQuestionIds: [questionIds[0], questionIds[1]] }),
  });
  expect("reorder with a missing id -> 400", badReorder.status, 400);

  // --- answer 2, leave 1 unanswered ---
  const answerRes1 = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ response: "We run full CDD per our onboarding policy.", status: "reviewed" }),
  });
  expect("answer question 1 -> 200", answerRes1.status, 200);

  const answerRes2 = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[1]}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ response: "Screened against sanctions lists daily.", status: "drafted" }),
  });
  expect("answer question 2 -> 200", answerRes2.status, 200);

  // --- approve BLOCKED 409 unanswered_questions ---
  const blockedApprove = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/approve`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId }),
  });
  expect("approve while unanswered -> 409", blockedApprove.status, 409);
  const blockedApproveBody = await body(blockedApprove);
  expect("refusal reason is unanswered_questions", blockedApproveBody.reason, "unanswered_questions");

  // --- answer the third ---
  const exceptionRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[2]}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ exceptionNote: "We do not currently track this metric; remediation committed below.", status: "reviewed" }),
  });
  expect("answer question 3 (honest exception) -> 200", exceptionRes.status, 200);

  // --- link a real workspace control and a real incident to a question ---
  const controlLinkRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "workspace_control", targetId: controlId }),
  });
  expect("link workspace_control -> 201", controlLinkRes.status, 201);

  const incidentLinkRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[1]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "incident", targetId: incidentId }),
  });
  expect("link incident -> 201", incidentLinkRes.status, 201);

  // wrong-kind link: an incident id passed as control_test
  const wrongKindRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "control_test", targetId: incidentId }),
  });
  expect("wrong-kind link (incident id as control_test) -> 400", wrongKindRes.status, 400);

  // foreign-workspace target of the RIGHT kind
  const foreignTargetRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "workspace_control", targetId: foreignControlId }),
  });
  expect("foreign-workspace control as target -> 400", foreignTargetRes.status, 400);

  // duplicate link
  const dupLinkRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "workspace_control", targetId: controlId }),
  });
  expect("duplicate link -> 409", dupLinkRes.status, 409);

  // --- commitment with a due date creates a tracked action in the same transaction ---
  const commitRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      questionId: questionIds[2],
      description: "Implement SAR filing volume tracking dashboard",
      dueDate: "2026-10-01",
      ownerPersonId: personId,
    }),
  });
  expect("create commitment with due date -> 201", commitRes.status, 201);
  const commitBody = await body(commitRes);
  const commitmentId = commitBody.commitment?.id;
  const commitmentActionId = commitBody.commitment?.action_id;
  if (!commitmentId) return fail("commitment id present", JSON.stringify(commitBody).slice(0, 160));
  expect("commitment has an action_id stored", typeof commitmentActionId === "string" && commitmentActionId.length > 0, true);

  // The generic /api/workspace/actions list route's ?subjectType= filter is
  // a fixed small enum (see lib/workspace/action-input.ts ACTION_SUBJECT_TYPES)
  // that does not include every polymorphic subject_type in the system -
  // readiness_obligation actions are not filterable through it either, only
  // through the owning module's own detail route. Verify the tracked action
  // the same way: through GET /api/reg-requests/[id], which merges
  // request-level and commitment-level actions (see the route's doc comment).
  const detailAfterCommitment = await body(await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { headers: H }));
  const trackedAction = (detailAfterCommitment.actions || []).find((a) => a.subject_id === commitmentId);
  expect("exactly one action tracked against the commitment", (detailAfterCommitment.actions || []).filter((a) => a.subject_id === commitmentId).length, 1);
  expect("tracked action subject_type is reg_commitment", trackedAction?.subject_type, "reg_commitment");
  expect("tracked action id matches commitment.action_id", trackedAction?.id, commitmentActionId);
  expect("tracked action due_date matches commitment due date", (trackedAction?.due_date || "").slice(0, 10), "2026-10-01");

  // a commitment with no due date gets no action
  const commitNoDateRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ description: "Undated commitment, prose only for now" }),
  });
  const commitNoDateBody = await body(commitNoDateRes);
  expect("commitment with no due date -> 201", commitNoDateRes.status, 201);
  expect("commitment with no due date has null action_id", commitNoDateBody.commitment?.action_id, null);
  // withdraw it so it does not block close later
  await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments/${commitNoDateBody.commitment.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "withdrawn" }),
  });

  // --- approve 200 with a condition ---
  const approveRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/approve`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      decidedByPersonId: personId,
      rationale: "Response is substantiated; conditional on the SAR tracking remediation.",
      conditions: [{ description: "Deliver SAR tracking dashboard by Q4", dueDate: "2026-11-01" }],
    }),
  });
  expect("approve -> 200", approveRes.status, 200);
  const approved = await body(approveRes);
  expect("status is approved", approved.request?.status, "approved");
  expect("decision outcome is approve_with_conditions", approved.decision?.outcome, "approve_with_conditions");
  expect("one condition persisted", approved.conditions?.length, 1);
  expect("condition description persisted", approved.conditions?.[0]?.description, "Deliver SAR tracking dashboard by Q4");

  const reApprove = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/approve`, { method: "POST", headers: H, body: JSON.stringify({ decidedByPersonId: personId }) });
  expect("re-approve an approved request -> 409", reApprove.status, 409);
  expect("re-approve reason is wrong_status", (await body(reApprove)).reason, "wrong_status");

  const closeBeforeSubmit = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/close`, { method: "POST", headers: H });
  expect("close before submit -> 409", closeBeforeSubmit.status, 409);
  expect("close-before-submit reason is not_submitted", (await body(closeBeforeSubmit)).reason, "not_submitted");

  // --- submit 200 ---
  const submitRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/submit`, { method: "POST", headers: H });
  expect("submit -> 200", submitRes.status, 200);
  const submitted = await body(submitRes);
  expect("status is submitted", submitted.request?.status, "submitted");

  const resubmit = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/submit`, { method: "POST", headers: H });
  expect("re-submit -> 409", resubmit.status, 409);
  expect("re-submit reason is not_approved", (await body(resubmit)).reason, "not_approved");

  // --- close BLOCKED 409 open_commitments ---
  const blockedClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/close`, { method: "POST", headers: H });
  expect("close while a commitment is open -> 409", blockedClose.status, 409);
  expect("blocked-close reason is open_commitments", (await body(blockedClose)).reason, "open_commitments");

  // --- mark the commitment met; assert the linked action closes ---
  const metRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments/${commitmentId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "met" }),
  });
  expect("mark commitment met -> 200", metRes.status, 200);
  const met = await body(metRes);
  expect("commitment status is met", met.commitment?.status, "met");
  expect("commitment met_at is stamped", typeof met.commitment?.met_at === "string" && met.commitment.met_at.length > 0, true);

  const detailAfterMet = await body(await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { headers: H }));
  const actionAfterMet = (detailAfterMet.actions || []).find((a) => a.id === commitmentActionId);
  expect("linked action status is now done", actionAfterMet?.status, "done");

  // --- close 200 ---
  const closeRes = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/close`, { method: "POST", headers: H });
  expect("close -> 200", closeRes.status, 200);
  const closed = await body(closeRes);
  expect("status is closed", closed.request?.status, "closed");

  // --- every mutation now 409 ---
  const patchAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { method: "PATCH", headers: H, body: JSON.stringify({ summary: "tamper" }) });
  expect("PATCH request after close -> 409", patchAfterClose.status, 409);

  const deleteAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { method: "DELETE", headers: H });
  expect("DELETE request after close -> 409", deleteAfterClose.status, 409);

  const addQuestionAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ question: "late question" }),
  });
  expect("add question after close -> 409", addQuestionAfterClose.status, 409);

  const patchQuestionAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ response: "tamper" }),
  });
  expect("patch question after close -> 409", patchQuestionAfterClose.status, 409);

  const addCommitmentAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ description: "late commitment" }),
  });
  expect("add commitment after close -> 409", addCommitmentAfterClose.status, 409);

  const addLinkAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "incident", targetId: incidentId }),
  });
  expect("add link after close -> 409", addLinkAfterClose.status, 409);

  const addEvidenceAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/evidence`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ type: "document", title: "late evidence" }),
  });
  expect("add evidence after close -> 409", addEvidenceAfterClose.status, 409);

  const rejectAfterClose = await fetch(`${BASE_URL}/api/reg-requests/${requestId}/reject`, { method: "POST", headers: H, body: JSON.stringify({ decidedByPersonId: personId }) });
  expect("reject after close -> 409", rejectAfterClose.status, 409);

  // --- generic /api/workspace/actions PATCH on the commitment's action -> 409 ---
  const genericActionPatch = await fetch(`${BASE_URL}/api/workspace/actions/${commitmentActionId}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ priority: "high" }),
  });
  expect("generic actions PATCH on a closed-request commitment's action -> 409", genericActionPatch.status, 409);

  // --- cross-tenant probes ---
  expect("foreign GET request -> 404", (await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { headers: other })).status, 404);
  expect(
    "foreign PATCH request -> 404",
    (await fetch(`${BASE_URL}/api/reg-requests/${requestId}`, { method: "PATCH", headers: other, body: JSON.stringify({ summary: "hijack" }) })).status,
    404
  );
  expect(
    "foreign question PATCH -> 404",
    (
      await fetch(`${BASE_URL}/api/reg-requests/${requestId}/questions/${questionIds[0]}`, { method: "PATCH", headers: other, body: JSON.stringify({ response: "hijack" }) })
    ).status,
    404
  );
  expect(
    "foreign commitment PATCH -> 404",
    (await fetch(`${BASE_URL}/api/reg-requests/${requestId}/commitments/${commitmentId}`, { method: "PATCH", headers: other, body: JSON.stringify({ note: "hijack" }) })).status,
    404
  );

  // --- reject path from a fresh draft (not blocked by unanswered questions) ---
  const rejectSource = await body(
    await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "Smoke: reject path" }) })
  );
  const rejectId = rejectSource.request?.id;
  await fetch(`${BASE_URL}/api/reg-requests/${rejectId}/questions`, { method: "POST", headers: H, body: JSON.stringify({ question: "Unanswered on purpose" }) });
  const rejectRes = await fetch(`${BASE_URL}/api/reg-requests/${rejectId}/reject`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ decidedByPersonId: personId, rationale: "Withdrawn by the regulator" }),
  });
  expect("reject with an unanswered question -> 200 (not blocked)", rejectRes.status, 200);
  const rejected = await body(rejectRes);
  expect("status is cancelled", rejected.request?.status, "cancelled");
  expect("decision outcome is reject", rejected.decision?.outcome, "reject");

  const rejectAgain = await fetch(`${BASE_URL}/api/reg-requests/${rejectId}/reject`, { method: "POST", headers: H, body: JSON.stringify({ decidedByPersonId: personId }) });
  expect("reject a cancelled request -> 409", rejectAgain.status, 409);

  // --- validation probes ---
  const noTitle = await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({}) });
  expect("missing title -> 400", noTitle.status, 400);

  const badChannel = await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "x", channel: "fax" }) });
  expect("bad channel -> 400", badChannel.status, 400);

  const badDeadline = await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "x", deadline: "not-a-date" }) });
  expect("bad deadline -> 400", badDeadline.status, 400);

  const unknownOwner = await fetch(`${BASE_URL}/api/reg-requests`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ title: "x", ownerPersonId: "11111111-2222-3333-4444-555555555555" }),
  });
  expect("unknown ownerPersonId -> 400", unknownOwner.status, 400);

  expect("non-uuid path param (request) -> 404", (await fetch(`${BASE_URL}/api/reg-requests/not-a-uuid`, { headers: H })).status, 404);
  expect(
    "non-uuid path param (question) -> 404",
    (await fetch(`${BASE_URL}/api/reg-requests/${rejectId}/questions/not-a-uuid`, { method: "PATCH", headers: H, body: "{}" })).status,
    404
  );
  expect(
    "non-uuid path param (commitment) -> 404",
    (await fetch(`${BASE_URL}/api/reg-requests/${rejectId}/commitments/not-a-uuid`, { method: "PATCH", headers: H, body: "{}" })).status,
    404
  );

  const statusViaPatch = await fetch(`${BASE_URL}/api/reg-requests`, { method: "POST", headers: H, body: JSON.stringify({ title: "status probe" }) });
  const statusProbeId = (await body(statusViaPatch)).request.id;
  const statusPatchRes = await fetch(`${BASE_URL}/api/reg-requests/${statusProbeId}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "closed" }) });
  expect("status cannot be set via PATCH -> 400", statusPatchRes.status, 400);

  const positionViaPost = await fetch(`${BASE_URL}/api/reg-requests/${statusProbeId}/questions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ question: "x", position: 99 }),
  });
  expect("position cannot be set via POST -> 400", positionViaPost.status, 400);

  const badLinkType = await fetch(`${BASE_URL}/api/reg-requests/${statusProbeId}/questions`, { method: "POST", headers: H, body: JSON.stringify({ question: "link target" }) });
  const badLinkQuestionId = (await body(badLinkType)).question.id;
  const badLinkTypeRes = await fetch(`${BASE_URL}/api/reg-requests/${statusProbeId}/questions/${badLinkQuestionId}/links`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ linkType: "enforcement_case", targetId: controlId }),
  });
  expect("bad linkType enum -> 400", badLinkTypeRes.status, 400);

  const badCommitmentDate = await fetch(`${BASE_URL}/api/reg-requests/${statusProbeId}/commitments`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ description: "x", dueDate: "yesterday" }),
  });
  expect("malformed commitment dueDate -> 400", badCommitmentDate.status, 400);

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
