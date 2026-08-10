"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, Wrench, ListChecks, CalendarPlus, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { typologySlugsForThemes } from "@/lib/enforcement/select";
import type { EnforcementCase } from "@/data/enforcement/types";
import type { Control } from "@/data/controls/types";
import type { ActionPriority } from "@/components/pra/types";

const PRIORITIES: ActionPriority[] = ["high", "medium", "low"];

type ChangeState = { status: "idle" | "loading" } | { status: "error"; message: string };

/**
 * "Turn this case into work": the enforcement-case-detail action panel.
 * Renders for every visitor, anonymous or not - no fetch happens on mount, so
 * nothing here can create a workspace on page load. A workspace is created
 * (via wsFetch's built-in ensureWorkspace) only the moment someone clicks an
 * action that actually needs one.
 */
export default function EnforcementActionsPanel({
  caseData: c,
  controls,
  cSlug,
}: {
  caseData: EnforcementCase;
  controls: Control[];
  cSlug: string;
}) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [changeStates, setChangeStates] = useState<Record<string, ChangeState>>({});

  const primaryControl = controls[0] ?? null;
  const [actionTitle, setActionTitle] = useState(`Follow up on ${c.firm} (${c.year}) lessons`);
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionPriority, setActionPriority] = useState<ActionPriority>("medium");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  const typologySlugs = typologySlugsForThemes(c.riskThemes);
  const praHref = typologySlugs.length
    ? `/assess/product-risk/new?typologies=${typologySlugs.join(",")}`
    : "/assess/product-risk/new";

  // Only used for copy ("already have a workspace" vs "this creates one"),
  // never to gate or trigger a fetch - no GET happens in this panel at all.
  const hasWorkspace = ready && !!workspaceId;

  async function instantiateControl(control: Control): Promise<string> {
    const res = await wsFetch("/api/workspace/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controlSlug: control.slug }),
    });
    if (!res.ok) throw new Error("Could not add this control to your workspace.");
    const data: unknown = await res.json();
    const id =
      data && typeof data === "object" ? (data as { control?: { id?: unknown } }).control?.id : undefined;
    if (typeof id !== "string" || !id) throw new Error("Unexpected response instantiating the control.");
    return id;
  }

  async function createChangeFor(control: Control) {
    setChangeStates((prev) => ({ ...prev, [control.slug]: { status: "loading" } }));
    try {
      const workspaceControlId = await instantiateControl(control);
      const title = `Strengthen ${control.name} after ${c.firm} ${c.year}`;
      const rationale = `Raised from the ${c.regulator} enforcement action against ${c.firm} (${c.year}): ${c.summary}`;
      const res = await wsFetch("/api/control-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceControlId, title, rationale }),
      });
      if (!res.ok) throw new Error("Could not create the control change.");
      const data: unknown = await res.json();
      const changeId =
        data && typeof data === "object" ? (data as { change?: { id?: unknown } }).change?.id : undefined;
      if (typeof changeId !== "string" || !changeId) throw new Error("Unexpected response creating the control change.");
      router.push(`/change-lab/${changeId}`);
    } catch (error) {
      setChangeStates((prev) => ({
        ...prev,
        [control.slug]: {
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        },
      }));
    }
  }

  async function onCreateAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!primaryControl) return;
    const title = actionTitle.trim();
    if (!title) {
      setActionResult({ ok: false, message: "Title is required." });
      return;
    }
    setActionSubmitting(true);
    setActionResult(null);
    try {
      const workspaceControlId = await instantiateControl(primaryControl);
      const res = await wsFetch("/api/workspace/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "workspace_control",
          subjectId: workspaceControlId,
          title,
          dueDate: actionDueDate || undefined,
          priority: actionPriority,
        }),
      });
      if (!res.ok) throw new Error("Could not create the follow-up action.");
      setActionResult({ ok: true, message: "Action created. Find it on your workspace home." });
    } catch (error) {
      setActionResult({
        ok: false,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setActionSubmitting(false);
    }
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <ListChecks className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground">Turn this case into work</h2>
      </div>
      <p className="text-sm text-text-muted mb-5">
        {hasWorkspace
          ? "These actions save straight into your workspace."
          : "These actions save into your workspace. The first click creates a free, anonymous workspace for you; nothing is created until then."}
      </p>

      <div className="space-y-5">
        {/* 1. Log an incident (Phase 2, folded into this panel) */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Log an incident from this case</p>
            <p className="text-xs text-text-muted mt-0.5 mb-1.5">
              Start an incident record pre-linked to this enforcement case as its source.
            </p>
            <Link
              href={`/assure/incidents/new?enforcementRef=${cSlug}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Log an incident <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* 2. Create a control change, one click per mapped control */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Create a control change</p>
            <p className="text-xs text-text-muted mt-0.5 mb-2">
              Adds the control to your workspace if it isn&apos;t already there, then opens a pre-filled change
              proposal referencing this case.
            </p>
            {controls.length === 0 ? (
              <p className="text-xs text-text-muted">No mapped controls for this case yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {controls.slice(0, 4).map((control) => {
                  const state = changeStates[control.slug] ?? { status: "idle" };
                  return (
                    <div key={control.slug} className="flex items-center flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => createChangeFor(control)}
                        disabled={state.status === "loading"}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {state.status === "loading" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5" />
                        )}
                        Propose a change: {control.name}
                      </button>
                      {state.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-500">
                          <AlertTriangle className="h-3 w-3" /> {state.message}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Add to a product risk assessment */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <ListChecks className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Add to a product risk assessment</p>
            <p className="text-xs text-text-muted mt-0.5 mb-1.5">
              Start a PRA{typologySlugs.length ? " with this case's typologies pre-selected" : ""}.
            </p>
            <Link href={praHref} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              Go to product risk assessment <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* 4. Create a follow-up action */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <CalendarPlus className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Create a follow-up action</p>
            {!primaryControl ? (
              <p className="text-xs text-text-muted mt-0.5">
                No mapped control to attach a follow-up action to yet.
              </p>
            ) : (
              <form onSubmit={onCreateAction} className="mt-2 space-y-2">
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Action title"
                  className="w-full px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    aria-label="Due date"
                    className="px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  />
                  <select
                    value={actionPriority}
                    onChange={(e) => setActionPriority(e.target.value as ActionPriority)}
                    aria-label="Priority"
                    className="px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)} priority
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={actionSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {actionSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Create action
                  </button>
                </div>
                {actionResult && (
                  <p className={`text-[11px] ${actionResult.ok ? "text-accent" : "text-red-500"}`}>
                    {actionResult.message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
