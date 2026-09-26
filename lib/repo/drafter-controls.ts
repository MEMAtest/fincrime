import { query, withTransaction, queryWithClient } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import { buildCodeTags, coverageGroup, type CoverageGroup } from "@/lib/drafter/tagging";
import type { RegisterCell } from "@/lib/drafter/validation";
import type { ColumnMappingEntry } from "@/lib/drafter/validation";

export interface ControlRow {
  id: string;
  title: string;
  req_ids: string[];
  register_row_ids: string[];
  backoffice_control: string | null;
  coverage: string | null;
  agreed_wording: string | null;
  used_in_pra_ids: string[];
  merge_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ControlTagRow {
  id: string;
  control_id: string;
  tag_type: string;
  value: string;
  origin: "code" | "suggested";
  confirmed: boolean;
  confirmed_by: string | null;
  evidence_phrase: string | null;
  model_name: string | null;
  prompt_version: string | null;
}

/**
 * Builds one control per accepted, non-blocked register row (v1 keeps the
 * mapping 1:1; merges happen afterwards via drafter_merge_groups, per
 * SPEC.md - a control is not pre-merged at build time). Blocked rows that
 * have not been resolved/overridden never reach the library, per SPEC.md
 * "blocking issues must be resolved or overridden ... before rows enter the
 * library".
 */
export async function buildControlsFromRegisterVersion(
  registerVersionId: string,
  rows: { id: string; req_id: string | null; fields: Record<string, RegisterCell>; is_blocked: boolean }[],
  mapping: ColumnMappingEntry[],
  actor: string
): Promise<{ created: number; skippedBlocked: number }> {
  let created = 0;
  let skippedBlocked = 0;

  const fieldKeyToValue = (fields: Record<string, RegisterCell>) => {
    const out: Record<string, string> = {};
    for (const col of mapping) {
      const cell = fields[col.sourceHeader];
      if (cell) out[col.fieldKey] = cell.text;
    }
    return out;
  };

  await withTransaction(async (client) => {
    for (const row of rows) {
      if (row.is_blocked) {
        skippedBlocked++;
        continue;
      }
      const values = fieldKeyToValue(row.fields);
      const codeTags = buildCodeTags(values);
      const coverage = coverageGroupToDbValue(coverageGroup(values.control_coverage_assessment));
      const title = values.obligation_description?.trim()
        ? values.obligation_description.trim().slice(0, 200)
        : row.req_id
          ? `Control for ${row.req_id}`
          : "Untitled control";

      const controlRows = await queryWithClient<{ id: string }>(
        client,
        `INSERT INTO drafter_controls (title, req_ids, register_row_ids, backoffice_control, coverage)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [title, row.req_id ? [row.req_id] : [], [row.id], codeTags.backoffice_control ?? null, coverage]
      );
      const controlId = controlRows[0].id;

      const codeTagEntries: [string, string][] = [
        ["backoffice_control", codeTags.backoffice_control],
        ["fincrime_area", codeTags.fincrime_area],
        ["jurisdiction", codeTags.jurisdiction],
        ["regulation_reference", codeTags.regulation_reference],
        ["coverage", codeTags.coverage],
        ["products_used_in", codeTags.products_used_in],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]));

      for (const [tagType, value] of codeTagEntries) {
        await queryWithClient(
          client,
          `INSERT INTO drafter_control_tags (control_id, tag_type, value, origin, confirmed)
           VALUES ($1,$2,$3,'code', true)`,
          [controlId, tagType, value]
        );
      }
      created++;
    }
  });

  await writeDrafterAudit(actor, "library.controls.build", "drafter_register_version", registerVersionId, {
    created,
    skippedBlocked,
  });

  return { created, skippedBlocked };
}

function coverageGroupToDbValue(group: CoverageGroup): "yes" | "partial" | "no" | "unassessed" {
  if (group === "reuse") return "yes";
  if (group === "adapt") return "partial";
  if (group === "new") return "no";
  return "unassessed";
}

/**
 * Sets a control's agreed wording (Scope B fix #7: reuse must never fall
 * back to the obligation description - a requirement is not control
 * wording). Called either directly on the library control, or from
 * approving an enhancement (SPEC.md "Exemplar promotion": "Approving an
 * enhancement also writes the control's agreed_wording + used_in").
 */
export async function setAgreedWording(controlId: string, agreedWording: string, actor: string): Promise<ControlRow | null> {
  const rows = await query<ControlRow>(
    `UPDATE drafter_controls SET agreed_wording = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [controlId, agreedWording]
  );
  const row = rows[0] ?? null;
  if (row) await writeDrafterAudit(actor, "library.control.set_agreed_wording", "drafter_control", controlId, {});
  return row;
}

export async function listControls(): Promise<ControlRow[]> {
  return query<ControlRow>(`SELECT * FROM drafter_controls ORDER BY created_at DESC`);
}

export async function getControl(id: string): Promise<ControlRow | null> {
  const rows = await query<ControlRow>(`SELECT * FROM drafter_controls WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listControlTags(controlId: string): Promise<ControlTagRow[]> {
  return query<ControlTagRow>(`SELECT * FROM drafter_control_tags WHERE control_id = $1 ORDER BY created_at ASC`, [controlId]);
}

export async function listAllConfirmedTags(): Promise<ControlTagRow[]> {
  return query<ControlTagRow>(`SELECT * FROM drafter_control_tags WHERE confirmed = true`);
}

export async function addSuggestedTag(input: {
  controlId: string;
  tagType: string;
  value: string;
  evidencePhrase: string;
  modelName: string;
  promptVersion: string;
}): Promise<ControlTagRow> {
  const rows = await query<ControlTagRow>(
    `INSERT INTO drafter_control_tags (control_id, tag_type, value, origin, confirmed, evidence_phrase, model_name, prompt_version)
     VALUES ($1,$2,$3,'suggested', false, $4, $5, $6) RETURNING *`,
    [input.controlId, input.tagType, input.value, input.evidencePhrase, input.modelName, input.promptVersion]
  );
  return rows[0];
}

export async function confirmTag(tagId: string, actor: string): Promise<ControlTagRow | null> {
  const rows = await query<ControlTagRow>(
    `UPDATE drafter_control_tags SET confirmed = true, confirmed_by = $2, confirmed_at = now() WHERE id = $1 RETURNING *`,
    [tagId, actor]
  );
  const row = rows[0] ?? null;
  if (row) await writeDrafterAudit(actor, "library.tag.confirm", "drafter_control_tag", tagId, {});
  return row;
}

export async function rejectTag(tagId: string, actor: string): Promise<void> {
  await query(`DELETE FROM drafter_control_tags WHERE id = $1 AND origin = 'suggested' AND confirmed = false`, [tagId]);
  await writeDrafterAudit(actor, "library.tag.reject", "drafter_control_tag", tagId, {});
}

export interface MergeGroupRow {
  id: string;
  backoffice_control: string;
  risk_tag_value: string;
  status: "candidate" | "confirmed" | "split" | "rejected";
  member_control_ids: string[];
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export async function upsertMergeGroupCandidate(input: {
  backofficeControl: string;
  riskTagValue: string;
  controlIds: string[];
}): Promise<MergeGroupRow> {
  const existing = await query<MergeGroupRow>(
    `SELECT * FROM drafter_merge_groups WHERE backoffice_control = $1 AND risk_tag_value = $2 AND status = 'candidate'`,
    [input.backofficeControl, input.riskTagValue]
  );
  if (existing[0]) {
    const rows = await query<MergeGroupRow>(
      `UPDATE drafter_merge_groups SET member_control_ids = $2 WHERE id = $1 RETURNING *`,
      [existing[0].id, input.controlIds]
    );
    return rows[0];
  }
  const rows = await query<MergeGroupRow>(
    `INSERT INTO drafter_merge_groups (backoffice_control, risk_tag_value, member_control_ids)
     VALUES ($1,$2,$3) RETURNING *`,
    [input.backofficeControl, input.riskTagValue, input.controlIds]
  );
  return rows[0];
}

export async function listMergeGroups(): Promise<MergeGroupRow[]> {
  return query<MergeGroupRow>(`SELECT * FROM drafter_merge_groups ORDER BY created_at DESC`);
}

export async function decideMergeGroup(
  id: string,
  status: "confirmed" | "split" | "rejected",
  actor: string
): Promise<MergeGroupRow | null> {
  const rows = await query<MergeGroupRow>(
    `UPDATE drafter_merge_groups SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1 RETURNING *`,
    [id, status, actor]
  );
  const row = rows[0] ?? null;
  if (row) {
    if (status === "confirmed") {
      await query(`UPDATE drafter_controls SET merge_group_id = $1 WHERE id = ANY($2::uuid[])`, [id, row.member_control_ids]);
    }
    await writeDrafterAudit(actor, `library.merge_group.${status}`, "drafter_merge_group", id, {});
  }
  return row;
}
