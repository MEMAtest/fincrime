import { NextResponse } from "next/server";
import { getControlTest, type ControlTestRow } from "../repo/control-tests";
import { getWorkspaceControl, type WorkspaceControlRow } from "../repo/controls";

/**
 * Shared plumbing for the app/api/control-tests/** route handlers, mirroring
 * lib/control-changes/helpers.ts. No identity exists yet (anonymous
 * workspace only), so every mutation is attributed to this fixed actor
 * string. The pure request-body validators live in ./validation.ts (kept
 * free of value imports so they stay unit-testable without a db); this file
 * re-exports them alongside the db-touching lookups and NextResponse
 * helpers.
 */
export const ACTOR = "workspace";

/** Subject type used for actions/evidence/comments/decisions attached to a control test. */
export const SUBJECT_TYPE = "control_test";

export {
  isControlTestMethod,
  isFindingSeverity,
  isIsoDate,
  isNonNegativeInt,
  isUuid,
  parseOptionalCount,
  parseOptionalStep,
  type CountParseResult,
  type StepParseResult,
} from "./validation";

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Loads a control test and implicitly verifies it belongs to the authed workspace. */
export async function requireControlTest(workspaceId: string, id: string): Promise<ControlTestRow | null> {
  return getControlTest(workspaceId, id);
}

/**
 * Loads the workspace_control a test targets, verifying it belongs to the
 * SAME workspace as the test. A test's workspace_control_id is only ever set
 * from a value already checked against the workspace at create time, but
 * this is re-verified on every read so a test can never be used to reach a
 * control belonging to another workspace.
 */
export async function requireTestControl(test: ControlTestRow): Promise<WorkspaceControlRow | null> {
  return getWorkspaceControl(test.workspace_id, test.workspace_control_id);
}

/** A test that is complete or cancelled is a historical record and may not be mutated further. */
export function isFinalTestStatus(status: ControlTestRow["status"]): boolean {
  return status === "complete" || status === "cancelled";
}
