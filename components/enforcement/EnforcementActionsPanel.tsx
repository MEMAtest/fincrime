"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, Wrench, ListChecks, CalendarPlus, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { CaseTypologySelection } from "@/lib/enforcement/select";
import type { EnforcementCase } from "@/data/enforcement/types";
import type { Control } from "@/data/controls/types";
import type { ActionPriority } from "@/components/pra/types";

const PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
const CONTROLS_SHOWN = 4;

type ChangeState = { status: "idle" | "loading" } | { status: "error"; message: string };

const DEFAULT_ACTION_TITLE = (c: EnforcementCase) => `Follow up on ${c.firm} (${c.year}) lessons`;

/** Reads `{error: string}` off a failed response, falling back to a generic message rather than discarding the server's actual reason. */
async function errorMessageFrom(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  } catch {
    // no JSON body
  }
  return fallback;
}

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
  typologySelection,
}: {
  caseData: EnforcementCase;
  controls: Control[];
  cSlug: string;
  /** Case-specific typology slugs computed server-side (see app/enforcement/[slug]/page.tsx), so the ~300KB typology catalogue never ships to this client component. */
  typologySelection: CaseTypologySelection;
}) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [changeStates, setChangeStates] = useState<Record<string, ChangeState>>({});

  const primaryControl = controls[0] ?? null;
  const [actionTitle, setActionTitle] = useState(DEFAULT_ACTION_TITLE(c));
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionPriority, setActionPriority] = useState<ActionPriority>("medium");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { slugs: typologySlugs, totalBeforeCap, usedFallback } = typologySelection;
  const praHref = typologySlugs.length
    ? `/assess/product-risk/new?typologies=${typologySlugs.map(encodeURIComponent).join(",")}`
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
    if (!res.ok) {
      throw new Error(await errorMessageFrom(res, "Could not add this control to your workspace."));
    }
    const data: unknown = await res.json();
    const id =
      data && typeof data === "object" ? (data as { control?: { id?: unknown } }).control?.id : undefined;
    if (typeof id !== "string" || !id) throw new Error("Unexpected response instantiating the control.");
    return id;
  }

  async function createChangeFor(control: Control) {
    setChangeStates((prev) => ({ ...prev, [control.slug]: { status: "loading" } }));

    let workspaceControlId: string;
    try {
      workspaceControlId = await instantiateControl(control);
    } catch (error) {
      setChangeStates((prev) => ({
        ...prev,
        [control.slug]: {
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        },
      }));
      return;
    }

    // The control is now in the workspace regardless of what happens next, so
    // any failure from here on must say so rather than implying nothing happened.
    try {
      const title = `Strengthen ${control.name} after ${c.firm} ${c.year}`;
      const rationale = `Raised from the ${c.regulator} enforcement action against ${c.firm} (${c.year}): ${c.summary}`;
      const res = await wsFetch("/api/control-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceControlId, title, rationale }),
      });
      if (!res.ok) {
        throw new Error(await errorMessageFrom(res, "Could not create the control change."));
      }
      const data: unknown = await res.json();
      const changeId =
        data && typeof data === "object" ? (data as { change?: { id?: unknown } }).change?.id : undefined;
      if (typeof changeId !== "string" || !changeId) throw new Error("Unexpected response creating the control change.");
      router.push(`/change-lab/${changeId}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Something went wrong.";
      setChangeStates((prev) => ({
        ...prev,
        [control.slug]: {
          status: "error",
          message: `${control.name} was added to your workspace, but the change proposal failed: ${detail}`,
        },
      }));
    }
  }

  function resetActionForm() {
    setActionResult(null);
    setActionTitle(DEFAULT_ACTION_TITLE(c));
    setActionDueDate("");
    setActionPriority("medium");
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

    let workspaceControlId: string;
    try {
      workspaceControlId = await instantiateControl(primaryControl);
    } catch (error) {
      setActionResult({
        ok: false,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
      setActionSubmitting(false);
      return;
    }

    try {
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
      if (!res.ok) {
        throw new Error(await errorMessageFrom(res, "Could not create the follow-up action."));
      }
      setActionResult({ ok: true, message: "Action created. Find it on your workspace home." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Something went wrong.";
      setActionResult({
        ok: false,
        message: `${primaryControl.name} was added to your workspace, but the action wasn't created: ${detail}`,
      });
    } finally {
      setActionSubmitting(false);
    }
  }

  // Once an action is successfully created, the form is locked (not just
  // re-enabled once submitting flips back to false) so a second click can't
  // fire the same title/date/priority again and create a duplicate action.
  // "Create another" explicitly resets it.
  const actionFormLocked = actionSubmitting || actionResult?.ok === true;

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
                {controls.slice(0, CONTROLS_SHOWN).map((control) => {
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
                {controls.length > CONTROLS_SHOWN && (
                  <p className="text-[11px] text-text-muted">
                    Showing {CONTROLS_SHOWN} of {controls.length} mapped controls. Open the control builder below
                    for the rest.
                  </p>
                )}
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
              {typologySlugs.length
                ? `Start a PRA with ${typologySlugs.length}${
                    totalBeforeCap > typologySlugs.length ? ` of ${totalBeforeCap}` : ""
                  } ${usedFallback ? "risk-theme" : "case-specific"} typolog${
                    typologySlugs.length === 1 ? "y" : "ies"
                  } pre-selected.`
                : "Start a PRA."}
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
                  disabled={actionFormLocked}
                  className="w-full px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    aria-label="Due date"
                    disabled={actionFormLocked}
                    className="px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
                  />
                  <select
                    value={actionPriority}
                    onChange={(e) => setActionPriority(e.target.value as ActionPriority)}
                    aria-label="Priority"
                    disabled={actionFormLocked}
                    className="px-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)} priority
                      </option>
                    ))}
                  </select>
                  {actionResult?.ok ? (
                    <button
                      type="button"
                      onClick={resetActionForm}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-colors cursor-pointer"
                    >
                      Create another action
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={actionFormLocked}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {actionSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Create action
                    </button>
                  )}
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
