import { describe, it, expect } from "vitest";
import {
  checkMissingColumns,
  validateRow,
  checkDuplicateReqIds,
  validateRegisterRows,
  type ColumnMappingEntry,
  type RegisterRowInput,
} from "../validation";
import type { ContradictionRule } from "@/lib/repo/drafter-settings";
import { EXPECTED_HEADERS } from "../register-schema";

const MAPPING: ColumnMappingEntry[] = [
  { sourceHeader: "Applicability", role: "filter", fieldKey: "applicability" },
  { sourceHeader: "Complete for PRA + Procedures?", role: "filter", fieldKey: "complete_for_pra_procedures" },
  { sourceHeader: "Current Owner", role: "unused", fieldKey: "current_owner" },
  { sourceHeader: "Fincrime Product", role: "section_and_tags", fieldKey: "fincrime_product" },
  { sourceHeader: "BackOffice Reconciliation Comment", role: "reference_only", fieldKey: "backoffice_reconciliation_comment" },
  { sourceHeader: "Regulatory requirement ID", role: "evidence", fieldKey: "req_id" },
  { sourceHeader: "Control Review Notes", role: "draft_input", fieldKey: "control_review_notes" },
  { sourceHeader: "Control Uplift / Amendment", role: "draft_input", fieldKey: "control_uplift_amendment" },
  { sourceHeader: "Remediation on identified gaps", role: "draft_input", fieldKey: "remediation_gaps" },
  { sourceHeader: "Requirement (original language)", role: "reference_only", fieldKey: "requirement_original" },
  { sourceHeader: "Requirement (translation)", role: "reference_only", fieldKey: "requirement_translation" },
];

const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    id: "applicability_vs_backoffice_out_of_scope",
    column_a: "applicability",
    value_a: "Applicable to Revolut",
    column_b: "backoffice_reconciliation_comment",
    value_b_contains: "Marked Out of Scope",
    severity: "blocking",
  },
];

function makeRow(rowIndex: number, cells: Record<string, string | { error: string }>): RegisterRowInput {
  const cellsByHeader: RegisterRowInput["cellsByHeader"] = {};
  for (const [header, value] of Object.entries(cells)) {
    cellsByHeader[header] = typeof value === "string" ? { text: value } : { text: value.error, error: value.error };
  }
  return { rowIndex, cellsByHeader };
}

describe("checkMissingColumns", () => {
  it("flags a missing column with a role as blocking", () => {
    const issues = checkMissingColumns(["Applicability"]); // most canonical headers absent
    const reqIdIssue = issues.find((i) => i.column === "Regulatory requirement ID");
    expect(reqIdIssue?.severity).toBe("blocking");
  });

  it("flags a missing unused column as a warning", () => {
    const allButPhase = EXPECTED_HEADERS.filter((h: string) => h !== "Phase");
    const issues = checkMissingColumns(allButPhase);
    const phaseIssue = issues.find((i) => i.column === "Phase");
    expect(phaseIssue?.severity).toBe("warning");
  });
});

describe("validateRow", () => {
  it("flags a formula error in a filter column as blocking, in unused as warning", () => {
    const row = makeRow(0, {
      Applicability: "Applicable to Revolut",
      "Complete for PRA + Procedures?": { error: "#REF!" },
      "Current Owner": { error: "#REF!" },
    });
    const issues = validateRow(row, MAPPING, []);
    const filterIssue = issues.find((i) => i.column === "Complete for PRA + Procedures?");
    const unusedIssue = issues.find((i) => i.column === "Current Owner");
    expect(filterIssue?.severity).toBe("blocking");
    expect(unusedIssue?.severity).toBe("warning");
  });

  it("flags a placeholder value in a tag column as a warning", () => {
    const row = makeRow(0, { "Fincrime Product": "N/A" });
    const issues = validateRow(row, MAPPING, []);
    expect(issues.find((i) => i.check === "placeholder_tag_value")?.severity).toBe("warning");
  });

  it("flags a configured contradiction as blocking and never resolves it", () => {
    const row = makeRow(0, {
      Applicability: "Applicable to Revolut",
      "BackOffice Reconciliation Comment": "Marked Out of Scope by the regional team",
    });
    const issues = validateRow(row, MAPPING, CONTRADICTION_RULES);
    const contradiction = issues.find((i) => i.check === "contradiction");
    expect(contradiction?.severity).toBe("blocking");
  });

  it("does not flag a contradiction when the rule does not match", () => {
    const row = makeRow(0, { Applicability: "Not applicable", "BackOffice Reconciliation Comment": "All good" });
    const issues = validateRow(row, MAPPING, CONTRADICTION_RULES);
    expect(issues.find((i) => i.check === "contradiction")).toBeUndefined();
  });

  it("flags empty draft input as a warning when draft-input columns are mapped", () => {
    const row = makeRow(0, {
      "Regulatory requirement ID": "REQ-0001",
      "Control Review Notes": "",
      "Control Uplift / Amendment": "",
      "Remediation on identified gaps": "",
    });
    const issues = validateRow(row, MAPPING, []);
    expect(issues.find((i) => i.check === "empty_draft_input")?.severity).toBe("warning");
  });

  it("does not flag empty draft input when at least one field has text", () => {
    const row = makeRow(0, { "Control Review Notes": "Some review notes." });
    const issues = validateRow(row, MAPPING, []);
    expect(issues.find((i) => i.check === "empty_draft_input")).toBeUndefined();
  });

  it("flags translation == original as info", () => {
    const row = makeRow(0, {
      "Requirement (original language)": "Same text.",
      "Requirement (translation)": "Same text.",
    });
    const issues = validateRow(row, MAPPING, []);
    expect(issues.find((i) => i.check === "translation_equals_original")?.severity).toBe("info");
  });
});

describe("checkDuplicateReqIds", () => {
  it("flags every row sharing a REQ ID as blocking", () => {
    const rows = [
      makeRow(0, { "Regulatory requirement ID": "REQ-0007" }),
      makeRow(1, { "Regulatory requirement ID": "REQ-0007" }),
      makeRow(2, { "Regulatory requirement ID": "REQ-0008" }),
    ];
    const result = checkDuplicateReqIds(rows, MAPPING);
    expect(result.get(0)?.[0].severity).toBe("blocking");
    expect(result.get(1)?.[0].severity).toBe("blocking");
    expect(result.has(2)).toBe(false);
  });
});

describe("validateRegisterRows", () => {
  it("marks a row blocked when it has any blocking issue, not for warnings/info alone", () => {
    const rows = [
      makeRow(0, { "Fincrime Product": "N/A" }), // warning only
      makeRow(1, { "Complete for PRA + Procedures?": { error: "#REF!" } }), // blocking (filter)
    ];
    const results = validateRegisterRows(rows, MAPPING, []);
    expect(results[0].isBlocked).toBe(false);
    expect(results[1].isBlocked).toBe(true);
  });
});
