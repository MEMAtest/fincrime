import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { listAssessments, type AssessmentRow, type AssessmentStatus } from "@/lib/repo/assessments";
import { listProducts } from "@/lib/repo/products";
import { listOverdueActions } from "@/lib/repo/actions";
import { listOverdueConditions } from "@/lib/repo/decisions";
import { listAuditLog } from "@/lib/repo/audit";
import { listPeople } from "@/lib/repo/people";
import { getRegCommitment, REG_COMMITMENT_SUBJECT_TYPE } from "@/lib/repo/reg-requests";

const RECENT_ACTIVITY_LIMIT = 15;

// An assessment is "open" (still needs attention) in every status except the
// two terminal ones. Kept as an ordered set so `assessments` and
// `decisionsRequired` (a subset, status = in_review) agree on what counts.
const OPEN_STATUSES = new Set<AssessmentStatus>(["draft", "in_review", "conditions_applied"]);

export interface OverviewAssessment {
  id: string;
  productName: string;
  status: AssessmentStatus;
  currentStep: number;
  updatedAt: string;
}

function toOverviewAssessment(row: AssessmentRow, productNameById: Map<string, string>): OverviewAssessment {
  return {
    id: row.id,
    productName: productNameById.get(row.product_id) ?? "Untitled product",
    status: row.status,
    currentStep: row.current_step,
    updatedAt: row.updated_at,
  };
}

/**
 * The workspace home ("My Work") aggregate: open assessments, the subset
 * awaiting a decision, overdue actions/conditions across the whole workspace,
 * and a tail of the audit log. One route so the /workspace page makes a
 * single request rather than fanning out client-side.
 */
export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const [assessments, products, overdueActions, overdueConditions, recentActivity, people] = await Promise.all([
      listAssessments(workspace.id),
      listProducts(workspace.id),
      listOverdueActions(workspace.id),
      listOverdueConditions(workspace.id),
      listAuditLog(workspace.id, { limit: RECENT_ACTIVITY_LIMIT }),
      listPeople(workspace.id),
    ]);

    const productNameById = new Map(products.map((p) => [p.id, p.name]));
    const personNameById = new Map(people.map((p) => [p.id, p.name]));

    const openAssessments = assessments
      .filter((a) => OPEN_STATUSES.has(a.status))
      .map((a) => toOverviewAssessment(a, productNameById));
    const decisionsRequired = assessments
      .filter((a) => a.status === "in_review")
      .map((a) => toOverviewAssessment(a, productNameById));

    // A reg_commitment action's subject_id is the commitment's own id, not
    // the reg_request it belongs to, so it cannot be turned into a link
    // without looking up the request it lives under - resolved here so the
    // workspace home can render it as a real link rather than bare text.
    const commitmentRequestIdBySubjectId = new Map<string, string>();
    await Promise.all(
      overdueActions
        .filter((a) => a.subject_type === REG_COMMITMENT_SUBJECT_TYPE)
        .map(async (a) => {
          const commitment = await getRegCommitment(workspace.id, a.subject_id);
          if (commitment) commitmentRequestIdBySubjectId.set(a.subject_id, commitment.request_id);
        })
    );

    return NextResponse.json({
      assessments: openAssessments,
      decisionsRequired,
      overdueActions: overdueActions.map((a) => ({
        ...a,
        ownerName: a.owner_person_id ? (personNameById.get(a.owner_person_id) ?? null) : null,
        requestId: a.subject_type === REG_COMMITMENT_SUBJECT_TYPE ? commitmentRequestIdBySubjectId.get(a.subject_id) ?? null : null,
      })),
      overdueConditions: overdueConditions.map((c) => ({
        ...c,
        ownerName: c.owner_person_id ? (personNameById.get(c.owner_person_id) ?? null) : null,
      })),
      recentActivity,
    });
  } catch (error) {
    console.error("Workspace overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
