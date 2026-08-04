import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  createWorkspaceControl,
  listWorkspaceControls,
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
function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
    const ownerPersonId = optionalString(body.ownerPersonId);
    if (ownerPersonId && !(await requirePerson(workspace.id, ownerPersonId))) {
      return NextResponse.json({ error: "Unknown ownerPersonId for this workspace" }, { status: 400 });
    }
    const approverPersonId = optionalString(body.approverPersonId);
    if (approverPersonId && !(await requirePerson(workspace.id, approverPersonId))) {
      return NextResponse.json({ error: "Unknown approverPersonId for this workspace" }, { status: 400 });
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
      lastTestedAt: optionalString(body.lastTestedAt),
      nextTestDue: optionalString(body.nextTestDue),
    };

    const slug = optionalString(body.controlSlug);
    let input: CreateWorkspaceControlInput;

    if (slug) {
      const libraryControl = getControlBySlug(slug);
      if (!libraryControl) {
        return NextResponse.json({ error: `Unknown control slug: ${slug}` }, { status: 400 });
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
