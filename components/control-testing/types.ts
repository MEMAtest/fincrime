/**
 * Client-side mirrors of the lib/repo/control-tests.ts row shapes used by the
 * Control Testing journey. Deliberately NOT imported from lib/repo/** (those
 * modules pull in lib/db.ts / the `pg` driver, which must never end up in a
 * client bundle) - these are plain, duplicated type declarations kept in
 * lockstep with the DB rows returned by app/api/control-tests/**.
 *
 * PersonDTO / ActionDTO / EvidenceDTO and WorkspaceControlDTO are identical
 * shapes to components/change-lab/types.ts (people/actions/evidence/controls
 * are reused polymorphically across every journey in this repo), so they are
 * re-exported from there rather than redeclared.
 */

export type {
  PersonDTO,
  PersonRole,
  ActionDTO,
  ActionPriority,
  ActionStatus,
  EvidenceDTO,
  WorkspaceControlDTO,
  ControlEffectivenessRating,
} from "@/components/change-lab/types";

import type { ActionPriority, ActionStatus } from "@/components/change-lab/types";

export type ControlTestMethod = "sample" | "walkthrough" | "reperformance" | "data_analysis" | "other";
export type ControlTestStatus = "planned" | "in_progress" | "complete" | "cancelled";
export type ControlTestResult = "pass" | "pass_with_findings" | "fail";
export type FindingSeverity = "low" | "medium" | "high";

/** Client-side mirror of lib/repo/control-tests.ts's ControlTestRow. */
export interface ControlTestDTO {
  id: string;
  workspace_id: string;
  workspace_control_id: string;
  title: string;
  method: ControlTestMethod | null;
  period_start: string | null;
  period_end: string | null;
  tester_person_id: string | null;
  sample_size: number | null;
  samples_passed: number | null;
  samples_failed: number | null;
  samples_partial: number | null;
  status: ControlTestStatus;
  result: ControlTestResult | null;
  conclusion: string | null;
  applied_rating: "strong" | "adequate" | "weak" | "not_assessed" | null;
  applied_version: number | null;
  tested_at: string | null;
  next_test_due: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/control-tests.ts's ControlTestFindingRow. */
export interface ControlTestFindingDTO {
  id: string;
  workspace_id: string;
  test_id: string;
  description: string;
  severity: FindingSeverity;
  sample_ref: string | null;
  action_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ControlTestListItem {
  id: string;
  title: string;
  status: ControlTestStatus;
  result: ControlTestResult | null;
  controlName: string;
  periodEnd: string | null;
  updatedAt: string;
}

export const CONTROL_TEST_STATUS_LABEL: Record<ControlTestStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const CONTROL_TEST_RESULT_LABEL: Record<ControlTestResult, string> = {
  pass: "Pass",
  pass_with_findings: "Pass with findings",
  fail: "Fail",
};

export const CONTROL_TEST_METHOD_LABEL: Record<ControlTestMethod, string> = {
  sample: "Sample testing",
  walkthrough: "Walkthrough",
  reperformance: "Reperformance",
  data_analysis: "Data analysis",
  other: "Other",
};

export const FINDING_SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const JOURNEY_STEP_LABELS = ["Scope", "Samples", "Findings", "Evidence", "Conclusion"] as const;

/** All 5 steps are built. */
export const LAST_UNLOCKED_STEP = 5;

/**
 * Step 5's on-screen/PDF test report payload, assembled client-side by
 * StepConclusion.tsx and sent as-is to POST /api/export/pdf (module
 * "control_test"). This is the ONE canonical shape for that payload:
 * lib/pdf/test-pdf.ts (server-only, pulls in jsPDF) imports these same types
 * rather than redeclaring them, so the two sides can never drift. Safe for a
 * server file to import from here because this module has no "use client"
 * directive and no server-only dependencies of its own.
 */
export interface TestExportFinding {
  description: string;
  severity: FindingSeverity;
  sampleRef: string | null;
  hasAction: boolean;
}

export interface TestExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

export interface TestExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
}

export interface TestExportPayload {
  testTitle: string;
  controlName: string;
  controlSlug: string | null;
  status: ControlTestStatus;
  method: ControlTestMethod | null;
  periodStart: string | null;
  periodEnd: string | null;
  testerName: string | null;
  sampleSize: number | null;
  samplesPassed: number | null;
  samplesFailed: number | null;
  samplesPartial: number | null;
  /** 0-100, rounded. Derived client-side from data/scoring/test-effectiveness.ts, not stored separately. */
  passRatePct: number | null;
  /** The result data/scoring/test-effectiveness.ts derives from the current counts + findings. */
  derivedResult: ControlTestResult | null;
  /** The rating actually written onto the control - only set once the test is complete. */
  appliedRating: "strong" | "adequate" | "weak" | "not_assessed" | null;
  appliedVersion: number | null;
  testedAt: string | null;
  nextTestDue: string | null;
  conclusion: string | null;
  findings: TestExportFinding[];
  actions: TestExportAction[];
  evidence: TestExportEvidence[];
  narrative?: string | null;
}
