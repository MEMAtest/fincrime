import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  createWorkspaceControl,
  listWorkspaceControlBySlug,
  listWorkspaceControls,
  updateWorkspaceControl,
  type ControlLifecycleStatus,
  type ControlEffectivenessRating,
  type CreateWorkspaceControlInput,
} from "@/lib/repo/controls";
import { getControlBySlug } from "@/data/controls";
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

/** Postgres unique_violation (23505) - the shape node-postgres throws for it, not exported as a type by `pg`. */
function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505";
}

export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const controls = await listWorkspaceControls(workspace.id);
    return NextResponse.json({ controls });
  } catch (error) {
    console.error("Workspace controls list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/**
 * Two request shapes, matching the plan:
 *  - { controlSlug } - instantiate a workspace control from the static
 *    library (data/controls), carrying its name/category/objective/typology
 *    slugs as sensible defaults. Caller overrides (owner/threshold/status/
 *    etc.) win over the library default when present.
 *  - a full custom control payload (no controlSlug): requires at least
 *    `name` and `objective`.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;

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

    // Fields shared by both shapes: caller overrides on top of the slug's
    // library defaults, or the sole source of truth for a custom control.
    const overrides = {
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
    const hasOverrides = Object.values(overrides).some((v) => v !== undefined);

    const slug = optionalString(body.controlSlug);
    let input: CreateWorkspaceControlInput;

    if (slug) {
      const libraryControl = getControlBySlug(slug);
      if (!libraryControl) {
        return NextResponse.json({ error: `Unknown control slug: ${slug}` }, { status: 400 });
      }

      // Instantiating the same library control twice in one workspace must
      // not create a second row: update the existing instantiation with
      // whatever overrides were supplied this time (undefined fields leave
      // the current value untouched), rather than re-applying the library
      // defaults on top of it.
      const existing = await listWorkspaceControlBySlug(workspace.id, libraryControl.slug);
      if (existing) {
        // A bare {controlSlug} POST (e.g. "add this control to my
        // workspace" from the enforcement action panel) supplies no
        // overrides at all. Against an already-instantiated control that is
        // a true no-op: applying library defaults on top of an existing row
        // changes nothing, so don't bump its version or write a snapshot for
        // it - every override field resolving to undefined is exactly the
        // "nothing was actually supplied this time" case.
        if (!hasOverrides) {
          return NextResponse.json({ control: existing }, { status: 200 });
        }
        const updated = await updateWorkspaceControl(
          workspace.id,
          existing.id,
          overrides,
          "workspace",
          "saved from library"
        );
        return NextResponse.json({ control: updated }, { status: 200 });
      }

      input = {
        objective: libraryControl.objective,
        controlSlug: libraryControl.slug,
        name: libraryControl.name,
        category: libraryControl.category,
        typologySlugs: libraryControl.typologySlugs,
        ...overrides,
        productApplicability: overrides.productApplicability ?? [],
        systems: overrides.systems ?? libraryControl.suggestedSystems,
        dataInputs: overrides.dataInputs ?? libraryControl.dataInputs,
        threshold: overrides.threshold ?? libraryControl.defaultThreshold,
      };

      // The existence check above and this insert are not atomic: two
      // concurrent POSTs for the same slug can both pass the check and both
      // reach here. db/migrations/003_workspace_control_slug_unique.sql adds
      // a unique index on (workspace_id, control_slug) so only one insert
      // wins; the loser falls back to the update path instead of 500ing.
      try {
        const control = await createWorkspaceControl(workspace.id, input, "workspace");
        return NextResponse.json({ control }, { status: 201 });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await listWorkspaceControlBySlug(workspace.id, libraryControl.slug);
        if (!raced) throw error;
        if (!hasOverrides) {
          return NextResponse.json({ control: raced }, { status: 200 });
        }
        const updated = await updateWorkspaceControl(workspace.id, raced.id, overrides, "workspace", "saved from library");
        return NextResponse.json({ control: updated }, { status: 200 });
      }
    } else {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const objective = typeof body.objective === "string" ? body.objective.trim() : "";
      if (!name || !objective) {
        return NextResponse.json(
          { error: "Missing or invalid fields: name, objective (or provide controlSlug to instantiate from the library)" },
          { status: 400 }
        );
      }
      input = {
        objective,
        name,
        controlSlug: null,
        category: optionalString(body.category) ?? null,
        typologySlugs: stringArray(body.typologySlugs) ?? [],
        ...overrides,
        productApplicability: overrides.productApplicability ?? [],
        systems: overrides.systems ?? [],
        dataInputs: overrides.dataInputs ?? [],
      };
    }

    const control = await createWorkspaceControl(workspace.id, input, "workspace");
    return NextResponse.json({ control }, { status: 201 });
  } catch (error) {
    console.error("Workspace control create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
