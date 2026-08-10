/**
 * Pure roll-up arithmetic over a readiness assessment's obligation register.
 * Kept dependency-free (no db) so it is unit testable directly. Used by
 * readinessSummary in lib/repo/readiness.ts (the list view and the detail
 * pack) and by the approval guards (a launch blocker is exactly what must
 * stop an approval - see approveLocal/approveGlobal).
 */
import type { ReadinessGap } from "../repo/readiness";

export interface ObligationSummaryInput {
  gap: ReadinessGap;
  blocker: boolean;
  workspace_control_id: string | null;
}

export interface ReadinessSummary {
  total: number;
  byGap: Record<ReadinessGap, number>;
  blockerCount: number;
  /** Blockers that would still stop an approval: blocker = true AND gap != 'full'. */
  unresolvedBlockerCount: number;
  noControlCount: number;
  /** Percentage (0-100, rounded) of obligations with gap = 'full'. */
  coveragePct: number;
}

const EMPTY_BY_GAP: Record<ReadinessGap, number> = { not_assessed: 0, none: 0, partial: 0, full: 0 };

/**
 * The single definition of "unresolved launch blocker": blocker = true AND
 * gap != 'full'. Exported so every UI that needs the itemised list (not just
 * a count or a boolean) - StepGaps' blocker panel, StepApproval's checklist
 * and read-only summary - filters with this instead of each re-typing the
 * predicate, which is exactly the kind of drift that let the "Record
 * approval" button diverge from the server's guard.
 */
export function isUnresolvedBlocker(o: ObligationSummaryInput): boolean {
  return o.blocker && o.gap !== "full";
}

export function summarizeObligations(obligations: ObligationSummaryInput[]): ReadinessSummary {
  const byGap: Record<ReadinessGap, number> = { ...EMPTY_BY_GAP };
  let blockerCount = 0;
  let unresolvedBlockerCount = 0;
  let noControlCount = 0;

  for (const o of obligations) {
    byGap[o.gap] += 1;
    if (o.blocker) {
      blockerCount += 1;
      if (isUnresolvedBlocker(o)) unresolvedBlockerCount += 1;
    }
    if (!o.workspace_control_id) noControlCount += 1;
  }

  const total = obligations.length;
  const coveragePct = total === 0 ? 0 : Math.round((byGap.full / total) * 100);

  return { total, byGap, blockerCount, unresolvedBlockerCount, noControlCount, coveragePct };
}

/** True while any obligation is a launch blocker not yet fully resolved (gap = 'full'). Used by approveLocal/approveGlobal. */
export function hasUnresolvedBlockers(obligations: ObligationSummaryInput[]): boolean {
  return obligations.some(isUnresolvedBlocker);
}
