import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "../password";

describe("hashPassword / verifyPassword", () => {
  it("produces a different hash string for the same password across two calls (random salt)", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
  });

  it("stores the scrypt cost parameters in the format", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const parts = hash.split(":");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password entirely", hash)).resolves.toBe(false);
  });

  it("rejects a subtly different password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staplee", hash)).resolves.toBe(false);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt:bad:format")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt:16384:8:1:zz:zz")).resolves.toBe(false);
  });

  it("is constant-time-ish: verifying wrong passwords of varying similarity does not vary wildly in duration", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const samples: number[] = [];
    const candidates = ["x", "correct", "correct horse", "correct horse battery staplX", "totally unrelated string of similar length!"];
    for (const candidate of candidates) {
      const start = process.hrtime.bigint();
      await verifyPassword(candidate, hash);
      const end = process.hrtime.bigint();
      samples.push(Number(end - start));
    }
    // The dominant cost is the scrypt derivation itself (same work regardless
    // of how much of the final digest matches), so timings should be within
    // the same order of magnitude - this is a smoke check, not a rigorous
    // timing-attack proof. A byte-by-byte early-exit comparison (the bug this
    // guards against) would show a specific short-candidate outlier; scrypt's
    // fixed-cost derivation dominates instead.
    const max = Math.max(...samples);
    const min = Math.min(...samples);
    expect(max / min).toBeLessThan(20);
  });

  it("needsRehash is false for a hash created under current parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(needsRehash(hash)).toBe(false);
  });

  it("needsRehash is true for a hash created under different parameters", () => {
    const oldHash = "scrypt:1024:8:1:aabb:ccdd";
    expect(needsRehash(oldHash)).toBe(true);
  });

  it("needsRehash is true for a malformed hash", () => {
    expect(needsRehash("garbage")).toBe(true);
  });
});
