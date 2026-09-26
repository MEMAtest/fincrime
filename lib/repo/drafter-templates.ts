import { query, withTransaction, queryWithClient } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { SkeletonFieldLabels, SkeletonSection } from "@/lib/drafter/skeleton";

export interface TemplateRow {
  id: string;
  source_document_id: string | null;
  name: string;
  current_version: number;
  created_at: string;
}

export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version: number;
  sections: SkeletonSection[];
  field_labels: SkeletonFieldLabels;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
}

export async function createTemplate(input: {
  sourceDocumentId: string | null;
  name: string;
  sections: SkeletonSection[];
  fieldLabels: SkeletonFieldLabels;
  actor: string;
}): Promise<{ template: TemplateRow; version: TemplateVersionRow }> {
  const templateRows = await query<TemplateRow>(
    `INSERT INTO drafter_templates (source_document_id, name) VALUES ($1,$2) RETURNING *`,
    [input.sourceDocumentId, input.name]
  );
  const template = templateRows[0];
  const versionRows = await query<TemplateVersionRow>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, created_by)
     VALUES ($1,1,$2,$3,$4) RETURNING *`,
    [template.id, JSON.stringify(input.sections), JSON.stringify(input.fieldLabels), input.actor]
  );
  await writeDrafterAudit(input.actor, "template.create", "drafter_template", template.id, { name: input.name });
  return { template, version: versionRows[0] };
}

export async function listTemplates(): Promise<TemplateRow[]> {
  return query<TemplateRow>(`SELECT * FROM drafter_templates ORDER BY created_at DESC`);
}

export async function getTemplateVersion(id: string): Promise<TemplateVersionRow | null> {
  const rows = await query<TemplateVersionRow>(`SELECT * FROM drafter_template_versions WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersionRow[]> {
  return query<TemplateVersionRow>(`SELECT * FROM drafter_template_versions WHERE template_id = $1 ORDER BY version DESC`, [templateId]);
}

export async function getLatestConfirmedTemplateVersion(): Promise<TemplateVersionRow | null> {
  const rows = await query<TemplateVersionRow>(
    `SELECT * FROM drafter_template_versions WHERE confirmed = true ORDER BY created_at DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

/**
 * Confirms a template version after user review/edits to the proposed
 * sections/field labels (SPEC.md "Template and house style": "A review
 * screen where the user edits/confirms the skeleton ... before it becomes a
 * versioned Template"). Edits create a NEW version rather than mutating the
 * proposal in place, so the extraction that produced it stays reproducible.
 */
export async function saveEditedTemplateVersion(input: {
  templateId: string;
  sections: SkeletonSection[];
  fieldLabels: SkeletonFieldLabels;
  actor: string;
}): Promise<TemplateVersionRow> {
  const maxRows = await query<{ max: number }>(`SELECT COALESCE(MAX(version), 0) AS max FROM drafter_template_versions WHERE template_id = $1`, [
    input.templateId,
  ]);
  const nextVersion = (maxRows[0]?.max ?? 0) + 1;
  const rows = await query<TemplateVersionRow>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.templateId, nextVersion, JSON.stringify(input.sections), JSON.stringify(input.fieldLabels), input.actor]
  );
  await query(`UPDATE drafter_templates SET current_version = $2 WHERE id = $1`, [input.templateId, nextVersion]);
  await writeDrafterAudit(input.actor, "template.edit_version", "drafter_template", input.templateId, { version: nextVersion });
  return rows[0];
}

/**
 * Deletes a Template and all its versions - follow-up to prod walkthrough
 * item 5 (see lib/repo/drafter-documents.ts deleteDrafterDocument,
 * lib/repo/drafter-register.ts deleteRegisterImport). Refused with an
 * explanation if any PRA is pinned to one of its versions
 * (drafter_pras.template_version_id is NOT NULL - there is no "release"
 * for a PRA, only a block). Deleting the template also frees its source
 * document (drafter_templates.source_document_id) since the referencing
 * row itself is gone, so a subsequent document delete can succeed.
 */
export async function deleteTemplate(
  templateId: string,
  actor: string
): Promise<{ deleted: boolean; blockedReason?: string }> {
  const templateRows = await query<TemplateRow>(`SELECT * FROM drafter_templates WHERE id = $1`, [templateId]);
  const template = templateRows[0];
  if (!template) return { deleted: false };

  const versions = await listTemplateVersions(templateId);
  const versionIds = versions.map((v) => v.id);
  if (versionIds.length > 0) {
    const referencing = await query<{ id: string; product: string }>(
      `SELECT id, product FROM drafter_pras WHERE template_version_id = ANY($1::uuid[])`,
      [versionIds]
    );
    if (referencing.length > 0) {
      return {
        deleted: false,
        blockedReason: `This template is used by ${referencing.length} PRA(s) (${referencing
          .map((r) => r.product)
          .join(", ")}) and cannot be deleted. Delete those PRA(s) first, or leave the template in place.`,
      };
    }
  }

  await withTransaction(async (client) => {
    await queryWithClient(client, `DELETE FROM drafter_template_versions WHERE template_id = $1`, [templateId]);
    await queryWithClient(client, `DELETE FROM drafter_templates WHERE id = $1`, [templateId]);
  });

  await writeDrafterAudit(actor, "template.delete", "drafter_template", templateId, { name: template.name });
  return { deleted: true };
}

export async function confirmTemplateVersion(id: string, actor: string): Promise<TemplateVersionRow | null> {
  const rows = await query<TemplateVersionRow>(
    `UPDATE drafter_template_versions SET confirmed = true, confirmed_by = $2, confirmed_at = now() WHERE id = $1 RETURNING *`,
    [id, actor]
  );
  const row = rows[0] ?? null;
  if (row) await writeDrafterAudit(actor, "template.confirm", "drafter_template_version", id, {});
  return row;
}
