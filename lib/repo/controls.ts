import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";

export type ControlLifecycleStatus = "not_started" | "in_progress" | "needs_review" | "gaps" | "implemented";
export type ControlEffectivenessRating = "strong" | "adequate" | "weak" | "not_assessed";

const SUBJECT_TYPE = "workspace_control";

export interface WorkspaceControlRow {
  id: string;
  workspace_id: string;
  objective: string;
  control_slug: string | null;
  name: string;
  category: string | null;
  typology_slugs: string[];
  product_applicability: string[];
  version: number;
  owner_person_id: string | null;
  approver_person_id: string | null;
  systems: string[];
  data_inputs: string[];
  threshold: string | null;
  operating_frequency: string | null;
  status: ControlLifecycleStatus;
  effectiveness_rating: ControlEffectivenessRating | null;
  last_tested_at: string | null;
  next_test_due: string | null;
  monitoring_metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceControlInput {
  objective: string;
  controlSlug?: string | null;
  name: string;
  category?: string | null;
  typologySlugs?: string[];
  productApplicability?: string[];
  ownerPersonId?: string | null;
  approverPersonId?: string | null;
  systems?: string[];
  dataInputs?: string[];
  threshold?: string | null;
  operatingFrequency?: string | null;
  status?: ControlLifecycleStatus;
  effectivenessRating?: ControlEffectivenessRating | null;
  lastTestedAt?: string | null;
  nextTestDue?: string | null;
  monitoringMetrics?: Record<string, unknown>;
}

export interface UpdateWorkspaceControlInput {
  objective?: string;
  controlSlug?: string | null;
  name?: string;
  category?: string | null;
  typologySlugs?: string[];
  productApplicability?: string[];
  ownerPersonId?: string | null;
  approverPersonId?: string | null;
  systems?: string[];
  dataInputs?: string[];
  threshold?: string | null;
  operatingFrequency?: string | null;
  status?: ControlLifecycleStatus;
  effectivenessRating?: ControlEffectivenessRating | null;
  lastTestedAt?: string | null;
  nextTestDue?: string | null;
  monitoringMetrics?: Record<string, unknown>;
}

async function snapshotVersion(
  client: DbTransactionClient,
  workspaceId: string,
  control: WorkspaceControlRow,
  changedBy: string,
  changeNote: string
): Promise<void> {
  await queryWithClient(
    client,
    `INSERT INTO object_versions (workspace_id, subject_type, subject_id, version, snapshot, changed_by, change_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [workspaceId, SUBJECT_TYPE, control.id, control.version, JSON.stringify(control), changedBy, changeNote]
  );
}

export async function listWorkspaceControls(workspaceId: string): Promise<WorkspaceControlRow[]> {
  return query<WorkspaceControlRow>(`SELECT * FROM workspace_controls WHERE workspace_id = $1 ORDER BY created_at DESC`, [
    workspaceId,
  ]);
}

export async function getWorkspaceControl(workspaceId: string, id: string): Promise<WorkspaceControlRow | null> {
  const rows = await query<WorkspaceControlRow>(
    `SELECT * FROM workspace_controls WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export async function createWorkspaceControl(
  workspaceId: string,
  input: CreateWorkspaceControlInput,
  actor: string
): Promise<WorkspaceControlRow> {
  return withTransaction(async (client) => {
    const rows = await queryWithClient<WorkspaceControlRow>(
      client,
      `INSERT INTO workspace_controls (
         workspace_id, objective, control_slug, name, category, typology_slugs, product_applicability,
         owner_person_id, approver_person_id, systems, data_inputs, threshold, operating_frequency,
         status, effectiveness_rating, last_tested_at, next_test_due, monitoring_metrics
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        workspaceId,
        input.objective,
        input.controlSlug || null,
        input.name,
        input.category || null,
        JSON.stringify(input.typologySlugs ?? []),
        JSON.stringify(input.productApplicability ?? []),
        input.ownerPersonId || null,
        input.approverPersonId || null,
        JSON.stringify(input.systems ?? []),
        JSON.stringify(input.dataInputs ?? []),
        input.threshold || null,
        input.operatingFrequency || null,
        input.status ?? "not_started",
        input.effectivenessRating ?? "not_assessed",
        input.lastTestedAt || null,
        input.nextTestDue || null,
        JSON.stringify(input.monitoringMetrics ?? {}),
      ]
    );

    const control = rows[0];
    await snapshotVersion(client, workspaceId, control, actor, "created");
    await writeAudit(workspaceId, actor, "workspace_control.created", SUBJECT_TYPE, control.id, { name: control.name }, client);

    return control;
  });
}

export async function updateWorkspaceControl(
  workspaceId: string,
  id: string,
  input: UpdateWorkspaceControlInput,
  actor: string,
  changeNote = "updated"
): Promise<WorkspaceControlRow | null> {
  return withTransaction(async (client) => {
    const currentRows = await queryWithClient<WorkspaceControlRow>(
      client,
      `SELECT * FROM workspace_controls WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [workspaceId, id]
    );
    const current = currentRows[0];
    if (!current) return null;

    const objective = input.objective ?? current.objective;
    const controlSlug = input.controlSlug !== undefined ? input.controlSlug : current.control_slug;
    const name = input.name ?? current.name;
    const category = input.category !== undefined ? input.category : current.category;
    const typologySlugs = input.typologySlugs ?? current.typology_slugs;
    const productApplicability = input.productApplicability ?? current.product_applicability;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const approverPersonId =
      input.approverPersonId !== undefined ? input.approverPersonId : current.approver_person_id;
    const systems = input.systems ?? current.systems;
    const dataInputs = input.dataInputs ?? current.data_inputs;
    const threshold = input.threshold !== undefined ? input.threshold : current.threshold;
    const operatingFrequency =
      input.operatingFrequency !== undefined ? input.operatingFrequency : current.operating_frequency;
    const status = input.status ?? current.status;
    const effectivenessRating =
      input.effectivenessRating !== undefined ? input.effectivenessRating : current.effectiveness_rating;
    const lastTestedAt = input.lastTestedAt !== undefined ? input.lastTestedAt : current.last_tested_at;
    const nextTestDue = input.nextTestDue !== undefined ? input.nextTestDue : current.next_test_due;
    const monitoringMetrics = input.monitoringMetrics ?? current.monitoring_metrics;
    const nextVersion = current.version + 1;

    const rows = await queryWithClient<WorkspaceControlRow>(
      client,
      `UPDATE workspace_controls
       SET objective = $3, control_slug = $4, name = $5, category = $6, typology_slugs = $7,
           product_applicability = $8, owner_person_id = $9, approver_person_id = $10, systems = $11,
           data_inputs = $12, threshold = $13, operating_frequency = $14, status = $15,
           effectiveness_rating = $16, last_tested_at = $17, next_test_due = $18, monitoring_metrics = $19,
           version = $20, updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [
        workspaceId,
        id,
        objective,
        controlSlug,
        name,
        category,
        JSON.stringify(typologySlugs),
        JSON.stringify(productApplicability),
        ownerPersonId,
        approverPersonId,
        JSON.stringify(systems),
        JSON.stringify(dataInputs),
        threshold,
        operatingFrequency,
        status,
        effectivenessRating,
        lastTestedAt,
        nextTestDue,
        JSON.stringify(monitoringMetrics),
        nextVersion,
      ]
    );

    const updated = rows[0];
    await snapshotVersion(client, workspaceId, updated, actor, changeNote);
    await writeAudit(
      workspaceId,
      actor,
      "workspace_control.updated",
      SUBJECT_TYPE,
      id,
      { fields: Object.keys(input), version: updated.version },
      client
    );

    return updated;
  });
}

export async function deleteWorkspaceControl(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM workspace_controls WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "workspace_control.deleted", SUBJECT_TYPE, id, {});
  }
  return deleted;
}

export interface ObjectVersionRow {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function listWorkspaceControlVersions(workspaceId: string, controlId: string): Promise<ObjectVersionRow[]> {
  return query<ObjectVersionRow>(
    `SELECT * FROM object_versions
     WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3
     ORDER BY version DESC`,
    [workspaceId, SUBJECT_TYPE, controlId]
  );
}
