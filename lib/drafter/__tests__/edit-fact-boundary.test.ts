import { describe, it, expect } from "vitest";
import { flagUnsupportedEditTerms } from "../edit-fact-boundary";
import type { DrafterEnhancementRow, DrafterPraRow } from "@/lib/repo/drafter-pras";

/**
 * SAFETY: an Apply-fix save is re-checked against the fact boundary (task:
 * "run the fact boundary on SAVE of any edit that came from Apply fix ...
 * flag new unsupported terms as open items, never silently"). This exercises
 * the pure flagging logic directly, for an enhancement with no register
 * controls (so no DB round trip for source fields is needed) and inputs that
 * do not contain "every 12 months" or "MLRO".
 */

function pra(description: string | null): DrafterPraRow {
  return {
    id: "pra-1",
    product: "Test product",
    description,
    legal_entity: null,
    customer_types: ["legal_person"],
    template_version_id: "t1",
    stylepack_version_id: "s1",
    register_version_id: null,
    status: "draft",
    cost_cap_pence: null,
    spend_pence: 0,
    created_by: "test@example.com",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function enhancement(controlText: string, rationale: string): DrafterEnhancementRow {
  return {
    id: "enh-1",
    section_id: "sec-1",
    pra_id: "pra-1",
    sort_order: 0,
    control_ids: [],
    control_text: controlText,
    rationale,
    backoffice_control_label: null,
    evidence_refs: [],
    placeholders: [],
    review_result: null,
    is_gap: false,
    model_name: null,
    prompt_version: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("flagUnsupportedEditTerms", () => {
  it("flags an unsupported figure/frequency introduced by an Apply-fix save as an open item, never silently", async () => {
    const enh = enhancement("The reviewer screens each relationship and records the outcome.", "This addresses the onboarding risk.");
    const descriptions = await flagUnsupportedEditTerms(
      [{ field: "control_text", newValue: "The reviewer screens each relationship every 12 months and records the outcome." }],
      enh,
      pra("A test product."),
      "apply_fix"
    );
    expect(descriptions.some((d) => d.includes("every 12 months"))).toBe(true);
  });

  it("flags an unsupported role/system name introduced by an Apply-fix save", async () => {
    const enh = enhancement("The reviewer screens each relationship and records the outcome.", "This addresses the onboarding risk.");
    const descriptions = await flagUnsupportedEditTerms(
      [{ field: "control_text", newValue: "The MLRO screens each relationship and records the outcome." }],
      enh,
      pra("A test product."),
      "apply_fix"
    );
    expect(descriptions.some((d) => d.includes("MLRO"))).toBe(true);
  });

  it("flags nothing when the saved text introduces no new number, frequency, role or system", async () => {
    const enh = enhancement("The reviewer screens each relationship and records the outcome.", "This addresses the onboarding risk.");
    const descriptions = await flagUnsupportedEditTerms(
      [{ field: "control_text", newValue: "The reviewer screens each relationship promptly and records the outcome." }],
      enh,
      pra("A test product."),
      "apply_fix"
    );
    expect(descriptions).toEqual([]);
  });
});
