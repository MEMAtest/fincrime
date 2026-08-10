import { Pool, type PoolClient, types } from "pg";

// The `pg` driver's default type parser for a DATE column (oid 1082)
// constructs a JS Date at LOCAL midnight (via the `postgres-date` package)
// and hands it back as a Date object - even though every row interface in
// this codebase (lib/repo/**) declares that field as a plain `string`. Once
// that Date crosses NextResponse.json -> JSON.stringify -> Date#toJSON, it
// serialises via toISOString(), which converts local midnight to UTC: on
// any host whose local time zone is ahead of UTC (e.g. BST, UTC+1), local
// midnight on 2026-10-01 becomes "2026-09-30T23:00:00.000Z" on the wire -
// silently shifting every DATE value back a calendar day. This is exactly
// the "comparing a request string to a pg Date" trap noted throughout
// lib/repo/** (see e.g. lib/reg-response/summary.ts's toEpochMs). Registering
// a passthrough parser for oid 1082 makes DATE columns come back as the
// plain "YYYY-MM-DD" string Postgres sent, matching the TypeScript types
// that already assume that shape everywhere in this codebase - a pure
// correctness fix, not a behaviour change any caller could have been
// relying on (a Date object was never a documented or intended contract
// here). TIMESTAMP/TIMESTAMPTZ columns are left on the default parser:
// those genuinely represent an absolute instant, so the Date -> ISO string
// round trip through toISOString() is correct for them.
types.setTypeParser(1082, (value: string) => value);

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
