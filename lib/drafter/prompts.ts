/**
 * Writer prompt construction (SPEC.md "Drafting" - model step). Pure string
 * building, no DB or network access, so it can be unit tested directly.
 *
 * CRITICAL: the register's "Rationale" column is NEVER passed to the model
 * (SPEC.md "Register import": "It is never used to write a PRA rationale").
 * This module only accepts the specific named fields below - it has no
 * parameter through which a caller could pass that column - and
 * `lib/drafter/__tests__/prompts.test.ts` additionally asserts the literal
 * word "rationale" (register-column sense) never reaches the built prompt
 * text outside of the instruction asking the model to WRITE a rationale.
 */

import type { BannedPhrase } from "./lint";

export interface WriterExemplar {
  sectionType: string;
  controlText: string;
  rationale: string;
}

export interface WriterDraftInputs {
  /** Obligation description - context, always included when present. */
  obligationDescription: string | null;
  /** In SPEC.md priority order: Control Review Notes, then Control Uplift / Amendment, then Remediation. Empty ones are omitted. */
  controlReviewNotes: string | null;
  controlUpliftAmendment: string | null;
  remediationGaps: string | null;
}

export interface WriterPromptInput {
  styleRules: string[];
  bannedPhrases: BannedPhrase[];
  wordLimits: { min: number; max: number };
  exemplars: WriterExemplar[]; // 2-3, section-matched
  productDescription: string;
  sectionTitle: string;
  draftInputs: WriterDraftInputs;
}

export interface BuiltWriterPrompt {
  system: string;
  user: string;
  /** The exact texts the model was shown, for the fact-boundary check afterwards - every number/term in these is "supported". */
  allowedInputTexts: string[];
}

/** True when a draft input has no usable content across all three priority fields (SPEC.md: "Empty draft inputs -> placeholder enhancement, no call"). */
export function draftInputsAreEmpty(inputs: WriterDraftInputs): boolean {
  return !inputs.controlReviewNotes?.trim() && !inputs.controlUpliftAmendment?.trim() && !inputs.remediationGaps?.trim();
}

/** The draft-input texts in SPEC.md priority order, non-empty only. */
function prioritisedDraftInputTexts(inputs: WriterDraftInputs): { label: string; text: string }[] {
  const ordered: { label: string; text: string | null }[] = [
    { label: "Control Review Notes", text: inputs.controlReviewNotes },
    { label: "Control Uplift / Amendment", text: inputs.controlUpliftAmendment },
    { label: "Remediation on identified gaps", text: inputs.remediationGaps },
  ];
  return ordered.filter((o): o is { label: string; text: string } => Boolean(o.text?.trim()));
}

export function buildWriterPrompt(input: WriterPromptInput): BuiltWriterPrompt {
  const system = [
    "You are drafting one control enhancement for a Financial Crime Product Risk Assessment (PRA), in house style.",
    "You write exactly two fields: control_text and rationale. You never decide whether a control is needed, and you never invent a fact - only use numbers, roles, thresholds and system names given to you below.",
    "Style rules:",
    ...input.styleRules.map((r, i) => `${i + 1}. ${r}`),
    `Control text word count: ${input.wordLimits.min} to ${input.wordLimits.max} words.`,
    input.bannedPhrases.length
      ? `Avoid these phrases (with a plain replacement): ${input.bannedPhrases.map((b) => `"${b.phrase}" -> "${b.replacement}"`).join(", ")}.`
      : "",
    "REQ IDs and article references must NOT appear in control_text or rationale - they belong only in the Evidence field, which you do not write.",
    "No em dashes or en dashes.",
    "Respond with JSON only: {\"control_text\": string, \"rationale\": string, \"placeholders\": string[]}. Use placeholders (as short bracketed notes in your own text) for anything you are missing a fact for - never guess.",
  ]
    .filter(Boolean)
    .join("\n");

  const exemplarBlocks = input.exemplars.map(
    (e, i) => `Exemplar ${i + 1} (${e.sectionType}):\nControl text: ${e.controlText}\nRationale: ${e.rationale}`
  );

  const draftInputTexts = prioritisedDraftInputTexts(input.draftInputs);
  const draftInputBlocks = draftInputTexts.map((d) => `${d.label}: ${d.text}`);

  const userParts = [
    `Product description: ${input.productDescription}`,
    `Section: ${input.sectionTitle}`,
    input.draftInputs.obligationDescription?.trim() ? `Obligation description: ${input.draftInputs.obligationDescription.trim()}` : "",
    draftInputBlocks.length ? `Draft inputs, in priority order:\n${draftInputBlocks.join("\n")}` : "",
    exemplarBlocks.length ? `Style exemplars (form only - do not reuse their facts):\n${exemplarBlocks.join("\n\n")}` : "",
  ].filter(Boolean);

  const user = userParts.join("\n\n");

  const allowedInputTexts = [
    input.productDescription,
    input.draftInputs.obligationDescription ?? "",
    ...draftInputTexts.map((d) => d.text),
    ...input.exemplars.flatMap((e) => [e.controlText, e.rationale]),
  ];

  return { system, user, allowedInputTexts };
}
