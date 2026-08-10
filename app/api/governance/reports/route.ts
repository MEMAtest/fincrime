import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { listAssessments } from "@/lib/repo/assessments";
import { listProducts } from "@/lib/repo/products";
import { listControlChanges } from "@/lib/repo/control-changes";
import { listControlTests } from "@/lib/repo/control-tests";
import { listWorkspaceControls } from "@/lib/repo/controls";
import { listIncidents } from "@/lib/repo/incidents";
import { listReadinessAssessments } from "@/lib/repo/readiness";
import { listRegRequests } from "@/lib/repo/reg-requests";

/**
 * GET /api/governance/reports - the record index for the Reports page: one
 * row per exportable-or-not record across all six workstreams, each with a
 * link to its OWN detail journey (where the real PDFExportButton for that
 * module already lives, built from a payload assembled from the full
 * detail fetch - see components/*\/StepPack.tsx, StepImplement.tsx,
 * StepConclusion.tsx, StepClosure.tsx, StepApproval.tsx).
 *
 * This route deliberately does NOT re-assemble those export payloads here -
 * that logic already exists once, per module, next to the data it needs
 * (evidence, links, decisions, conditions, people), and duplicating it on an
 * index page would be a second construction site for the exact payload
 * shape /api/export/pdf's module branches trust, risking drift between what
 * the Reports row exports and what the record's own page would. Instead
 * this route answers a narrower question per row: has this record reached
 * the step in its journey where that export view exists? `current_step` is
 * on every module's row (pra_assessments, control_changes, control_tests,
 * incidents, readiness_assessments, reg_requests) but not every module's
 * LIST route surfaces it in its DTO - reading it directly from the repo row
 * here avoids touching those existing list routes.
 *
 * LAST_UNLOCKED_STEP per module mirrors the constant of the same name
 * exported by each module's components/*\/types.ts (pra=8, control-lab=7,
 * control-testing=5, incidents=7, readiness=6, reg-response=6) - the step at
 * which that module's export-bearing final step renders.
 */
const LAST_STEP: Record<ReportKind, number> = {
  pra_assessment: 8,
  control_change: 7,
  control_test: 5,
  incident: 7,
  readiness_assessment: 6,
  reg_request: 6,
};

type ReportKind = "pra_assessment" | "control_change" | "control_test" | "incident" | "readiness_assessment" | "reg_request";

export interface ReportRecordDTO {
  id: string;
  kind: ReportKind;
  label: string;
  status: string;
  updatedAt: string;
  currentStep: number;
  totalSteps: number;
  exportable: boolean;
  href: string;
}

const HREF: Record<ReportKind, (id: string) => string> = {
  pra_assessment: (id) => `/assess/product-risk/${id}`,
  control_change: (id) => `/change-lab/${id}`,
  control_test: (id) => `/assure/control-testing/${id}`,
  incident: (id) => `/assure/incidents/${id}`,
  readiness_assessment: (id) => `/assure/market-readiness/${id}`,
  reg_request: (id) => `/govern/regulatory-response/${id}`,
};

export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const [assessments, products, controlChanges, controlTests, workspaceControls, incidents, readinessAssessments, regRequests] = await Promise.all([
      listAssessments(workspace.id),
      listProducts(workspace.id),
      listControlChanges(workspace.id),
      listControlTests(workspace.id),
      listWorkspaceControls(workspace.id),
      listIncidents(workspace.id),
      listReadinessAssessments(workspace.id),
      listRegRequests(workspace.id),
    ]);

    const productNameById = new Map(products.map((p) => [p.id, p.name]));
    const controlNameById = new Map(workspaceControls.map((c) => [c.id, c.name]));

    const toRecord = (kind: ReportKind, id: string, label: string, status: string, updatedAt: string, currentStep: number): ReportRecordDTO => {
      const totalSteps = LAST_STEP[kind];
      return { id, kind, label, status, updatedAt, currentStep, totalSteps, exportable: currentStep >= totalSteps, href: HREF[kind](id) };
    };

    const records: ReportRecordDTO[] = [
      ...assessments.map((a) => toRecord("pra_assessment", a.id, productNameById.get(a.product_id) ?? "Untitled product", a.status, a.updated_at, a.current_step)),
      ...controlChanges.map((c) => toRecord("control_change", c.id, `${c.title} (${controlNameById.get(c.workspace_control_id) ?? "Unknown control"})`, c.status, c.updated_at, c.current_step)),
      ...controlTests.map((t) => toRecord("control_test", t.id, `${t.title} (${controlNameById.get(t.workspace_control_id) ?? "Unknown control"})`, t.status, t.updated_at, t.current_step)),
      ...incidents.map((i) => toRecord("incident", i.id, i.title, i.status, i.updated_at, i.current_step)),
      ...readinessAssessments.map((r) => toRecord("readiness_assessment", r.id, r.title, r.status, r.updated_at, r.current_step)),
      ...regRequests.map((r) => toRecord("reg_request", r.id, `${r.reference ? `${r.reference} - ` : ""}${r.title}`, r.status, r.updated_at, r.current_step)),
    ];

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Governance reports index error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
