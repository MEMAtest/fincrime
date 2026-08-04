import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { updateAssessment, type AssessmentStatus } from "@/lib/repo/assessments";
import {
  createCondition,
  createDecision,
  listConditionsByDecision,
  listDecisionsBySubject,
  type DecisionOutcome,
} from "@/lib/repo/decisions";
import { createAction, listActionsBySubject, type ActionPriority } from "@/lib/repo/actions";
import { ACTOR, badRequest, isDecisionOutcome, notFound, requireAssessment, requirePerson, serverError } from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Subject type shared by decisions, conditions (via their decision) and actions recorded against a PRA assessment. */
const SUBJECT_TYPE = "pra_assessment";

/** Maps a decision outcome to the assessment status it moves the record to. */
const OUTCOME_STATUS: Record<DecisionOutcome, AssessmentStatus> = {
  approve: "approved",
  approve_with_conditions: "conditions_applied",
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
 * GET /api/pra/assessments/[id]/decision - the most recently recorded
 * decision for this assessment (if any) plus its conditions and every
 * follow-up action recorded against the assessment. Returns
 * { decision: null, conditions: [], actions: [] } (200, not 404) when no
 * decision has been made yet - that is a normal state, not an error.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const decisions = await listDecisionsBySubject(workspace.id, SUBJECT_TYPE, id);
    const decision = decisions[0] ?? null;

    const [conditions, actions] = await Promise.all([
      decision ? listConditionsByDecision(workspace.id, decision.id) : Promise.resolve([]),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    return NextResponse.json({ decision, conditions, actions });
  } catch (error) {
    return serverError("PRA decision fetch error", error);
  }
});

/**
 * POST /api/pra/assessments/[id]/decision - records a decision (approve /
 * approve_with_conditions / reject) signed by a named workspace person,
 * plus any conditions and follow-up actions, all in one call, then moves
 * the assessment to the matching status (approved / conditions_applied /
 * rejected).
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

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

    const updatedAssessment = await updateAssessment(workspace.id, id, { status: OUTCOME_STATUS[outcome] }, ACTOR);

    return NextResponse.json(
      { decision, conditions, actions, assessment: updatedAssessment ?? assessment },
      { status: 201 }
    );
  } catch (error) {
    return serverError("PRA decision create error", error);
  }
});
