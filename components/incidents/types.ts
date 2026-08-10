/**
 * Client-side mirrors of the lib/repo/incidents.ts row shapes used by the
 * Incident and Assurance Workspace journey. Deliberately NOT imported from
 * lib/repo/** (those modules pull in lib/db.ts / the `pg` driver, which must
 * never end up in a client bundle) - these are plain, duplicated type
 * declarations kept in lockstep with the DB rows returned by
 * app/api/incidents/**.
 *
 * PersonDTO/ActionDTO/EvidenceDTO are identical shapes to
 * components/change-lab/types.ts (people/actions/evidence are reused
 * polymorphically across every journey in this repo), so they are re-exported
 * from there rather than redeclared.
 */

export type {
  PersonDTO,
  PersonRole,
  ActionDTO,
  ActionPriority,
  ActionStatus,
  EvidenceDTO,
} from "@/components/change-lab/types";

import type { ActionPriority, ActionStatus } from "@/components/change-lab/types";

export type IncidentSource =
  | "internal_detection"
  | "customer_complaint"
  | "regulator"
  | "third_party"
  | "audit"
  | "control_test"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "contained" | "investigating" | "remediating" | "closed" | "cancelled";
export type IncidentRootCauseCategory =
  | "control_design"
  | "control_operation"
  | "data_quality"
  | "system_failure"
  | "human_error"
  | "third_party"
  | "process_gap"
  | "other";

export type IncidentLinkType = "failed_control" | "control_change" | "control_test" | "pra_assessment" | "enforcement_case";

/** Client-side mirror of lib/repo/incidents.ts's AffectedPopulation. */
export interface AffectedPopulation {
  customersAffected?: number;
  transactionsAffected?: number;
  valueGbp?: number;
  identificationMethod?: string;
  notes?: string;
}

/** Client-side mirror of lib/repo/incidents.ts's IncidentRow. */
export interface IncidentDTO {
  id: string;
  workspace_id: string;
  reference: string | null;
  title: string;
  source: IncidentSource | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurred_at: string | null;
  detected_at: string | null;
  contained_at: string | null;
  closed_at: string | null;
  summary: string | null;
  containment: string | null;
  affected_population: AffectedPopulation;
  root_cause: string | null;
  root_cause_category: IncidentRootCauseCategory | null;
  reportable: boolean;
  reported_at: string | null;
  regulator_reference: string | null;
  owner_person_id: string | null;
  current_step: number;
  closure_summary: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/incidents.ts's IncidentLinkRow. */
export interface IncidentLinkDTO {
  id: string;
  workspace_id: string;
  incident_id: string;
  link_type: IncidentLinkType;
  target_id: string | null;
  target_ref: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/incidents/[id]'s `links` array shape: each link with its server-resolved display label (null if the target has since disappeared). */
export interface ResolvedIncidentLinkDTO {
  link: IncidentLinkDTO;
  label: string | null;
}

export interface IncidentListItem {
  id: string;
  reference: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  ownerName: string | null;
  detectedAt: string | null;
  openActions: number;
  updatedAt: string;
}

export const INCIDENT_SOURCE_LABEL: Record<IncidentSource, string> = {
  internal_detection: "Internal detection",
  customer_complaint: "Customer complaint",
  regulator: "Regulator",
  third_party: "Third party",
  audit: "Audit",
  control_test: "Control test",
  other: "Other",
};

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  contained: "Contained",
  investigating: "Investigating",
  remediating: "Remediating",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const ROOT_CAUSE_CATEGORY_LABEL: Record<IncidentRootCauseCategory, string> = {
  control_design: "Control design",
  control_operation: "Control operation",
  data_quality: "Data quality",
  system_failure: "System failure",
  human_error: "Human error",
  third_party: "Third party",
  process_gap: "Process gap",
  other: "Other",
};

export const INCIDENT_LINK_TYPE_LABEL: Record<IncidentLinkType, string> = {
  failed_control: "Failed control",
  control_change: "Control change",
  control_test: "Control test",
  pra_assessment: "PRA assessment",
  enforcement_case: "Enforcement case",
};

export const JOURNEY_STEP_LABELS = [
  "Intake",
  "Containment",
  "Population",
  "Root cause",
  "Remediation",
  "Evidence",
  "Closure",
] as const;

/** All 7 steps are built. */
export const LAST_UNLOCKED_STEP = 7;

/**
 * Step 7's on-screen/PDF incident report payload, assembled client-side by
 * StepClosure.tsx and sent as-is to POST /api/export/pdf (module
 * "incident"). This is the ONE canonical shape for that payload:
 * lib/pdf/incident-pdf.ts (server-only, pulls in jsPDF) imports these same
 * types rather than redeclaring them, so the two sides can never drift. Safe
 * for a server file to import from here because this module has no
 * "use client" directive and no server-only dependencies of its own.
 */
export interface IncidentExportLink {
  linkType: IncidentLinkType;
  label: string;
  note: string | null;
}

export interface IncidentExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

export interface IncidentExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
  /** Whether this evidence item has a file attached (migration 009) - "we hold the document" vs "we linked to it" is a material distinction on a pack, per the Phase 7 brief. */
  fileName: string | null;
  fileSizeBytes: number | null;
}

export interface IncidentExportAffectedPopulation {
  customersAffected: number | null;
  transactionsAffected: number | null;
  valueGbp: number | null;
  identificationMethod: string | null;
  notes: string | null;
}

export interface IncidentExportPayload {
  reference: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource | null;
  ownerName: string | null;
  occurredAt: string | null;
  detectedAt: string | null;
  containedAt: string | null;
  closedAt: string | null;
  summary: string | null;
  containment: string | null;
  affectedPopulation: IncidentExportAffectedPopulation;
  rootCause: string | null;
  rootCauseCategory: IncidentRootCauseCategory | null;
  links: IncidentExportLink[];
  actions: IncidentExportAction[];
  evidence: IncidentExportEvidence[];
  closureSummary: string | null;
  reportable: boolean;
  reportedAt: string | null;
  regulatorReference: string | null;
  narrative?: string | null;
}
