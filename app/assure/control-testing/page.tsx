"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Plus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  CONTROL_TEST_RESULT_LABEL,
  CONTROL_TEST_STATUS_LABEL,
  type ControlTestListItem,
  type ControlTestResult,
  type ControlTestStatus,
} from "@/components/control-testing/types";

const STATUS_VARIANT: Record<ControlTestStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  planned: "default",
  in_progress: "info",
  complete: "success",
  cancelled: "default",
};

const RESULT_VARIANT: Record<ControlTestResult, "default" | "success" | "warning" | "danger" | "info"> = {
  pass: "success",
  pass_with_findings: "warning",
  fail: "danger",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "No period end";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ControlTestingListPage() {
  const { wsFetch, ready, workspaceId } = useWorkspace();
  const [tests, setTests] = useState<ControlTestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only fetch once a workspace already exists; never create one just for
  // visiting this page (wsFetch calls ensureWorkspace(), which POSTs
  // bootstrap - an anonymous visitor who merely lands here must not get a DB
  // row for it). Mirrors app/change-lab/page.tsx's gate.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/control-tests");
        if (!res.ok) throw new Error("Failed to load control tests");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { tests?: unknown }).tests)
            ? (data as { tests: ControlTestListItem[] }).tests
            : [];
        if (!cancelled) setTests(list);
      } catch {
        if (!cancelled) setError("Could not load your control tests. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  // No workspace yet (nothing has been saved by this browser): show the same
  // "No control tests yet" empty state as a workspace with zero saved tests,
  // without ever fetching (which would create one via wsFetch).
  const noWorkspaceYet = ready && !workspaceId;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Control Testing" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Control Testing</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Test a live control against a sample, record findings and evidence, and let a deterministic scoring
                rule set the effectiveness rating and next test due date.
              </p>
            </div>
            <Link href="/assure/control-testing/new">
              <Button>
                <Plus className="h-4 w-4" /> New test
              </Button>
            </Link>
          </div>

          {error && <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>}

          {tests === null && !error && !noWorkspaceYet && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">
              Loading control tests...
            </div>
          )}

          {(noWorkspaceYet || (tests !== null && tests.length === 0)) && !error && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <ClipboardCheck className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No control tests yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                A control test needs a live control already in your workspace to test against. Instantiate a control
                from the{" "}
                <Link href="/controls" className="text-accent hover:underline">
                  Controls Library
                </Link>{" "}
                or the{" "}
                <Link href="/control-builder" className="text-accent hover:underline">
                  Control Builder
                </Link>{" "}
                first, then run a test against it.
              </p>
              <Link href="/assure/control-testing/new">
                <Button>
                  <Plus className="h-4 w-4" /> Start a test
                </Button>
              </Link>
            </div>
          )}

          {tests !== null && tests.length > 0 && (
            <div className="grid gap-3">
              {tests.map((t) => (
                <Link
                  key={t.id}
                  href={`/assure/control-testing/${t.id}`}
                  className="glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t.controlName} · {fmtDate(t.periodEnd)} · Updated {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {t.result && <Badge variant={RESULT_VARIANT[t.result]}>{CONTROL_TEST_RESULT_LABEL[t.result]}</Badge>}
                    <Badge variant={STATUS_VARIANT[t.status] ?? "default"}>
                      {CONTROL_TEST_STATUS_LABEL[t.status] ?? t.status}
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
