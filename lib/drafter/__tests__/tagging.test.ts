import { describe, it, expect } from "vitest";
import { coverageGroup, buildCodeTags, enforceControlledTags, proposeMergeGroups } from "../tagging";

describe("coverageGroup", () => {
  it("maps Yes/Partial/No to reuse/adapt/new, everything else to unassessed", () => {
    expect(coverageGroup("Yes")).toBe("reuse");
    expect(coverageGroup("Partial")).toBe("adapt");
    expect(coverageGroup("No")).toBe("new");
    expect(coverageGroup("")).toBe("unassessed");
    expect(coverageGroup(null)).toBe("unassessed");
    expect(coverageGroup("#REF!")).toBe("unassessed");
  });
});

describe("buildCodeTags", () => {
  it("builds code tags from register fields, skipping N/A product", () => {
    const tags = buildCodeTags({
      backoffice_control: "Customer Due Diligence",
      fincrime_area: "CDD",
      jurisdiction: "Lithuania",
      source_regulation: "AMLD5",
      requirement_reference: "Art. 13",
      control_coverage_assessment: "Yes",
      fincrime_product: "N/A",
    });
    expect(tags.backoffice_control).toBe("Customer Due Diligence");
    expect(tags.regulation_reference).toBe("AMLD5 Art. 13");
    expect(tags.products_used_in).toBeUndefined();
  });
});

describe("enforceControlledTags", () => {
  const lists = {
    risk_addressed: ["sanctions", "source of wealth"],
    customer_type: ["natural person", "legal person", "both"],
    lifecycle_stage: ["onboarding", "ongoing monitoring", "periodic review", "exit"],
  };

  it("accepts a value that is in the controlled list with an evidence phrase", () => {
    const result = enforceControlledTags(
      [{ tagType: "risk_addressed", value: "sanctions", evidencePhrase: "screened against sanctions lists" }],
      lists
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects a value the model invented that is not in the controlled list", () => {
    const result = enforceControlledTags(
      [{ tagType: "risk_addressed", value: "shell banks", evidencePhrase: "correspondent relationship" }],
      lists
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/not in the controlled list/);
  });

  it("rejects a suggestion with no evidence phrase", () => {
    const result = enforceControlledTags([{ tagType: "customer_type", value: "both", evidencePhrase: "" }], lists);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/No evidence phrase/);
  });

  it("matches case-insensitively", () => {
    const result = enforceControlledTags(
      [{ tagType: "customer_type", value: "Legal Person", evidencePhrase: "for legal entities" }],
      lists
    );
    expect(result.accepted).toHaveLength(1);
  });
});

describe("proposeMergeGroups", () => {
  it("groups controls sharing a backoffice control and a confirmed risk tag", () => {
    const groups = proposeMergeGroups([
      { id: "a", backofficeControl: "CDD", confirmedRiskTags: ["sanctions"] },
      { id: "b", backofficeControl: "CDD", confirmedRiskTags: ["sanctions"] },
      { id: "c", backofficeControl: "CDD", confirmedRiskTags: ["source of wealth"] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].controlIds.sort()).toEqual(["a", "b"]);
  });

  it("never proposes a merge on an unconfirmed (absent) risk tag", () => {
    const groups = proposeMergeGroups([
      { id: "a", backofficeControl: "CDD", confirmedRiskTags: [] },
      { id: "b", backofficeControl: "CDD", confirmedRiskTags: [] },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("never proposes a merge without a shared backoffice control", () => {
    const groups = proposeMergeGroups([
      { id: "a", backofficeControl: "CDD", confirmedRiskTags: ["sanctions"] },
      { id: "b", backofficeControl: "EDD", confirmedRiskTags: ["sanctions"] },
    ]);
    expect(groups).toHaveLength(0);
  });
});
