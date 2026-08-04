import { query } from "@/lib/db";
import { writeAudit } from "./audit";

export type ActionStatus = "open" | "in_progress" | "done" | "cancelled";
export type ActionPriority = "high" | "medium" | "low";

const SUBJECT_TYPE = "action";

export interface ActionRow {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  title: string;
  owner_person_id: string | null;
  due_date: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  created_at: string;
  updated_at: string;
}

export interface CreateActionInput {
  subjectType: string;
  subjectId: string;
  title: string;
  ownerPersonId?: string | null;
  dueDate?: string | null;
  priority?: ActionPriority;
}

export async function listActionsBySubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string
): Promise<ActionRow[]> {
  return query<ActionRow>(
    `SELECT * FROM actions WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3 ORDER BY created_at ASC`,
    [workspaceId, subjectType, subjectId]
  );
}

export async function listActions(workspaceId: string, status?: ActionStatus): Promise<ActionRow[]> {
  if (status) {
    return query<ActionRow>(`SELECT * FROM actions WHERE workspace_id = $1 AND status = $2 ORDER BY due_date ASC NULLS LAST`, [
      workspaceId,
      status,
    ]);
  }
  return query<ActionRow>(`SELECT * FROM actions WHERE workspace_id = $1 ORDER BY due_date ASC NULLS LAST`, [
    workspaceId,
  ]);
}

/** Open actions with a due date in the past, across the whole workspace (workspace home). */
export async function listOverdueActions(workspaceId: string): Promise<ActionRow[]> {
  return query<ActionRow>(
    `SELECT * FROM actions
     WHERE workspace_id = $1 AND status = 'open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE
     ORDER BY due_date ASC`,
    [workspaceId]
  );
}

export async function getAction(workspaceId: string, id: string): Promise<ActionRow | null> {
  const rows = await query<ActionRow>(`SELECT * FROM actions WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

export async function createAction(workspaceId: string, input: CreateActionInput, actor: string): Promise<ActionRow> {
  const rows = await query<ActionRow>(
    `INSERT INTO actions (workspace_id, subject_type, subject_id, title, owner_person_id, due_date, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      workspaceId,
      input.subjectType,
      input.subjectId,
      input.title,
      input.ownerPersonId || null,
      input.dueDate || null,
      input.priority ?? "medium",
    ]
  );
  const action = rows[0];

  await writeAudit(workspaceId, actor, "action.created", SUBJECT_TYPE, action.id, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    title: input.title,
  });

  return action;
}

export interface UpdateActionInput {
  title?: string;
  ownerPersonId?: string | null;
  dueDate?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
}

export async function updateAction(
  workspaceId: string,
  id: string,
  input: UpdateActionInput,
  actor: string
): Promise<ActionRow | null> {
  const current = await getAction(workspaceId, id);
  if (!current) return null;

  const title = input.title ?? current.title;
  const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
  const dueDate = input.dueDate !== undefined ? input.dueDate : current.due_date;
  const status = input.status ?? current.status;
  const priority = input.priority ?? current.priority;

  const rows = await query<ActionRow>(
    `UPDATE actions
     SET title = $3, owner_person_id = $4, due_date = $5, status = $6, priority = $7, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, title, ownerPersonId, dueDate, status, priority]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "action.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteAction(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM actions WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "action.deleted", SUBJECT_TYPE, id, {});
  }
  return deleted;
}
