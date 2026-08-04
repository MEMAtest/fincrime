import { query } from "@/lib/db";
import { writeAudit } from "./audit";

export type PersonRole = "owner" | "reviewer" | "approver";

export interface PersonRow {
  id: string;
  workspace_id: string;
  name: string;
  role: PersonRole;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonInput {
  name: string;
  role: PersonRole;
  email?: string | null;
}

export async function listPeople(workspaceId: string): Promise<PersonRow[]> {
  return query<PersonRow>(`SELECT * FROM workspace_people WHERE workspace_id = $1 ORDER BY created_at ASC`, [
    workspaceId,
  ]);
}

export async function getPerson(workspaceId: string, id: string): Promise<PersonRow | null> {
  const rows = await query<PersonRow>(`SELECT * FROM workspace_people WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createPerson(workspaceId: string, input: CreatePersonInput, actor: string): Promise<PersonRow> {
  const rows = await query<PersonRow>(
    `INSERT INTO workspace_people (workspace_id, name, role, email)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [workspaceId, input.name, input.role, input.email || null]
  );
  const person = rows[0];

  await writeAudit(workspaceId, actor, "person.created", "workspace_person", person.id, {
    name: input.name,
    role: input.role,
  });

  return person;
}

export interface UpdatePersonInput {
  name?: string;
  role?: PersonRole;
  email?: string | null;
}

export async function updatePerson(
  workspaceId: string,
  id: string,
  input: UpdatePersonInput,
  actor: string
): Promise<PersonRow | null> {
  const current = await getPerson(workspaceId, id);
  if (!current) return null;

  const name = input.name ?? current.name;
  const role = input.role ?? current.role;
  const email = input.email !== undefined ? input.email : current.email;

  const rows = await query<PersonRow>(
    `UPDATE workspace_people
     SET name = $3, role = $4, email = $5, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, name, role, email]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "person.updated", "workspace_person", id, { ...input });
  }
  return updated;
}

export async function deletePerson(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM workspace_people WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "person.deleted", "workspace_person", id, {});
  }
  return deleted;
}
