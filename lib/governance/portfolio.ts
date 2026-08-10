/**
 * Portfolio-level governance roll-up: pure arithmetic over rows the six
 * workstream repos already return (assessments, control changes, control
 * tests, incidents, readiness, reg-requests) plus decisions/conditions/
 * actions. No SQL here and no `new Date()` internally - `today` is always a
 * parameter, so the whole module is deterministic and unit-testable, mirroring
 * lib/readiness/summary.ts and lib/reg-response/summary.ts.
 *
 * Every "open X" / "overdue Y" predicate here is documented next to the field
 * it counts, but the SOURCE of what counts as e.g. "open" for a single
 * workstream (an assessment status, a commitment status) always stays with
 * that workstream's own repo module (isFinalReadinessStatus,
 * isTerminalCommitmentStatus, etc.) - this module composes those, it never
 * redefines them.
 *
 * TIMESTAMPTZ columns (last_tested_at, implemented_at, tested_at) come back
 * from `query()` as JS Date objects (only DATE columns get the string-passthrough
 * type parser registered in lib/db.ts), so every date-ish input here is typed
 * `string | Date | null` and normalised through toEpochMs before comparison -
 * never compared or formatted directly. See lib/reg-response/summary.ts's
 * identical toEpochMs for the same trap.
 */
import type { AssessmentRow, AppetiteResult } from "../repo/assessments";
import type { ControlChangeRow } from "../repo/control-changes";
import type { ControlTestRow } from "../repo/control-tests";
import type { WorkspaceControlRow } from "../repo/controls";
import type { IncidentRow, IncidentSeverity, IncidentStatus } from "../repo/incidents";
import type { ReadinessAssessmentRow, OpenReadinessBlockerRow } from "../repo/readiness";
import type { RegRequestRow, RegCommitmentRow } from "../repo/reg-requests";
import type { ConditionRow, DecisionRow } from "../repo/decisions";
import type { ActionRow } from "../repo/actions";
import { REG_COMMITMENT_SUBJECT_TYPE } from "../repo/reg-requests";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Window (inclusive) for "due soon", applied consistently across controls and regulatory commitments. */
const DUE_SOON_WINDOW_DAYS = 30;

export type PortfolioUrgency = "critical" | "high" | "medium" | "low" | "overdue" | "due_soon" | "info";

export interface PortfolioItem {
  id: string;
  label: string;
  subjectType: string;
  /** null when the item's subject cannot be resolved to a live route (should not happen for the subject types this module emits, but never fabricated). */
  href: string | null;
  dueDate: string | null;
  status: string;
  urgency: PortfolioUrgency;
}

export interface PortfolioSection {
  count: number;
  items: PortfolioItem[];
}

function emptySection(): PortfolioSection {
  return { count: 0, items: [] };
}

function section(items: PortfolioItem[]): PortfolioSection {
  return { count: items.length, items };
}

// ---------------------------------------------------------------------------
// date helpers
// ---------------------------------------------------------------------------

/** Normalises a DATE-ish value (ISO string OR a pg-driver TIMESTAMPTZ Date) to epoch ms at UTC midnight. Mirrors lib/reg-response/summary.ts's toEpochMs. */
function toEpochMs(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const iso = String(value).slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `today` to `value` (negative once `value` is in the past). Null if `value` has no date. */
function daysFromToday(value: string | Date | null, today: Date): number | null {
  const ms = toEpochMs(value);
  if (ms === null) return null;
  return Math.round((ms - startOfUtcDay(today)) / MS_PER_DAY);
}

/** "overdue" (strictly past today), "due_soon" (today..today+window), or "info" (no date, or further out). */
function urgencyForDueDate(value: string | Date | null, today: Date, windowDays = DUE_SOON_WINDOW_DAYS): PortfolioUrgency {
  const days = daysFromToday(value, today);
  if (days === null) return "info";
  if (days < 0) return "overdue";
  if (days <= windowDays) return "due_soon";
  return "info";
}

/** Plain string form of a due-date-ish value for display (DATE columns are already strings; TIMESTAMPTZ Date objects are converted). Never used for comparison, only for the item's dueDate field. */
function isoDateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------------
// subject -> route
// ---------------------------------------------------------------------------

const SUBJECT_HREF: Record<string, (id: string) => string> = {
  pra_assessment: (id) => `/assess/product-risk/${id}`,
  control_change: (id) => `/change-lab/${id}`,
  control_test: (id) => `/assure/control-testing/${id}`,
  readiness_assessment: (id) => `/assure/market-readiness/${id}`,
  reg_request: (id) => `/govern/regulatory-response/${id}`,
  incident: (id) => `/assure/incidents/${id}`,
};

/**
 * Resolves a polymorphic subject_type/subject_id pair to the exact record's
 * route. `reg_commitment` is special-cased via `commitmentById`: its
 * subject_id is the commitment's own id, not a directly linkable page (the
 * commitment lives under its parent reg_request) - the same resolution the
 * workspace overview route performs, done here from an already-fetched map
 * instead of a per-row DB lookup.
 */
export function hrefForSubject(
  subjectType: string,
  subjectId: string,
  commitmentById: Map<string, RegCommitmentRow>
): string | null {
  if (subjectType === REG_COMMITMENT_SUBJECT_TYPE) {
    const commitment = commitmentById.get(subjectId);
    return commitment ? `/govern/regulatory-response/${commitment.request_id}` : null;
  }
  const build = SUBJECT_HREF[subjectType];
  return build ? build(subjectId) : null;
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

export interface BuildPortfolioInput {
  /** Deterministic "as of" instant - never Date.now() inside this module. */
  today: Date;
  assessments: AssessmentRow[];
  productNameById: Map<string, string>;
  controlChanges: ControlChangeRow[];
  controlTests: ControlTestRow[];
  workspaceControls: WorkspaceControlRow[];
  incidents: IncidentRow[];
  readinessAssessments: ReadinessAssessmentRow[];
  openReadinessBlockers: OpenReadinessBlockerRow[];
  regRequests: RegRequestRow[];
  regCommitments: RegCommitmentRow[];
  openConditions: ConditionRow[];
  /** Keyed by decision id - only decisions referenced by `openConditions` need to be present. */
  decisionById: Map<string, DecisionRow>;
  overdueActions: ActionRow[];
}

export interface PortfolioSnapshot {
  /** The calendar date (UTC, YYYY-MM-DD) this snapshot was computed against. */
  asOf: string;
  decisionsRequired: PortfolioSection;
  riskOutsideAppetite: { outside: PortfolioSection; tolerated: PortfolioSection };
  openConditionsAndBlockers: PortfolioSection;
  controlChangesInFlight: PortfolioSection;
  controlChangesImplementedNotTested: PortfolioSection;
  controlsDueForTesting: PortfolioSection;
  failedControlTests: PortfolioSection;
  incidents: {
    open: PortfolioSection;
    pastTarget: PortfolioSection;
    bySeverity: Record<IncidentSeverity, number>;
    byStatus: Record<IncidentStatus, number>;
  };
  regulatoryCommitments: { open: PortfolioSection; overdue: PortfolioSection; dueSoon: PortfolioSection };
  overdueActions: PortfolioSection;
}

const EMPTY_SEVERITY: Record<IncidentSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
const EMPTY_INCIDENT_STATUS: Record<IncidentStatus, number> = {
  open: 0,
  contained: 0,
  investigating: 0,
  remediating: 0,
  closed: 0,
  cancelled: 0,
};

/** Non-final incident statuses: work still outstanding against the incident. */
const OPEN_INCIDENT_STATUSES = new Set<IncidentStatus>(["open", "contained", "investigating", "remediating"]);

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

/**
 * Controls whose next scheduled test is past due, or falls within the next
 * `DUE_SOON_WINDOW_DAYS` days. Exported standalone (not just inline inside
 * buildGovernancePortfolio) so the workspace home ("My Work") can reuse this
 * EXACT definition for its own "controls due for testing" section - a
 * surface Phase 5 deliberately skipped - without either re-fetching every
 * other workstream just to get one section, or re-deriving the predicate and
 * risking the two views disagreeing.
 */
export function computeControlsDueForTesting(workspaceControls: WorkspaceControlRow[], today: Date): PortfolioSection {
  const items: PortfolioItem[] = workspaceControls
    .filter((c) => {
      if (!c.next_test_due) return false;
      const urgency = urgencyForDueDate(c.next_test_due, today);
      return urgency === "overdue" || urgency === "due_soon";
    })
    .map((c) => ({
      id: c.id,
      label: c.name,
      subjectType: "workspace_control",
      href: `/assure/control-testing/new?controlId=${c.id}`,
      dueDate: isoDateOnly(c.next_test_due),
      status: c.status,
      urgency: urgencyForDueDate(c.next_test_due, today),
    }));
  return section(items);
}

export function buildGovernancePortfolio(input: BuildPortfolioInput): PortfolioSnapshot {
  const { today } = input;
  const asOf = isoDateOnly(today) ?? today.toISOString().slice(0, 10);

  const commitmentById = new Map(input.regCommitments.map((c) => [c.id, c]));
  const regRequestById = new Map(input.regRequests.map((r) => [r.id, r]));
  const controlNameById = new Map(input.workspaceControls.map((c) => [c.id, c.name]));
  const controlById = new Map(input.workspaceControls.map((c) => [c.id, c]));

  // -- decisions required -----------------------------------------------
  const decisionsRequired: PortfolioItem[] = [
    ...input.assessments
      .filter((a) => a.status === "in_review")
      .map((a) => ({
        id: a.id,
        label: `PRA: ${input.productNameById.get(a.product_id) ?? "Untitled product"}`,
        subjectType: "pra_assessment",
        href: hrefForSubject("pra_assessment", a.id, commitmentById),
        dueDate: null,
        status: a.status,
        urgency: "medium" as PortfolioUrgency,
      })),
    ...input.controlChanges
      .filter((c) => c.status === "in_review")
      .map((c) => ({
        id: c.id,
        label: `Control change: ${c.title}`,
        subjectType: "control_change",
        href: hrefForSubject("control_change", c.id, commitmentById),
        dueDate: null,
        status: c.status,
        urgency: "medium" as PortfolioUrgency,
      })),
    ...input.readinessAssessments
      .filter((r) => r.status === "in_review")
      .map((r) => ({
        id: r.id,
        label: `Readiness: ${r.title}`,
        subjectType: "readiness_assessment",
        href: hrefForSubject("readiness_assessment", r.id, commitmentById),
        dueDate: r.target_launch_date,
        status: r.status,
        urgency: "medium" as PortfolioUrgency,
      })),
    ...input.regRequests
      .filter((r) => r.status === "in_review" || r.status === "approved")
      .map((r) => ({
        id: r.id,
        label: `Regulatory response: ${r.reference ? `${r.reference} - ` : ""}${r.title}`,
        subjectType: "reg_request",
        href: hrefForSubject("reg_request", r.id, commitmentById),
        dueDate: r.deadline,
        status: r.status,
        urgency: "medium" as PortfolioUrgency,
      })),
  ];

  // -- risk outside appetite ---------------------------------------------
  const byAppetite = (result: AppetiteResult): PortfolioItem[] =>
    input.assessments
      .filter((a) => a.appetite_result === result)
      .map((a) => ({
        id: a.id,
        label: input.productNameById.get(a.product_id) ?? "Untitled product",
        subjectType: "pra_assessment",
        href: hrefForSubject("pra_assessment", a.id, commitmentById),
        dueDate: null,
        status: a.status,
        urgency: (result === "outside" ? "critical" : "high") as PortfolioUrgency,
      }));

  // -- open conditions + unresolved readiness blockers --------------------
  const conditionItems: PortfolioItem[] = input.openConditions.map((c) => {
    const decision = input.decisionById.get(c.decision_id);
    const href = decision ? hrefForSubject(decision.subject_type, decision.subject_id, commitmentById) : null;
    return {
      id: c.id,
      label: c.description,
      subjectType: "condition",
      href,
      dueDate: isoDateOnly(c.due_date),
      status: c.status,
      urgency: urgencyForDueDate(c.due_date, today, 0),
    };
  });
  const blockerItems: PortfolioItem[] = input.openReadinessBlockers.map((b) => ({
    id: b.id,
    label: `${b.assessment_title}: ${b.title}`,
    subjectType: "readiness_obligation",
    href: hrefForSubject("readiness_assessment", b.assessment_id, commitmentById),
    dueDate: isoDateOnly(b.due_date),
    status: b.gap,
    urgency: urgencyForDueDate(b.due_date, today, 0) === "overdue" ? "overdue" : "high",
  }));

  // -- control changes ------------------------------------------------
  const inFlightItems: PortfolioItem[] = input.controlChanges
    .filter((c) => c.status === "approved")
    .map((c) => ({
      id: c.id,
      label: `${c.title} (${controlNameById.get(c.workspace_control_id) ?? "Unknown control"})`,
      subjectType: "control_change",
      href: hrefForSubject("control_change", c.id, commitmentById),
      dueDate: null,
      status: c.status,
      urgency: "medium" as PortfolioUrgency,
    }));

  const implementedNotTestedItems: PortfolioItem[] = input.controlChanges
    .filter((c) => {
      if (c.status !== "implemented") return false;
      const control = controlById.get(c.workspace_control_id);
      const implementedMs = toEpochMs(c.implemented_at);
      const lastTestedMs = control ? toEpochMs(control.last_tested_at) : null;
      if (implementedMs === null) return false;
      return lastTestedMs === null || lastTestedMs < implementedMs;
    })
    .map((c) => ({
      id: c.id,
      label: `${c.title} (${controlNameById.get(c.workspace_control_id) ?? "Unknown control"})`,
      subjectType: "control_change",
      href: hrefForSubject("control_change", c.id, commitmentById),
      dueDate: null,
      status: c.status,
      urgency: "high" as PortfolioUrgency,
    }));

  // -- controls due/overdue for testing ------------------------------
  const controlsDue = computeControlsDueForTesting(input.workspaceControls, today);

  // -- failed control tests --------------------------------------------
  const failedTestItems: PortfolioItem[] = input.controlTests
    .filter((t) => t.result === "fail")
    .map((t) => ({
      id: t.id,
      label: `${t.title} (${controlNameById.get(t.workspace_control_id) ?? "Unknown control"})`,
      subjectType: "control_test",
      href: hrefForSubject("control_test", t.id, commitmentById),
      dueDate: isoDateOnly(t.tested_at),
      status: t.status,
      urgency: "critical" as PortfolioUrgency,
    }));

  // -- incidents --------------------------------------------------------
  const bySeverity: Record<IncidentSeverity, number> = { ...EMPTY_SEVERITY };
  const byStatus: Record<IncidentStatus, number> = { ...EMPTY_INCIDENT_STATUS };
  for (const i of input.incidents) {
    bySeverity[i.severity] += 1;
    byStatus[i.status] += 1;
  }
  const openIncidentItems: PortfolioItem[] = input.incidents
    .filter((i) => OPEN_INCIDENT_STATUSES.has(i.status))
    .map((i) => ({
      id: i.id,
      label: i.title,
      subjectType: "incident",
      href: hrefForSubject("incident", i.id, commitmentById),
      dueDate: null,
      status: i.status,
      urgency: i.severity as PortfolioUrgency,
    }));

  const overdueActionSubjectIds = new Set(
    input.overdueActions.filter((a) => a.subject_type === "incident").map((a) => a.subject_id)
  );
  const pastTargetIncidentItems: PortfolioItem[] = openIncidentItems.filter((item) => overdueActionSubjectIds.has(item.id));

  // -- regulatory commitments --------------------------------------------
  const openCommitmentRows = input.regCommitments.filter((c) => c.status === "open" || c.status === "in_progress");
  const toCommitmentItem = (c: RegCommitmentRow): PortfolioItem => {
    const request = regRequestById.get(c.request_id);
    return {
      id: c.id,
      label: request ? `${request.reference ? `${request.reference} - ` : ""}${request.title}: ${c.description}` : c.description,
      subjectType: "reg_commitment",
      href: `/govern/regulatory-response/${c.request_id}`,
      dueDate: isoDateOnly(c.due_date),
      status: c.status,
      urgency: urgencyForDueDate(c.due_date, today),
    };
  };
  const openCommitmentItems = openCommitmentRows.map(toCommitmentItem);
  const overdueCommitmentItems = openCommitmentRows.filter((c) => urgencyForDueDate(c.due_date, today) === "overdue").map(toCommitmentItem);
  const dueSoonCommitmentItems = openCommitmentRows.filter((c) => urgencyForDueDate(c.due_date, today) === "due_soon").map(toCommitmentItem);

  // -- overdue actions (every subject type) -------------------------------
  const overdueActionItems: PortfolioItem[] = input.overdueActions.map((a) => ({
    id: a.id,
    label: a.title,
    subjectType: a.subject_type,
    href: hrefForSubject(a.subject_type, a.subject_id, commitmentById),
    dueDate: isoDateOnly(a.due_date),
    status: a.status,
    urgency: "overdue" as PortfolioUrgency,
  }));

  return {
    asOf,
    decisionsRequired: section(decisionsRequired),
    riskOutsideAppetite: { outside: section(byAppetite("outside")), tolerated: section(byAppetite("tolerated")) },
    openConditionsAndBlockers: section([...conditionItems, ...blockerItems]),
    controlChangesInFlight: section(inFlightItems),
    controlChangesImplementedNotTested: section(implementedNotTestedItems),
    controlsDueForTesting: controlsDue,
    failedControlTests: section(failedTestItems),
    incidents: {
      open: section(openIncidentItems),
      pastTarget: section(pastTargetIncidentItems),
      bySeverity,
      byStatus,
    },
    regulatoryCommitments: {
      open: section(openCommitmentItems),
      overdue: section(overdueCommitmentItems),
      dueSoon: section(dueSoonCommitmentItems),
    },
    overdueActions: section(overdueActionItems),
  };
}

/** An all-zero snapshot, for callers that want a coherent shape before any data has loaded (mirrors summarizeObligations([])'s zeroed-summary convention). */
export function emptyGovernancePortfolio(today: Date): PortfolioSnapshot {
  const asOf = today.toISOString().slice(0, 10);
  return {
    asOf,
    decisionsRequired: emptySection(),
    riskOutsideAppetite: { outside: emptySection(), tolerated: emptySection() },
    openConditionsAndBlockers: emptySection(),
    controlChangesInFlight: emptySection(),
    controlChangesImplementedNotTested: emptySection(),
    controlsDueForTesting: emptySection(),
    failedControlTests: emptySection(),
    incidents: { open: emptySection(), pastTarget: emptySection(), bySeverity: { ...EMPTY_SEVERITY }, byStatus: { ...EMPTY_INCIDENT_STATUS } },
    regulatoryCommitments: { open: emptySection(), overdue: emptySection(), dueSoon: emptySection() },
    overdueActions: emptySection(),
  };
}
