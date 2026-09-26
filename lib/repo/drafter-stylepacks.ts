import { query } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { BannedPhrase } from "@/lib/drafter/lint";

export interface StylepackRow {
  id: string;
  name: string;
  current_version: number;
  created_at: string;
}

export interface StylepackVersionRow {
  id: string;
  stylepack_id: string;
  version: number;
  rules: string[];
  banned_phrases: BannedPhrase[];
  tense_rule: string | null;
  length_limits: { min_words: number; max_words: number };
  created_by: string;
  created_at: string;
}

// SPEC.md "Style rules" 1-9, seeded verbatim; editable afterwards via a new version.
export const SEED_STYLE_RULES = [
  "One enhancement describes one mechanism: trigger, actor, action, outcome.",
  "No enhancement only restates that a policy exists.",
  "Scope is stated, as a short list when there are several cases.",
  "Rationale explains the risk and the design choice in 2 to 4 sentences; it does not describe a register gap or open with a standard's name.",
  "Present tense for how the control works; present perfect only for a delivered build change; \"will\" only for something not yet live.",
  "REQ IDs and article references appear only in the Evidence field.",
  "Measured tone: banned-phrase list with plain replacements.",
  "No em dashes or en dashes.",
  "Control text 60 to 150 words.",
];

export const SEED_TENSE_RULE =
  "Present tense for how the control works; present perfect only for a delivered build change; \"will\" only for something not yet live.";

export async function createStylepack(input: {
  name: string;
  rules: string[];
  bannedPhrases: BannedPhrase[];
  tenseRule: string;
  lengthLimits: { min_words: number; max_words: number };
  actor: string;
}): Promise<{ stylepack: StylepackRow; version: StylepackVersionRow }> {
  const stylepackRows = await query<StylepackRow>(`INSERT INTO drafter_stylepacks (name) VALUES ($1) RETURNING *`, [input.name]);
  const stylepack = stylepackRows[0];
  const versionRows = await query<StylepackVersionRow>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,$2,$3,$4,$5,$6) RETURNING *`,
    [stylepack.id, JSON.stringify(input.rules), JSON.stringify(input.bannedPhrases), input.tenseRule, JSON.stringify(input.lengthLimits), input.actor]
  );
  await writeDrafterAudit(input.actor, "stylepack.create", "drafter_stylepack", stylepack.id, { name: input.name });
  return { stylepack, version: versionRows[0] };
}

export async function listStylepacks(): Promise<StylepackRow[]> {
  return query<StylepackRow>(`SELECT * FROM drafter_stylepacks ORDER BY created_at DESC`);
}

export async function getStylepackVersion(id: string): Promise<StylepackVersionRow | null> {
  const rows = await query<StylepackVersionRow>(`SELECT * FROM drafter_stylepack_versions WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listStylepackVersions(stylepackId: string): Promise<StylepackVersionRow[]> {
  return query<StylepackVersionRow>(`SELECT * FROM drafter_stylepack_versions WHERE stylepack_id = $1 ORDER BY version DESC`, [stylepackId]);
}

export async function getLatestStylepackVersion(): Promise<StylepackVersionRow | null> {
  const rows = await query<StylepackVersionRow>(`SELECT * FROM drafter_stylepack_versions ORDER BY created_at DESC LIMIT 1`);
  return rows[0] ?? null;
}

/** Editing a StylePack creates a new version (SPEC.md: "editable and versioned"). */
export async function saveEditedStylepackVersion(input: {
  stylepackId: string;
  rules: string[];
  bannedPhrases: BannedPhrase[];
  tenseRule: string;
  lengthLimits: { min_words: number; max_words: number };
  actor: string;
}): Promise<StylepackVersionRow> {
  const maxRows = await query<{ max: number }>(`SELECT COALESCE(MAX(version), 0) AS max FROM drafter_stylepack_versions WHERE stylepack_id = $1`, [
    input.stylepackId,
  ]);
  const nextVersion = (maxRows[0]?.max ?? 0) + 1;
  const rows = await query<StylepackVersionRow>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      input.stylepackId,
      nextVersion,
      JSON.stringify(input.rules),
      JSON.stringify(input.bannedPhrases),
      input.tenseRule,
      JSON.stringify(input.lengthLimits),
      input.actor,
    ]
  );
  await query(`UPDATE drafter_stylepacks SET current_version = $2 WHERE id = $1`, [input.stylepackId, nextVersion]);
  await writeDrafterAudit(input.actor, "stylepack.edit_version", "drafter_stylepack", input.stylepackId, { version: nextVersion });
  return rows[0];
}

export interface ExemplarRow {
  id: string;
  stylepack_version_id: string | null;
  section_type: string;
  control_text: string;
  rationale: string;
  source: "template" | "user_approved";
  source_document_id: string | null;
  source_pra_id: string | null;
  created_by: string;
  created_at: string;
}

export async function createExemplar(input: {
  stylepackVersionId: string | null;
  sectionType: string;
  controlText: string;
  rationale: string;
  source: "template" | "user_approved";
  sourceDocumentId: string | null;
  sourcePraId: string | null;
  actor: string;
}): Promise<ExemplarRow> {
  const rows = await query<ExemplarRow>(
    `INSERT INTO drafter_exemplars (stylepack_version_id, section_type, control_text, rationale, source, source_document_id, source_pra_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      input.stylepackVersionId,
      input.sectionType,
      input.controlText,
      input.rationale,
      input.source,
      input.sourceDocumentId,
      input.sourcePraId,
      input.actor,
    ]
  );
  await writeDrafterAudit(input.actor, "exemplar.create", "drafter_exemplar", rows[0].id, { sectionType: input.sectionType, source: input.source });
  return rows[0];
}

export async function listExemplars(): Promise<ExemplarRow[]> {
  return query<ExemplarRow>(`SELECT * FROM drafter_exemplars ORDER BY created_at DESC`);
}

/** 2-3 exemplars matching a section type (SPEC.md: "A draft sees only the 2 or 3 exemplars matching its section"). Falls back to the most recent exemplars of any type if none match, so drafting is never blocked by a naming mismatch - but this fallback is logged by the caller as a warning. */
export async function getExemplarsForSectionType(sectionType: string, limit = 3): Promise<{ exemplars: ExemplarRow[]; usedFallback: boolean }> {
  const matched = await query<ExemplarRow>(
    `SELECT * FROM drafter_exemplars WHERE lower(section_type) = lower($1) ORDER BY created_at DESC LIMIT $2`,
    [sectionType, limit]
  );
  if (matched.length > 0) return { exemplars: matched, usedFallback: false };
  const fallback = await query<ExemplarRow>(`SELECT * FROM drafter_exemplars ORDER BY created_at DESC LIMIT $1`, [limit]);
  return { exemplars: fallback, usedFallback: true };
}
