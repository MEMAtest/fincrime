import pg from "pg";
import { randomBytes, createHash } from "node:crypto";
const client = new pg.Client({ connectionString: "postgres://localhost/fincrime_dev" });
await client.connect();
async function mint(userId, label) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30*24*3600*1000).toISOString();
  await client.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`, [userId, hash, expiresAt]);
  console.log(label, token);
}
await mint("11111111-1111-1111-1111-111111111111", "ALLOWLISTED_TOKEN");
await mint("22222222-2222-2222-2222-222222222222", "NONALLOWLISTED_TOKEN");
await client.end();
