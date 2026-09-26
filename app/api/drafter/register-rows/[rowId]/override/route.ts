import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getRegisterRow, addValidationOverride, markRegisterRowResolved, listValidationOverrides } from "@/lib/repo/drafter-register";

interface RouteContext {
  params: Promise<{ rowId: string }>;
}

/**
 * POST /api/drafter/register-rows/[rowId]/override - body
 * { checkName, resolution: "resolved" | "overridden", note? }. Logs the
 * override with actor + reason (SPEC.md: "override logged with actor and
 * reason") and, once every blocking issue on the row has a resolution
 * logged, clears is_blocked so the row can enter the library. The app never
 * decides FOR the user which value is correct - it only records the
 * decision made.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { rowId } = await context.params;

  const row = await getRegisterRow(rowId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { checkName?: string; resolution?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { checkName, resolution, note? }" }, { status: 400 });
  }
  if (!body.checkName || (body.resolution !== "resolved" && body.resolution !== "overridden")) {
    return NextResponse.json({ error: 'checkName and resolution ("resolved" | "overridden") are required' }, { status: 400 });
  }
  if (body.resolution === "overridden" && !body.note?.trim()) {
    return NextResponse.json({ error: "A reason is required to override a blocking issue." }, { status: 400 });
  }

  await addValidationOverride({
    registerRowId: rowId,
    checkName: body.checkName,
    resolution: body.resolution,
    note: body.note?.trim() || null,
    actor: actor.email,
  });

  const blockingChecks = new Set(
    (row.validation_issues as { check: string; severity: string }[]).filter((i) => i.severity === "blocking").map((i) => i.check)
  );
  const overridesRes = await listValidationOverrides(rowId);
  const resolvedChecks = new Set(overridesRes.map((o) => o.check_name));
  const stillBlocked = Array.from(blockingChecks).some((check) => !resolvedChecks.has(check));

  await markRegisterRowResolved(rowId, stillBlocked);

  return NextResponse.json({ isBlocked: stillBlocked });
}
