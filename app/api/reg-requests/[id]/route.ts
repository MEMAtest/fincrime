import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  deleteRegRequest,
  getRegResponseSummary,
  isFinalRegRequestStatus,
  listRegCommitments,
  listRegQuestionLinks,
  listRegQuestions,
  updateRegRequest,
  REG_REQUEST_SUBJECT_TYPE,
  REG_COMMITMENT_SUBJECT_TYPE,
  type UpdateRegRequestInput,
} from "@/lib/repo/reg-requests";
import { listActionsBySubject, listActionsBySubjectIds } from "@/lib/repo/actions";
import { listCommentsBySubject, listEvidenceBySubject } from "@/lib/repo/evidence";
import { listConditionsByDecision, listDecisionsBySubject } from "@/lib/repo/decisions";
import { badRequest,
  conflict,
  isIsoDate,
  isRegRequestChannel,
  isUuid,
  notFound,
  parseOptionalStep,
  requirePerson,
  requireRegRequest,
  serverError,
} from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reg-requests/[id] - full detail: the request, its questions
 * (with their substantiating links), commitments, the roll-up summary,
 * every decision recorded against it (approve/reject each record one) with
 * their conditions flattened, actions (request-level and every
 * commitment's), evidence, and comments.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const request = await requireRegRequest(workspace.id, id);
    if (!request) return notFound("Reg request not found");

    const [questions, commitments, summary, decisions, requestActions, evidence, comments] = await Promise.all([
      listRegQuestions(workspace.id, id),
      listRegCommitments(workspace.id, id),
      getRegResponseSummary(workspace.id, id),
      listDecisionsBySubject(workspace.id, REG_REQUEST_SUBJECT_TYPE, id),
      listActionsBySubject(workspace.id, REG_REQUEST_SUBJECT_TYPE, id),
      listEvidenceBySubject(workspace.id, REG_REQUEST_SUBJECT_TYPE, id),
      listCommentsBySubject(workspace.id, REG_REQUEST_SUBJECT_TYPE, id),
    ]);

    const linkLists = await Promise.all(questions.map((q) => listRegQuestionLinks(workspace.id, q.id)));
    const questionsWithLinks = questions.map((q, i) => ({ ...q, links: linkLists[i] }));

    const commitmentActions = await listActionsBySubjectIds(
      workspace.id,
      REG_COMMITMENT_SUBJECT_TYPE,
      commitments.map((c) => c.id)
    );
    const actions = [...requestActions, ...commitmentActions];

    const conditionLists = await Promise.all(decisions.map((d) => listConditionsByDecision(workspace.id, d.id)));
    const conditions = conditionLists.flat();

    return NextResponse.json({
      request,
      questions: questionsWithLinks,
      commitments,
      summary,
      decisions,
      conditions,
      actions,
      evidence,
      comments,
    });
  } catch (error) {
    return serverError("Reg request detail error", error);
  }
});

/**
 * PATCH /api/reg-requests/[id] - partial update of {title, reference,
 * regulator, channel, receivedAt, deadline, ownerPersonId, summary,
 * currentStep}. NOT status (approve/submit/close/reject have their own
 * routes) - rejected with an unconditional 400.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const existing = await requireRegRequest(workspace.id, id);
    if (!existing) return notFound("Reg request not found");
    if (isFinalRegRequestStatus(existing.status)) {
      return conflict("Cannot update a reg request that is already closed or cancelled");
    }

    const body = await request.json().catch(() => null);

    if (body?.status !== undefined) {
      return badRequest("status cannot be changed via PATCH; use approve, submit, close, or reject");
    }

    const patch: UpdateRegRequestInput = {};

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title must be a non-empty string");
      patch.title = title;
    }

    if (body?.reference !== undefined) {
      patch.reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
    }

    if (body?.regulator !== undefined) {
      const regulator = typeof body.regulator === "string" ? body.regulator.trim() : "";
      if (!regulator) return badRequest("regulator must be a non-empty string");
      patch.regulator = regulator;
    }

    if (body?.channel !== undefined) {
      if (body.channel === null) {
        patch.channel = null;
      } else {
        if (!isRegRequestChannel(body.channel)) return badRequest("Invalid channel: must be email, portal, letter, meeting, s165, or other");
        patch.channel = body.channel;
      }
    }

    if (body?.receivedAt !== undefined) {
      if (body.receivedAt !== null && !isIsoDate(body.receivedAt)) {
        return badRequest("Invalid receivedAt: must be an ISO date (YYYY-MM-DD) or null");
      }
      patch.receivedAt = body.receivedAt;
    }

    if (body?.deadline !== undefined) {
      if (body.deadline !== null && !isIsoDate(body.deadline)) {
        return badRequest("Invalid deadline: must be an ISO date (YYYY-MM-DD) or null");
      }
      patch.deadline = body.deadline;
    }

    if (body?.ownerPersonId !== undefined) {
      if (body.ownerPersonId === null) {
        patch.ownerPersonId = null;
      } else {
        if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID or null");
        const person = await requirePerson(workspace.id, body.ownerPersonId);
        if (!person) return badRequest("Unknown ownerPersonId for this workspace");
        patch.ownerPersonId = person.id;
      }
    }

    if (body?.summary !== undefined) {
      patch.summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : null;
    }

    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 6");
      if (typeof parsed.value === "number") patch.currentStep = parsed.value;
    }

    const result = await updateRegRequest(workspace.id, id, patch, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      return conflict("Cannot update a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ request: result.request });
  } catch (error) {
    return serverError("Reg request update error", error);
  }
});

/** DELETE /api/reg-requests/[id] - refuses on a final request (closed, cancelled). */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");

    const result = await deleteRegRequest(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      return conflict("Cannot delete a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Reg request delete error", error);
  }
});
