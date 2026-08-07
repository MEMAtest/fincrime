import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";
import {
  getWorkspaceControl,
  updateWorkspaceControlWithClient,
  type UpdateWorkspaceControlInput,
  type WorkspaceControlRow,
} from "./controls";

export type ControlChangeType =
  | "threshold"
  | "rule_logic"
  | "scope"
  | "ownership"
  | "frequency"
  | "system"
  | "decommission"
  | "other";

export type ControlChangeStatus = "draft" | "in_review" | "approved" | "rejected" | "implemented" | "rolled_back";

const SUBJECT_TYPE = "control_change";

/**
 * Whitelisted subset of workspace_controls fields that `baseline` and
 * `proposed` may carry. Anything outside this list is ignored rather than
 * passed through, both when snapshotting a baseline and when applying a
 * proposed value back onto the control.
 */
export const CONTROL_FIELD_WHITELIST = [
  "objective",
  "threshold",
  "operatingFrequency",
  "systems",
  "dataInputs",
  "status",
  "effectivenessRating",
  "ownerPersonId",
  "approverPersonId",
  "productApplicability",
  "typologySlugs",
] as const;

export type ControlFieldKey = (typeof CONTROL_FIELD_WHITELIST)[number];
export type ControlFieldValues = Partial<Record<ControlFieldKey, unknown>>;

/** Strips any key not in CONTROL_FIELD_WHITELIST from an arbitrary object. */
export function pickControlFields(value: unknown): ControlFieldValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: ControlFieldValues = {};
  for (const key of CONTROL_FIELD_WHITELIST) {
    if (key in source) result[key] = source[key];
  }
  return result;
}

/** Snapshots the whitelisted fields off a live workspace_controls row, in the same shape baseline/proposed use. */
export function snapshotControlFields(control: WorkspaceControlRow): ControlFieldValues {
  return {
    objective: control.objective,
    threshold: control.threshold,
    operatingFrequency: control.operating_frequency,
    systems: control.systems,
    dataInputs: control.data_inputs,
    status: control.status,
    effectivenessRating: control.effectiveness_rating,
    ownerPersonId: control.owner_person_id,
    approverPersonId: control.approver_person_id,
    productApplicability: control.product_applicability,
    typologySlugs: control.typology_slugs,
  };
}

/** Maps whitelisted field values onto an UpdateWorkspaceControlInput patch. */
function toWorkspaceControlPatch(fields: ControlFieldValues): UpdateWorkspaceControlInput {
  const patch: UpdateWorkspaceControlInput = {};
  if ("objective" in fields && typeof fields.objective === "string") patch.objective = fields.objective;
  if ("threshold" in fields) patch.threshold = (fields.threshold as string | null) ?? null;
  if ("operatingFrequency" in fields) patch.operatingFrequency = (fields.operatingFrequency as string | null) ?? null;
  if ("systems" in fields && Array.isArray(fields.systems)) patch.systems = fields.systems as string[];
  if ("dataInputs" in fields && Array.isArray(fields.dataInputs)) patch.dataInputs = fields.dataInputs as string[];
  if ("status" in fields && typeof fields.status === "string") {
    patch.status = fields.status as UpdateWorkspaceControlInput["status"];
  }
  if ("effectivenessRating" in fields) {
    patch.effectivenessRating = (fields.effectivenessRating as UpdateWorkspaceControlInput["effectivenessRating"]) ?? null;
  }
  if ("ownerPersonId" in fields) patch.ownerPersonId = (fields.ownerPersonId as string | null) ?? null;
  if ("approverPersonId" in fields) patch.approverPersonId = (fields.approverPersonId as string | null) ?? null;
  if ("productApplicability" in fields && Array.isArray(fields.productApplicability)) {
    patch.productApplicability = fields.productApplicability as string[];
  }
  if ("typologySlugs" in fields && Array.isArray(fields.typologySlugs)) {
    patch.typologySlugs = fields.typologySlugs as string[];
  }
  return patch;
}

export interface ControlChangeRow {
  id: string;
  workspace_id: string;
  workspace_control_id: string;
  title: string;
  rationale: string | null;
  change_type: ControlChangeType | null;
  status: ControlChangeStatus;
  current_step: number;
  baseline: ControlFieldValues;
  proposed: ControlFieldValues;
  supporting_data: Record<string, unknown>;
  impact: Record<string, unknown>;
  pilot: boolean;
  pilot_notes: string | null;
  monitoring: Record<string, unknown>;
  rollback_criteria: string | null;
  implemented_at: string | null;
  rolled_back_at: string | null;
  applied_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateControlChangeInput {
  workspaceControlId: string;
  title: string;
  rationale?: string | null;
  changeType?: ControlChangeType | null;
}

export async function listControlChanges(workspaceId: string): Promise<ControlChangeRow[]> {
  return query<ControlChangeRow>(`SELECT * FROM control_changes WHERE workspace_id = $1 ORDER BY created_at DESC`, [
    workspaceId,
  ]);
}

export async function getControlChange(workspaceId: string, id: string): Promise<ControlChangeRow | null> {
  const rows = await query<ControlChangeRow>(`SELECT * FROM control_changes WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

/**
 * Creates a control change against a live workspace_control, snapshotting
 * the control's CURRENT whitelisted values into `baseline` at creation time
 * (the "current version" side of the before/after comparison).
 */
export async function createControlChange(
  workspaceId: string,
  input: CreateControlChangeInput,
  actor: string
): Promise<ControlChangeRow | null> {
  const control = await getWorkspaceControl(workspaceId, input.workspaceControlId);
  if (!control) return null;

  const baseline = snapshotControlFields(control);

  const rows = await query<ControlChangeRow>(
    `INSERT INTO control_changes (workspace_id, workspace_control_id, title, rationale, change_type, baseline)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, input.workspaceControlId, input.title, input.rationale || null, input.changeType || null, JSON.stringify(baseline)]
  );
  const change = rows[0];

  await writeAudit(workspaceId, actor, "control_change.created", SUBJECT_TYPE, change.id, {
    workspaceControlId: input.workspaceControlId,
    title: input.title,
  });

  return change;
}

export interface UpdateControlChangeInput {
  title?: string;
  rationale?: string | null;
  changeType?: ControlChangeType | null;
  currentStep?: number;
  status?: ControlChangeStatus;
  proposed?: ControlFieldValues;
  supportingData?: Record<string, unknown>;
  impact?: Record<string, unknown>;
  pilot?: boolean;
  pilotNotes?: string | null;
  monitoring?: Record<string, unknown>;
  rollbackCriteria?: string | null;
}

export async function updateControlChange(
  workspaceId: string,
  id: string,
  input: UpdateControlChangeInput,
  actor: string
): Promise<ControlChangeRow | null> {
  const current = await getControlChange(workspaceId, id);
  if (!current) return null;

  const title = input.title ?? current.title;
  const rationale = input.rationale !== undefined ? input.rationale : current.rationale;
  const changeType = input.changeType !== undefined ? input.changeType : current.change_type;
  const currentStep = input.currentStep ?? current.current_step;
  const status = input.status ?? current.status;
  const proposed = input.proposed ? { ...current.proposed, ...pickControlFields(input.proposed) } : current.proposed;
  const supportingData = input.supportingData ?? current.supporting_data;
  const impact = input.impact ?? current.impact;
  const pilot = input.pilot ?? current.pilot;
  const pilotNotes = input.pilotNotes !== undefined ? input.pilotNotes : current.pilot_notes;
  const monitoring = input.monitoring ?? current.monitoring;
  const rollbackCriteria = input.rollbackCriteria !== undefined ? input.rollbackCriteria : current.rollback_criteria;

  const rows = await query<ControlChangeRow>(
    `UPDATE control_changes
     SET title = $3, rationale = $4, change_type = $5, current_step = $6, status = $7, proposed = $8,
         supporting_data = $9, impact = $10, pilot = $11, pilot_notes = $12, monitoring = $13,
         rollback_criteria = $14, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      title,
      rationale,
      changeType,
      currentStep,
      status,
      JSON.stringify(proposed),
      JSON.stringify(supportingData),
      JSON.stringify(impact),
      pilot,
      pilotNotes,
      JSON.stringify(monitoring),
      rollbackCriteria,
    ]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "control_change.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteControlChange(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM control_changes WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "control_change.deleted", SUBJECT_TYPE, id, {});
  }
  return deleted;
}

async function getControlChangeWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  id: string
): Promise<ControlChangeRow | null> {
  const rows = await queryWithClient<ControlChangeRow>(
    client,
    `SELECT * FROM control_changes WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export type ApplyControlChangeResult =
  | { ok: true; change: ControlChangeRow; control: WorkspaceControlRow }
  | { ok: false; reason: "not_found" | "not_approved" };

/**
 * Applies an approved change's `proposed` values onto the underlying
 * workspace_control via the existing updateWorkspaceControl (so it
 * version-bumps and snapshots to object_versions with a change note
 * referencing this control change), then stamps implemented_at /
 * applied_version and moves status to 'implemented'. Runs in a single
 * transaction; writes audit_log.
 */
export async function applyControlChange(
  workspaceId: string,
  changeId: string,
  actor: string
): Promise<ApplyControlChangeResult> {
  return withTransaction(async (client) => {
    const change = await getControlChangeWithClient(client, workspaceId, changeId);
    if (!change) return { ok: false, reason: "not_found" };
    if (change.status !== "approved") return { ok: false, reason: "not_approved" };

    const patch = toWorkspaceControlPatch(change.proposed);
    const control = await updateWorkspaceControlWithClient(
      client,
      workspaceId,
      change.workspace_control_id,
      patch,
      actor,
      `control change ${change.id} implemented`
    );
    if (!control) return { ok: false, reason: "not_found" };

    const rows = await queryWithClient<ControlChangeRow>(
      client,
      `UPDATE control_changes
       SET status = 'implemented', implemented_at = now(), applied_version = $3, updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [workspaceId, changeId, control.version]
    );
    const updated = rows[0];

    await writeAudit(
      workspaceId,
      actor,
      "control_change.implemented",
      SUBJECT_TYPE,
      changeId,
      { workspaceControlId: change.workspace_control_id, appliedVersion: control.version },
      client
    );

    return { ok: true, change: updated, control };
  });
}

export type RollbackControlChangeResult =
  | { ok: true; change: ControlChangeRow; control: WorkspaceControlRow }
  | { ok: false; reason: "not_found" | "not_implemented" };

/**
 * Restores the control to the recorded `baseline` values, again via
 * updateWorkspaceControl so history is preserved as a new version (never by
 * rewriting history), then stamps rolled_back_at and moves status to
 * 'rolled_back'. Runs in a single transaction; writes audit_log.
 */
export async function rollbackControlChange(
  workspaceId: string,
  changeId: string,
  actor: string
): Promise<RollbackControlChangeResult> {
  return withTransaction(async (client) => {
    const change = await getControlChangeWithClient(client, workspaceId, changeId);
    if (!change) return { ok: false, reason: "not_found" };
    if (change.status !== "implemented") return { ok: false, reason: "not_implemented" };

    const patch = toWorkspaceControlPatch(change.baseline);
    const control = await updateWorkspaceControlWithClient(
      client,
      workspaceId,
      change.workspace_control_id,
      patch,
      actor,
      `control change ${change.id} rolled back`
    );
    if (!control) return { ok: false, reason: "not_found" };

    const rows = await queryWithClient<ControlChangeRow>(
      client,
      `UPDATE control_changes
       SET status = 'rolled_back', rolled_back_at = now(), updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [workspaceId, changeId]
    );
    const updated = rows[0];

    await writeAudit(
      workspaceId,
      actor,
      "control_change.rolled_back",
      SUBJECT_TYPE,
      changeId,
      { workspaceControlId: change.workspace_control_id, version: control.version },
      client
    );

    return { ok: true, change: updated, control };
  });
}
