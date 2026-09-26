/**
 * SAFETY: fact boundary on SAVE of an Apply-fix edit (task: "run the fact
 * boundary on SAVE of any edit that came from Apply fix ... flag new
 * unsupported terms as open items, never silently"). A manual edit stays the
 * user's own responsibility for its wording, so this only runs for
 * editType === "apply_fix" (see the PATCH route). Never rewrites what the
 * user just saved - it only flags, as open items, so nothing disappears
 * silently.
 */
import { applyFactBoundary } from "./fact-boundary";
import { getAllowedInputTextsForEnhancement } from "./allowed-inputs";
import type { DrafterEnhancementRow, DrafterPraRow } from "@/lib/repo/drafter-pras";

export interface SavedEditForBoundary {
  field: string;
  newValue: string | null;
}

/** Returns one open-item description per newly unsupported figure/frequency or flagged role/system in the saved edit(s), or [] when nothing is unsupported. */
export async function flagUnsupportedEditTerms(
  edits: SavedEditForBoundary[],
  enhancement: DrafterEnhancementRow,
  pra: DrafterPraRow,
  editType: string
): Promise<string[]> {
  const allowedInputTexts = await getAllowedInputTextsForEnhancement(enhancement, pra);
  const descriptions: string[] = [];
  for (const edit of edits) {
    const boundary = applyFactBoundary(edit.newValue ?? "", allowedInputTexts);
    for (const p of boundary.placeholders) {
      descriptions.push(`Saved edit (${editType}) to ${edit.field} introduced "${p.original}" - ${p.reason} Verify before export.`);
    }
    for (const f of boundary.flags) {
      descriptions.push(`Saved edit (${editType}) to ${edit.field} used "${f.term}" - ${f.reason}`);
    }
  }
  return descriptions;
}
