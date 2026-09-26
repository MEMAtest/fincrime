import { query, withTransaction, queryWithClient } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import { getColumnMapping } from "./drafter-register";
import type { SkeletonCustomerType, SkeletonSection } from "@/lib/drafter/skeleton";
import { assignGroupToSection, type AssignableGroup } from "@/lib/drafter/section-assignment";
import { buildEvidence, type EvidenceRef } from "@/lib/drafter/evidence";
import type { LintIssue } from "@/lib/drafter/lint";

export interface DrafterPraRow {
  id: string;
  product: string;
  description: string | null;
  legal_entity: string | null;
  customer_types: SkeletonCustomerType[];
  template_version_id: string;
  stylepack_version_id: string;
  register_version_id: string | null;
  status: "draft" | "drafting" | "drafted" | "in_review" | "ready_to_export" | "exported";
  cost_cap_pence: number | null;
  spend_pence: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function createPra(input: {
  product: string;
  description: string | null;
  legalEntity: string | null;
  customerTypes: SkeletonCustomerType[];
  templateVersionId: string;
  stylepackVersionId: string;
  registerVersionId: string | null;
  costCapPence: number | null;
  actor: string;
}): Promise<DrafterPraRow> {
  const rows = await query<DrafterPraRow>(
    `INSERT INTO drafter_pras (product, description, legal_entity, customer_types, template_version_id, stylepack_version_id, register_version_id, cost_cap_pence, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      input.product,
      input.description,
      input.legalEntity,
      input.customerTypes,
      input.templateVersionId,
      input.stylepackVersionId,
      input.registerVersionId,
      input.costCapPence,
      input.actor,
    ]
  );
  await writeDrafterAudit(input.actor, "pra.create", "drafter_pra", rows[0].id, { product: input.product });
  return rows[0];
}

export async function listPras(): Promise<DrafterPraRow[]> {
  return query<DrafterPraRow>(`SELECT * FROM drafter_pras ORDER BY created_at DESC`);
}

export async function getPra(id: string): Promise<DrafterPraRow | null> {
  const rows = await query<DrafterPraRow>(`SELECT * FROM drafter_pras WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export interface DrafterSectionRow {
  id: string;
  pra_id: string;
  section_number: string;
  title: string;
  customer_type: string | null;
  sort_order: number;
  is_empty: boolean;
  created_at: string;
}

export interface DrafterEnhancementRow {
  id: string;
  section_id: string;
  pra_id: string;
  sort_order: number;
  control_ids: string[];
  control_text: string | null;
  rationale: string | null;
  backoffice_control_label: string | null;
  evidence_refs: EvidenceRef[];
  placeholders: { original: string; reason: string }[];
  review_result: {
    lint: LintIssue[];
    status: "pass" | "minor" | "critical" | "not_reviewed" | "needs_input";
    error?: string;
    judge?: unknown;
    judgeStale?: boolean;
  } | null;
  is_gap: boolean;
  model_name: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

/** Creates the section skeleton for a PRA from its confirmed template version's sections. Idempotent per PRA - a second call is a no-op if sections already exist. */
export async function ensureSectionsForPra(praId: string, templateSections: SkeletonSection[]): Promise<DrafterSectionRow[]> {
  const existing = await query<DrafterSectionRow>(`SELECT * FROM drafter_sections WHERE pra_id = $1 ORDER BY sort_order`, [praId]);
  if (existing.length > 0) return existing;
  const created: DrafterSectionRow[] = [];
  await withTransaction(async (client) => {
    for (let i = 0; i < templateSections.length; i++) {
      const s = templateSections[i];
      const rows = await queryWithClient<DrafterSectionRow>(
        client,
        `INSERT INTO drafter_sections (pra_id, section_number, title, customer_type, sort_order, is_empty)
         VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
        [praId, s.number, s.title, s.customerType, i]
      );
      created.push(rows[0]);
    }
  });
  return created;
}

export async function listSectionsForPra(praId: string): Promise<DrafterSectionRow[]> {
  return query<DrafterSectionRow>(`SELECT * FROM drafter_sections WHERE pra_id = $1 ORDER BY sort_order`, [praId]);
}

export async function getSectionById(id: string): Promise<DrafterSectionRow | null> {
  const rows = await query<DrafterSectionRow>(`SELECT * FROM drafter_sections WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updatePraSpend(praId: string, addPence: number): Promise<void> {
  // Note: status is advanced separately by lib/drafter/pra-status.ts's
  // maybeAdvancePraStatus, called after every draft/judge call - it used to
  // be tied only to a non-zero spend here (HANDOFF-3 "Known limits" #3),
  // which meant a PRA drafted entirely via reuse/placeholder/stub calls
  // never left "draft". Spend tracking and status are independent now.
  await query(`UPDATE drafter_pras SET spend_pence = spend_pence + $2, updated_at = now() WHERE id = $1`, [praId, addPence]);
}

export async function setPraStatus(praId: string, status: DrafterPraRow["status"]): Promise<DrafterPraRow> {
  const rows = await query<DrafterPraRow>(
    `UPDATE drafter_pras SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [praId, status]
  );
  return rows[0];
}

export async function listEnhancementsForPra(praId: string): Promise<DrafterEnhancementRow[]> {
  return query<DrafterEnhancementRow>(`SELECT * FROM drafter_enhancements WHERE pra_id = $1 ORDER BY sort_order`, [praId]);
}

export async function getEnhancement(id: string): Promise<DrafterEnhancementRow | null> {
  const rows = await query<DrafterEnhancementRow>(`SELECT * FROM drafter_enhancements WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Assigns a set of confirmed candidate controls to sections and creates one
 * enhancement row per control (code steps 2 and 5 of SPEC.md "Drafting":
 * assignment and numbering). Evidence and backoffice fields are built here,
 * deterministically, from the control's register-sourced fields - never by
 * the model. Sections with no assigned enhancement stay `is_empty = true`.
 */
export async function assignControlsAndCreateEnhancements(input: {
  praId: string;
  sections: SkeletonSection[]; // the template's section list, for assignment matching
  controls: { id: string; backofficeControl: string | null; customerType: SkeletonCustomerType; coverage: string | null }[];
  sourceFieldsByControlId: Record<string, EvidenceSourceRegisterFields>;
  praCustomerTypes: SkeletonCustomerType[];
  actor: string;
}): Promise<{ assigned: number; unassigned: { controlId: string; reason: string }[] }> {
  const dbSections = await ensureSectionsForPra(input.praId, input.sections);
  const bySectionNumber = new Map(dbSections.map((s) => [s.section_number, s]));
  const nextSortOrderBySection = new Map<string, number>();

  const unassigned: { controlId: string; reason: string }[] = [];
  let assigned = 0;

  await withTransaction(async (client) => {
    for (const control of input.controls) {
      const group: AssignableGroup = { groupKey: control.id, backofficeControl: control.backofficeControl, customerType: control.customerType };
      const result = assignGroupToSection(group, input.sections, input.praCustomerTypes);
      if (!result.sectionNumber) {
        unassigned.push({ controlId: control.id, reason: result.reason });
        continue;
      }
      const dbSection = bySectionNumber.get(result.sectionNumber);
      if (!dbSection) {
        unassigned.push({ controlId: control.id, reason: `Section ${result.sectionNumber} was not found on this PRA.` });
        continue;
      }
      const sortOrder = nextSortOrderBySection.get(dbSection.id) ?? 0;
      nextSortOrderBySection.set(dbSection.id, sortOrder + 1);

      const evidence = buildEvidence(input.sourceFieldsByControlId[control.id] ?? {});
      await queryWithClient(
        client,
        `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, backoffice_control_label, evidence_refs, review_result, is_gap)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
        [
          dbSection.id,
          input.praId,
          sortOrder,
          [control.id],
          evidence.backofficeControlLabel,
          JSON.stringify(evidence.evidenceRefs),
          JSON.stringify({ lint: [], status: "not_reviewed" }),
        ]
      );
      await queryWithClient(client, `UPDATE drafter_sections SET is_empty = false WHERE id = $1`, [dbSection.id]);
      assigned++;
    }
  });

  await writeDrafterAudit(input.actor, "pra.assign_controls", "drafter_pra", input.praId, { assigned, unassignedCount: unassigned.length });
  return { assigned, unassigned };
}

/** Manual gap entry (SPEC.md "Reuse, adapt or new": "A user can add a gap manually ... produces a placeholder enhancement, not model-written control text"). */
export async function addManualGap(input: {
  praId: string;
  sectionNumber: string;
  description: string;
  backofficeControlLabel: string | null;
  actor: string;
}): Promise<DrafterEnhancementRow> {
  const sectionRows = await query<DrafterSectionRow>(`SELECT * FROM drafter_sections WHERE pra_id = $1 AND section_number = $2`, [
    input.praId,
    input.sectionNumber,
  ]);
  const section = sectionRows[0];
  if (!section) throw new Error(`Section ${input.sectionNumber} not found on this PRA.`);

  const orderRows = await query<{ max: number }>(`SELECT COALESCE(MAX(sort_order), -1) AS max FROM drafter_enhancements WHERE section_id = $1`, [
    section.id,
  ]);
  const sortOrder = (orderRows[0]?.max ?? -1) + 1;

  const rows = await query<DrafterEnhancementRow>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, control_text, backoffice_control_label, evidence_refs, review_result, is_gap)
     VALUES ($1,$2,$3,'{}',$4,$5,'[]',$6,true) RETURNING *`,
    [
      section.id,
      input.praId,
      sortOrder,
      `[Gap: ${input.description} - no control exists yet. This is a placeholder, not model-generated text.]`,
      input.backofficeControlLabel,
      JSON.stringify({ lint: [], status: "not_reviewed" }),
    ]
  );
  await query(`UPDATE drafter_sections SET is_empty = false WHERE id = $1`, [section.id]);
  await createOpenItem({ praId: input.praId, enhancementId: rows[0].id, itemType: "gap", description: input.description });
  await writeDrafterAudit(input.actor, "pra.add_gap", "drafter_enhancement", rows[0].id, { sectionNumber: input.sectionNumber });
  return rows[0];
}

export async function updateEnhancementDraft(
  id: string,
  fields: {
    controlText?: string;
    rationale?: string;
    placeholders?: { original: string; reason: string }[];
    reviewResult?: DrafterEnhancementRow["review_result"];
    modelName?: string;
    promptVersion?: string;
  }
): Promise<DrafterEnhancementRow> {
  const rows = await query<DrafterEnhancementRow>(
    `UPDATE drafter_enhancements SET
       control_text = COALESCE($2, control_text),
       rationale = COALESCE($3, rationale),
       placeholders = COALESCE($4, placeholders),
       review_result = COALESCE($5, review_result),
       model_name = COALESCE($6, model_name),
       prompt_version = COALESCE($7, prompt_version),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      id,
      fields.controlText ?? null,
      fields.rationale ?? null,
      fields.placeholders ? JSON.stringify(fields.placeholders) : null,
      fields.reviewResult ? JSON.stringify(fields.reviewResult) : null,
      fields.modelName ?? null,
      fields.promptVersion ?? null,
    ]
  );
  return rows[0];
}

/**
 * Updates an enhancement's full review_result (lint + judge + combined
 * status) as one JSON blob (HANDOFF-3: "you'll add a `judge` key alongside
 * `lint` in that same JSON blob rather than a new column"). Used by the
 * judge runner and by the PATCH route when marking a judge result stale.
 */
export async function updateEnhancementReview(
  id: string,
  fields: { reviewResult: DrafterEnhancementRow["review_result"] }
): Promise<DrafterEnhancementRow> {
  const rows = await query<DrafterEnhancementRow>(
    `UPDATE drafter_enhancements SET review_result = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(fields.reviewResult)]
  );
  return rows[0];
}

export async function recordEnhancementEdit(input: {
  enhancementId: string;
  field: "control_text" | "rationale";
  previousValue: string | null;
  newValue: string | null;
  editType: "manual" | "apply_fix";
  actor: string;
}): Promise<void> {
  await query(
    `INSERT INTO drafter_enhancement_edits (enhancement_id, field, previous_value, new_value, edit_type, actor)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.enhancementId, input.field, input.previousValue, input.newValue, input.editType, input.actor]
  );
  await writeDrafterAudit(input.actor, `enhancement.edit.${input.editType}`, "drafter_enhancement", input.enhancementId, { field: input.field });
}

export interface OpenItemRow {
  id: string;
  pra_id: string;
  enhancement_id: string | null;
  item_type: "placeholder" | "unsupported_term" | "gap" | "export_override";
  description: string;
  resolved: boolean;
  created_at: string;
}

export async function createOpenItem(input: {
  praId: string;
  enhancementId: string | null;
  itemType: OpenItemRow["item_type"];
  description: string;
}): Promise<OpenItemRow> {
  const rows = await query<OpenItemRow>(
    `INSERT INTO drafter_open_items (pra_id, enhancement_id, item_type, description) VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.praId, input.enhancementId, input.itemType, input.description]
  );
  return rows[0];
}

export async function listOpenItemsForPra(praId: string): Promise<OpenItemRow[]> {
  return query<OpenItemRow>(`SELECT * FROM drafter_open_items WHERE pra_id = $1 ORDER BY created_at DESC`, [praId]);
}

/** Fields pulled from a control's underlying register row, keyed by canonical field_key - used to build evidence/backoffice fields and the writer's draft inputs. */
export interface EvidenceSourceRegisterFields {
  backoffice_control?: string;
  req_id?: string;
  requirement_reference?: string;
  backoffice_linkage_id?: string;
  scoping_fincrime_ticket?: string;
  obligation_description?: string;
  control_review_notes?: string;
  control_uplift_amendment?: string;
  remediation_gaps?: string;
  // Deliberately no `rationale` field here - the register's Rationale column
  // is never surfaced to anything drafting-related. See lib/drafter/prompts.ts.
}

export interface CandidateControl {
  id: string;
  title: string;
  reqIds: string[];
  backofficeControl: string | null;
  coverage: "yes" | "partial" | "no" | "unassessed" | null;
  group: "reuse" | "adapt" | "new" | "unassessed";
  agreedWording: string | null;
  customerType: SkeletonCustomerType;
  usedIn: { praId: string; product: string }[];
}

function coverageToGroup(coverage: string | null): CandidateControl["group"] {
  if (coverage === "yes") return "reuse";
  if (coverage === "partial") return "adapt";
  if (coverage === "no") return "new";
  return "unassessed";
}

/**
 * Candidate controls for the "Start a PRA" screen (SPEC.md "Reuse, adapt or
 * new"), grouped by coverage. "Where used before" comes from
 * used_in_pra_ids; "last approved wording" is agreed_wording. Unassessed
 * controls are still returned (the caller/UI excludes them from selection
 * until the user sets a value - SPEC.md: "excluded until the user sets a
 * value").
 */
export async function listCandidateControls(): Promise<CandidateControl[]> {
  const controls = await query<{
    id: string;
    title: string;
    req_ids: string[];
    backoffice_control: string | null;
    coverage: string | null;
    agreed_wording: string | null;
    used_in_pra_ids: string[];
  }>(`SELECT id, title, req_ids, backoffice_control, coverage, agreed_wording, used_in_pra_ids FROM drafter_controls ORDER BY created_at DESC`);

  const customerTypeTags = await query<{ control_id: string; value: string }>(
    `SELECT control_id, value FROM drafter_control_tags WHERE tag_type = 'customer_type' AND confirmed = true`
  );
  const customerTypeByControl = new Map<string, SkeletonCustomerType>();
  for (const tag of customerTypeTags) {
    const value = tag.value.toLowerCase();
    customerTypeByControl.set(tag.control_id, value === "legal person" ? "legal_person" : value === "natural person" ? "natural_person" : "both");
  }

  const allPraIds = Array.from(new Set(controls.flatMap((c) => c.used_in_pra_ids ?? [])));
  const pras = allPraIds.length
    ? await query<{ id: string; product: string }>(`SELECT id, product FROM drafter_pras WHERE id = ANY($1::uuid[])`, [allPraIds])
    : [];
  const praById = new Map(pras.map((p) => [p.id, p.product]));

  return controls.map((c) => ({
    id: c.id,
    title: c.title,
    reqIds: c.req_ids ?? [],
    backofficeControl: c.backoffice_control,
    coverage: c.coverage as CandidateControl["coverage"],
    group: coverageToGroup(c.coverage),
    agreedWording: c.agreed_wording,
    customerType: customerTypeByControl.get(c.id) ?? null,
    usedIn: (c.used_in_pra_ids ?? []).filter((id) => praById.has(id)).map((id) => ({ praId: id, product: praById.get(id)! })),
  }));
}

export async function markControlUsedInPra(controlId: string, praId: string): Promise<void> {
  await query(`UPDATE drafter_controls SET used_in_pra_ids = array_append(used_in_pra_ids, $2), updated_at = now() WHERE id = $1 AND NOT ($2 = ANY(used_in_pra_ids))`, [
    controlId,
    praId,
  ]);
}

/** Resolves a control's first source register row to its canonical field_key values, via the saved column mapping for that row's register import. */
export async function getControlSourceFields(controlId: string): Promise<EvidenceSourceRegisterFields> {
  const controlRows = await query<{ register_row_ids: string[] }>(`SELECT register_row_ids FROM drafter_controls WHERE id = $1`, [controlId]);
  const rowId = controlRows[0]?.register_row_ids?.[0];
  if (!rowId) return {};

  const rowRows = await query<{ fields: Record<string, { text: string }>; register_version_id: string }>(
    `SELECT fields, register_version_id FROM drafter_register_rows WHERE id = $1`,
    [rowId]
  );
  const row = rowRows[0];
  if (!row) return {};

  const importRows = await query<{ register_import_id: string }>(`SELECT register_import_id FROM drafter_register_versions WHERE id = $1`, [
    row.register_version_id,
  ]);
  const registerImportId = importRows[0]?.register_import_id;
  if (!registerImportId) return {};

  const mapping = await getColumnMapping(registerImportId);
  const out: Record<string, string> = {};
  for (const col of mapping) {
    if (col.fieldKey === "rationale") continue; // never surfaced - defence in depth alongside the type omitting it
    const cell = row.fields[col.sourceHeader];
    if (cell) out[col.fieldKey] = cell.text;
  }
  return out as EvidenceSourceRegisterFields;
}

/**
 * Deletes a PRA and everything scoped to it (sections, enhancements, edit
 * history, open items, model call log, calibration link, export log) -
 * prod walkthrough item 5. No table here has ON DELETE CASCADE (see
 * db/migrations/013_pra_drafter.sql), so this deletes child rows in FK
 * order inside one transaction. Returns false (no-op) if the PRA does not
 * exist, so the caller can 404.
 */
export async function deletePra(praId: string, actor: string): Promise<boolean> {
  const pra = await getPra(praId);
  if (!pra) return false;

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `DELETE FROM drafter_enhancement_edits WHERE enhancement_id IN (SELECT id FROM drafter_enhancements WHERE pra_id = $1)`,
      [praId]
    );
    await queryWithClient(client, `DELETE FROM drafter_model_calls WHERE pra_id = $1`, [praId]);
    await queryWithClient(client, `DELETE FROM drafter_export_log WHERE pra_id = $1`, [praId]);
    await queryWithClient(client, `DELETE FROM drafter_open_items WHERE pra_id = $1`, [praId]);
    await queryWithClient(client, `DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
    await queryWithClient(client, `DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
    await queryWithClient(client, `UPDATE drafter_exemplars SET source_pra_id = NULL WHERE source_pra_id = $1`, [praId]);
    await queryWithClient(client, `DELETE FROM drafter_pras WHERE id = $1`, [praId]);
  });

  await writeDrafterAudit(actor, "pra.delete", "drafter_pra", praId, { product: pra.product });
  return true;
}
