import { describe, it, expect } from "vitest";
import { buildEvidence, formatEvidenceLine } from "../evidence";

describe("buildEvidence", () => {
  it("builds the backoffice label and evidence refs from register fields", () => {
    const result = buildEvidence({
      backoffice_control: "Customer Due Diligence",
      req_id: "REQ-0011",
      requirement_reference: "Art. 13 (1) (b)",
      backoffice_linkage_id: "BO-441",
      scoping_fincrime_ticket: "FC-90",
    });
    expect(result.backofficeControlLabel).toBe("Customer Due Diligence");
    expect(result.evidenceRefs).toHaveLength(4);
    expect(formatEvidenceLine(result.evidenceRefs)).toBe("REQ-0011, Art. 13 (1) (b), BO-441, FC-90");
  });

  it("omits blank fields rather than rendering an empty evidence entry", () => {
    const result = buildEvidence({ backoffice_control: "CDD", req_id: "REQ-1", requirement_reference: "", backoffice_linkage_id: undefined, scoping_fincrime_ticket: "  " });
    expect(result.evidenceRefs).toEqual([{ label: "Regulatory requirement ID", value: "REQ-1" }]);
  });

  it("returns null backoffice label when absent, never a fabricated fallback", () => {
    const result = buildEvidence({ req_id: "REQ-1" });
    expect(result.backofficeControlLabel).toBeNull();
  });
});
