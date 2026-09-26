import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { saveEditedStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import type { BannedPhrase } from "@/lib/drafter/lint";
import { getDrafterDocument } from "@/lib/repo/drafter-documents";
import { blocksToPlainText } from "@/lib/drafter/blocks";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST - saves an edit to a StylePack's rules/banned phrases/tense rule/length limits as a new version. */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const rules = body?.rules as string[] | undefined;
  const bannedPhrases = body?.bannedPhrases as BannedPhrase[] | undefined;
  const tenseRule = typeof body?.tenseRule === "string" ? body.tenseRule : undefined;
  const lengthLimits = body?.lengthLimits as { min_words: number; max_words: number } | undefined;

  if (!Array.isArray(rules) || !Array.isArray(bannedPhrases) || !tenseRule || !lengthLimits) {
    return NextResponse.json({ error: "rules, bannedPhrases, tenseRule and lengthLimits are all required" }, { status: 400 });
  }

  const styleBriefDocumentId = typeof body?.styleBriefDocumentId === "string" ? body.styleBriefDocumentId : null;
  let styleBriefText: string | null = null;
  if (styleBriefDocumentId) {
    const doc = await getDrafterDocument(styleBriefDocumentId);
    if (doc?.parsed_content) styleBriefText = blocksToPlainText(doc.parsed_content);
  }

  const version = await saveEditedStylepackVersion({
    stylepackId: id,
    rules,
    bannedPhrases,
    tenseRule,
    lengthLimits,
    styleBriefDocumentId,
    styleBriefText,
    actor: actor.email,
  });
  return NextResponse.json({ version });
}
