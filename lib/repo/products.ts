import { query } from "@/lib/db";
import { writeAudit } from "./audit";

export interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  flows: unknown[];
  customers: unknown[];
  jurisdictions: unknown[];
  channels: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  flows?: unknown[];
  customers?: unknown[];
  jurisdictions?: unknown[];
  channels?: unknown[];
}

export async function listProducts(workspaceId: string): Promise<ProductRow[]> {
  return query<ProductRow>(`SELECT * FROM products WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
}

export async function getProduct(workspaceId: string, id: string): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(`SELECT * FROM products WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createProduct(
  workspaceId: string,
  input: CreateProductInput,
  actor: string
): Promise<ProductRow> {
  const rows = await query<ProductRow>(
    `INSERT INTO products (workspace_id, name, description, flows, customers, jurisdictions, channels)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      workspaceId,
      input.name,
      input.description || null,
      JSON.stringify(input.flows ?? []),
      JSON.stringify(input.customers ?? []),
      JSON.stringify(input.jurisdictions ?? []),
      JSON.stringify(input.channels ?? []),
    ]
  );
  const product = rows[0];

  await writeAudit(workspaceId, actor, "product.created", "product", product.id, { name: input.name });

  return product;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  flows?: unknown[];
  customers?: unknown[];
  jurisdictions?: unknown[];
  channels?: unknown[];
}

export async function updateProduct(
  workspaceId: string,
  id: string,
  input: UpdateProductInput,
  actor: string
): Promise<ProductRow | null> {
  const current = await getProduct(workspaceId, id);
  if (!current) return null;

  const name = input.name ?? current.name;
  const description = input.description !== undefined ? input.description : current.description;
  const flows = input.flows ?? current.flows;
  const customers = input.customers ?? current.customers;
  const jurisdictions = input.jurisdictions ?? current.jurisdictions;
  const channels = input.channels ?? current.channels;

  const rows = await query<ProductRow>(
    `UPDATE products
     SET name = $3, description = $4, flows = $5, customers = $6, jurisdictions = $7, channels = $8, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      name,
      description,
      JSON.stringify(flows),
      JSON.stringify(customers),
      JSON.stringify(jurisdictions),
      JSON.stringify(channels),
    ]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "product.updated", "product", id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteProduct(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM products WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "product.deleted", "product", id, {});
  }
  return deleted;
}
