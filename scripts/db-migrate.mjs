/**
 * Applies every .sql file in db/migrations, in filename order, tracking
 * applied files in a schema_migrations table (created on first run). Each
 * migration file runs inside its own transaction; a failure rolls back that
 * file only and stops the run (earlier applied files stay committed).
 *
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require" \
 *     node scripts/db-migrate.mjs
 *
 * If DATABASE_URL is not already set in the environment, this also tries to
 * read it from .env.local in the repo root (mirroring the env loading Next.js
 * does for the app itself, since a plain node script does not get that for
 * free). A DATABASE_URL already present in the environment always wins.
 */
import pg from "pg";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT_DIR, "db", "migrations");

function loadEnvLocal() {
  const envPath = join(ROOT_DIR, ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) value = value.slice(1, -1);

    // Env vars already set (e.g. passed on the command line) take precedence.
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("Set DATABASE_URL (see .env.local.example). Aborting.");
  process.exit(1);
}

// Mirrors the SSL detection in lib/db.ts, so this script and the app agree on
// when to use SSL for the same connection string.
function shouldUseSsl(connectionString) {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const host = (url.hostname || "").trim().toLowerCase();
    const sslMode = (url.searchParams.get("sslmode") || process.env.PGSSLMODE || "").trim().toLowerCase();
    if (["disable", "allow", "prefer"].includes(sslMode)) return false;
    if (["require", "verify-ca", "verify-full"].includes(sslMode)) return true;
    return !["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return connectionString.includes("sslmode=require");
  }
}

function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
  console.log(`Applying ${filename} ...`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    console.log(`Applied ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const pending = listMigrationFiles().filter((filename) => !applied.has(filename));

    if (!pending.length) {
      console.log("No pending migrations.");
      return;
    }

    for (const filename of pending) {
      await applyMigration(client, filename);
    }

    console.log(`Done. Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
