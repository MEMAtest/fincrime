import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { toWorkspaceSummary } from "@/lib/repo/workspace";
import { listPeople } from "@/lib/repo/people";

export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const people = await listPeople(workspace.id);
    return NextResponse.json({
      ...toWorkspaceSummary(workspace),
      peopleCount: people.length,
    });
  } catch (error) {
    console.error("Workspace me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
