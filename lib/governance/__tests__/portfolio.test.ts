import { describe, expect, it } from "vitest";
import { buildGovernancePortfolio, emptyGovernancePortfolio, hrefForSubject, type BuildPortfolioInput } from "../portfolio";
import type { AssessmentRow } from "../../repo/assessments";
import type { ControlChangeRow } from "../../repo/control-changes";
import type { ControlTestRow } from "../../repo/control-tests";
import type { WorkspaceControlRow } from "../../repo/controls";
import type { IncidentRow } from "../../repo/incidents";
import type { ReadinessAssessmentRow, OpenReadinessBlockerRow } from "../../repo/readiness";
import type { RegRequestRow, RegCommitmentRow } from "../../repo/reg-requests";
import type { ConditionRow, DecisionRow } from "../../repo/decisions";
import type { ActionRow } from "../../repo/actions";

const TODAY = new Date("2026-08-10T00:00:00.000Z");
const WS = "ws-1";

function emptyInput(): BuildPortfolioInput {
  return {
    today: TODAY,
    assessments: [],
    productNameById: new Map(),
    controlChanges: [],
    controlTests: [],
    workspaceControls: [],
    incidents: [],
    readinessAssessments: [],
    openReadinessBlockers: [],
    regRequests: [],
    regCommitments: [],
    openConditions: [],
    decisionById: new Map(),
    overdueActions: [],
  };
}

function assessment(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: "assess-1",
    workspace_id: WS,
    product_id: "product-1",
    status: "draft",
    recommendation: null,
    residual_summary: {},
    appetite_result: null,
    current_step: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function controlChange(overrides: Partial<ControlChangeRow> = {}): ControlChangeRow {
  return {
    id: "change-1",
    workspace_id: WS,
    workspace_control_id: "control-1",
    title: "Raise threshold",
    rationale: null,
    change_type: "threshold",
    status: "draft",
    current_step: 1,
    baseline: {},
    proposed: {},
    supporting_data: {},
    impact: {},
    pilot: false,
    pilot_notes: null,
    monitoring: {},
    rollback_criteria: null,
    implemented_at: null,
    rolled_back_at: null,
    applied_version: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function controlTest(overrides: Partial<ControlTestRow> = {}): ControlTestRow {
  return {
    id: "test-1",
    workspace_id: WS,
    workspace_control_id: "control-1",
    title: "Q3 sample test",
    method: "sample",
    period_start: null,
    period_end: null,
    tester_person_id: null,
    sample_size: 20,
    samples_passed: 15,
    samples_failed: 5,
    samples_partial: 0,
    status: "complete",
    result: "fail",
    conclusion: null,
    applied_rating: "weak",
    applied_version: 2,
    tested_at: "2026-08-01T00:00:00.000Z",
    next_test_due: "2026-11-01",
    current_step: 4,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function workspaceControl(overrides: Partial<WorkspaceControlRow> = {}): WorkspaceControlRow {
  return {
    id: "control-1",
    workspace_id: WS,
    objective: "Detect X",
    control_slug: null,
    name: "Transaction Monitoring Rule",
    category: null,
    typology_slugs: [],
    product_applicability: [],
    version: 1,
    owner_person_id: null,
    approver_person_id: null,
    systems: [],
    data_inputs: [],
    threshold: null,
    operating_frequency: null,
    status: "implemented",
    effectiveness_rating: "adequate",
    last_tested_at: null,
    next_test_due: null,
    monitoring_metrics: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function incident(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "incident-1",
    workspace_id: WS,
    reference: null,
    title: "Suspicious transaction pattern",
    source: "internal_detection",
    severity: "high",
    status: "investigating",
    occurred_at: null,
    detected_at: null,
    contained_at: null,
    closed_at: null,
    summary: null,
    containment: null,
    affected_population: {},
    root_cause: null,
    root_cause_category: null,
    reportable: false,
    reported_at: null,
    regulator_reference: null,
    owner_person_id: null,
    current_step: 1,
    closure_summary: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function readinessAssessment(overrides: Partial<ReadinessAssessmentRow> = {}): ReadinessAssessmentRow {
  return {
    id: "readiness-1",
    workspace_id: WS,
    title: "EMI launch - Germany",
    entity_type: "emi",
    jurisdiction: "de",
    risk_level: "medium",
    product_id: null,
    product_note: null,
    status: "in_review",
    current_step: 2,
    target_launch_date: "2026-09-01",
    owner_person_id: null,
    summary: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function readinessBlocker(overrides: Partial<OpenReadinessBlockerRow> = {}): OpenReadinessBlockerRow {
  return {
    id: "obligation-1",
    workspace_id: WS,
    assessment_id: "readiness-1",
    assessment_title: "EMI launch - Germany",
    requirement_key: "emi-de-cdd",
    category: "cdd",
    title: "Enhanced due diligence for PEPs",
    rule_summary: null,
    legal_basis: [],
    applies_at_risk: [],
    workspace_control_id: null,
    control_note: null,
    gap: "none",
    blocker: true,
    owner_person_id: null,
    due_date: "2026-08-05",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function regRequest(overrides: Partial<RegRequestRow> = {}): RegRequestRow {
  return {
    id: "request-1",
    workspace_id: WS,
    reference: "FCA-2026-01",
    title: "S165 information request",
    regulator: "FCA",
    channel: "s165",
    received_at: null,
    deadline: "2026-09-15",
    status: "in_review",
    submitted_at: null,
    owner_person_id: null,
    summary: null,
    current_step: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function regCommitment(overrides: Partial<RegCommitmentRow> = {}): RegCommitmentRow {
  return {
    id: "commitment-1",
    workspace_id: WS,
    request_id: "request-1",
    question_id: null,
    description: "Deliver SAR tracking dashboard",
    due_date: "2026-08-01",
    owner_person_id: null,
    status: "open",
    action_id: null,
    met_at: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function condition(overrides: Partial<ConditionRow> = {}): ConditionRow {
  return {
    id: "condition-1",
    workspace_id: WS,
    decision_id: "decision-1",
    description: "Complete enhanced monitoring rollout",
    due_date: "2026-08-02",
    status: "open",
    owner_person_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "decision-1",
    workspace_id: WS,
    subject_type: "pra_assessment",
    subject_id: "assess-1",
    outcome: "approve_with_conditions",
    rationale: null,
    decided_by_person_id: "person-1",
    decided_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function action(overrides: Partial<ActionRow> = {}): ActionRow {
  return {
    id: "action-1",
    workspace_id: WS,
    subject_type: "incident",
    subject_id: "incident-1",
    title: "Complete root cause analysis",
    owner_person_id: null,
    due_date: "2026-08-01",
    status: "open",
    priority: "high",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("emptyGovernancePortfolio", () => {
  it("returns a coherent all-zero snapshot", () => {
    const empty = emptyGovernancePortfolio(TODAY);
    expect(empty.asOf).toBe("2026-08-10");
    expect(empty.decisionsRequired).toEqual({ count: 0, items: [] });
    expect(empty.riskOutsideAppetite.outside).toEqual({ count: 0, items: [] });
    expect(empty.incidents.bySeverity).toEqual({ low: 0, medium: 0, high: 0, critical: 0 });
  });

  it("matches buildGovernancePortfolio given entirely empty input", () => {
    const built = buildGovernancePortfolio(emptyInput());
    expect(built).toEqual(emptyGovernancePortfolio(TODAY));
  });
});

describe("buildGovernancePortfolio - decisions required", () => {
  it("counts an in_review item from each of the four workstreams, and nothing else", () => {
    const input = emptyInput();
    input.assessments = [assessment({ status: "in_review" }), assessment({ id: "assess-2", status: "draft" })];
    input.controlChanges = [controlChange({ status: "in_review" }), controlChange({ id: "change-2", status: "approved" })];
    input.readinessAssessments = [readinessAssessment({ status: "in_review" }), readinessAssessment({ id: "readiness-2", status: "draft" })];
    input.regRequests = [
      regRequest({ status: "in_review" }),
      regRequest({ id: "request-2", status: "approved" }),
      regRequest({ id: "request-3", status: "submitted" }),
    ];

    const result = buildGovernancePortfolio(input);
    expect(result.decisionsRequired.count).toBe(4); // 1 PRA + 1 change + 1 readiness + 1 reg (in_review only)
    const ids = result.decisionsRequired.items.map((i) => i.id).sort();
    expect(ids).toEqual(["assess-1", "change-1", "readiness-1", "request-1"].sort());
  });

  // Regression for defect #6: an approved reg_request has already had its
  // decision (approveResponse) - its next step is submission, not sign-off -
  // so it must not still count as "waiting on a decision", the section's own
  // on-screen caption. Before the fix this assertion would read 5, not 4.
  it("regression: excludes an approved reg_request even though its status used to be counted", () => {
    const input = emptyInput();
    input.regRequests = [regRequest({ id: "req-approved", status: "approved" }), regRequest({ id: "req-review", status: "in_review" })];
    const result = buildGovernancePortfolio(input);
    expect(result.decisionsRequired.count).toBe(1);
    expect(result.decisionsRequired.items[0].id).toBe("req-review");
  });
});

describe("buildGovernancePortfolio - risk outside appetite", () => {
  it("separates outside from tolerated for a live (approved) assessment", () => {
    const input = emptyInput();
    input.assessments = [
      assessment({ id: "a-outside", appetite_result: "outside", status: "approved" }),
      assessment({ id: "a-tolerated", appetite_result: "tolerated", status: "approved" }),
      assessment({ id: "a-within", appetite_result: "within", status: "approved" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.riskOutsideAppetite.outside.count).toBe(1);
    expect(result.riskOutsideAppetite.outside.items[0].id).toBe("a-outside");
    expect(result.riskOutsideAppetite.outside.items[0].urgency).toBe("critical");
    expect(result.riskOutsideAppetite.tolerated.count).toBe(1);
    expect(result.riskOutsideAppetite.tolerated.items[0].urgency).toBe("high");
  });

  it("counts an in_review or conditions_applied assessment as a live position too", () => {
    const input = emptyInput();
    input.assessments = [
      assessment({ id: "a-review", appetite_result: "outside", status: "in_review" }),
      assessment({ id: "a-conditions", appetite_result: "outside", status: "conditions_applied" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.riskOutsideAppetite.outside.count).toBe(2);
  });

  // Regression for defect #3: an assessment carries appetite_result the
  // moment a user reaches step 6, so 'draft' can sit half-finished
  // indefinitely with appetite_result set; 'rejected' means the product was
  // never launched. Neither is a live risk position. Before the fix, all
  // three of these (draft, rejected, approved) counted, reading 3 instead
  // of 1.
  it("regression: excludes draft and rejected assessments even though appetite_result is set outside", () => {
    const input = emptyInput();
    input.assessments = [
      assessment({ id: "a-draft", appetite_result: "outside", status: "draft" }),
      assessment({ id: "a-rejected", appetite_result: "outside", status: "rejected" }),
      assessment({ id: "a-live", appetite_result: "outside", status: "approved" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.riskOutsideAppetite.outside.count).toBe(1);
    expect(result.riskOutsideAppetite.outside.items[0].id).toBe("a-live");
  });
});

describe("buildGovernancePortfolio - open conditions and readiness blockers", () => {
  it("combines conditions and unresolved blockers into one section, resolving hrefs via the decision's subject", () => {
    const input = emptyInput();
    input.openConditions = [condition()];
    input.decisionById = new Map([["decision-1", decision({ subject_type: "pra_assessment", subject_id: "assess-1" })]]);
    input.openReadinessBlockers = [readinessBlocker()];

    const result = buildGovernancePortfolio(input);
    expect(result.openConditionsAndBlockers.count).toBe(2);
    const conditionItem = result.openConditionsAndBlockers.items.find((i) => i.subjectType === "condition");
    expect(conditionItem?.href).toBe("/assess/product-risk/assess-1");
    const blockerItem = result.openConditionsAndBlockers.items.find((i) => i.subjectType === "readiness_obligation");
    expect(blockerItem?.href).toBe("/assure/market-readiness/readiness-1");
    expect(blockerItem?.label).toContain("Enhanced due diligence for PEPs");
  });

  it("does not surface a condition whose decision cannot be resolved as a broken link", () => {
    const input = emptyInput();
    input.openConditions = [condition()];
    input.decisionById = new Map(); // decision missing
    const result = buildGovernancePortfolio(input);
    expect(result.openConditionsAndBlockers.items[0].href).toBeNull();
  });
});

describe("buildGovernancePortfolio - control changes", () => {
  it("counts approved-but-not-implemented as in flight", () => {
    const input = emptyInput();
    input.controlChanges = [controlChange({ status: "approved" }), controlChange({ id: "change-2", status: "draft" })];
    const result = buildGovernancePortfolio(input);
    expect(result.controlChangesInFlight.count).toBe(1);
    expect(result.controlChangesInFlight.items[0].id).toBe("change-1");
  });

  it("counts implemented with no test since implementation as implemented-not-tested", () => {
    const input = emptyInput();
    input.workspaceControls = [workspaceControl({ id: "control-1", last_tested_at: "2026-01-01T00:00:00.000Z" })];
    input.controlChanges = [
      controlChange({ id: "change-tested", status: "implemented", implemented_at: "2025-06-01T00:00:00.000Z", workspace_control_id: "control-1" }),
      controlChange({ id: "change-untested", status: "implemented", implemented_at: "2026-06-01T00:00:00.000Z", workspace_control_id: "control-1" }),
      controlChange({ id: "change-never-tested", status: "implemented", implemented_at: "2026-06-01T00:00:00.000Z", workspace_control_id: "control-2" }),
    ];
    const result = buildGovernancePortfolio(input);
    const ids = result.controlChangesImplementedNotTested.items.map((i) => i.id).sort();
    // change-tested: implemented before the control's last test -> tested since, excluded.
    // change-untested: implemented after the control's last test -> not yet retested, included.
    // change-never-tested: control-2 has no last_tested_at at all -> included.
    expect(ids).toEqual(["change-never-tested", "change-untested"]);
  });

  // Regression for defect #1: last_tested_at and implemented_at are both
  // TIMESTAMPTZ. Flooring both to UTC midnight before comparing (the old
  // toEpochMs-for-everything behaviour) makes a same-day morning-test then
  // afternoon-implementation compare as simultaneous - lastTestedMs <
  // implementedMs is false either way - so the change reads as already
  // retested. A morning test followed by an afternoon implementation is an
  // ordinary Tuesday and must still count as implemented-not-tested. Before
  // the fix this section's count would read 0 here, not 1.
  it("regression: a same-day morning test then afternoon implementation still counts as implemented-not-tested", () => {
    const input = emptyInput();
    input.workspaceControls = [workspaceControl({ id: "control-1", last_tested_at: "2026-08-10T09:00:00.000Z" })];
    input.controlChanges = [
      controlChange({ id: "change-same-day", status: "implemented", implemented_at: "2026-08-10T15:00:00.000Z", workspace_control_id: "control-1" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.controlChangesImplementedNotTested.count).toBe(1);
    expect(result.controlChangesImplementedNotTested.items[0].id).toBe("change-same-day");
  });

  // Regression for defect #8: implemented_at should never happen to be NULL
  // on an 'implemented' row via the normal implement() path, but if it is (a
  // data-entry gap), the change must still be counted - with a null due date
  // - rather than silently dropped from the section, which would hide the
  // gap instead of surfacing it.
  it("counts an implemented change with a null implemented_at instead of dropping it", () => {
    const input = emptyInput();
    input.controlChanges = [controlChange({ id: "change-no-timestamp", status: "implemented", implemented_at: null })];
    const result = buildGovernancePortfolio(input);
    expect(result.controlChangesImplementedNotTested.count).toBe(1);
    expect(result.controlChangesImplementedNotTested.items[0].id).toBe("change-no-timestamp");
    expect(result.controlChangesImplementedNotTested.items[0].dueDate).toBeNull();
  });
});

describe("buildGovernancePortfolio - controls due for testing", () => {
  it("classes a past-due control as overdue and a soon-due one as due_soon, ignoring one far out", () => {
    const input = emptyInput();
    input.workspaceControls = [
      workspaceControl({ id: "c-overdue", next_test_due: "2026-08-01" }),
      workspaceControl({ id: "c-soon", next_test_due: "2026-08-20" }),
      workspaceControl({ id: "c-later", next_test_due: "2027-01-01" }),
      workspaceControl({ id: "c-none", next_test_due: null }),
    ];
    const result = buildGovernancePortfolio(input);
    const byId = new Map(result.controlsDueForTesting.items.map((i) => [i.id, i]));
    expect(byId.get("c-overdue")?.urgency).toBe("overdue");
    expect(byId.get("c-soon")?.urgency).toBe("due_soon");
    expect(byId.has("c-later")).toBe(false);
    expect(byId.has("c-none")).toBe(false);
    expect(result.controlsDueForTesting.count).toBe(2);
  });

  // Boundary tests, all against TODAY = 2026-08-10 and the module's real
  // 30-day due-soon window: today-1 is overdue, today is due_soon (the
  // window is inclusive of today), today+30 is still due_soon (the window's
  // exact upper edge), and today+31 is excluded entirely (info, outside the
  // window and not overdue). These lock in behaviour the runtime already
  // gets right but that nothing previously asserted - the same shape of gap
  // that let defect #1 (also boundary/date arithmetic) ship unnoticed.
  it("boundary: today-1 overdue, today due_soon, today+30 due_soon, today+31 excluded", () => {
    const input = emptyInput();
    input.workspaceControls = [
      workspaceControl({ id: "c-yesterday", next_test_due: "2026-08-09" }), // today - 1
      workspaceControl({ id: "c-today", next_test_due: "2026-08-10" }), // today
      workspaceControl({ id: "c-plus30", next_test_due: "2026-09-09" }), // today + 30
      workspaceControl({ id: "c-plus31", next_test_due: "2026-09-10" }), // today + 31
    ];
    const result = buildGovernancePortfolio(input);
    const byId = new Map(result.controlsDueForTesting.items.map((i) => [i.id, i]));
    expect(byId.get("c-yesterday")?.urgency).toBe("overdue");
    expect(byId.get("c-today")?.urgency).toBe("due_soon");
    expect(byId.get("c-plus30")?.urgency).toBe("due_soon");
    expect(byId.has("c-plus31")).toBe(false);
    expect(result.controlsDueForTesting.count).toBe(3);
  });
});

describe("buildGovernancePortfolio - regulatory commitments boundary", () => {
  it("boundary: today-1 overdue, today due_soon, today+30 due_soon, today+31 excluded from both overdue and due-soon (but still open)", () => {
    const input = emptyInput();
    input.regRequests = [regRequest()];
    input.regCommitments = [
      regCommitment({ id: "rc-yesterday", due_date: "2026-08-09", status: "open" }),
      regCommitment({ id: "rc-today", due_date: "2026-08-10", status: "open" }),
      regCommitment({ id: "rc-plus30", due_date: "2026-09-09", status: "open" }),
      regCommitment({ id: "rc-plus31", due_date: "2026-09-10", status: "open" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.regulatoryCommitments.overdue.items.map((i) => i.id)).toEqual(["rc-yesterday"]);
    expect(result.regulatoryCommitments.dueSoon.items.map((i) => i.id).sort()).toEqual(["rc-plus30", "rc-today"]);
    expect(result.regulatoryCommitments.open.count).toBe(4);
  });
});

describe("buildGovernancePortfolio - conditions and blockers boundary (0-day window)", () => {
  it("boundary: a condition due today is due_soon, not overdue - only strictly past today is overdue", () => {
    const input = emptyInput();
    input.openConditions = [condition({ id: "cond-today", due_date: "2026-08-10" }), condition({ id: "cond-yesterday", due_date: "2026-08-09" })];
    const result = buildGovernancePortfolio(input);
    const byId = new Map(result.openConditionsAndBlockers.items.map((i) => [i.id, i]));
    expect(byId.get("cond-today")?.urgency).toBe("due_soon");
    expect(byId.get("cond-yesterday")?.urgency).toBe("overdue");
  });
});

describe("buildGovernancePortfolio - failed control tests", () => {
  it("counts only tests with result = fail", () => {
    const input = emptyInput();
    input.controlTests = [controlTest({ result: "fail" }), controlTest({ id: "test-2", result: "pass" }), controlTest({ id: "test-3", result: "pass_with_findings" })];
    const result = buildGovernancePortfolio(input);
    expect(result.failedControlTests.count).toBe(1);
    expect(result.failedControlTests.items[0].id).toBe("test-1");
  });

  it("excludes a fail result on a test that is not actually complete (status still in_progress)", () => {
    const input = emptyInput();
    input.controlTests = [controlTest({ id: "test-planned", result: "fail", status: "in_progress" })];
    const result = buildGovernancePortfolio(input);
    expect(result.failedControlTests.count).toBe(0);
  });

  // Regression for defect #7: a control that failed in January and passed a
  // retest in June must clear from this section, not show Critical forever.
  // "Latest test per control" (by tested_at) is what determines whether a
  // fail has been superseded.
  it("regression: a failed test is superseded once a later test on the same control completes, even a passing one", () => {
    const input = emptyInput();
    input.controlTests = [
      controlTest({ id: "test-jan-fail", workspace_control_id: "control-1", result: "fail", tested_at: "2026-01-15T00:00:00.000Z" }),
      controlTest({ id: "test-jun-pass", workspace_control_id: "control-1", result: "pass", tested_at: "2026-06-01T00:00:00.000Z" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.failedControlTests.count).toBe(0);
  });

  it("still shows a fail on a different control while another control's fail has been superseded", () => {
    const input = emptyInput();
    input.controlTests = [
      controlTest({ id: "test-jan-fail", workspace_control_id: "control-1", result: "fail", tested_at: "2026-01-15T00:00:00.000Z" }),
      controlTest({ id: "test-jun-pass", workspace_control_id: "control-1", result: "pass", tested_at: "2026-06-01T00:00:00.000Z" }),
      controlTest({ id: "test-still-failing", workspace_control_id: "control-2", result: "fail", tested_at: "2026-07-01T00:00:00.000Z" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.failedControlTests.count).toBe(1);
    expect(result.failedControlTests.items[0].id).toBe("test-still-failing");
  });
});

describe("buildGovernancePortfolio - incidents", () => {
  it("rolls up by severity and status, and flags an open incident with an overdue action as past target", () => {
    const input = emptyInput();
    input.incidents = [
      incident({ id: "inc-open-overdue", severity: "critical", status: "investigating" }),
      incident({ id: "inc-open-ontrack", severity: "medium", status: "contained" }),
      incident({ id: "inc-closed", severity: "low", status: "closed" }),
    ];
    input.overdueActions = [action({ subject_type: "incident", subject_id: "inc-open-overdue" })];

    const result = buildGovernancePortfolio(input);
    expect(result.incidents.bySeverity).toEqual({ low: 1, medium: 1, high: 0, critical: 1 });
    expect(result.incidents.byStatus.investigating).toBe(1);
    expect(result.incidents.byStatus.closed).toBe(1);
    expect(result.incidents.open.count).toBe(2); // closed excluded
    expect(result.incidents.pastTarget.count).toBe(1);
    expect(result.incidents.pastTarget.items[0].id).toBe("inc-open-overdue");
  });
});

describe("buildGovernancePortfolio - regulatory commitments", () => {
  it("splits open commitments into overdue and due-soon subsets, excluding terminal ones", () => {
    const input = emptyInput();
    input.regRequests = [regRequest()];
    input.regCommitments = [
      regCommitment({ id: "c-overdue", due_date: "2026-08-01", status: "open" }),
      regCommitment({ id: "c-soon", due_date: "2026-08-25", status: "in_progress" }),
      regCommitment({ id: "c-later", due_date: "2027-01-01", status: "open" }),
      regCommitment({ id: "c-met", due_date: "2026-08-01", status: "met" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.regulatoryCommitments.open.count).toBe(3); // c-met excluded (terminal)
    expect(result.regulatoryCommitments.overdue.items.map((i) => i.id)).toEqual(["c-overdue"]);
    expect(result.regulatoryCommitments.dueSoon.items.map((i) => i.id)).toEqual(["c-soon"]);
    expect(result.regulatoryCommitments.open.items[0].label).toContain("FCA-2026-01");
  });
});

describe("buildGovernancePortfolio - overdue actions", () => {
  it("passes through every overdue action regardless of subject type, resolving a reg_commitment link via the commitment map", () => {
    const input = emptyInput();
    input.regCommitments = [regCommitment({ id: "commitment-x", request_id: "request-9" })];
    input.overdueActions = [
      action({ id: "a-incident", subject_type: "incident", subject_id: "incident-1" }),
      action({ id: "a-commitment", subject_type: "reg_commitment", subject_id: "commitment-x" }),
    ];
    const result = buildGovernancePortfolio(input);
    expect(result.overdueActions.count).toBe(2);
    const commitmentItem = result.overdueActions.items.find((i) => i.id === "a-commitment");
    expect(commitmentItem?.href).toBe("/govern/regulatory-response/request-9");
    const incidentItem = result.overdueActions.items.find((i) => i.id === "a-incident");
    expect(incidentItem?.href).toBe("/assure/incidents/incident-1");
  });
});

describe("hrefForSubject", () => {
  it("resolves a known subject type directly", () => {
    expect(hrefForSubject("incident", "inc-1", new Map())).toBe("/assure/incidents/inc-1");
  });

  it("resolves reg_commitment via the commitment map", () => {
    const map = new Map([["commitment-1", regCommitment({ id: "commitment-1", request_id: "request-7" })]]);
    expect(hrefForSubject("reg_commitment", "commitment-1", map)).toBe("/govern/regulatory-response/request-7");
  });

  it("returns null for an unknown subject type", () => {
    expect(hrefForSubject("mystery", "x", new Map())).toBeNull();
  });
});
