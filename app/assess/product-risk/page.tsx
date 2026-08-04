"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Plus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ASSESSMENT_STATUS_LABEL, type AssessmentListItem, type AssessmentStatus } from "@/components/pra/types";

const STATUS_VARIANT: Record<AssessmentStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved: "success",
  rejected: "danger",
  conditions_applied: "warning",
};

export default function ProductRiskListPage() {
  const { wsFetch, ready } = useWorkspace();
  const [assessments, setAssessments] = useState<AssessmentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/pra/assessments");
        if (!res.ok) throw new Error("Failed to load assessments");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { assessments?: unknown }).assessments)
            ? ((data as { assessments: AssessmentListItem[] }).assessments)
            : [];
        if (!cancelled) setAssessments(list);
      } catch {
        if (!cancelled) setError("Could not load your assessments. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, wsFetch]);

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Product Risk Assessments" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Product Risk Assessments</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Assess a product&apos;s financial crime risk end to end: profile, flows, inherent risk, control
                mapping, residual risk and a documented decision.
              </p>
            </div>
            <Link href="/assess/product-risk/new">
              <Button>
                <Plus className="h-4 w-4" /> New assessment
              </Button>
            </Link>
          </div>

          {error && (
            <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>
          )}

          {assessments === null && !error && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">
              Loading assessments...
            </div>
          )}

          {assessments !== null && assessments.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <ClipboardList className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No assessments yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                Start a Product Risk Assessment to work through profile, flows, inherent risk, control mapping,
                residual risk and a documented decision for a single product.
              </p>
              <Link href="/assess/product-risk/new">
                <Button>
                  <Plus className="h-4 w-4" /> Start an assessment
                </Button>
              </Link>
            </div>
          )}

          {assessments !== null && assessments.length > 0 && (
            <div className="grid gap-3">
              {assessments.map((a) => (
                <Link
                  key={a.id}
                  href={`/assess/product-risk/${a.id}`}
                  className="glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{a.productName}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Step {a.currentStep} of 8 · Updated {new Date(a.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={STATUS_VARIANT[a.status] ?? "default"}>
                      {ASSESSMENT_STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
