import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { updateControlChange, type ControlChangeStatus } from "@/lib/repo/control-changes";
import {
  createCondition,
  createDecision,
  listConditionsByDecision,
  listDecisionsBySubject,
  type DecisionOutcome,
} from "@/lib/repo/decisions";
import { createAction, listActionsBySubject, type ActionPriority } from "@/lib/repo/actions";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  isDecisionOutcome,
  notFound,
  requireControlChange,
  serverError,
} from "@/lib/control-changes/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Maps a decision outcome to the control_changes status it moves the record
 * to. approve_with_conditions still moves the change to 'approved' (it is
 * approved, with tracked conditions) - control_changes has no separate
 * "conditions_applied" status the way pra_assessments does.
 */
const OUTCOME_STATUS: Record<DecisionOutcome, ControlChangeStatus> = {
  approve: "approved",
  approve_with_conditions: "approved",
  reject: "rejected",
};

const VALID_PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
function isActionPriority(value: unknown): value is ActionPriority {
  return typeof value === "string" && (VALID_PRIORITIES as string[]).includes(value);
}

interface ConditionInput {
  description: string;
  dueDate: string | null;
  ownerPersonId: string | null;
}

interface ActionInput {
  title: string;
  ownerPersonId: string | null;
  dueDate: string | null;
  priority: ActionPriority;
}

/**
 * GET /api/control-changes/[id]/decision - the most recently recorded
 * decision for this change (if any) plus its conditions and every follow-up
 * action recorded against it. Returns {decision: null, conditions: [],
 * actions: []} (200, not 404) when no decision has been made yet.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const decisions = await listDecisionsBySubject(workspace.id, SUBJECT_TYPE, id);
    const decision = decisions[0] ?? null;

    const [conditions, actions] = await Promise.all([
      decision ? listConditionsByDecision(workspace.id, decision.id) : Promise.resolve([]),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    return NextResponse.json({ decision, conditions, actions });
  } catch (error) {
    return serverError("Control change decision fetch error", error);
  }
});

/**
 * POST /api/control-changes/[id]/decision - records a decision (approve /
 * approve_with_conditions / reject) signed by a named workspace person, plus
 * any conditions and follow-up actions, then moves the change to the
 * matching status (approved / rejected).
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const body = await request.json();

    if (!isDecisionOutcome(body?.outcome)) {
      return badRequest("Missing or invalid outcome: must be approve, approve_with_conditions, or reject");
    }
    const outcome: DecisionOutcome = body.outcome;

    const decidedByPersonId = typeof body?.decidedByPersonId === "string" ? body.decidedByPersonId : "";
    if (!decidedByPersonId) return badRequest("Missing required field: decidedByPersonId");
    const decider = await requirePerson(workspace.id, decidedByPersonId);
    if (!decider) return badRequest("Unknown decidedByPersonId for this workspace");

    const rationale = typeof body?.rationale === "string" && body.rationale.trim() ? body.rationale.trim() : null;

    const rawConditions: unknown[] = Array.isArray(body?.conditions) ? body.conditions : [];
    const conditionInputs: ConditionInput[] = [];
    for (const raw of rawConditions) {
      const c = raw as Record<string, unknown>;
      const description = typeof c?.description === "string" ? c.description.trim() : "";
      if (!description) return badRequest("Each condition requires a non-empty description");

      let ownerPersonId: string | null = null;
      if (c?.ownerPersonId !== undefined && c.ownerPersonId !== null) {
        if (typeof c.ownerPersonId !== "string") return badRequest("Invalid ownerPersonId on a condition");
        const owner = await requirePerson(workspace.id, c.ownerPersonId);
        if (!owner) return badRequest("Unknown ownerPersonId on a condition");
        ownerPersonId = owner.id;
      }
      const dueDate = typeof c?.dueDate === "string" && c.dueDate ? c.dueDate : null;
      conditionInputs.push({ description, dueDate, ownerPersonId });
    }

    const rawActions: unknown[] = Array.isArray(body?.actions) ? body.actions : [];
    const actionInputs: ActionInput[] = [];
    for (const raw of rawActions) {
      const a = raw as Record<string, unknown>;
      const title = typeof a?.title === "string" ? a.title.trim() : "";
      if (!title) return badRequest("Each action requires a non-empty title");

      let ownerPersonId: string | null = null;
      if (a?.ownerPersonId !== undefined && a.ownerPersonId !== null) {
        if (typeof a.ownerPersonId !== "string") return badRequest("Invalid ownerPersonId on an action");
        const owner = await requirePerson(workspace.id, a.ownerPersonId);
        if (!owner) return badRequest("Unknown ownerPersonId on an action");
        ownerPersonId = owner.id;
      }
      const dueDate = typeof a?.dueDate === "string" && a.dueDate ? a.dueDate : null;
      const priority: ActionPriority = isActionPriority(a?.priority) ? a.priority : "medium";
      actionInputs.push({ title, ownerPersonId, dueDate, priority });
    }

    const decision = await createDecision(
      workspace.id,
      { subjectType: SUBJECT_TYPE, subjectId: id, outcome, rationale, decidedByPersonId: decider.id },
      ACTOR
    );

    const conditions = [];
    for (const input of conditionInputs) {
      conditions.push(await createCondition(workspace.id, decision.id, input, ACTOR));
    }

    const actions = [];
    for (const input of actionInputs) {
      actions.push(await createAction(workspace.id, { subjectType: SUBJECT_TYPE, subjectId: id, ...input }, ACTOR));
    }

    const updatedChange = await updateControlChange(workspace.id, id, { status: OUTCOME_STATUS[outcome] }, ACTOR);

    return NextResponse.json(
      { decision, conditions, actions, change: updatedChange ?? change },
      { status: 201 }
    );
  } catch (error) {
    return serverError("Control change decision create error", error);
  }
});
