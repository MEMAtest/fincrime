/**
 * Canonical requirements-register column schema (SPEC.md "Register import"
 * role table). Columns are mapped by header name, never by position - each
 * canonical header below is a role + a stable field_key; the header-name
 * matcher below proposes a mapping the user can edit before it is saved.
 */

export type ColumnRole =
  | "filter"
  | "section_and_tags"
  | "reuse_adapt_new"
  | "draft_input"
  | "evidence"
  | "reference_only"
  | "unused";

export interface CanonicalColumn {
  header: string;
  role: ColumnRole;
  fieldKey: string;
}

export const CANONICAL_COLUMNS: CanonicalColumn[] = [
  // Filter
  { header: "Applicability", role: "filter", fieldKey: "applicability" },
  { header: "Obligation vs Guidance", role: "filter", fieldKey: "obligation_vs_guidance" },
  { header: "Group 2LOD Status", role: "filter", fieldKey: "group_2lod_status" },
  { header: "Complete for PRA + Procedures?", role: "filter", fieldKey: "complete_for_pra_procedures" },
  // Section and tags
  { header: "FinCrime Area", role: "section_and_tags", fieldKey: "fincrime_area" },
  { header: "Applicable control from Back Office (BO)", role: "section_and_tags", fieldKey: "backoffice_control" },
  { header: "Jurisdiction", role: "section_and_tags", fieldKey: "jurisdiction" },
  { header: "Source regulation", role: "section_and_tags", fieldKey: "source_regulation" },
  { header: "Fincrime Product", role: "section_and_tags", fieldKey: "fincrime_product" },
  // Reuse, adapt or new
  { header: "Control coverage assessment", role: "reuse_adapt_new", fieldKey: "control_coverage_assessment" },
  // Draft input
  { header: "Obligation description", role: "draft_input", fieldKey: "obligation_description" },
  { header: "Control Review Notes", role: "draft_input", fieldKey: "control_review_notes" },
  { header: "Control Uplift / Amendment", role: "draft_input", fieldKey: "control_uplift_amendment" },
  { header: "Remediation on identified gaps", role: "draft_input", fieldKey: "remediation_gaps" },
  // Evidence
  { header: "Regulatory requirement ID", role: "evidence", fieldKey: "req_id" },
  { header: "Requirement reference", role: "evidence", fieldKey: "requirement_reference" },
  { header: "BackOffice Linkage - ID", role: "evidence", fieldKey: "backoffice_linkage_id" },
  { header: "Scoping FinCrime Ticket", role: "evidence", fieldKey: "scoping_fincrime_ticket" },
  // Reference only
  { header: "Requirement (original language)", role: "reference_only", fieldKey: "requirement_original" },
  { header: "Requirement (translation)", role: "reference_only", fieldKey: "requirement_translation" },
  { header: "Rationale", role: "reference_only", fieldKey: "rationale" },
  { header: "Rationale for decision", role: "reference_only", fieldKey: "rationale_for_decision" },
  { header: "BackOffice Reconciliation Comment", role: "reference_only", fieldKey: "backoffice_reconciliation_comment" },
  // Unused (status / owner workflow columns)
  { header: "Phase", role: "unused", fieldKey: "phase" },
  { header: "Current Owner", role: "unused", fieldKey: "current_owner" },
  { header: "RBUK 2LOD Status and Notes", role: "unused", fieldKey: "rbuk_2lod_status_notes" },
  { header: "Group 1LOD Status and Notes", role: "unused", fieldKey: "group_1lod_status_notes" },
  { header: "Prioritisation", role: "unused", fieldKey: "prioritisation" },
];

export const REQ_ID_FIELD_KEY = "req_id";

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?]/g, "");
}

/**
 * Proposes a mapping for a sheet's raw headers: exact (normalised) match to
 * a canonical column, or role "unused" with a slugified field_key for
 * anything unrecognised. The user reviews/edits this before saving (SPEC.md:
 * "a saved mapping the user can edit").
 */
export function proposeColumnMapping(rawHeaders: string[]): { sourceHeader: string; role: ColumnRole; fieldKey: string }[] {
  const byNormalised = new Map(CANONICAL_COLUMNS.map((c) => [normaliseHeader(c.header), c]));
  return rawHeaders.map((header) => {
    const canonical = byNormalised.get(normaliseHeader(header));
    if (canonical) return { sourceHeader: header, role: canonical.role, fieldKey: canonical.fieldKey };
    const slug = header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unnamed_column";
    return { sourceHeader: header, role: "unused" as ColumnRole, fieldKey: slug };
  });
}

/** Canonical headers that carry a role (used by the "expected column missing" check). */
export const EXPECTED_HEADERS = CANONICAL_COLUMNS.map((c) => c.header);

export function expectedHeaderRole(header: string): ColumnRole | null {
  const canonical = CANONICAL_COLUMNS.find((c) => normaliseHeader(c.header) === normaliseHeader(header));
  return canonical ? canonical.role : null;
}
