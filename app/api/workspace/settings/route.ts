import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { updateWorkspace, toWorkspaceSummary } from "@/lib/repo/workspace";
import {
  resolveWorkspaceSettings,
  validateSettingsPatch,
  validateAppetiteThresholds,
  isValidEmail,
} from "@/lib/workspace/settings";

/**
 * GET /api/workspace/settings - the workspace's name, owner email, appetite
 * thresholds, and settings (JSONB, with documented defaults filled in).
 * Mirrors GET /api/workspace/me's shape for name/ownerEmail/appetiteThresholds
 * but resolves settings to its full defaulted form rather than the raw
 * (possibly partial, possibly empty) stored blob.
 */
export const GET = withWorkspace(async (_request, workspace) => {
  const summary = toWorkspaceSummary(workspace);
  return NextResponse.json({
    name: summary.name,
    ownerEmail: summary.ownerEmail,
    appetiteThresholds: summary.appetiteThresholds,
    settings: resolveWorkspaceSettings(summary.settings),
  });
});

/**
 * PATCH /api/workspace/settings - body {name?, ownerEmail?,
 * appetiteThresholds?, settings?}. Every field is validated hard before any
 * write: appetiteThresholds must be integers 0-100 with toleratedFrom
 * strictly less than outsideFrom; settings rejects unknown keys outright
 * (never silently drops or stores them); ownerEmail (when non-null) must
 * match the same email shape used by the PDF export route's lead-capture
 * email. `settings` is a PARTIAL patch merged onto whatever is already
 * stored, so PATCHing one key never clobbers the others. audit_log's actor
 * for this write is whoever withWorkspace resolved the request as: the
 * generic "workspace" string for the anonymous header path (unchanged), or
 * the signed-in user's email when a session authenticated the request -
 * this is the one route wired to demonstrate that end to end; see
 * lib/workspace-auth.ts's withWorkspace doc for the general mechanism.
 */
export const PATCH = withWorkspace(async (request, workspace, _context, actor) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const update: {
    name?: string | null;
    ownerEmail?: string | null;
    appetiteThresholds?: { toleratedFrom: number; outsideFrom: number };
    settingsPatch?: Record<string, unknown>;
  } = {};

  if ("name" in b) {
    if (b.name !== null && (typeof b.name !== "string" || b.name.trim().length === 0 || b.name.length > 200)) {
      return NextResponse.json({ error: "name must be a non-empty string (max 200 chars) or null" }, { status: 400 });
    }
    update.name = b.name === null ? null : (b.name as string).trim();
  }

  if ("ownerEmail" in b) {
    if (b.ownerEmail !== null && (typeof b.ownerEmail !== "string" || !isValidEmail(b.ownerEmail.trim()))) {
      return NextResponse.json({ error: "ownerEmail must be a valid email address or null" }, { status: 400 });
    }
    update.ownerEmail = b.ownerEmail === null ? null : (b.ownerEmail as string).trim();
  }

  if ("appetiteThresholds" in b) {
    const result = validateAppetiteThresholds(b.appetiteThresholds);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    update.appetiteThresholds = result.thresholds;
  }

  if ("settings" in b) {
    const result = validateSettingsPatch(b.settings);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    // The PARTIAL patch itself, not a merge computed against `workspace.settings`
    // here: that snapshot is read at request start and would be stale by the
    // time this write lands against a concurrent PATCH. updateWorkspace merges
    // this patch in SQL, inside a transaction that locks the row, so concurrent
    // partial patches of different keys both persist instead of one clobbering
    // the other.
    update.settingsPatch = result.patch;
  }

  const updated = await updateWorkspace(workspace.id, update, actor);
  if (!updated) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const summary = toWorkspaceSummary(updated);
  return NextResponse.json({
    name: summary.name,
    ownerEmail: summary.ownerEmail,
    appetiteThresholds: summary.appetiteThresholds,
    settings: resolveWorkspaceSettings(summary.settings),
  });
});
