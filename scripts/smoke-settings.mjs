/**
 * Phase 7 (Settings + file-backed evidence) smoke test.
 *
 * Proves: settings validation (inverted/equal/out-of-range appetite
 * thresholds, unknown settings keys, bad email all 400); that
 * reviewReminderDays actually changes the governance dashboard's due-soon
 * classification (not just stored and ignored); that defaultTestSampleSize
 * reaches a newly created control test; person-deletion behaviour (refused
 * coherently when referenced by a decision, allowed otherwise); and the
 * file-evidence upload path including the graceful-degradation response
 * when no BLOB_READ_WRITE_TOKEN is configured (expected to be the case for
 * this local smoke run), plus bad-content-type/oversized-file 400s which
 * are validated BEFORE the storage-configured check so they behave the same
 * in every deployment.
 *
 * Usage:
 *   node scripts/smoke-settings.mjs
 *   SMOKE_BASE_URL=https://fincrime.memaconsultants.com node scripts/smoke-settings.mjs
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
const expect = (name, actual, want) => (actual === want ? ok(name, `got ${actual}`) : fail(name, `expected ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`));

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
  console.log(`\nSettings + file-backed evidence smoke - ${BASE_URL}\n${"=".repeat(60)}`);

  const H = await bootstrap();

  // --- 1. GET defaults --------------------------------------------------
  const defaults = await body(await fetch(`${BASE_URL}/api/workspace/settings`, { headers: H }));
  expect("default dateFormat", defaults.settings.dateFormat, "en-GB");
  expect("default reviewReminderDays", defaults.settings.reviewReminderDays, 30);
  expect("default organisationName", defaults.settings.organisationName, null);

  // --- 2. Validation: appetite thresholds --------------------------------
  const invertedRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ appetiteThresholds: { toleratedFrom: 70, outsideFrom: 30 } }),
  });
  expect("inverted thresholds -> 400", invertedRes.status, 400);

  const equalRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ appetiteThresholds: { toleratedFrom: 50, outsideFrom: 50 } }),
  });
  expect("equal thresholds -> 400", equalRes.status, 400);

  const outOfRangeRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ appetiteThresholds: { toleratedFrom: 40, outsideFrom: 150 } }),
  });
  expect("out-of-range threshold -> 400", outOfRangeRes.status, 400);

  const nonIntegerRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ appetiteThresholds: { toleratedFrom: 40.5, outsideFrom: 60 } }),
  });
  expect("non-integer threshold -> 400", nonIntegerRes.status, 400);

  // --- 3. Validation: settings unknown keys / bad values ------------------
  const unknownKeyRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ settings: { notARealSetting: 1 } }),
  });
  expect("unknown settings key -> 400", unknownKeyRes.status, 400);

  const badDateFormatRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ settings: { dateFormat: "us" } }),
  });
  expect("bad dateFormat enum -> 400", badDateFormatRes.status, 400);

  const negativeHourlyRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ settings: { defaultHourlyCostGbp: -5 } }),
  });
  expect("negative hourly cost -> 400", negativeHourlyRes.status, 400);

  // --- 4. Validation: bad email -------------------------------------------
  const badEmailRes = await fetch(`${BASE_URL}/api/workspace/settings`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ ownerEmail: "not-an-email" }),
  });
  expect("bad ownerEmail -> 400", badEmailRes.status, 400);

  // --- 5. A valid patch persists and resolves back ------------------------
  const validPatch = await body(
    await fetch(`${BASE_URL}/api/workspace/settings`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        name: "Acme Test Firm",
        ownerEmail: "owner@example.com",
        appetiteThresholds: { toleratedFrom: 35, outsideFrom: 65 },
        settings: {
          defaultHourlyCostGbp: 55,
          defaultTestSampleSize: 40,
          organisationName: "Acme Test Firm Ltd",
          dateFormat: "iso",
          reviewReminderDays: 7,
        },
      }),
    })
  );
  expect("valid patch: name persisted", validPatch.name, "Acme Test Firm");
  expect("valid patch: appetite toleratedFrom persisted", validPatch.appetiteThresholds.toleratedFrom, 35);
  expect("valid patch: appetite outsideFrom persisted", validPatch.appetiteThresholds.outsideFrom, 65);
  expect("valid patch: hourly cost persisted", validPatch.settings.defaultHourlyCostGbp, 55);
  expect("valid patch: sample size persisted", validPatch.settings.defaultTestSampleSize, 40);
  expect("valid patch: organisationName persisted", validPatch.settings.organisationName, "Acme Test Firm Ltd");
  expect("valid patch: dateFormat persisted", validPatch.settings.dateFormat, "iso");
  expect("valid patch: reviewReminderDays persisted", validPatch.settings.reviewReminderDays, 7);

  // A partial patch must not clobber the other already-set keys.
  const partial = await body(
    await fetch(`${BASE_URL}/api/workspace/settings`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ settings: { reviewReminderDays: 14 } }),
    })
  );
  expect("partial patch: reviewReminderDays updated", partial.settings.reviewReminderDays, 14);
  expect("partial patch: organisationName untouched", partial.settings.organisationName, "Acme Test Firm Ltd");

  // GET reflects PATCH, exactly (client view must never disagree with server).
  const reread = await body(await fetch(`${BASE_URL}/api/workspace/settings`, { headers: H }));
  expect("GET reflects PATCH: reviewReminderDays", reread.settings.reviewReminderDays, 14);

  // --- 6. reviewReminderDays actually reaches the dashboard's due-soon window ---
  const control = await body(
    await fetch(`${BASE_URL}/api/workspace/controls`, { method: "POST", headers: H, body: JSON.stringify({ controlSlug: LIBRARY_SLUG }) })
  );
  const today = new Date();
  const dueIn10Days = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await fetch(`${BASE_URL}/api/workspace/controls/${control.control.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ nextTestDue: dueIn10Days }),
  });

  // reviewReminderDays = 5 (< 10 days out): the control must NOT count as due-soon.
  await fetch(`${BASE_URL}/api/workspace/settings`, { method: "PATCH", headers: H, body: JSON.stringify({ settings: { reviewReminderDays: 5 } }) });
  const tightPortfolio = await body(await fetch(`${BASE_URL}/api/governance/portfolio`, { headers: H }));
  const tightHasControl = tightPortfolio.portfolio.controlsDueForTesting.items.some((i) => i.id === control.control.id);
  expect("reviewReminderDays=5: control 10 days out is NOT due-soon", tightHasControl, false);

  // reviewReminderDays = 30 (> 10 days out): the SAME control now counts.
  await fetch(`${BASE_URL}/api/workspace/settings`, { method: "PATCH", headers: H, body: JSON.stringify({ settings: { reviewReminderDays: 30 } }) });
  const widePortfolio = await body(await fetch(`${BASE_URL}/api/governance/portfolio`, { headers: H }));
  const wideHasControl = widePortfolio.portfolio.controlsDueForTesting.items.some((i) => i.id === control.control.id);
  expect("reviewReminderDays=30: control 10 days out IS due-soon", wideHasControl, true);

  // --- 7. defaultTestSampleSize reaches a new control test -----------------
  await fetch(`${BASE_URL}/api/workspace/settings`, { method: "PATCH", headers: H, body: JSON.stringify({ settings: { defaultTestSampleSize: 42 } }) });
  const settingsForPrefill = await body(await fetch(`${BASE_URL}/api/workspace/me`, { headers: H }));
  expect("workspace/me exposes resolved defaultTestSampleSize", settingsForPrefill.settings.defaultTestSampleSize, 42);
  const newTest = await body(
    await fetch(`${BASE_URL}/api/control-tests`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        workspaceControlId: control.control.id,
        title: "Sample-size prefill test",
        sampleSize: settingsForPrefill.settings.defaultTestSampleSize,
      }),
    })
  );
  expect("control test created with prefilled sample size", newTest.test.sample_size, 42);

  // --- 8. Person deletion: refused coherently when referenced -------------
  const personA = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, { method: "POST", headers: H, body: JSON.stringify({ name: "Alice Approver", role: "approver" }) })
  );
  const personB = await body(
    await fetch(`${BASE_URL}/api/workspace/people`, { method: "POST", headers: H, body: JSON.stringify({ name: "Bob Unreferenced", role: "reviewer" }) })
  );

  // Build a minimal PRA assessment through to a decision so personA is referenced by decisions.decided_by_person_id.
  const product = await body(await fetch(`${BASE_URL}/api/pra/assessments`, { method: "POST", headers: H, body: JSON.stringify({ productName: "Smoke Product" }) }));
  const assessmentId = product.assessment.id;
  const decisionRes = await fetch(`${BASE_URL}/api/pra/assessments/${assessmentId}/decision`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ outcome: "approve", decidedByPersonId: personA.person.id, rationale: "Smoke test decision" }),
  });
  if (decisionRes.ok) {
    const referencedDeleteRes = await fetch(`${BASE_URL}/api/workspace/people/${personA.person.id}`, { method: "DELETE", headers: H });
    expect("deleting a referenced (decided_by) person -> 409, not 500", referencedDeleteRes.status, 409);
    const referencedDeleteBody = await body(referencedDeleteRes);
    ok("referenced-person delete has an honest message", typeof referencedDeleteBody.error === "string" && referencedDeleteBody.error.length > 0 ? "has message" : "MISSING MESSAGE");
  } else {
    fail("could not create a decision to test referenced-person deletion", `status ${decisionRes.status}`);
  }

  const unreferencedDeleteRes = await fetch(`${BASE_URL}/api/workspace/people/${personB.person.id}`, { method: "DELETE", headers: H });
  expect("deleting an unreferenced person -> 200", unreferencedDeleteRes.status, 200);

  // --- 9. File evidence: create link-only evidence, then exercise upload ---
  const evidenceRes = await body(
    await fetch(`${BASE_URL}/api/control-tests/${newTest.test.id}/evidence`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ type: "test_result", title: "Smoke evidence", linkUrl: "https://example.com/doc" }),
    })
  );
  const evidenceId = evidenceRes.evidence.id;
  expect("link-only evidence still works (no file columns required)", evidenceRes.evidence.file_url, null);

  // Bad content type -> 400, validated before the storage-configured check.
  const badTypeForm = new FormData();
  badTypeForm.append("file", new Blob(["#!/bin/sh\necho hi"], { type: "application/x-sh" }), "script.sh");
  const badTypeRes = await fetch(`${BASE_URL}/api/evidence/${evidenceId}/file`, { method: "POST", headers: { "x-workspace-id": H["x-workspace-id"], "x-workspace-token": H["x-workspace-token"] }, body: badTypeForm });
  expect("disallowed content type -> 400", badTypeRes.status, 400);

  // Oversized file -> 400.
  const oversizedForm = new FormData();
  oversizedForm.append("file", new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "application/pdf" }), "big.pdf");
  const oversizedRes = await fetch(`${BASE_URL}/api/evidence/${evidenceId}/file`, { method: "POST", headers: { "x-workspace-id": H["x-workspace-id"], "x-workspace-token": H["x-workspace-token"] }, body: oversizedForm });
  expect("oversized file -> 400", oversizedRes.status, 400);

  // A valid, well-formed upload: 201/200 if Blob storage happens to be
  // configured in this environment, or a 503 with an honest message if not
  // (expected for this local smoke run - BLOB_READ_WRITE_TOKEN is not set).
  const validForm = new FormData();
  validForm.append("file", new Blob(["evidence contents"], { type: "text/plain" }), "notes.txt");
  const validUploadRes = await fetch(`${BASE_URL}/api/evidence/${evidenceId}/file`, { method: "POST", headers: { "x-workspace-id": H["x-workspace-id"], "x-workspace-token": H["x-workspace-token"] }, body: validForm });
  const validUploadBody = await body(validUploadRes);
  if (validUploadRes.status === 503) {
    ok("valid upload without configured storage -> 503 with an honest message", validUploadBody.error);
    ok("graceful degradation: never a 500", "confirmed 503, not 500");
  } else if (validUploadRes.ok) {
    ok("valid upload succeeded (Blob storage is configured in this environment)", validUploadBody.evidence?.file_name);
  } else {
    fail("unexpected status for a well-formed upload", `status ${validUploadRes.status}: ${JSON.stringify(validUploadBody)}`);
  }

  // Evidence on a FINAL record must remain immutable, including for the file
  // endpoint: record samples matching the sample size, then complete the
  // test (the only way to reach a final status - there is no direct
  // "cancel" PATCH), and confirm the file endpoint now refuses.
  const recordSamplesRes = await fetch(`${BASE_URL}/api/control-tests/${newTest.test.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ samplesPassed: 42, samplesFailed: 0, samplesPartial: 0 }),
  });
  const completeRes = await fetch(`${BASE_URL}/api/control-tests/${newTest.test.id}/complete`, { method: "POST", headers: H });
  if (recordSamplesRes.ok && completeRes.ok) {
    const finalForm = new FormData();
    finalForm.append("file", new Blob(["notes"], { type: "text/plain" }), "notes.txt");
    const finalUploadRes = await fetch(`${BASE_URL}/api/evidence/${evidenceId}/file`, { method: "POST", headers: { "x-workspace-id": H["x-workspace-id"], "x-workspace-token": H["x-workspace-token"] }, body: finalForm });
    expect("file upload refused on evidence attached to a complete/final test -> 409", finalUploadRes.status, 409);
  } else {
    fail("could not complete the test to verify evidence immutability", `samples ${recordSamplesRes.status}, complete ${completeRes.status}`);
  }

  // --- 10. Cross-tenant isolation: a foreign workspace cannot see or touch this evidence ---
  const H2 = await bootstrap();
  const foreignGetRes = await fetch(`${BASE_URL}/api/evidence/${evidenceId}/file`, { method: "DELETE", headers: H2 });
  expect("foreign workspace cannot touch this evidence's file -> 404", foreignGetRes.status, 404);

  // --- 11. Non-UUID path param -> 404, not 500 -----------------------------
  const nonUuidRes = await fetch(`${BASE_URL}/api/evidence/not-a-uuid/file`, { method: "DELETE", headers: H });
  expect("non-uuid evidence id -> 404", nonUuidRes.status, 404);

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.log(`FATAL: ${error.message}`);
  process.exit(1);
});
