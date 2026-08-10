import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deletePerson, updatePerson, type PersonRole } from "@/lib/repo/people";

const VALID_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

function isPersonRole(value: unknown): value is PersonRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Person not found" }, { status: 404 });
    const body = await request.json();

    const patch: { name?: string; role?: PersonRole; email?: string | null } = {};

    if (typeof body?.name === "string" && body.name.trim()) {
      patch.name = body.name.trim();
    }

    if (body?.role !== undefined) {
      if (!isPersonRole(body.role)) {
        return NextResponse.json(
          { error: "Invalid role: must be owner, reviewer, or approver" },
          { status: 400 }
        );
      }
      patch.role = body.role;
    }

    if (body?.email !== undefined) {
      patch.email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
    }

    const person = await updatePerson(workspace.id, id, patch, "workspace");
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json({ person });
  } catch (error) {
    console.error("Person update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Person not found" }, { status: 404 });
    const result = await deletePerson(workspace.id, id, "workspace");
    if (result === "not_found") {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    if (result === "referenced") {
      return NextResponse.json(
        {
          error:
            "This person cannot be removed: they are recorded as the decider on at least one decision, which must keep its historical record. Reassign or leave them in place.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Person delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
