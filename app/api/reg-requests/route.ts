import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createRegRequest, listRegRequestsWithSummary } from "@/lib/repo/reg-requests";
import {
  ACTOR,
  badRequest,
  isIsoDate,
  isRegRequestChannel,
  isRegRequestStatus,
  isUuid,
  requirePerson,
  serverError,
} from "@/lib/reg-response/helpers";

/**
 * GET /api/reg-requests - list the workspace's regulator requests, most
 * recent first, each with its roll-up summary attached (listRegRequestsWithSummary
 * computes every row's summary in two bulk queries rather than the list
 * page fetching a full detail GET per row for it). Optional ?status=
 * filter, validated against the enum.
 */
export const GET = withWorkspace(async (request, workspace) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    if (statusParam !== null && !isRegRequestStatus(statusParam)) {
      return badRequest("Invalid status filter");
    }

    const requests = await listRegRequestsWithSummary(workspace.id, { status: statusParam ?? undefined });
    return NextResponse.json({ requests });
  } catch (error) {
    return serverError("Reg request list error", error);
  }
});

/**
 * POST /api/reg-requests - body {title, reference?, regulator?, channel?,
 * receivedAt?, deadline?, ownerPersonId?, summary?}.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json().catch(() => null);

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const reference = typeof body?.reference === "string" && body.reference.trim() ? body.reference.trim() : null;

    let regulator: string | undefined;
    if (body?.regulator !== undefined) {
      const r = typeof body.regulator === "string" ? body.regulator.trim() : "";
      if (!r) return badRequest("regulator must be a non-empty string");
      regulator = r;
    }

    let channel: "email" | "portal" | "letter" | "meeting" | "s165" | "other" | null = null;
    if (body?.channel !== undefined && body.channel !== null) {
      if (!isRegRequestChannel(body.channel)) return badRequest("Invalid channel: must be email, portal, letter, meeting, s165, or other");
      channel = body.channel;
    }

    let receivedAt: string | null = null;
    if (body?.receivedAt !== undefined && body.receivedAt !== null) {
      if (!isIsoDate(body.receivedAt)) return badRequest("Invalid receivedAt: must be an ISO date (YYYY-MM-DD)");
      receivedAt = body.receivedAt;
    }

    let deadline: string | null = null;
    if (body?.deadline !== undefined && body.deadline !== null) {
      if (!isIsoDate(body.deadline)) return badRequest("Invalid deadline: must be an ISO date (YYYY-MM-DD)");
      deadline = body.deadline;
    }

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    const summary = typeof body?.summary === "string" && body.summary.trim() ? body.summary.trim() : null;

    const created = await createRegRequest(workspace.id, { title, reference, regulator, channel, receivedAt, deadline, ownerPersonId, summary }, ACTOR);

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return serverError("Reg request create error", error);
  }
});
