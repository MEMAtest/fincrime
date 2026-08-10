"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, UserPlus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_SOURCE_LABEL,
  type IncidentSeverity,
  type IncidentSource,
  type PersonDTO,
  type PersonRole,
} from "@/components/incidents/types";

const SOURCES = Object.keys(INCIDENT_SOURCE_LABEL) as IncidentSource[];
const SEVERITIES = Object.keys(INCIDENT_SEVERITY_LABEL) as IncidentSeverity[];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

interface NewIncidentClientProps {
  /** Carried from /assure/incidents/new?controlId=<workspace_control_id> - a failed control bridge. */
  preselectedControlId: string | null;
  /** Carried from /assure/incidents/new?testId=<control_test_id> - the StepConclusion "Log an incident" bridge for a failed test. */
  preselectedTestId: string | null;
  /** Carried from /assure/incidents/new?changeId=<control_change_id>. */
  preselectedChangeId: string | null;
  /** Carried from /assure/incidents/new?enforcementRef=<case slug> - the enforcement case detail page bridge. */
  preselectedEnforcementRef: string | null;
}

/** Creation form: title, source, severity, detected date, owner, then hand off to the 7-step journey. Any pre-selected control/test/change/enforcement-case param is turned into an incident_links row right after creation. */
export default function NewIncidentClient({
  preselectedControlId,
  preselectedTestId,
  preselectedChangeId,
  preselectedEnforcementRef,
}: NewIncidentClientProps) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState<IncidentSource | "">("");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [detectedAt, setDetectedAt] = useState("");
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

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
        const res = await wsFetch("/api/workspace/people");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPeople(Array.isArray(data.people) ? data.people : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

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
      setOwnerPersonId(data.person.id);
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
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSubmitError("Title is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await wsFetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          source: source || undefined,
          severity,
          detectedAt: detectedAt || undefined,
          ownerPersonId: ownerPersonId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create incident");
      const data: unknown = await res.json();
      const id = data && typeof data === "object" && (data as { incident?: { id?: unknown } }).incident?.id;
      if (typeof id !== "string" || !id) throw new Error("Unexpected response");

      // Best-effort: create the bridged link. A failure here should not block
      // navigating into the newly created incident - the user can still add
      // the link manually on the Root cause step.
      const bridgeLink = preselectedControlId
        ? { linkType: "failed_control", targetId: preselectedControlId }
        : preselectedTestId
        ? { linkType: "control_test", targetId: preselectedTestId }
        : preselectedChangeId
        ? { linkType: "control_change", targetId: preselectedChangeId }
        : preselectedEnforcementRef
        ? { linkType: "enforcement_case", targetRef: preselectedEnforcementRef }
        : null;

      if (bridgeLink) {
        try {
          await wsFetch(`/api/incidents/${id}/links`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bridgeLink),
          });
        } catch {
          // non-blocking
        }
      }

      router.push(`/assure/incidents/${id}`);
    } catch {
      setSubmitError("Could not create the incident. Please try again.");
      setSubmitting(false);
    }
  };

  const crumb = [
    { label: "Home", href: "/" },
    { label: "Incidents", href: "/assure/incidents" },
    { label: "New" },
  ];

  return (
    <ToolFrame breadcrumb={crumb}>
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold text-foreground mb-1">Log an incident</h1>
          <p className="text-sm text-text-muted mb-6">
            Start with the basics. You&apos;ll record containment, the affected population, root cause and
            traceability links, remediation and evidence over the next few steps.
          </p>

          {loading && !noWorkspaceYet ? (
            <div className="glass-card rounded-2xl p-8 text-center text-text-muted text-sm">Loading...</div>
          ) : (
            <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 space-y-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sanctions screening bypass on batch payments"
                required
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-soft">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as IncidentSource | "")}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  >
                    <option value="">Not specified</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {INCIDENT_SOURCE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-soft">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {INCIDENT_SEVERITY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                type="date"
                label="Detected on (optional)"
                value={detectedAt}
                onChange={(e) => setDetectedAt(e.target.value)}
              />

              <div>
                <label className="text-sm font-medium text-ink-soft">Owner (optional)</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <select
                    value={ownerPersonId}
                    onChange={(e) => setOwnerPersonId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Unassigned</option>
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

              {(preselectedControlId || preselectedTestId || preselectedChangeId || preselectedEnforcementRef) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-foreground">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                  <span>
                    This incident will be linked to the{" "}
                    {preselectedControlId
                      ? "control"
                      : preselectedTestId
                      ? "failed test"
                      : preselectedChangeId
                      ? "control change"
                      : "enforcement case"}{" "}
                    you came from once created.
                  </span>
                </div>
              )}

              {submitError && <p className="text-xs text-red-500">{submitError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Log incident"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
