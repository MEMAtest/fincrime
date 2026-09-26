import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createStylepack, listStylepacks, listStylepackVersions, SEED_STYLE_RULES, SEED_TENSE_RULE } from "@/lib/repo/drafter-stylepacks";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";
import { getDrafterDocument } from "@/lib/repo/drafter-documents";
import { blocksToPlainText } from "@/lib/drafter/blocks";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const stylepacks = await listStylepacks();
  const withVersions = await Promise.all(stylepacks.map(async (s) => ({ stylepack: s, versions: await listStylepackVersions(s.id) })));
  return NextResponse.json({ stylepacks: withVersions });
}

/**
 * POST /api/drafter/stylepacks {name} - creates a StylePack seeded from
 * SPEC.md's style rules 1-9 and the banned-phrase list held in settings
 * (drafter_settings.banned_phrases), editable afterwards via a new version.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "House style";

  const bannedPhrases = (await getDrafterSetting("banned_phrases")) ?? [];
  const wordLimits = (await getDrafterSetting("control_text_word_limits")) ?? { min: 60, max: 150 };

  // Style brief attach (BUILD-DECISIONS "Skeleton extraction" / migration
  // 014): a style_brief document, if given, is parsed to plain text and
  // stored on the version so the writer prompt can include it.
  const styleBriefDocumentId = typeof body?.styleBriefDocumentId === "string" ? body.styleBriefDocumentId : null;
  let styleBriefText: string | null = null;
  if (styleBriefDocumentId) {
    const doc = await getDrafterDocument(styleBriefDocumentId);
    if (doc?.parsed_content) styleBriefText = blocksToPlainText(doc.parsed_content);
  }

  const { stylepack, version } = await createStylepack({
    name,
    rules: SEED_STYLE_RULES,
    bannedPhrases,
    tenseRule: SEED_TENSE_RULE,
    lengthLimits: { min_words: wordLimits.min, max_words: wordLimits.max },
    styleBriefDocumentId,
    styleBriefText,
    actor: actor.email,
  });

  return NextResponse.json({ stylepack, version });
}
