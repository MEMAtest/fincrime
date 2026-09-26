import { EXPECTED_HEADERS, expectedHeaderRole, type ColumnRole } from "./register-schema";
import type { ContradictionRule } from "@/lib/repo/drafter-settings";
import { detectFormulaError } from "./blocks";

export type ValidationSeverity = "blocking" | "warning" | "info";

export interface ValidationIssue {
  check: string;
  severity: ValidationSeverity;
  message: string;
  column?: string;
}

export interface RegisterCell {
  text: string;
  error?: string;
}

export interface ColumnMappingEntry {
  sourceHeader: string;
  role: ColumnRole;
  fieldKey: string;
}

export interface RegisterRowInput {
  rowIndex: number;
  cellsByHeader: Record<string, RegisterCell>;
}

const PLACEHOLDER_VALUES = new Set(["n/a", "na", "tbc", "tbd", "-", "pending"]);
const DRAFT_INPUT_FIELD_KEYS = ["control_review_notes", "control_uplift_amendment", "remediation_gaps"];

/**
 * Import-level check: expected canonical columns absent from this sheet's
 * headers. Warning by default; blocking when the missing column has a role
 * (i.e. it is one of the columns the app actually reads from), per SPEC.md's
 * "Warning, blocking if the column has a role".
 */
export function checkMissingColumns(rawHeaders: string[]): ValidationIssue[] {
  const present = new Set(rawHeaders.map((h) => h.trim().toLowerCase()));
  const issues: ValidationIssue[] = [];
  for (const expected of EXPECTED_HEADERS) {
    if (present.has(expected.trim().toLowerCase())) continue;
    const role = expectedHeaderRole(expected);
    const hasRole = role !== null && role !== "unused";
    issues.push({
      check: "expected_column_missing",
      severity: hasRole ? "blocking" : "warning",
      message: `Expected column "${expected}" was not found in this sheet.`,
      column: expected,
    });
  }
  return issues;
}

function fieldValue(row: RegisterRowInput, mapping: ColumnMappingEntry[], fieldKey: string): RegisterCell | null {
  const col = mapping.find((m) => m.fieldKey === fieldKey);
  if (!col) return null;
  return row.cellsByHeader[col.sourceHeader] ?? null;
}

function fieldValueByRole(row: RegisterRowInput, mapping: ColumnMappingEntry[], fieldKey: string): { role: ColumnRole } | null {
  const col = mapping.find((m) => m.fieldKey === fieldKey);
  return col ? { role: col.role } : null;
}

/**
 * Per-row checks: formula errors, placeholder tag values, contradictions,
 * duplicate REQ IDs (duplicate check needs the full row set, run separately
 * below), empty draft input, translation == original.
 */
export function validateRow(
  row: RegisterRowInput,
  mapping: ColumnMappingEntry[],
  contradictionRules: ContradictionRule[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Formula error in a mapped column: blocking for filter columns, warning
  // otherwise (SPEC.md's own example lists "Current Owner", an unused
  // status column, alongside a filter column at "warning otherwise").
  for (const col of mapping) {
    const cell = row.cellsByHeader[col.sourceHeader];
    if (!cell) continue;
    const error = cell.error ?? detectFormulaError(cell.text);
    if (error) {
      issues.push({
        check: "formula_error",
        severity: col.role === "filter" ? "blocking" : "warning",
        message: `Column "${col.sourceHeader}" has a formula error (${error}) instead of a value.`,
        column: col.sourceHeader,
      });
    }
  }

  // Placeholder value in a tag column (section_and_tags).
  for (const col of mapping) {
    if (col.role !== "section_and_tags") continue;
    const cell = row.cellsByHeader[col.sourceHeader];
    if (!cell) continue;
    const normalised = cell.text.trim().toLowerCase();
    if (normalised && PLACEHOLDER_VALUES.has(normalised)) {
      issues.push({
        check: "placeholder_tag_value",
        severity: "warning",
        message: `Column "${col.sourceHeader}" holds a placeholder value ("${cell.text}") instead of a real tag.`,
        column: col.sourceHeader,
      });
    }
  }

  // Contradiction rules (configurable pairs of column/value). The app never
  // resolves a contradiction itself - it only surfaces it for the user.
  for (const rule of contradictionRules) {
    const colA = mapping.find((m) => m.fieldKey === rule.column_a);
    const colB = mapping.find((m) => m.fieldKey === rule.column_b);
    if (!colA || !colB) continue;
    const cellA = row.cellsByHeader[colA.sourceHeader];
    const cellB = row.cellsByHeader[colB.sourceHeader];
    if (!cellA || !cellB) continue;
    const aMatches = cellA.text.trim() === rule.value_a;
    const bMatches = cellB.text.toLowerCase().includes(rule.value_b_contains.toLowerCase());
    if (aMatches && bMatches) {
      issues.push({
        check: "contradiction",
        severity: rule.severity,
        message: `"${colA.sourceHeader}" is "${rule.value_a}" but "${colB.sourceHeader}" contains "${rule.value_b_contains}".`,
      });
    }
  }

  // Empty draft input: no Control Review Notes, Uplift or Remediation text.
  const anyDraftInput = DRAFT_INPUT_FIELD_KEYS.some((key) => {
    const cell = fieldValue(row, mapping, key);
    return cell && cell.text.trim().length > 0;
  });
  const hasDraftInputMapped = DRAFT_INPUT_FIELD_KEYS.some((key) => fieldValueByRole(row, mapping, key));
  if (hasDraftInputMapped && !anyDraftInput) {
    issues.push({
      check: "empty_draft_input",
      severity: "warning",
      message: "No Control Review Notes, Uplift/Amendment or Remediation text - this control will draft as a placeholder.",
    });
  }

  // Translation equals original: info only.
  const original = fieldValue(row, mapping, "requirement_original");
  const translation = fieldValue(row, mapping, "requirement_translation");
  if (original && translation && original.text.trim() && original.text.trim() === translation.text.trim()) {
    issues.push({
      check: "translation_equals_original",
      severity: "info",
      message: "Requirement (translation) is identical to Requirement (original language).",
    });
  }

  return issues;
}

/** Duplicate REQ ID check across the whole register version: blocking. */
export function checkDuplicateReqIds(
  rows: RegisterRowInput[],
  mapping: ColumnMappingEntry[]
): Map<number, ValidationIssue[]> {
  const reqIdCol = mapping.find((m) => m.fieldKey === "req_id");
  const byId = new Map<string, number[]>();
  if (reqIdCol) {
    for (const row of rows) {
      const cell = row.cellsByHeader[reqIdCol.sourceHeader];
      const id = cell?.text.trim();
      if (!id) continue;
      const list = byId.get(id) ?? [];
      list.push(row.rowIndex);
      byId.set(id, list);
    }
  }
  const result = new Map<number, ValidationIssue[]>();
  for (const [id, indexes] of byId) {
    if (indexes.length <= 1) continue;
    for (const idx of indexes) {
      result.set(idx, [
        {
          check: "duplicate_req_id",
          severity: "blocking",
          message: `REQ ID "${id}" appears on ${indexes.length} rows (rows ${indexes.join(", ")}).`,
        },
      ]);
    }
  }
  return result;
}

export interface RowValidationResult {
  rowIndex: number;
  issues: ValidationIssue[];
  isBlocked: boolean;
}

export function validateRegisterRows(
  rows: RegisterRowInput[],
  mapping: ColumnMappingEntry[],
  contradictionRules: ContradictionRule[]
): RowValidationResult[] {
  const duplicates = checkDuplicateReqIds(rows, mapping);
  return rows.map((row) => {
    const issues = [...validateRow(row, mapping, contradictionRules), ...(duplicates.get(row.rowIndex) ?? [])];
    const isBlocked = issues.some((i) => i.severity === "blocking");
    return { rowIndex: row.rowIndex, issues, isBlocked };
  });
}
