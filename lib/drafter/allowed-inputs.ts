/**
 * The fact-boundary "allowed" input texts for one enhancement, shared by
 * the writer (draft-enhancement.ts, via prompts.ts's buildWriterPrompt) and
 * the judge-rewrite check (judge-runner.ts).
 *
 * Per the task: a judge's suggested_rewrite must be checked against the SAME
 * inputs the enhancement was drafted from - its register rows' draft inputs
 * (Control Review Notes, Control Uplift / Amendment, Remediation) plus the
 * Obligation description and the product description - and NEVER the
 * register's "Rationale" column (BUILD-DECISIONS.md "Fact boundary": "The
 * register's Rationale column is never passed to the model").
 */
import { getControlSourceFields, type DrafterEnhancementRow, type DrafterPraRow } from "@/lib/repo/drafter-pras";

/** Fetches the draft-input texts (never Rationale) an enhancement was legitimately drafted from, for one control id. */
export async function getAllowedInputTextsForEnhancement(
  enhancement: DrafterEnhancementRow,
  pra: DrafterPraRow
): Promise<string[]> {
  const texts: string[] = [pra.description ?? ""];
  for (const controlId of enhancement.control_ids) {
    const sourceFields = await getControlSourceFields(controlId);
    texts.push(
      sourceFields.obligation_description ?? "",
      sourceFields.control_review_notes ?? "",
      sourceFields.control_uplift_amendment ?? "",
      sourceFields.remediation_gaps ?? ""
    );
  }
  // The reused/current control text and rationale are also legitimate
  // context for a rewrite (they are what the rewrite is revising, not an
  // invented fact) - never the register's Rationale column, which never
  // reaches this list.
  if (enhancement.control_text) texts.push(enhancement.control_text);
  if (enhancement.rationale) texts.push(enhancement.rationale);
  return texts;
}
