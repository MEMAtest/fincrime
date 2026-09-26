/**
 * PRA status transitions (HANDOFF-3 "Known limits" #3 - fixed here):
 * draft -> drafted -> in_review -> ready_to_export -> exported, advancing
 * regardless of whether a step used the stub or a paid model. Never goes
 * backwards automatically except ready_to_export -> in_review when an edit
 * makes the draft no longer export-ready (see checkExportReadiness).
 */
import { listEnhancementsForPra, getPra, setPraStatus, type DrafterPraRow } from "@/lib/repo/drafter-pras";
import { combineStatus, type JudgeInvalid } from "./review-status";
import type { JudgeResult } from "./judge";
import type { LintIssue } from "./lint";

export interface ExportBlockingReason {
  enhancementId: string;
  reason: string;
}

export interface ExportReadiness {
  ready: boolean;
  blocking: ExportBlockingReason[];
}

/** SPEC.md "Word export": blocked while any enhancement has a critical failure, is not reviewed, or has lint errors. */
export async function checkExportReadiness(praId: string): Promise<ExportReadiness> {
  const enhancements = await listEnhancementsForPra(praId);
  const blocking: ExportBlockingReason[] = [];
  for (const e of enhancements) {
    if (e.is_gap) continue; // a manual gap placeholder is intentionally unreviewed prose, but still must be resolved before export - see open items
    const rr = e.review_result;
    const lint: LintIssue[] = rr?.lint ?? [];
    const judge = (rr?.judge ?? null) as JudgeResult | JudgeInvalid | null;
    const judgeStale = Boolean(rr?.judgeStale);
    const status = combineStatus({ lintIssues: lint, judge, judgeStale });
    if (status === "critical") blocking.push({ enhancementId: e.id, reason: "Critical lint or judge failure." });
    else if (status === "not_reviewed") blocking.push({ enhancementId: e.id, reason: "Not yet judged (or judge result is stale)." });
  }
  return { ready: blocking.length === 0, blocking };
}

/**
 * Called after a draft or judge run. Advances status forward when the whole
 * PRA reaches the next milestone; never regresses a status the user has
 * already moved past (e.g. in_review) just because one more enhancement was
 * drafted.
 */
export async function maybeAdvancePraStatus(praId: string): Promise<DrafterPraRow | null> {
  const pra = await getPra(praId);
  if (!pra) return null;
  const enhancements = await listEnhancementsForPra(praId);
  if (enhancements.length === 0) return pra;

  const allDrafted = enhancements.every((e) => e.is_gap || Boolean(e.control_text?.trim()));
  const readiness = await checkExportReadiness(praId);

  if (pra.status === "draft" || pra.status === "drafting") {
    if (allDrafted) return setPraStatus(praId, "drafted");
    return setPraStatus(praId, "drafting");
  }
  if (pra.status === "drafted" || pra.status === "in_review") {
    if (readiness.ready) return setPraStatus(praId, "ready_to_export");
    return pra.status === "drafted" ? pra : pra; // stays in_review until ready
  }
  if (pra.status === "ready_to_export" && !readiness.ready) {
    // An edit after reaching ready_to_export made it stale again.
    return setPraStatus(praId, "in_review");
  }
  return pra;
}

/** Called when the user first opens the review/page-viewer screen for a drafted PRA. */
export async function markPraInReview(praId: string): Promise<DrafterPraRow | null> {
  const pra = await getPra(praId);
  if (!pra) return null;
  if (pra.status === "drafted") return setPraStatus(praId, "in_review");
  return pra;
}
