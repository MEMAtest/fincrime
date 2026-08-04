import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createPerson, listPeople, type PersonRole } from "@/lib/repo/people";

const VALID_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

function isPersonRole(value: unknown): value is PersonRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const people = await listPeople(workspace.id);
    return NextResponse.json({ people });
  } catch (error) {
    console.error("People list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const role = body?.role;
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!name || !isPersonRole(role)) {
      return NextResponse.json(
        { error: "Missing or invalid fields: name, role (owner | reviewer | approver)" },
        { status: 400 }
      );
    }

    const person = await createPerson(workspace.id, { name, role, email: email || null }, "workspace");
    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error("Person create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
