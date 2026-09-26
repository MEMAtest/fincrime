/**
 * Vitest setup: ensures DATABASE_URL points at the local dev DB for any test
 * that exercises repo/DB code (e.g. lib/drafter/llm.ts logging model calls).
 * Runs before test files are imported (see vitest.config.ts setupFiles), so
 * lib/db.ts's module-scope Pool is constructed with the right connection
 * string. Never touches a real/prod database - this only sets a default
 * when nothing is already configured in the environment.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://localhost/fincrime_dev";
}
