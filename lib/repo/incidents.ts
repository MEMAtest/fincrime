import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";

export type IncidentSource =
  | "internal_detection"
  | "customer_complaint"
  | "regulator"
  | "third_party"
  | "audit"
  | "control_test"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "contained" | "investigating" | "remediating" | "closed" | "cancelled";
export type IncidentRootCauseCategory =
  | "control_design"
  | "control_operation"
  | "data_quality"
  | "system_failure"
  | "human_error"
  | "third_party"
  | "process_gap"
  | "other";

export type IncidentLinkType = "failed_control" | "control_change" | "control_test" | "pra_assessment" | "enforcement_case";

export interface AffectedPopulation {
  customersAffected?: number;
  transactionsAffected?: number;
  valueGbp?: number;
  identificationMethod?: string;
  notes?: string;
}

const SUBJECT_TYPE = "incident";
const LINK_SUBJECT_TYPE = "incident_link";

export interface IncidentRow {
  id: string;
  workspace_id: string;
  reference: string | null;
  title: string;
  source: IncidentSource | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurred_at: string | null;
  detected_at: string | null;
  contained_at: string | null;
  closed_at: string | null;
  summary: string | null;
  containment: string | null;
  affected_population: AffectedPopulation;
  root_cause: string | null;
  root_cause_category: IncidentRootCauseCategory | null;
  reportable: boolean;
  reported_at: string | null;
  regulator_reference: string | null;
  owner_person_id: string | null;
  current_step: number;
  closure_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentLinkRow {
  id: string;
  workspace_id: string;
  incident_id: string;
  link_type: IncidentLinkType;
  target_id: string | null;
  target_ref: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** An incident that is closed or cancelled is a historical record and may not be mutated further via the general PATCH/child-mutation paths. */
export function isFinalIncidentStatus(status: IncidentStatus): boolean {
  return status === "closed" || status === "cancelled";
}

// ---------------------------------------------------------------------------
// incidents
// ---------------------------------------------------------------------------

export interface CreateIncidentInput {
  title: string;
  source?: IncidentSource | null;
  severity?: IncidentSeverity;
  occurredAt?: string | null;
  detectedAt?: string | null;
  summary?: string | null;
  ownerPersonId?: string | null;
}

export interface ListIncidentsFilter {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
}

export async function listIncidents(workspaceId: string, filter: ListIncidentsFilter = {}): Promise<IncidentRow[]> {
  const conditions = ["workspace_id = $1"];
  const params: unknown[] = [workspaceId];

  if (filter.status) {
    params.push(filter.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filter.severity) {
    params.push(filter.severity);
    conditions.push(`severity = $${params.length}`);
  }

  return query<IncidentRow>(
    `SELECT * FROM incidents WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params
  );
}

export async function getIncident(workspaceId: string, id: string): Promise<IncidentRow | null> {
  const rows = await query<IncidentRow>(`SELECT * FROM incidents WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

export async function createIncident(
  workspaceId: string,
  input: CreateIncidentInput,
  actor: string
): Promise<IncidentRow> {
  const rows = await query<IncidentRow>(
    `INSERT INTO incidents (workspace_id, title, source, severity, occurred_at, detected_at, summary, owner_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      workspaceId,
      input.title,
      input.source ?? null,
      input.severity ?? "medium",
      input.occurredAt ?? null,
      input.detectedAt ?? null,
      input.summary ?? null,
      input.ownerPersonId ?? null,
    ]
  );
  const incident = rows[0];

  await writeAudit(workspaceId, actor, "incident.created", SUBJECT_TYPE, incident.id, {
    title: input.title,
    severity: incident.severity,
  });

  return incident;
}

export interface UpdateIncidentInput {
  reference?: string | null;
  title?: string;
  source?: IncidentSource | null;
  severity?: IncidentSeverity;
  occurredAt?: string | null;
  detectedAt?: string | null;
  containedAt?: string | null;
  summary?: string | null;
  containment?: string | null;
  affectedPopulation?: AffectedPopulation;
  rootCause?: string | null;
  rootCauseCategory?: IncidentRootCauseCategory | null;
  reportable?: boolean;
  reportedAt?: string | null;
  regulatorReference?: string | null;
  ownerPersonId?: string | null;
  closureSummary?: string | null;
  currentStep?: number;
  /** Only forward, non-final moves are settable via this path (see isPatchableIncidentStatus); 'closed'/'cancelled' are only reachable via closeIncident/other dedicated paths. */
  status?: IncidentStatus;
}

export type UpdateIncidentResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; reason: "not_found" | "already_final" };

/**
 * Updates an incident. Runs inside a transaction with SELECT ... FOR UPDATE
 * on the incident row (the same locking helper closeIncident/reopenIncident
 * use), so a concurrent PATCH racing a close()/delete() cannot both "win":
 * the second transaction blocks on the row lock until the first commits,
 * then sees the now-final status and refuses ("already_final") rather than
 * writing over it. The UPDATE's WHERE clause also carries
 * `AND status NOT IN ('closed', 'cancelled')` as belt-and-braces - if
 * anything upstream of this function ever changes the guard order, the
 * write itself still cannot land on a final row, and 0 rows affected is
 * reported as the same "already_final" result rather than being read as
 * "not found".
 */
export async function updateIncident(
  workspaceId: string,
  id: string,
  input: UpdateIncidentInput,
  actor: string
): Promise<UpdateIncidentResult> {
  return withTransaction(async (client) => {
    const current = await getIncidentWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };
    if (isFinalIncidentStatus(current.status)) return { ok: false, reason: "already_final" };

    const reference = input.reference !== undefined ? input.reference : current.reference;
    const title = input.title ?? current.title;
    const source = input.source !== undefined ? input.source : current.source;
    const severity = input.severity ?? current.severity;
    const occurredAt = input.occurredAt !== undefined ? input.occurredAt : current.occurred_at;
    const detectedAt = input.detectedAt !== undefined ? input.detectedAt : current.detected_at;
    const containedAt = input.containedAt !== undefined ? input.containedAt : current.contained_at;
    const summary = input.summary !== undefined ? input.summary : current.summary;
    const containment = input.containment !== undefined ? input.containment : current.containment;
    const affectedPopulation = input.affectedPopulation !== undefined ? input.affectedPopulation : current.affected_population;
    const rootCause = input.rootCause !== undefined ? input.rootCause : current.root_cause;
    const rootCauseCategory = input.rootCauseCategory !== undefined ? input.rootCauseCategory : current.root_cause_category;
    const reportable = input.reportable !== undefined ? input.reportable : current.reportable;
    const reportedAt = input.reportedAt !== undefined ? input.reportedAt : current.reported_at;
    const regulatorReference = input.regulatorReference !== undefined ? input.regulatorReference : current.regulator_reference;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const closureSummary = input.closureSummary !== undefined ? input.closureSummary : current.closure_summary;
    const currentStep = input.currentStep ?? current.current_step;
    const status = input.status ?? current.status;

    const rows = await queryWithClient<IncidentRow>(
      client,
      `UPDATE incidents
       SET reference = $3, title = $4, source = $5, severity = $6, occurred_at = $7, detected_at = $8,
           contained_at = $9, summary = $10, containment = $11, affected_population = $12, root_cause = $13,
           root_cause_category = $14, reportable = $15, reported_at = $16, regulator_reference = $17,
           owner_person_id = $18, closure_summary = $19, current_step = $20, status = $21, updated_at = now()
       WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('closed', 'cancelled')
       RETURNING *`,
      [
        workspaceId,
        id,
        reference,
        title,
        source,
        severity,
        occurredAt,
        detectedAt,
        containedAt,
        summary,
        containment,
        JSON.stringify(affectedPopulation),
        rootCause,
        rootCauseCategory,
        reportable,
        reportedAt,
        regulatorReference,
        ownerPersonId,
        closureSummary,
        currentStep,
        status,
      ]
    );

    const updated = rows[0];
    if (!updated) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "incident.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) }, client);
    return { ok: true, incident: updated };
  });
}

export type DeleteIncidentResult = { ok: true } | { ok: false; reason: "not_found" | "already_final" };

/**
 * Deletes an incident. Same transaction + row-lock + status-predicate
 * treatment as updateIncident, for the same reason: a plain SELECT-then-
 * DELETE with no lock and no status predicate on the DELETE let a
 * concurrent PATCH and close() race past the route's isFinalIncidentStatus
 * check (TOCTOU).
 */
export async function deleteIncident(workspaceId: string, id: string, actor: string): Promise<DeleteIncidentResult> {
  return withTransaction(async (client) => {
    const current = await getIncidentWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };
    if (isFinalIncidentStatus(current.status)) return { ok: false, reason: "already_final" };

    const rows = await queryWithClient<{ id: string }>(
      client,
      `DELETE FROM incidents WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('closed', 'cancelled') RETURNING id`,
      [workspaceId, id]
    );
    if (rows.length === 0) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "incident.deleted", SUBJECT_TYPE, id, {}, client);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// incident_links
// ---------------------------------------------------------------------------

export interface CreateIncidentLinkInput {
  linkType: IncidentLinkType;
  targetId?: string | null;
  targetRef?: string | null;
  note?: string | null;
}

export async function listIncidentLinks(workspaceId: string, incidentId: string): Promise<IncidentLinkRow[]> {
  return query<IncidentLinkRow>(
    `SELECT * FROM incident_links WHERE workspace_id = $1 AND incident_id = $2 ORDER BY created_at ASC`,
    [workspaceId, incidentId]
  );
}

export async function getIncidentLink(workspaceId: string, id: string): Promise<IncidentLinkRow | null> {
  const rows = await query<IncidentLinkRow>(`SELECT * FROM incident_links WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createIncidentLink(
  workspaceId: string,
  incidentId: string,
  input: CreateIncidentLinkInput,
  actor: string
): Promise<IncidentLinkRow> {
  const rows = await query<IncidentLinkRow>(
    `INSERT INTO incident_links (workspace_id, incident_id, link_type, target_id, target_ref, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, incidentId, input.linkType, input.targetId ?? null, input.targetRef ?? null, input.note ?? null]
  );
  const link = rows[0];

  await writeAudit(workspaceId, actor, "incident_link.created", LINK_SUBJECT_TYPE, link.id, {
    incidentId,
    linkType: input.linkType,
    targetId: input.targetId ?? null,
    targetRef: input.targetRef ?? null,
  });

  return link;
}

export async function deleteIncidentLink(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM incident_links WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "incident_link.deleted", LINK_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// close / reopen
// ---------------------------------------------------------------------------

async function getIncidentWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  id: string
): Promise<IncidentRow | null> {
  const rows = await queryWithClient<IncidentRow>(
    client,
    `SELECT * FROM incidents WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export type CloseIncidentResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; reason: "not_found" | "already_final" | "open_actions" | "no_root_cause" };

/**
 * Closes an incident. This is the write-back path that closes the
 * traceability loop: an incident may not be marked closed while any
 * remediation action attached to it (subject_type 'incident') is still open
 * or in_progress ("open_actions") - closing over an open remediation is
 * exactly the governance failure this module exists to catch - and may not
 * be closed without a recorded root cause ("no_root_cause"), since a closed
 * incident with no root cause leaves nothing for the next control test or
 * assessment to check against. Runs in a single transaction with
 * SELECT ... FOR UPDATE on the incident row to guard against a concurrent
 * second close() racing past the guards. 409-equivalent ("already_final") if
 * the incident is already closed or cancelled. Neither guard writes anything
 * - they refuse before any write happens.
 */
export async function closeIncident(workspaceId: string, incidentId: string, actor: string): Promise<CloseIncidentResult> {
  return withTransaction(async (client) => {
    const incident = await getIncidentWithClient(client, workspaceId, incidentId);
    if (!incident) return { ok: false, reason: "not_found" };
    if (isFinalIncidentStatus(incident.status)) return { ok: false, reason: "already_final" };

    const openActionRows = await queryWithClient<{ count: string }>(
      client,
      `SELECT COUNT(*)::text as count FROM actions
       WHERE workspace_id = $1 AND subject_type = 'incident' AND subject_id = $2 AND status NOT IN ('done', 'cancelled')`,
      [workspaceId, incidentId]
    );
    const openActionCount = parseInt(openActionRows[0]?.count ?? "0", 10);
    if (openActionCount > 0) return { ok: false, reason: "open_actions" };

    if (!incident.root_cause || !incident.root_cause.trim()) {
      return { ok: false, reason: "no_root_cause" };
    }

    const rows = await queryWithClient<IncidentRow>(
      client,
      `UPDATE incidents SET status = 'closed', closed_at = now(), updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [workspaceId, incidentId]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "incident.closed", SUBJECT_TYPE, incidentId, {}, client);

    return { ok: true, incident: updated };
  });
}

export type ReopenIncidentResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; reason: "not_found" | "not_closed" };

/**
 * Reopens a closed incident back to 'investigating' (real incidents do
 * reopen, e.g. when remediation turns out to be incomplete). Only a closed
 * incident may be reopened; a cancelled incident is a dead record and stays
 * that way. Clears closed_at since the incident is no longer closed - it is
 * set again if the incident is closed a second time. Runs in a transaction
 * with SELECT ... FOR UPDATE on the incident row for the same reason as
 * closeIncident.
 */
export async function reopenIncident(workspaceId: string, incidentId: string, actor: string): Promise<ReopenIncidentResult> {
  return withTransaction(async (client) => {
    const incident = await getIncidentWithClient(client, workspaceId, incidentId);
    if (!incident) return { ok: false, reason: "not_found" };
    if (incident.status !== "closed") return { ok: false, reason: "not_closed" };

    const rows = await queryWithClient<IncidentRow>(
      client,
      `UPDATE incidents SET status = 'investigating', closed_at = NULL, updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [workspaceId, incidentId]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "incident.reopened", SUBJECT_TYPE, incidentId, {}, client);

    return { ok: true, incident: updated };
  });
}
