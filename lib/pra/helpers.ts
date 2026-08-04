import { NextResponse } from "next/server";
import {
  getAssessment,
  getAssessmentRisk,
  getAssessmentControl,
  type AssessmentRow,
  type AssessmentRiskRow,
  type AssessmentControlRow,
  type AssessmentStatus,
  type AppetiteResult,
  type ControlCoverage,
} from "@/lib/repo/assessments";
import { createWorkspaceControl, getWorkspaceControl, type WorkspaceControlRow } from "@/lib/repo/controls";
import { getPerson, type PersonRow } from "@/lib/repo/people";
import type { DecisionOutcome } from "@/lib/repo/decisions";
import { getControlBySlug } from "@/data/controls";

/**
 * Shared plumbing for the app/api/pra/** route handlers: no identity exists
 * yet (Round 1 is anonymous-workspace only), so every mutation is attributed
 * to this fixed actor string, matching the convention already used by
 * app/api/workspace/people/*.
 */
export const ACTOR = "workspace";

const ASSESSMENT_STATUSES: AssessmentStatus[] = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "conditions_applied",
];

export function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return typeof value === "string" && (ASSESSMENT_STATUSES as string[]).includes(value);
}

const CONTROL_COVERAGE_VALUES: ControlCoverage[] = ["full", "partial", "gap"];

export function isControlCoverage(value: unknown): value is ControlCoverage {
  return typeof value === "string" && (CONTROL_COVERAGE_VALUES as string[]).includes(value);
}

const APPETITE_RESULTS: AppetiteResult[] = ["within", "tolerated", "outside"];

export function isAppetiteResult(value: unknown): value is AppetiteResult {
  return typeof value === "string" && (APPETITE_RESULTS as string[]).includes(value);
}

const DECISION_OUTCOMES: DecisionOutcome[] = ["approve", "approve_with_conditions", "reject"];

export function isDecisionOutcome(value: unknown): value is DecisionOutcome {
  return typeof value === "string" && (DECISION_OUTCOMES as string[]).includes(value);
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Loads an assessment and implicitly verifies it belongs to the authed workspace. */
export async function requireAssessment(workspaceId: string, id: string): Promise<AssessmentRow | null> {
  return getAssessment(workspaceId, id);
}

/** Loads a risk and verifies it belongs to both the workspace AND the given assessment. */
export async function requireAssessmentRisk(
  workspaceId: string,
  assessmentId: string,
  riskId: string
): Promise<AssessmentRiskRow | null> {
  const risk = await getAssessmentRisk(workspaceId, riskId);
  if (!risk || risk.assessment_id !== assessmentId) return null;
  return risk;
}

/** Loads an assessment_control row and verifies it belongs to both the workspace AND the given assessment. */
export async function requireAssessmentControl(
  workspaceId: string,
  assessmentId: string,
  controlId: string
): Promise<AssessmentControlRow | null> {
  const control = await getAssessmentControl(workspaceId, controlId);
  if (!control || control.assessment_id !== assessmentId) return null;
  return control;
}

export type ScoreParseResult =
  | { ok: true; value: number | null | undefined }
  | { ok: false };

/**
 * Parses an optional 0-100 score field. Distinguishes "not provided" (leave
 * unchanged) from "explicit null" (clear it) from an invalid value (400).
 */
export function parseOptionalScore(value: unknown): ScoreParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
    return { ok: true, value: Math.round(value) };
  }
  return { ok: false };
}

/** Parses an optional current_step field (1-8). */
export function parseOptionalStep(value: unknown): ScoreParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8) {
    return { ok: true, value };
  }
  return { ok: false };
}

/**
 * Given a library control_slug, creates a live workspace_controls row seeded
 * from the catalogue entry (name/category/objective/typologySlugs), per the
 * "instantiate from library" path. Returns null if the slug is unknown.
 */
export async function instantiateLibraryControl(
  workspaceId: string,
  controlSlug: string,
  actor: string
): Promise<WorkspaceControlRow | null> {
  const libraryControl = getControlBySlug(controlSlug);
  if (!libraryControl) return null;

  return createWorkspaceControl(
    workspaceId,
    {
      objective: libraryControl.objective,
      controlSlug: libraryControl.slug,
      name: libraryControl.name,
      category: libraryControl.category,
      typologySlugs: libraryControl.typologySlugs,
    },
    actor
  );
}

/** Verifies a workspace_controls id belongs to the authed workspace. */
export async function requireWorkspaceControl(
  workspaceId: string,
  id: string
): Promise<WorkspaceControlRow | null> {
  return getWorkspaceControl(workspaceId, id);
}

/** Loads a workspace_people row and verifies it belongs to the authed workspace, for decision/condition/action owner references. */
export async function requirePerson(workspaceId: string, id: string): Promise<PersonRow | null> {
  return getPerson(workspaceId, id);
}
