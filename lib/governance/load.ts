/**
 * Server-side orchestration for the governance portfolio: fetches each
 * workstream's list exactly once and hands the rows to the pure aggregator
 * in lib/governance/portfolio.ts. Shared by GET /api/governance/portfolio
 * (the dashboard) and the governance_pack branch of /api/export/pdf (the
 * committee pack) so the two can never drift - the pack must show exactly
 * what the dashboard shows, not a re-derived approximation.
 */
import { listAssessments } from "../repo/assessments";
import { listProducts } from "../repo/products";
import { listControlChanges } from "../repo/control-changes";
import { listControlTests } from "../repo/control-tests";
import { listWorkspaceControls } from "../repo/controls";
import { listIncidents } from "../repo/incidents";
import { listReadinessAssessments, listOpenReadinessBlockers } from "../repo/readiness";
import { listRegRequests, listAllRegCommitments } from "../repo/reg-requests";
import { listOpenConditions, listDecisionsByIds } from "../repo/decisions";
import { listOverdueActions } from "../repo/actions";
import { buildGovernancePortfolio, type PortfolioSnapshot } from "./portfolio";

export async function loadGovernancePortfolio(
  workspaceId: string,
  today: Date = new Date(),
  dueSoonWindowDays?: number
): Promise<PortfolioSnapshot> {
  const [
    assessments,
    products,
    controlChanges,
    controlTests,
    workspaceControls,
    incidents,
    readinessAssessments,
    openReadinessBlockers,
    regRequests,
    regCommitments,
    openConditions,
    overdueActions,
  ] = await Promise.all([
    listAssessments(workspaceId),
    listProducts(workspaceId),
    listControlChanges(workspaceId),
    listControlTests(workspaceId),
    listWorkspaceControls(workspaceId),
    listIncidents(workspaceId),
    listReadinessAssessments(workspaceId),
    listOpenReadinessBlockers(workspaceId),
    listRegRequests(workspaceId),
    listAllRegCommitments(workspaceId),
    listOpenConditions(workspaceId),
    listOverdueActions(workspaceId),
  ]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  const decisionIds = Array.from(new Set(openConditions.map((c) => c.decision_id)));
  const decisionRows = await listDecisionsByIds(workspaceId, decisionIds);
  const decisionById = new Map(decisionRows.map((d) => [d.id, d]));

  return buildGovernancePortfolio({
    today,
    assessments,
    productNameById,
    controlChanges,
    controlTests,
    workspaceControls,
    incidents,
    readinessAssessments,
    openReadinessBlockers,
    regRequests,
    regCommitments,
    openConditions,
    decisionById,
    overdueActions,
    dueSoonWindowDays,
  });
}
