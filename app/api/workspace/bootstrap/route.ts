import { NextRequest, NextResponse } from "next/server";
import { createWorkspace } from "@/lib/repo/workspace";

/**
 * Creates a new anonymous workspace. This is the one workspace route that
 * does not require the x-workspace-id / x-workspace-token headers, since it
 * is what mints them in the first place.
 */
export async function POST(request: NextRequest) {
  try {
    let name: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.name === "string" && body.name.trim()) {
        name = body.name.trim();
      }
    } catch {
      // No JSON body, or an empty one; name stays null.
    }

    const workspace = await createWorkspace(name);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("Workspace bootstrap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
