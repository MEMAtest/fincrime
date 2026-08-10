import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { toWorkspaceSummary } from "@/lib/repo/workspace";
import { listPeople } from "@/lib/repo/people";
import { resolveWorkspaceSettings } from "@/lib/workspace/settings";
import { isBlobConfigured } from "@/lib/storage/blob";

export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const people = await listPeople(workspace.id);
    const summary = toWorkspaceSummary(workspace);
    return NextResponse.json({
      ...summary,
      // Resolved (defaults filled in), not the raw possibly-partial stored
      // blob - every consumer (StepGapsOpLoad's hourly cost default,
      // NewTestClient's sample size prefill) reads this rather than
      // `settings` raw so a workspace that has never opened Settings still
      // gets sane behaviour.
      settings: resolveWorkspaceSettings(summary.settings),
      peopleCount: people.length,
      // Lets the evidence-upload UI disable its file control and show an
      // honest message BEFORE the user picks a file and waits, rather than
      // enabling a control that will 503 on submit whenever
      // BLOB_READ_WRITE_TOKEN is unset (local dev, some preview deploys).
      fileUploadEnabled: isBlobConfigured(),
    });
  } catch (error) {
    console.error("Workspace me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
