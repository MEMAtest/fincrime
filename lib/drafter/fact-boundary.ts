/**
 * Fact boundary (SPEC.md "Drafting" / BUILD-DECISIONS.md "Fact boundary"),
 * enforced in code after generation, never by the model.
 *
 * - Deterministic: numbers, amounts, percentages, frequencies, durations and
 *   thresholds in the model's output must appear (case-insensitively) in the
 *   inputs; anything that doesn't is REPLACED with a bracketed placeholder
 *   and logged.
 * - Roles/system names: a capitalised multi-word term or acronym in the
 *   output that is not in a known-terms set DERIVED FROM THE INPUTS is
 *   FLAGGED (highlighted, added to open items) - never trusted, but also
 *   never silently replaced, and never matched against a hand-written
 *   blocklist of "bad" terms.
 */

export interface FactBoundaryPlaceholder {
  original: string;
  reason: string;
}

export interface FactBoundaryFlag {
  term: string;
  reason: string;
}

export interface FactBoundaryResult {
  text: string;
  placeholders: FactBoundaryPlaceholder[];
  flags: FactBoundaryFlag[];
}

// Longest/most specific alternatives first so the regex engine prefers a
// full frequency phrase ("every 12 months") over matching just the digits.
const FACT_TOKEN_RE =
  /\bevery\s+\d+\s+(?:day|days|week|weeks|month|months|year|years)\b|\b(?:daily|weekly|monthly|quarterly|annually|yearly|biannually|semi-annually)\b|[£$€]\s?\d+(?:\.\d+)?\s?(?:m|k|bn)?|\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\b/gi;

// Grammatical connectors excluded from a multi-word capitalised sequence so
// a plain sentence-start ("The Senior Risk Committee...") does not pull
// "The" into the flagged term. This is a tiny closed set of ARTICLES/
// PRONOUNS, not a blocklist of "bad" terms (see BUILD-DECISIONS.md: never
// blocklist fabrications) - it never affects whether a term is flagged,
// only where a multi-word match starts.
const LEADING_CONNECTOR = "(?:The|This|It|A|An)";
const KNOWN_TERM_RE = new RegExp(
  `\\b(?:[A-Z]{2,}[A-Za-z0-9]*|(?!${LEADING_CONNECTOR}\\b)[A-Z][a-z]+(?:\\s+(?!${LEADING_CONNECTOR}\\b)[A-Z][a-z]+)+)\\b`,
  "g"
);

function normalise(text: string): string {
  return text.trim().toLowerCase();
}

/** Extracts the known-terms set (capitalised multi-word terms / acronyms) present anywhere in the given input texts. */
export function deriveKnownTerms(inputTexts: string[]): Set<string> {
  const known = new Set<string>();
  for (const input of inputTexts) {
    if (!input) continue;
    const matches = input.match(KNOWN_TERM_RE) ?? [];
    for (const match of matches) known.add(normalise(match));
  }
  return known;
}

/** True if `token` (a number/frequency/duration/threshold match) appears verbatim (case-insensitively) in the combined input text. */
function factSupported(token: string, combinedInputText: string): boolean {
  return combinedInputText.includes(normalise(token));
}

/**
 * Applies the fact boundary to one generated field (control_text or
 * rationale). `inputTexts` should be every text the model was given for
 * this enhancement (product description + draft inputs actually used +
 * exemplars), so the same numbers/terms the model was legitimately shown
 * are never flagged or replaced.
 */
export function applyFactBoundary(generatedText: string, inputTexts: string[]): FactBoundaryResult {
  const combinedInputText = normalise(inputTexts.join("\n"));
  const knownTerms = deriveKnownTerms(inputTexts);
  const placeholders: FactBoundaryPlaceholder[] = [];
  const flags: FactBoundaryFlag[] = [];

  const text = generatedText.replace(FACT_TOKEN_RE, (match) => {
    if (factSupported(match, combinedInputText)) return match;
    placeholders.push({ original: match, reason: "This figure does not appear in the inputs given to the model." });
    return "[unsupported figure - verify]";
  });

  const termMatches = text.match(KNOWN_TERM_RE) ?? [];
  const seen = new Set<string>();
  for (const term of termMatches) {
    const key = normalise(term);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!knownTerms.has(key)) {
      flags.push({ term, reason: "This term is not present in the inputs given to the model - verify it is not an invented role or system name." });
    }
  }

  return { text, placeholders, flags };
}
