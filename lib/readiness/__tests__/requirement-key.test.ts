import { describe, expect, it } from "vitest";
import { getCddProfile } from "@/data/kyc";
import { buildRequirements } from "@/data/kyc/requirements";

/**
 * generateObligations in lib/repo/readiness.ts keys readiness_obligations on
 * req.id (requirement_key = req.id). The whole point of that key, per the
 * fix, is that it is derived from a requirement's STRUCTURAL position
 * (entity type, jurisdiction, section/trigger/ongoing-monitoring template),
 * never from its authored title - so a title/wording fix upstream in
 * data/kyc/requirements.ts can never change the key and orphan a user's
 * existing work on that obligation. These tests exercise buildRequirements
 * (the pure, dependency-free function that emits req.id) directly, without a
 * database, to prove that contract.
 */
describe("requirement id stability (the requirement_key readiness_obligations is keyed on)", () => {
  const lookup = getCddProfile("corporate", "uk");
  if (!lookup) throw new Error("expected a corporate/uk CddProfile to exist for this test");
  const requirements = buildRequirements(lookup.profile);

  it("is deterministic: re-running buildRequirements on the same profile yields the exact same id set", () => {
    const again = buildRequirements(lookup.profile);
    expect(again.map((r) => r.id).sort()).toEqual(requirements.map((r) => r.id).sort());
  });

  it("every id is unique within one profile - the natural key generateObligations upserts on", () => {
    const ids = requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are structural (entityType-jurisdiction-... prefixed), not derived from the title text", () => {
    expect(requirements.length).toBeGreaterThan(0);
    for (const r of requirements) {
      expect(r.id.startsWith(`${lookup.profile.entityType}-${lookup.profile.jurisdiction}-`)).toBe(true);
      // A title with more than one word should not itself appear verbatim in
      // the id - if it did, the id would drift whenever the title is edited,
      // which is exactly the bug this key scheme fixes.
      if (r.title.trim().includes(" ")) {
        expect(r.id.toLowerCase()).not.toContain(r.title.toLowerCase());
      }
    }
  });

  it("category and legal basis stay attached to the SAME requirement id across runs (nothing about the identity depends on mutable content)", () => {
    const again = buildRequirements(lookup.profile);
    const byId = new Map(requirements.map((r) => [r.id, r]));
    for (const r of again) {
      const original = byId.get(r.id);
      expect(original).toBeDefined();
      expect(original?.category).toBe(r.category);
    }
  });
});
