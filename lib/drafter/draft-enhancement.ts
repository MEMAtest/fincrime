/**
 * Drives the writer step for one enhancement (SPEC.md "Drafting" - model
 * step, driven one call per enhancement from the browser). Composes the
 * pure modules (prompts, fact boundary, lint) with the repo layer and the
 * model provider. Not unit tested directly (it touches the DB and the
 * model) - its pieces are; see lib/drafter/__tests__/prompts.test.ts,
 * fact-boundary.test.ts and lint.test.ts.
 */

import { callDrafterModel, isUnderCostCap, PROMPT_VERSIONS, formatCostCapMessage } from "./llm";
import { buildWriterPrompt, draftInputsAreEmpty, type WriterDraftInputs } from "./prompts";
import { applyFactBoundary, type FactBoundaryFlag, type FactBoundaryPlaceholder } from "./fact-boundary";
import { lintEnhancement, isPlaceholderOnlyText } from "./lint";
import { combineStatus } from "./review-status";
import {
  getEnhancement,
  getPra,
  getSectionById,
  getControlSourceFields,
  updateEnhancementDraft,
  createOpenItem,
  markControlUsedInPra,
  updatePraSpend,
  type DrafterEnhancementRow,
} from "@/lib/repo/drafter-pras";
import { getControl } from "@/lib/repo/drafter-controls";
import { getStylepackVersion, getExemplarsForSectionType } from "@/lib/repo/drafter-stylepacks";
import { writeDrafterAudit } from "@/lib/repo/drafter-audit";
import { maybeAdvancePraStatus } from "./pra-status";

export interface DraftResult {
  ok: boolean;
  enhancement?: DrafterEnhancementRow;
  reason?: string;
}

const PLACEHOLDER_NO_INPUT_TEXT =
  "[No control review notes, uplift or remediation text was provided for this control - placeholder pending input.]";

export async function draftOneEnhancement(enhancementId: string, actor: string): Promise<DraftResult> {
  const enhancement = await getEnhancement(enhancementId);
  if (!enhancement) return { ok: false, reason: "Enhancement not found." };
  if (enhancement.is_gap) return { ok: false, reason: "Gaps are placeholders - the model never drafts a manually entered gap." };

  const pra = await getPra(enhancement.pra_id);
  if (!pra) return { ok: false, reason: "PRA not found." };
  const section = await getSectionById(enhancement.section_id);
  if (!section) return { ok: false, reason: "Section not found." };

  const stylepackVersion = await getStylepackVersion(pra.stylepack_version_id);
  if (!stylepackVersion) return { ok: false, reason: "StylePack version not found." };

  const controlId = enhancement.control_ids[0];
  const control = controlId ? await getControl(controlId) : null;
  const sourceFields = controlId ? await getControlSourceFields(controlId) : {};

  let controlText: string;
  let rationale: string;
  let placeholders: FactBoundaryPlaceholder[] = [];
  const flags: FactBoundaryFlag[] = [];
  let modelName: string | null = null;
  let promptVersion: string | null = null;
  let costPence = 0;

  if (control?.coverage === "yes") {
    // Reuse: agreed wording, NEVER a model call (SPEC.md "Reuse, adapt or
    // new"). Scope B fix: an obligation description is a regulatory
    // requirement, not control WORDING - falling back to it produced text
    // that read as an obligation, not an enhancement. When no agreed
    // wording is held, this is a placeholder + open item, and the user
    // approves/enters agreed wording on the library control instead (see
    // POST /api/drafter/library/controls/[id]/agreed-wording).
    const reused = control.agreed_wording?.trim() || null;
    const NO_AGREED_WORDING_TEXT = "[Agreed wording not held for this control]";
    if (!reused) {
      controlText = NO_AGREED_WORDING_TEXT;
      rationale = "";
      placeholders = [
        {
          original: NO_AGREED_WORDING_TEXT,
          reason: "Marked reuse, but no agreed wording is held for this control. Enter and approve agreed wording on the library control, then re-draft.",
        },
      ];
    } else {
      controlText = reused;
      rationale =
        "[Reused control - this enhancement carries an existing agreed wording forward; v1 does not separately track a reused rationale. Review before export.]";
      placeholders = [{ original: rationale, reason: "Reused control - rationale is a placeholder pending confirmation." }];
    }
  } else {
    const draftInputs: WriterDraftInputs = {
      obligationDescription: sourceFields.obligation_description ?? null,
      controlReviewNotes: sourceFields.control_review_notes ?? null,
      controlUpliftAmendment: sourceFields.control_uplift_amendment ?? null,
      remediationGaps: sourceFields.remediation_gaps ?? null,
    };

    if (draftInputsAreEmpty(draftInputs)) {
      // SPEC.md "Drafting": "Empty draft inputs -> placeholder enhancement, no call."
      controlText = PLACEHOLDER_NO_INPUT_TEXT;
      rationale = "";
      placeholders = [{ original: PLACEHOLDER_NO_INPUT_TEXT, reason: "No Control Review Notes, Uplift or Remediation text was available." }];
    } else {
      const capCheck = await isUnderCostCap(pra.id);
      if (!capCheck.underCap) {
        return { ok: false, reason: `Cost cap reached for this PRA (${formatCostCapMessage(capCheck)}). No further model calls will be made.` };
      }

      const { exemplars } = await getExemplarsForSectionType(section.title);
      const built = buildWriterPrompt({
        styleRules: stylepackVersion.rules,
        bannedPhrases: stylepackVersion.banned_phrases,
        wordLimits: { min: stylepackVersion.length_limits.min_words, max: stylepackVersion.length_limits.max_words },
        exemplars: exemplars.slice(0, 3).map((e) => ({ sectionType: e.section_type, controlText: e.control_text, rationale: e.rationale })),
        productDescription: pra.description ?? "",
        sectionTitle: `${section.section_number} ${section.title}`,
        draftInputs,
        styleBrief: stylepackVersion.style_brief_text ?? null,
      });

      const call = await callDrafterModel({
        role: "writer",
        promptVersion: PROMPT_VERSIONS.writer_enhancement,
        systemPrompt: built.system,
        userPrompt: built.user,
        temperature: 0.2,
        praId: pra.id,
        enhancementId: enhancement.id,
      });

      if (!call.ok) {
        await updateEnhancementDraft(enhancement.id, { reviewResult: { lint: [], status: "not_reviewed", error: call.error } });
        return { ok: false, reason: call.error };
      }

      const json = call.json as { control_text?: unknown; rationale?: unknown; placeholders?: unknown };
      if (typeof json.control_text !== "string" || typeof json.rationale !== "string") {
        const error = "Model response was missing control_text or rationale as strings.";
        await updateEnhancementDraft(enhancement.id, { reviewResult: { lint: [], status: "not_reviewed", error } });
        return { ok: false, reason: error };
      }

      const factControl = applyFactBoundary(json.control_text, built.allowedInputTexts);
      const factRationale = applyFactBoundary(json.rationale, built.allowedInputTexts);
      controlText = factControl.text;
      rationale = factRationale.text;
      const modelPlaceholders: FactBoundaryPlaceholder[] = Array.isArray(json.placeholders)
        ? (json.placeholders as unknown[]).filter((p): p is string => typeof p === "string").map((p) => ({ original: p, reason: "Placeholder declared by the model." }))
        : [];
      placeholders = [...modelPlaceholders, ...factControl.placeholders, ...factRationale.placeholders];
      flags.push(...factControl.flags, ...factRationale.flags);
      modelName = call.modelName;
      promptVersion = PROMPT_VERSIONS.writer_enhancement;
      costPence = call.costEstimatePence;
    }
  }

  const lintIssues = lintEnhancement({
    controlText,
    rationale,
    wordLimits: { min: stylepackVersion.length_limits.min_words, max: stylepackVersion.length_limits.max_words },
    bannedPhrases: stylepackVersion.banned_phrases,
  });
  // A (re)draft always invalidates any previous judge result - the text
  // just changed, so a stale "pass" must never be shown.
  const needsInput = enhancement.is_gap || isPlaceholderOnlyText(controlText) || !controlText.trim();
  const status = combineStatus({ lintIssues, judge: null, judgeStale: false, needsInput });

  const updated = await updateEnhancementDraft(enhancement.id, {
    controlText,
    rationale,
    placeholders,
    reviewResult: { lint: lintIssues, judge: null, judgeStale: false, status },
    modelName: modelName ?? undefined,
    promptVersion: promptVersion ?? undefined,
  });

  for (const p of placeholders) {
    await createOpenItem({ praId: pra.id, enhancementId: enhancement.id, itemType: "placeholder", description: `${p.original} - ${p.reason}` });
  }
  for (const f of flags) {
    await createOpenItem({
      praId: pra.id,
      enhancementId: enhancement.id,
      itemType: "unsupported_term",
      description: `"${f.term}" - ${f.reason}`,
    });
  }
  if (control?.coverage === "no") {
    await createOpenItem({
      praId: pra.id,
      enhancementId: enhancement.id,
      itemType: "gap",
      description: "New-coverage control (no prior coverage) - flag for closer review before approval.",
    });
  }
  if (controlId) await markControlUsedInPra(controlId, pra.id);
  if (costPence > 0) await updatePraSpend(pra.id, costPence);
  await writeDrafterAudit(actor, "enhancement.draft", "drafter_enhancement", enhancement.id, { status, modelName });
  await maybeAdvancePraStatus(pra.id);

  return { ok: true, enhancement: updated };
}
