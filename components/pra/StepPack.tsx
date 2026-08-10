"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import Badge from "@/components/ui/Badge";
import RiskRatingBadge from "@/components/shared/RiskRatingBadge";
import { PriorityBadge, RatingBadge } from "@/components/controls/ControlBits";
import PDFExportButton from "@/components/shared/PDFExportButton";
import NarrativeCard from "@/components/results/NarrativeCard";
import { useNarrative } from "@/lib/useNarrative";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { getRiskRating } from "@/data/scoring/risk-matrix";
import { summariseOperationalLoad } from "@/data/scoring/operational-load";
import type { AppetiteThresholds } from "@/data/scoring/residual-risk";
import { computeAssessmentResidual, computeGaps, opLoadInputFromControl, resolveControlLabel } from "./journeyCompute";
import type {
  AssessmentControlDTO,
  AssessmentDTO,
  AssessmentRiskDTO,
  DecisionRecord,
  EvidenceDTO,
  PersonDTO,
  PraExportPayload,
  ProductDTO,
  WorkspaceControlDTO,
} from "./types";

const OUTCOME_LABEL: Record<string, string> = {
  approve: "Approved",
  approve_with_conditions: "Approved with conditions",
  reject: "Rejected",
};

const APPETITE_BANNER: Record<"within" | "tolerated" | "outside", { bg: string; icon: typeof CheckCircle2; label: string }> = {
  within: { bg: "bg-accent/10 border-accent/20 text-accent", icon: CheckCircle2, label: "Within appetite" },
  tolerated: { bg: "bg-amber-50 border-amber-200 text-amber-700", icon: AlertTriangle, label: "Tolerated" },
  outside: { bg: "bg-red-50 border-red-200 text-red-700", icon: ShieldAlert, label: "Outside appetite" },
};

interface StepPackProps {
  assessment: AssessmentDTO;
  product: ProductDTO;
  risks: AssessmentRiskDTO[];
  controls: AssessmentControlDTO[];
  workspaceControls: WorkspaceControlDTO[];
  people: PersonDTO[];
  decisionData: DecisionRecord;
  appetiteThresholds: AppetiteThresholds;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Step 8: the on-screen committee pack (profile, flows, risk register, control map, gaps, operational load, residual vs appetite, decision, conditions, actions, evidence) plus a Risk Intelligence narrative and the PDF export. */
export default function StepPack({
  assessment,
  product,
  risks,
  controls,
  workspaceControls,
  people,
  decisionData,
  appetiteThresholds,
}: StepPackProps) {
  const { wsFetch } = useWorkspace();
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    wsFetch(`/api/pra/assessments/${assessment.id}/evidence`)
      .then((res) => (res.ok ? res.json() : { evidence: [] }))
      .then((data) => {
        if (!cancelled) setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
      })
      .catch(() => {
        if (!cancelled) setEvidence([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assessment.id, wsFetch]);

  const workspaceControlById = useMemo(
    () => new Map(workspaceControls.map((c) => [c.id, c])),
    [workspaceControls]
  );
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const { perRisk, summary } = useMemo(
    () => computeAssessmentResidual(risks, controls, workspaceControlById, appetiteThresholds),
    [risks, controls, workspaceControlById, appetiteThresholds]
  );
  const gaps = useMemo(() => computeGaps(risks, controls, workspaceControlById), [risks, controls, workspaceControlById]);
  // Explicit arrow rather than `controls.map(opLoadInputFromControl)`: Array.map
  // also passes the element's index as a second argument, which would land in
  // opLoadInputFromControl's (same-typed, number) defaultHourlyCostGbp param.
  const opLoadSummary = useMemo(() => summariseOperationalLoad(controls.map((c) => opLoadInputFromControl(c))), [controls]);

  const exportPayload: PraExportPayload = useMemo(
    () => ({
      productName: product.name,
      productDescription: product.description,
      customers: product.customers,
      jurisdictions: product.jurisdictions,
      channels: product.channels,
      flows: product.flows,
      risks: perRisk.map(({ risk, attachedControls, result }) => ({
        title: risk.title,
        typologySlug: risk.typology_slug,
        inherentScore: result.inherentScore,
        residualScore: result.residualScore,
        residualRationale: risk.residual_rationale,
        controls: attachedControls.map((a) => ({
          label: resolveControlLabel(a.control, workspaceControlById),
          coverage: a.control.coverage,
          effectiveness: a.effectiveness,
          instantiated: a.instantiated,
        })),
      })),
      gaps: gaps.map((g) => ({ riskTitle: g.riskTitle, kind: g.kind, controlLabel: g.controlLabel })),
      opLoad: opLoadSummary.totals,
      overallResidualScore: summary?.overallResidualScore ?? null,
      overallResidualRating: summary?.overallResidualRating ?? null,
      appetiteResult: summary?.appetiteResult ?? null,
      recommendation: assessment.recommendation,
      decision: decisionData.decision
        ? {
            outcome: decisionData.decision.outcome,
            decidedByName: personById.get(decisionData.decision.decided_by_person_id)?.name ?? "Unknown",
            decidedAt: decisionData.decision.decided_at,
            rationale: decisionData.decision.rationale,
          }
        : null,
      conditions: decisionData.conditions.map((c) => ({
        description: c.description,
        dueDate: c.due_date,
        ownerName: c.owner_person_id ? (personById.get(c.owner_person_id)?.name ?? null) : null,
        status: c.status,
      })),
      actions: decisionData.actions.map((a) => ({
        title: a.title,
        ownerName: a.owner_person_id ? (personById.get(a.owner_person_id)?.name ?? null) : null,
        dueDate: a.due_date,
        priority: a.priority,
        status: a.status,
      })),
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url, fileName: e.file_name, fileSizeBytes: e.file_size_bytes })),
    }),
    [product, perRisk, gaps, opLoadSummary, summary, assessment.recommendation, decisionData, personById, evidence, workspaceControlById]
  );

  const { narrative, loading: narrativeLoading } = useNarrative("/api/pra/narrative", {
    productName: product.name,
    productDescription: product.description,
    customers: product.customers,
    jurisdictions: product.jurisdictions,
    topRisks: perRisk.slice(0, 5).map((r) => ({
      title: r.risk.title,
      inherentScore: r.result.inherentScore,
      residualScore: r.result.residualScore,
    })),
    appetiteResult: summary?.appetiteResult ?? null,
    gapCount: gaps.length,
    opLoad: opLoadSummary.totals,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Committee pack</h2>
          <p className="text-sm text-text-muted">
            Everything a reviewer or committee needs in one place, ready to export.
          </p>
        </div>
        <PDFExportButton module="pra_assessment" assessmentData={{ ...exportPayload, narrative }} />
      </div>

      {/* Product profile */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">{product.name || "Untitled product"}</h3>
        {product.description && <p className="text-sm text-text-muted mb-3">{product.description}</p>}
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Customers</p>
            <p className="text-foreground">{product.customers.join(", ") || "Not specified"}</p>
          </div>
          <div>
            <p className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Jurisdictions</p>
            <p className="text-foreground">{product.jurisdictions.join(", ") || "Not specified"}</p>
          </div>
          <div>
            <p className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Channels</p>
            <p className="text-foreground">{product.channels.join(", ") || "Not specified"}</p>
          </div>
        </div>
      </section>

      {/* Flows */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Flows ({product.flows.length})</h3>
        {product.flows.length === 0 ? (
          <p className="text-sm text-text-muted">No flow legs recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {product.flows.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-xs font-mono text-text-muted w-5">{i + 1}</span>
                {f.from} <ArrowRight className="h-3 w-3 text-text-muted" /> {f.to}
                {f.note && <span className="text-xs text-text-muted">- {f.note}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Risk register + control map */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Risk register &amp; control map ({perRisk.length})</h3>
        {perRisk.length === 0 ? (
          <p className="text-sm text-text-muted">No risks scored.</p>
        ) : (
          <div className="space-y-3">
            {perRisk.map(({ risk, attachedControls, result }) => (
              <div key={risk.id} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-foreground">{risk.title}</p>
                  <div className="flex items-center gap-2">
                    <RiskRatingBadge level={getRiskRating(result.inherentScore).rating} score={result.inherentScore} />
                    <ArrowRight className="h-3 w-3 text-text-muted" />
                    <RiskRatingBadge level={result.residualRating} score={result.residualScore} />
                  </div>
                </div>
                {attachedControls.length === 0 ? (
                  <p className="text-xs text-red-500">No controls attached.</p>
                ) : (
                  <div className="space-y-1">
                    {attachedControls.map((a) => (
                      <div key={a.control.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-foreground">{resolveControlLabel(a.control, workspaceControlById)}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={a.control.coverage === "full" ? "success" : a.control.coverage === "partial" ? "warning" : "danger"}>
                            {a.control.coverage}
                          </Badge>
                          <RatingBadge rating={a.effectiveness} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gaps */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Gaps ({gaps.length})</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-text-muted">No coverage gaps identified.</p>
        ) : (
          <div className="space-y-1.5">
            {gaps.map((g) => (
              <div key={g.key} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  {g.riskTitle}: {g.kind === "no_controls" ? "no controls attached" : `gap coverage on "${g.controlLabel}"`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Operational load */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Operational load</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <OpLoadKpi label="Alerts / month" value={opLoadSummary.totals.alertsPerMonth} />
          <OpLoadKpi label="Analyst hours / month" value={opLoadSummary.totals.analystHoursPerMonth} />
          <OpLoadKpi label="FTE required" value={opLoadSummary.totals.fte} />
          <OpLoadKpi label="Monthly cost" value={opLoadSummary.totals.monthlyCostGbp} prefix="£" />
        </div>
      </section>

      {/* Residual vs appetite */}
      {summary && (
        <section className={`rounded-2xl border p-5 ${APPETITE_BANNER[summary.appetiteResult].bg}`}>
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = APPETITE_BANNER[summary.appetiteResult].icon;
              return <Icon className="h-5 w-5" />;
            })()}
            <p className="font-semibold text-sm">{APPETITE_BANNER[summary.appetiteResult].label}</p>
          </div>
          <p className="text-xs mt-1.5 opacity-90">
            Overall residual score {summary.overallResidualScore} ({summary.overallResidualRating}), mean{" "}
            {summary.meanResidualScore} across the register.
          </p>
        </section>
      )}

      {/* Recommendation */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Recommendation</h3>
        <p className="text-sm text-text-muted whitespace-pre-wrap">
          {assessment.recommendation || "No recommendation recorded."}
        </p>
      </section>

      {/* Decision, conditions, actions */}
      <section className="glass-card rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Decision</h3>
          {decisionData.decision ? (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={decisionData.decision.outcome === "reject" ? "danger" : decisionData.decision.outcome === "approve" ? "success" : "warning"}>
                  {OUTCOME_LABEL[decisionData.decision.outcome]}
                </Badge>
                <span className="text-text-muted text-xs">
                  by {personById.get(decisionData.decision.decided_by_person_id)?.name ?? "Unknown"} on{" "}
                  {fmtDate(decisionData.decision.decided_at)}
                </span>
              </div>
              {decisionData.decision.rationale && <p className="text-foreground mt-1">{decisionData.decision.rationale}</p>}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No decision recorded yet.</p>
          )}
        </div>

        {decisionData.conditions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Conditions ({decisionData.conditions.length})
            </p>
            <div className="space-y-1.5">
              {decisionData.conditions.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{c.description}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {fmtDate(c.due_date)} &middot; {c.owner_person_id ? (personById.get(c.owner_person_id)?.name ?? "Unassigned") : "Unassigned"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {decisionData.actions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Follow-up actions ({decisionData.actions.length})
            </p>
            <div className="space-y-1.5">
              {decisionData.actions.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{a.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-muted">
                      {fmtDate(a.due_date)} &middot; {a.owner_person_id ? (personById.get(a.owner_person_id)?.name ?? "Unassigned") : "Unassigned"}
                    </span>
                    <PriorityBadge priority={a.priority} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Evidence */}
      <section className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" /> Evidence ({evidence.length})
        </h3>
        {evidence.length === 0 ? (
          <p className="text-sm text-text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {evidence.map((e) => (
              <div key={e.id} className="text-sm text-foreground">
                {e.title} <span className="text-xs text-text-muted">({e.type})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Risk Intelligence (AI-assisted narrative, distinguished from cited fact) */}
      <NarrativeCard heading="Risk Intelligence" narrative={narrative} loading={narrativeLoading} />
    </div>
  );
}

function OpLoadKpi({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="text-2xl font-bold text-foreground tabular-nums leading-none">
        {prefix}
        {value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
