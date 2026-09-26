import { describe, it, expect } from "vitest";
import { assignGroupToSection } from "../section-assignment";
import type { SkeletonSection } from "../skeleton";

const sections: SkeletonSection[] = [
  { number: "2.1", title: "CDD", lifecycleStage: "Onboarding", customerType: "natural_person", standardWording: null, emptySectionWording: null, backofficeControlMap: "Customer Due Diligence" },
  { number: "2.2", title: "CDD", lifecycleStage: "Onboarding", customerType: "legal_person", standardWording: null, emptySectionWording: null, backofficeControlMap: "Customer Due Diligence" },
  { number: "2.3", title: "EDD", lifecycleStage: "Ongoing Monitoring", customerType: "both", standardWording: null, emptySectionWording: null, backofficeControlMap: "Enhanced Due Diligence" },
  { number: "2.4", title: "EDD legal", lifecycleStage: "Onboarding", customerType: "legal_person", standardWording: null, emptySectionWording: null, backofficeControlMap: "Enhanced Due Diligence" },
];

describe("assignGroupToSection", () => {
  it("routes an untagged EDD control to the legal person section for a legal-person-only product", () => {
    const result = assignGroupToSection(
      { groupKey: "c1", backofficeControl: "Enhanced Due Diligence", customerType: null },
      sections,
      ["legal_person"]
    );
    expect(result.sectionNumber).toBe("2.4");
  });

  it("routes to the 'both' section when the PRA covers both customer types and the group is untagged", () => {
    const result = assignGroupToSection(
      { groupKey: "c1", backofficeControl: "Enhanced Due Diligence", customerType: null },
      sections,
      ["natural_person", "legal_person"]
    );
    expect(result.sectionNumber).toBe("2.3");
  });

  it("routes a natural-person-tagged CDD control to the natural person section", () => {
    const result = assignGroupToSection(
      { groupKey: "c1", backofficeControl: "Customer Due Diligence", customerType: "natural_person" },
      sections,
      ["natural_person", "legal_person"]
    );
    expect(result.sectionNumber).toBe("2.1");
  });

  it("returns null with a reason when no section maps to the back office control", () => {
    const result = assignGroupToSection({ groupKey: "c1", backofficeControl: "Sanctions Screening", customerType: null }, sections, ["both"]);
    expect(result.sectionNumber).toBeNull();
    expect(result.reason).toMatch(/no section maps/i);
  });

  it("returns null with a reason when there is no back office control to match", () => {
    const result = assignGroupToSection({ groupKey: "c1", backofficeControl: null, customerType: null }, sections, ["both"]);
    expect(result.sectionNumber).toBeNull();
  });
});
