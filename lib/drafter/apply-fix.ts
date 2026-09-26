/**
 * "Apply fix" (SPEC.md "Page viewer and editing": "Apply fix replaces the
 * quoted sentence with the suggestion in an editable box before saving").
 * Pure string replacement - the result is put into the editable box, NOT
 * saved automatically; the user still has to hit Save (which re-lints).
 */
export interface ApplyFixResult {
  applied: boolean;
  text: string;
}

export function applyFix(currentText: string, quote: string, suggestion: string): ApplyFixResult {
  if (!quote || !currentText.includes(quote)) return { applied: false, text: currentText };
  return { applied: true, text: currentText.replace(quote, suggestion) };
}

/** Decides which field (control text or rationale) a judge criterion's quote came from, so Apply fix edits the right box. */
export function fieldForQuote(quote: string, controlText: string, rationale: string): "control_text" | "rationale" | null {
  if (controlText.includes(quote)) return "control_text";
  if (rationale.includes(quote)) return "rationale";
  return null;
}
