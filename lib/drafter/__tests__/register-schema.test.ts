import { describe, it, expect } from "vitest";
import { proposeColumnMapping, EXPECTED_HEADERS, expectedHeaderRole } from "../register-schema";

describe("register-schema", () => {
  it("maps canonical headers by name to their role and field key", () => {
    const mapping = proposeColumnMapping(["Applicability", "Regulatory requirement ID", "Some Other Column"]);
    expect(mapping[0]).toEqual({ sourceHeader: "Applicability", role: "filter", fieldKey: "applicability" });
    expect(mapping[1]).toEqual({ sourceHeader: "Regulatory requirement ID", role: "evidence", fieldKey: "req_id" });
    expect(mapping[2].role).toBe("unused");
    expect(mapping[2].fieldKey).toBe("some_other_column");
  });

  it("matches header names case- and whitespace-insensitively", () => {
    const mapping = proposeColumnMapping(["  applicability  ", "COMPLETE FOR PRA + PROCEDURES"]);
    expect(mapping[0].fieldKey).toBe("applicability");
    expect(mapping[1].fieldKey).toBe("complete_for_pra_procedures");
  });

  it("exposes every canonical header's role", () => {
    for (const header of EXPECTED_HEADERS) {
      expect(expectedHeaderRole(header)).not.toBeNull();
    }
    expect(expectedHeaderRole("Not a real column")).toBeNull();
  });
});
