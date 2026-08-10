/**
 * Client-side mirrors of the lib/repo/reg-requests.ts row shapes used by the
 * Regulatory Response Workspace journey. Deliberately NOT imported from
 * lib/repo/** (those modules pull in lib/db.ts / the `pg` driver, which must
 * never end up in a client bundle) - these are plain, duplicated type
 * declarations kept in lockstep with the DB rows returned by
 * app/api/reg-requests/**.
 *
 * PersonDTO/ActionDTO/EvidenceDTO/DecisionDTO/ConditionDTO are identical
 * shapes to components/change-lab/types.ts (people/actions/evidence/
 * decisions/conditions are reused polymorphically across every journey in
 * this repo), so they are re-exported from there rather than redeclared.
 */

export type {
  PersonDTO,
  PersonRole,
  ActionDTO,
  ActionPriority,
  ActionStatus,
  EvidenceDTO,
  DecisionDTO,
  DecisionOutcome,
  ConditionDTO,
  ConditionStatus,
  WorkspaceControlDTO,
} from "@/components/change-lab/types";

import type { ActionPriority, ActionStatus, ConditionStatus } from "@/components/change-lab/types";

export type RegRequestChannel = "email" | "portal" | "letter" | "meeting" | "s165" | "other";
export type RegRequestStatus = "draft" | "in_progress" | "in_review" | "approved" | "submitted" | "closed" | "cancelled";
export type RegQuestionStatus = "unanswered" | "drafted" | "reviewed";
export type RegQuestionLinkType =
  | "workspace_control"
  | "control_test"
  | "control_change"
  | "incident"
  | "readiness_assessment"
  | "pra_assessment"
  | "evidence";
export type RegCommitmentStatus = "open" | "in_progress" | "met" | "missed" | "withdrawn";

/** Client-side mirror of lib/repo/reg-requests.ts's RegRequestRow. */
export interface RegRequestDTO {
  id: string;
  workspace_id: string;
  reference: string | null;
  title: string;
  regulator: string;
  channel: RegRequestChannel | null;
  received_at: string | null;
  deadline: string | null;
  status: RegRequestStatus;
  submitted_at: string | null;
  owner_person_id: string | null;
  summary: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

/**
 * Client-side mirror of lib/repo/reg-requests.ts's RegRequestWithSummary -
 * what GET /api/reg-requests actually returns (each row plus its roll-up
 * under `progress`, kept distinct from the row's own free-text `summary`
 * column), so the list page never has to fetch a detail GET per row for it.
 */
export interface RegRequestListItemDTO extends RegRequestDTO {
  progress: RegResponseSummaryDTO;
}

/** Client-side mirror of lib/repo/reg-requests.ts's RegQuestionLinkRow. */
export interface RegQuestionLinkDTO {
  id: string;
  workspace_id: string;
  question_id: string;
  link_type: RegQuestionLinkType;
  target_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/reg-requests.ts's RegQuestionRow, with its substantiation links attached (GET /api/reg-requests/[id] returns each question pre-joined this way). */
export interface RegQuestionDTO {
  id: string;
  workspace_id: string;
  request_id: string;
  position: number;
  question: string;
  response: string | null;
  exception_note: string | null;
  status: RegQuestionStatus;
  created_at: string;
  updated_at: string;
  links: RegQuestionLinkDTO[];
}

/** Client-side mirror of lib/repo/reg-requests.ts's RegCommitmentRow. */
export interface RegCommitmentDTO {
  id: string;
  workspace_id: string;
  request_id: string;
  question_id: string | null;
  description: string;
  due_date: string | null;
  owner_person_id: string | null;
  status: RegCommitmentStatus;
  action_id: string | null;
  met_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/reg-response/summary.ts's RegResponseSummary. */
export interface RegResponseSummaryDTO {
  totalQuestions: number;
  questionsByStatus: Record<RegQuestionStatus, number>;
  answeredCount: number;
  unansweredCount: number;
  answeredPct: number;
  totalCommitments: number;
  commitmentsByStatus: Record<RegCommitmentStatus, number>;
  overdueCommitmentCount: number;
  daysUntilDeadline: number | null;
}

export const REG_REQUEST_STATUS_LABEL: Record<RegRequestStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  in_review: "In Review",
  approved: "Approved",
  submitted: "Submitted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const REG_QUESTION_STATUS_LABEL: Record<RegQuestionStatus, string> = {
  unanswered: "Unanswered",
  drafted: "Drafted",
  reviewed: "Reviewed",
};

export const REG_COMMITMENT_STATUS_LABEL: Record<RegCommitmentStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  met: "Met",
  missed: "Missed",
  withdrawn: "Withdrawn",
};

export const REG_REQUEST_CHANNEL_LABEL: Record<RegRequestChannel, string> = {
  email: "Email",
  portal: "Portal",
  letter: "Letter",
  meeting: "Meeting",
  s165: "s165 notice",
  other: "Other",
};

export const REG_QUESTION_LINK_TYPE_LABEL: Record<RegQuestionLinkType, string> = {
  workspace_control: "Control",
  control_test: "Control test",
  control_change: "Control change",
  incident: "Incident",
  readiness_assessment: "Readiness assessment",
  pra_assessment: "PRA assessment",
  evidence: "Evidence",
};

export const JOURNEY_STEP_LABELS = ["Request", "Questions", "Responses", "Substantiation", "Commitments", "Approval"] as const;

/** All 6 steps are built. */
export const LAST_UNLOCKED_STEP = 6;

/**
 * Step 6's on-screen/PDF response pack payload, assembled client-side by
 * StepApproval.tsx and sent as-is to POST /api/export/pdf (module
 * "reg_response"). This is the ONE canonical shape for that payload:
 * lib/pdf/reg-response-pdf.ts (server-only, pulls in jsPDF) imports these
 * same types rather than redeclaring them, so the two sides can never drift.
 * Safe for a server file to import from here because this module has no
 * "use client" directive and no server-only dependencies of its own.
 */
export interface RegResponseExportLink {
  linkType: RegQuestionLinkType;
  label: string;
  note: string | null;
}

export interface RegResponseExportQuestion {
  position: number;
  question: string;
  response: string | null;
  exceptionNote: string | null;
  status: RegQuestionStatus;
  links: RegResponseExportLink[];
}

export interface RegResponseExportCommitment {
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  status: RegCommitmentStatus;
  hasTrackedAction: boolean;
  note: string | null;
}

export interface RegResponseExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
  /** Whether this evidence item has a file attached (migration 009) - "we hold the document" vs "we linked to it" is a material distinction on a pack, per the Phase 7 brief. */
  fileName: string | null;
  fileSizeBytes: number | null;
}

export interface RegResponseExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

export interface RegResponseExportCondition {
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  status: ConditionStatus;
}

export interface RegResponseExportDecision {
  outcome: "approve" | "approve_with_conditions" | "reject";
  decidedByName: string;
  decidedAt: string;
  rationale: string | null;
}

export interface RegResponseExportPayload {
  reference: string | null;
  title: string;
  regulator: string;
  channel: RegRequestChannel | null;
  status: RegRequestStatus;
  receivedAt: string | null;
  deadline: string | null;
  submittedAt: string | null;
  ownerName: string | null;
  summary: string | null;
  progress: RegResponseSummaryDTO;
  questions: RegResponseExportQuestion[];
  commitments: RegResponseExportCommitment[];
  actions: RegResponseExportAction[];
  conditions: RegResponseExportCondition[];
  evidence: RegResponseExportEvidence[];
  decisions: RegResponseExportDecision[];
}
