import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { addCalibrationItem, listCalibrationItems } from "@/lib/repo/drafter-calibration";
import { JUDGE_CRITERIA } from "@/lib/drafter/judge";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const items = await listCalibrationItems();
  return NextResponse.json({ items });
}

interface ImportItem {
  text: string;
  rationale?: string;
  sectionType?: string;
  labels: Record<string, "pass" | "fail">;
}

function validLabels(labels: unknown): Record<string, "pass" | "fail"> | null {
  if (!labels || typeof labels !== "object") return null;
  const out: Record<string, "pass" | "fail"> = {};
  for (const [key, value] of Object.entries(labels as Record<string, unknown>)) {
    if (!JUDGE_CRITERIA.some((c) => c.key === key)) continue;
    if (value !== "pass" && value !== "fail") continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * POST - adds calibration items by hand ({text, rationale?, sectionType?,
 * labels}) or imports a JSON array of the same shape (SPEC.md calibration:
 * "add items by hand or import JSON: text + per-criterion human pass/fail").
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  const rawItems: ImportItem[] = Array.isArray(body?.items) ? body.items : body?.text ? [body] : [];
  if (rawItems.length === 0) return NextResponse.json({ error: "Provide {text, labels} or {items: [...]}" }, { status: 400 });

  const created = [];
  const skipped: string[] = [];
  for (const raw of rawItems) {
    const labels = validLabels(raw.labels);
    if (typeof raw.text !== "string" || !raw.text.trim() || !labels) {
      skipped.push(raw.text ?? "(no text)");
      continue;
    }
    created.push(
      await addCalibrationItem({
        enhancementText: raw.text,
        rationaleText: raw.rationale ?? "",
        sectionType: raw.sectionType ?? "General",
        humanLabels: labels,
        actor: actor.email,
      })
    );
  }

  return NextResponse.json({ created, skipped });
}
