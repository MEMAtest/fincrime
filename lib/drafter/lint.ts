/**
 * Code lint module (SPEC.md "Reviewer" - code lint, deterministic). Pure and
 * reusable: runs after drafting, on every save, and on text pasted in by a
 * user for review (per SPEC.md "The reviewer also runs on text pasted in by
 * the user"). No DB or model access here.
 */

export type LintRule =
  | "banned_phrase"
  | "req_id_outside_evidence"
  | "dash"
  | "tense"
  | "word_count"
  | "unfilled_placeholder"
  | "formula_error";

export interface LintIssue {
  rule: LintRule;
  severity: "warning" | "critical";
  message: string;
  match?: string;
  replacement?: string;
}

export interface BannedPhrase {
  phrase: string;
  replacement: string;
}

export interface LintInput {
  controlText: string;
  rationale: string;
  wordLimits?: { min: number; max: number };
  bannedPhrases?: BannedPhrase[];
}

const REQ_ID_RE = /\bREQ-\d+\b/gi;
const ARTICLE_REF_RE = /\bArt\.?\s?\d+[a-z]?(?:\s?\(\d+\))?/gi;
const DASH_RE = /[—–]/g; // em dash, en dash
const FORMULA_ERROR_RE = /#REF!|#N\/A|#VALUE!|#DIV\/0!|#NAME\?|#NULL!|#NUM!/g;
const UNFILLED_PLACEHOLDER_RE = /\[[^\]]*\]/g;
const TENSE_RE = /\b(was|will)\b/gi;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function lintBannedPhrases(text: string, bannedPhrases: BannedPhrase[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const lower = text.toLowerCase();
  for (const { phrase, replacement } of bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      issues.push({
        rule: "banned_phrase",
        severity: "critical",
        message: `Banned phrase "${phrase}" - suggested replacement "${replacement}".`,
        match: phrase,
        replacement,
      });
    }
  }
  return issues;
}

function lintReqIdsOutsideEvidence(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const match of text.matchAll(REQ_ID_RE)) {
    issues.push({ rule: "req_id_outside_evidence", severity: "critical", message: `REQ ID "${match[0]}" must appear only in the Evidence field.`, match: match[0] });
  }
  for (const match of text.matchAll(ARTICLE_REF_RE)) {
    issues.push({ rule: "req_id_outside_evidence", severity: "critical", message: `Article reference "${match[0]}" must appear only in the Evidence field.`, match: match[0] });
  }
  return issues;
}

function lintDashes(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const match of text.matchAll(DASH_RE)) {
    issues.push({ rule: "dash", severity: "warning", message: "No em dashes or en dashes.", match: match[0] });
  }
  return issues;
}

function lintTense(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const match of text.matchAll(TENSE_RE)) {
    issues.push({
      rule: "tense",
      severity: "warning",
      message: `"${match[0]}" - present tense for how the control works; present perfect only for a delivered build change; "will" only for something not yet live. Check this use.`,
      match: match[0],
    });
  }
  return issues;
}

function lintWordCount(text: string, limits: { min: number; max: number }): LintIssue[] {
  const count = countWords(text);
  if (count < limits.min) {
    return [{ rule: "word_count", severity: "warning", message: `Control text is ${count} words, below the ${limits.min}-${limits.max} word limit.` }];
  }
  if (count > limits.max) {
    return [{ rule: "word_count", severity: "warning", message: `Control text is ${count} words, above the ${limits.min}-${limits.max} word limit.` }];
  }
  return [];
}

function lintUnfilledPlaceholders(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const match of text.matchAll(UNFILLED_PLACEHOLDER_RE)) {
    issues.push({ rule: "unfilled_placeholder", severity: "critical", message: `Unfilled placeholder "${match[0]}" must be resolved before export.`, match: match[0] });
  }
  return issues;
}

function lintFormulaErrors(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const match of text.matchAll(FORMULA_ERROR_RE)) {
    issues.push({ rule: "formula_error", severity: "critical", message: `Formula error "${match[0]}" carried through as text - this must never be treated as a real value.`, match: match[0] });
  }
  return issues;
}

const DEFAULT_WORD_LIMITS = { min: 60, max: 150 };

/**
 * True when the control text is nothing but a single bracketed placeholder
 * (e.g. "[Agreed wording not held for this control]") - there is no real
 * prose to have a word count. Used to suppress the word-count lint on a
 * placeholder-only enhancement so it doesn't ALSO get a spurious "below
 * 60-150 words" warning on top of "needs input" (prod walkthrough item 3).
 */
export function isPlaceholderOnlyText(text: string): boolean {
  return /^\[[^\]]*\]$/.test(text.trim());
}

/** Runs every code lint rule against one enhancement's control_text + rationale. Word count applies to control_text only, per SPEC.md rule 9. */
export function lintEnhancement(input: LintInput): LintIssue[] {
  const bannedPhrases = input.bannedPhrases ?? [];
  const wordLimits = input.wordLimits ?? DEFAULT_WORD_LIMITS;
  const combined = `${input.controlText}\n${input.rationale}`;
  const placeholderOnly = isPlaceholderOnlyText(input.controlText);
  return [
    ...lintBannedPhrases(combined, bannedPhrases),
    ...lintReqIdsOutsideEvidence(combined),
    ...lintDashes(combined),
    ...lintTense(combined),
    ...(placeholderOnly ? [] : lintWordCount(input.controlText, wordLimits)),
    ...lintUnfilledPlaceholders(combined),
    ...lintFormulaErrors(combined),
  ];
}

export function lintStatus(issues: LintIssue[]): "pass" | "minor" | "critical" {
  if (issues.some((i) => i.severity === "critical")) return "critical";
  if (issues.length > 0) return "minor";
  return "pass";
}
