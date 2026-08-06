import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  updateWorkspaceControl,
  type ControlLifecycleStatus,
  type ControlEffectivenessRating,
  type UpdateWorkspaceControlInput,
} from "@/lib/repo/controls";
import { requirePerson } from "@/lib/pra/helpers";

const VALID_STATUSES: ControlLifecycleStatus[] = ["not_started", "in_progress", "needs_review", "gaps", "implemented"];
const VALID_RATINGS: ControlEffectivenessRating[] = ["strong", "adequate", "weak", "not_assessed"];

function isControlStatus(value: unknown): value is ControlLifecycleStatus {
  return typeof value === "string" && (VALID_STATUSES as string[]).includes(value);
}

function isEffectivenessRating(value: unknown): value is ControlEffectivenessRating {
  return typeof value === "string" && (VALID_RATINGS as string[]).includes(value);
}

/** Non-empty string array, or undefined if the input wasn't an array at all (so callers can fall back to a default). */
function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Trimmed non-empty string, explicit null passthrough, or undefined if absent/blank (so callers can fall back to a default). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** YYYY-MM-DD, optionally with a time suffix, and actually parseable. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T[0-9:.Zz+-]*)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/workspace/controls/[id] - partial update of a live workspace
 * control. Every field is optional; only what's present changes. Chiefly
 * used by PRA Step 6 to set a control's effectiveness_rating once it has
 * been tested, feeding the residual-risk scoring module's mitigation credit.
 * Bumps the control's version and writes an object_versions snapshot via
 * the existing updateWorkspaceControl repo function.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const raw = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;

    if (body.status !== undefined && !isControlStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.effectivenessRating !== undefined && !isEffectivenessRating(body.effectivenessRating)) {
      return NextResponse.json({ error: "Invalid effectivenessRating" }, { status: 400 });
    }

    // Person references must belong to this workspace, matching every PRA route.
    // Shape-check first: a non-UUID id would raise 22P02 in Postgres and
    // surface as a 500 instead of the intended 400.
    const ownerPersonId = optionalString(body.ownerPersonId);
    if (ownerPersonId && (!UUID_RE.test(ownerPersonId) || !(await requirePerson(workspace.id, ownerPersonId)))) {
      return NextResponse.json({ error: "Unknown ownerPersonId for this workspace" }, { status: 400 });
    }
    const approverPersonId = optionalString(body.approverPersonId);
    if (approverPersonId && (!UUID_RE.test(approverPersonId) || !(await requirePerson(workspace.id, approverPersonId)))) {
      return NextResponse.json({ error: "Unknown approverPersonId for this workspace" }, { status: 400 });
    }

    // Date fields hit DATE/TIMESTAMPTZ columns; free text must not reach
    // Postgres (silent MDY misparse or a 500 on invalid syntax).
    const lastTestedAt = optionalString(body.lastTestedAt);
    if (lastTestedAt && !isIsoDate(lastTestedAt)) {
      return NextResponse.json({ error: "lastTestedAt must be an ISO date (YYYY-MM-DD)" }, { status: 400 });
    }
    const nextTestDue = optionalString(body.nextTestDue);
    if (nextTestDue && !isIsoDate(nextTestDue)) {
      return NextResponse.json({ error: "nextTestDue must be an ISO date (YYYY-MM-DD)" }, { status: 400 });
    }

    const patch: UpdateWorkspaceControlInput = {
      objective: typeof body.objective === "string" && body.objective.trim() ? body.objective.trim() : undefined,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      category: optionalString(body.category),
      typologySlugs: stringArray(body.typologySlugs),
      productApplicability: stringArray(body.productApplicability),
      ownerPersonId,
      approverPersonId,
      systems: stringArray(body.systems),
      dataInputs: stringArray(body.dataInputs),
      threshold: optionalString(body.threshold),
      operatingFrequency: optionalString(body.operatingFrequency),
      status: isControlStatus(body.status) ? body.status : undefined,
      effectivenessRating: isEffectivenessRating(body.effectivenessRating) ? body.effectivenessRating : undefined,
      lastTestedAt,
      nextTestDue,
    };

    const control = await updateWorkspaceControl(workspace.id, id, patch, "workspace", "updated via API");
    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 });
    }
    return NextResponse.json({ control });
  } catch (error) {
    console.error("Workspace control update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
