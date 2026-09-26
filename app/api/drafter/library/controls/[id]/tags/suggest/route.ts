import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { callDrafterModel, isRoleConfigured, roleDisabledReason, PROMPT_VERSIONS } from "@/lib/drafter/llm";
import { enforceControlledTags, type SuggestedTagCandidate } from "@/lib/drafter/tagging";
import { getControl, addSuggestedTag } from "@/lib/repo/drafter-controls";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";
import { getRegisterRow } from "@/lib/repo/drafter-register";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SYSTEM_PROMPT = `You suggest tags for a financial-crime control from a controlled list only. You may never invent a value outside the supplied lists. For every suggestion, quote the exact phrase in the source text you based it on. Return JSON: {"tags":[{"tag_type":"risk_addressed"|"customer_type"|"lifecycle_stage","value":"...","evidence_phrase":"..."}]}`;

/**
 * POST /api/drafter/library/controls/[id]/tags/suggest - calls the writer
 * role (tag suggestions reuse the writer config per BUILD-DECISIONS) to
 * propose risk_addressed/customer_type/lifecycle_stage tags, then rejects
 * in code anything not in the controlled list (SPEC.md: "the model may not
 * invent new values"). Only ACCEPTED candidates are stored, as unconfirmed
 * suggested tags for the user to confirm/reject on the library screen.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  if (!isRoleConfigured("writer")) {
    return NextResponse.json({ error: roleDisabledReason("writer") }, { status: 503 });
  }

  const control = await getControl(id);
  if (!control) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const registerRowId = control.register_row_ids[0];
  const row = registerRowId ? await getRegisterRow(registerRowId) : null;
  const sourceText = row
    ? Object.entries(row.fields)
        .filter(([header]) => !/rationale/i.test(header)) // the Rationale column is never passed to the model
        .map(([header, cell]) => `${header}: ${cell.text}`)
        .join("\n")
    : control.title;

  const [riskList, customerTypeList, lifecycleList] = await Promise.all([
    getDrafterSetting("controlled_tags_risk_addressed"),
    getDrafterSetting("controlled_tags_customer_type"),
    getDrafterSetting("controlled_tags_lifecycle_stage"),
  ]);
  const controlledLists = {
    risk_addressed: riskList ?? [],
    customer_type: customerTypeList ?? [],
    lifecycle_stage: lifecycleList ?? [],
  };

  const userPrompt = `Controlled lists:\nrisk_addressed: ${controlledLists.risk_addressed.join(", ")}\ncustomer_type: ${controlledLists.customer_type.join(", ")}\nlifecycle_stage: ${controlledLists.lifecycle_stage.join(", ")}\n\nControl source text:\n${sourceText}`;

  const result = await callDrafterModel({
    role: "tagger",
    promptVersion: PROMPT_VERSIONS.tag_suggestion,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const raw = result.json as { tags?: { tag_type?: string; value?: string; evidence_phrase?: string }[] };
  const candidates: SuggestedTagCandidate[] = (raw.tags ?? [])
    .filter((t): t is Required<typeof t> => Boolean(t.tag_type && t.value && t.evidence_phrase))
    .filter((t) => t.tag_type === "risk_addressed" || t.tag_type === "customer_type" || t.tag_type === "lifecycle_stage")
    .map((t) => ({ tagType: t.tag_type as SuggestedTagCandidate["tagType"], value: t.value, evidencePhrase: t.evidence_phrase }));

  const { accepted, rejected } = enforceControlledTags(candidates, controlledLists);

  const stored = await Promise.all(
    accepted.map((c) =>
      addSuggestedTag({
        controlId: id,
        tagType: c.tagType,
        value: c.value,
        evidencePhrase: c.evidencePhrase,
        modelName: result.modelName,
        promptVersion: PROMPT_VERSIONS.tag_suggestion,
      })
    )
  );

  return NextResponse.json({ suggested: stored, rejected });
}
