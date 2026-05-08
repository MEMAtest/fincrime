import { Pool, type PoolClient } from "pg";

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const connectionTimeoutMillis = Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || "5000", 10);
const queryTimeoutMillis = Number.parseInt(process.env.PG_QUERY_TIMEOUT_MS || "8000", 10);
const statementTimeoutMillis = Number.parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || "8000", 10);

function shouldUseSsl(connectionString: string): boolean {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const host = (url.hostname || "").trim().toLowerCase();
    const sslMode = (url.searchParams.get("sslmode") || process.env.PGSSLMODE || "")
      .trim()
      .toLowerCase();
    if (["disable", "allow", "prefer"].includes(sslMode)) return false;
    if (["require", "verify-ca", "verify-full"].includes(sslMode)) return true;
    return !["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return connectionString.includes("sslmode=require");
  }
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis,
  query_timeout: queryTimeoutMillis,
  statement_timeout: statementTimeoutMillis,
  idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS || "10000", 10),
  keepAlive: true,
});

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryWithClient<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await client.query(text, params);
  return result.rows as T[];
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

export type DbTransactionClient = PoolClient;
export default pool;
