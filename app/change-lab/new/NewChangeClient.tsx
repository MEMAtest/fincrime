"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Blocks } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CONTROL_CHANGE_TYPE_LABEL, type ControlChangeType, type WorkspaceControlDTO } from "@/components/change-lab/types";

const CHANGE_TYPES = Object.keys(CONTROL_CHANGE_TYPE_LABEL) as ControlChangeType[];

interface NewChangeClientProps {
  /** Carried from /change-lab/new?controlId=<workspace_control_id> (the PRA bridge). */
  preselectedControlId: string | null;
}

/** Creation form: pick a live workspace control, title, optional rationale/change type, then hand off to the 7-step journey. */
export default function NewChangeClient({ preselectedControlId }: NewChangeClientProps) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [controls, setControls] = useState<WorkspaceControlDTO[]>([]);

  const [workspaceControlId, setWorkspaceControlId] = useState(preselectedControlId ?? "");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [changeType, setChangeType] = useState<ControlChangeType | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this creation form. Mirrors
  // app/assure/control-testing/new/NewTestClient.tsx's gate. Derived rather
  // than set from inside the effect below, so there is no synchronous
  // setState-in-effect.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/workspace/controls");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) setControls(Array.isArray(data.controls) ? data.controls : []);
      } catch {
        if (!cancelled) setLoadError("Could not load your workspace controls. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  const selectedControl = useMemo(
    () => controls.find((c) => c.id === workspaceControlId) ?? null,
    [controls, workspaceControlId]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceControlId) {
      setSubmitError("Select the control you want to change.");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSubmitError("Title is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await wsFetch("/api/control-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceControlId,
          title: trimmedTitle,
          rationale: rationale.trim() || undefined,
          changeType: changeType || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create control change");
      const data: unknown = await res.json();
      const id = data && typeof data === "object" && (data as { change?: { id?: unknown } }).change?.id;
      if (typeof id !== "string" || !id) throw new Error("Unexpected response");
      router.push(`/change-lab/${id}`);
    } catch {
      setSubmitError("Could not create the control change. Please try again.");
      setSubmitting(false);
    }
  };

  const crumb = [
    { label: "Home", href: "/" },
    { label: "Control Changes", href: "/change-lab" },
    { label: "New" },
  ];

  if (loading && !noWorkspaceYet) {
    return (
      <ToolFrame breadcrumb={crumb}>
        <main className="flex-1">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center text-text-muted text-sm">
            Loading your workspace controls...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (loadError) {
    return (
      <ToolFrame breadcrumb={crumb}>
        <main className="flex-1">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8 text-sm text-red-500">{loadError}</div>
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (controls.length === 0) {
    return (
      <ToolFrame breadcrumb={crumb}>
        <main className="flex-1">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <Blocks className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No live controls yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                A control change proposes a change to a control you already have live in your workspace. Instantiate
                one from the Controls Library or the Control Builder first.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/controls">
                  <Button variant="secondary">Controls Library</Button>
                </Link>
                <Link href="/control-builder">
                  <Button>Control Builder</Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </ToolFrame>
    );
  }

  return (
    <ToolFrame breadcrumb={crumb}>
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold text-foreground mb-1">Propose a control change</h1>
          <p className="text-sm text-text-muted mb-6">
            Pick the live control you want to change. Its current values are snapshotted as the baseline you&apos;ll
            compare against on the next step.
          </p>

          <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Control</label>
              <select
                value={workspaceControlId}
                onChange={(e) => setWorkspaceControlId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                required
              >
                <option value="">Select a control...</option>
                {controls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (v{c.version})
                  </option>
                ))}
              </select>
              {selectedControl && <p className="text-xs text-text-muted">{selectedControl.objective}</p>}
            </div>

            <Input
              label="Change title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Raise the structuring alert threshold"
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Change type (optional)</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as ControlChangeType | "")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              >
                <option value="">Not specified</option>
                {CHANGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTROL_CHANGE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Rationale (optional)</label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                placeholder="Why is this change needed?"
              />
            </div>

            {submitError && <p className="text-xs text-red-500">{submitError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create control change"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </ToolFrame>
  );
}
