import { query } from "@/lib/db";

/**
 * PRA Drafter audit trail. Unlike the main app's audit_log, this is never
 * scoped by workspace_id (the module has no per-client workspaces - see
 * BUILD-DECISIONS.md "Private"): every row just records who (actor email)
 * did what to which entity.
 */
export async function writeDrafterAudit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  await query(
    `INSERT INTO drafter_audit_log (actor, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [actor, action, entityType, entityId, JSON.stringify(details)]
  );
}
