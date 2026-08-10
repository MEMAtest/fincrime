"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, UserPlus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  CONTROL_TEST_METHOD_LABEL,
  type ControlTestMethod,
  type PersonDTO,
  type PersonRole,
  type WorkspaceControlDTO,
} from "@/components/control-testing/types";

const METHODS = Object.keys(CONTROL_TEST_METHOD_LABEL) as ControlTestMethod[];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

interface NewTestClientProps {
  /** Carried from /assure/control-testing/new?controlId=<workspace_control_id> (e.g. the Change Lab bridge). */
  preselectedControlId: string | null;
}

/** Creation form: pick a live workspace control, title, method, period, tester, then hand off to the 5-step journey. */
export default function NewTestClient({ preselectedControlId }: NewTestClientProps) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [controls, setControls] = useState<WorkspaceControlDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);

  const [workspaceControlId, setWorkspaceControlId] = useState(preselectedControlId ?? "");
  const [title, setTitle] = useState("");
  const [method, setMethod] = useState<ControlTestMethod | "">("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [testerPersonId, setTesterPersonId] = useState("");
  // Prefilled from workspace Settings > Operational defaults once /api/workspace/me
  // resolves (see the effect below); left blank ("") rather than a hard-coded
  // number until then, and freely editable regardless of where it came from.
  const [sampleSize, setSampleSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this creation form (wsFetch's ensureWorkspace() would
  // otherwise mint a workspace row for an anonymous visitor who merely
  // landed here). Mirrors app/assure/control-testing/page.tsx's gate.
  // Derived rather than set from inside the effect below, so there is no
  // synchronous setState-in-effect.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const [controlsRes, peopleRes, meRes] = await Promise.all([
          wsFetch("/api/workspace/controls"),
          wsFetch("/api/workspace/people"),
          wsFetch("/api/workspace/me"),
        ]);
        if (!controlsRes.ok) throw new Error("failed");
        const controlsData = await controlsRes.json();
        if (!cancelled) setControls(Array.isArray(controlsData.controls) ? controlsData.controls : []);

        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          if (!cancelled) setPeople(Array.isArray(peopleData.people) ? peopleData.people : []);
        }

        // Best-effort prefill only - a failure here just leaves the sample
        // size field blank, it never blocks creating the test.
        if (meRes.ok) {
          const meData = await meRes.json();
          const defaultSampleSize = meData?.settings?.defaultTestSampleSize;
          if (!cancelled && typeof defaultSampleSize === "number") {
            setSampleSize(String(defaultSampleSize));
          }
        }
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

  const submitQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddBusy(true);
    try {
      const res = await wsFetch("/api/workspace/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: quickAddRole }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPeople((prev) => [...prev, data.person]);
      setTesterPersonId(data.person.id);
      setQuickAddName("");
      setQuickAddOpen(false);
    } catch {
      setSubmitError("Could not add that person. Please try again.");
    } finally {
      setQuickAddBusy(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceControlId) {
      setSubmitError("Select the control you want to test.");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSubmitError("Title is required.");
      return;
    }
    let parsedSampleSize: number | undefined;
    if (sampleSize.trim() !== "") {
      const n = Number(sampleSize);
      if (!Number.isInteger(n) || n < 0) {
        setSubmitError("Sample size must be a non-negative whole number.");
        return;
      }
      parsedSampleSize = n;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await wsFetch("/api/control-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceControlId,
          title: trimmedTitle,
          method: method || undefined,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          testerPersonId: testerPersonId || undefined,
          sampleSize: parsedSampleSize,
        }),
      });
      if (!res.ok) throw new Error("Failed to create control test");
      const data: unknown = await res.json();
      const id = data && typeof data === "object" && (data as { test?: { id?: unknown } }).test?.id;
      if (typeof id !== "string" || !id) throw new Error("Unexpected response");
      router.push(`/assure/control-testing/${id}`);
    } catch {
      setSubmitError("Could not create the control test. Please try again.");
      setSubmitting(false);
    }
  };

  const crumb = [
    { label: "Home", href: "/" },
    { label: "Control Testing", href: "/assure/control-testing" },
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
              <ClipboardCheck className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No live controls yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                A control test needs a control you already have live in your workspace to test against. Instantiate
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
          <h1 className="text-2xl font-bold text-foreground mb-1">Start a control test</h1>
          <p className="text-sm text-text-muted mb-6">
            Pick the live control you want to test. You&apos;ll record the sample results, findings and evidence over
            the next few steps.
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
              label="Test title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 sanctions screening reperformance"
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Method (optional)</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ControlTestMethod | "")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              >
                <option value="">Not specified</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {CONTROL_TEST_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Period start (optional)"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
              <Input
                type="date"
                label="Period end (optional)"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>

            <Input
              type="number"
              min={0}
              step={1}
              label="Sample size (optional)"
              value={sampleSize}
              onChange={(e) => setSampleSize(e.target.value)}
            />

            <div>
              <label className="text-sm font-medium text-ink-soft">Tester (optional)</label>
              <div className="flex items-center gap-2 mt-1.5">
                <select
                  value={testerPersonId}
                  onChange={(e) => setTesterPersonId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  <option value="">Select a person...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 cursor-pointer shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" /> New
                </button>
              </div>
              {quickAddOpen && (
                <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-2">
                  <input
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <select
                    value={quickAddRole}
                    onChange={(e) => setQuickAddRole(e.target.value as PersonRole)}
                    className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    {PERSON_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={submitQuickAdd}
                    disabled={quickAddBusy || !quickAddName.trim()}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {submitError && <p className="text-xs text-red-500">{submitError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create control test"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </ToolFrame>
  );
}
