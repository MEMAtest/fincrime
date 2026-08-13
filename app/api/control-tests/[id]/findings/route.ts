import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createControlTestFinding, listControlTestFindings } from "@/lib/repo/control-tests";
import { createAction } from "@/lib/repo/actions";
import { requirePerson } from "@/lib/pra/helpers";
import { withTransaction } from "@/lib/db";
import { SUBJECT_TYPE,
  badRequest,
  conflict,
  isFindingSeverity,
  isFinalTestStatus,
  isIsoDate,
  isUuid,
  notFound,
  requireControlTest,
  serverError,
} from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/control-tests/[id]/findings - findings recorded against this test. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const findings = await listControlTestFindings(workspace.id, id);
    return NextResponse.json({ findings });
  } catch (error) {
    return serverError("Control test findings list error", error);
  }
});

/**
 * POST /api/control-tests/[id]/findings - body {description, severity,
 * sampleRef?, createAction?:boolean, ownerPersonId?, dueDate?}. When
 * createAction is true, also creates an action (subjectType 'control_test',
 * subjectId = test id) via the actions repo and stores its id on the
 * finding, both inside one transaction - a failed finding insert must not
 * leave an orphaned action behind. ownerPersonId/dueDate only make sense
 * alongside createAction: true, so they 400 rather than being silently
 * dropped when createAction is false or absent. A test that is already
 * complete or cancelled is a historical record and 409s.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");
    if (isFinalTestStatus(test.status)) return conflict("Cannot add findings to a test that is already complete or cancelled");

    const body = await request.json();

    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!description) return badRequest("Missing required field: description");

    if (!isFindingSeverity(body?.severity)) {
      return badRequest("Invalid severity: must be low, medium, or high");
    }
    const severity = body.severity;

    const sampleRef = typeof body?.sampleRef === "string" && body.sampleRef.trim() ? body.sampleRef.trim() : null;

    const createActionFlag = body?.createAction === true;
    if (body?.createAction !== undefined && typeof body.createAction !== "boolean") {
      return badRequest("Invalid createAction: must be a boolean");
    }

    if (!createActionFlag && (body?.ownerPersonId !== undefined || body?.dueDate !== undefined)) {
      return badRequest("ownerPersonId and dueDate only apply when createAction is true");
    }

    let ownerPersonId: string | null = null;
    if (createActionFlag && body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    let dueDate: string | null = null;
    if (createActionFlag && body?.dueDate !== undefined && body.dueDate !== null) {
      if (!isIsoDate(body.dueDate)) return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD)");
      dueDate = body.dueDate;
    }

    const { finding } = await withTransaction(async (client) => {
      let actionId: string | null = null;
      if (createActionFlag) {
        const action = await createAction(
          workspace.id,
          {
            subjectType: SUBJECT_TYPE,
            subjectId: id,
            title: `Remediate finding: ${description}`,
            ownerPersonId,
            dueDate,
            priority: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
          },
          actor,
          client
        );
        actionId = action.id;
      }

      const finding = await createControlTestFinding(
        workspace.id,
        id,
        { description, severity, sampleRef, actionId },
        actor,
        client
      );
      return { finding };
    });

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    return serverError("Control test finding create error", error);
  }
});
