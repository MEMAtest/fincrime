/**
 * Builds "Backoffice control impacted" and "Evidence of delivery" from
 * register fields (SPEC.md "Drafting", code step 4). Pure and deterministic
 * - never touched by a model. Field keys match lib/drafter/register-schema.ts.
 */

export interface EvidenceSourceFields {
  backoffice_control?: string;
  req_id?: string;
  requirement_reference?: string;
  backoffice_linkage_id?: string;
  scoping_fincrime_ticket?: string;
}

export interface EvidenceRef {
  label: string;
  value: string;
}

export interface BuiltEvidence {
  backofficeControlLabel: string | null;
  evidenceRefs: EvidenceRef[];
}

const EVIDENCE_FIELD_LABELS: [keyof EvidenceSourceFields, string][] = [
  ["req_id", "Regulatory requirement ID"],
  ["requirement_reference", "Requirement reference"],
  ["backoffice_linkage_id", "BackOffice Linkage ID"],
  ["scoping_fincrime_ticket", "Scoping FinCrime Ticket"],
];

export function buildEvidence(fields: EvidenceSourceFields): BuiltEvidence {
  const evidenceRefs: EvidenceRef[] = [];
  for (const [key, label] of EVIDENCE_FIELD_LABELS) {
    const value = fields[key]?.trim();
    if (value) evidenceRefs.push({ label, value });
  }
  return {
    backofficeControlLabel: fields.backoffice_control?.trim() || null,
    evidenceRefs,
  };
}

/** Evidence formatted as one line, e.g. for the Word export or a review-panel summary. */
export function formatEvidenceLine(evidenceRefs: EvidenceRef[]): string {
  return evidenceRefs.map((e) => e.value).join(", ");
}
