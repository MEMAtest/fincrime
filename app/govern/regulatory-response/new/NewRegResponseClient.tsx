"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  REG_REQUEST_CHANNEL_LABEL,
  type PersonDTO,
  type PersonRole,
  type RegRequestChannel,
} from "@/components/reg-response/types";

const CHANNELS: RegRequestChannel[] = ["email", "portal", "letter", "meeting", "s165", "other"];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

interface NewRegResponseClientProps {
  preselectedIncidentId: string | null;
}

/**
 * The "log a request" form. POSTs to /api/reg-requests, then redirects into
 * the journey at step 1. If this was reached via the incident closure
 * bridge (?incidentId=), that id is carried through as a query param on the
 * redirect so step 4 of the journey can offer a one-click substantiation
 * link back to the incident once a question exists.
 */
export default function NewRegResponseClient({ preselectedIncidentId }: NewRegResponseClientProps) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [title, setTitle] = useState("");
  const [regulator, setRegulator] = useState("FCA");
  const [reference, setReference] = useState("");
  const [channel, setChannel] = useState<RegRequestChannel | "">("");
  const [receivedAt, setReceivedAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [people, setPeople] = useState<PersonDTO[]>([]);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Best-effort: only load the people picker once a workspace already
  // exists. A brand-new anonymous visitor with no workspace yet simply sees
  // an empty picker (and can still quick-add), rather than this page
  // bootstrapping one just by being visited.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await wsFetch(`/api/workspace/people`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPeople(Array.isArray(data.people) ? data.people : []);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  async function submitQuickAdd() {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddBusy(true);
    try {
      const res = await wsFetch(`/api/workspace/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: quickAddRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setPeople((prev) => [...prev, data.person]);
        setOwnerPersonId(data.person.id);
        setQuickAddName("");
        setQuickAddOpen(false);
      }
    } finally {
      setQuickAddBusy(false);
    }
  }

  async function submit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await wsFetch(`/api/reg-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          regulator: regulator.trim() || undefined,
          reference: reference.trim() || undefined,
          channel: channel || undefined,
          receivedAt: receivedAt || undefined,
          deadline: deadline || undefined,
          ownerPersonId: ownerPersonId || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not log this request. Please try again.");
        return;
      }
      const data = await res.json();
      const id = data.request?.id;
      if (!id) {
        setError("Could not log this request. Please try again.");
        return;
      }
      const qs = preselectedIncidentId ? `?incidentId=${encodeURIComponent(preselectedIncidentId)}` : "";
      router.push(`/govern/regulatory-response/${id}${qs}`);
    } catch {
      setError("Could not log this request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Regulatory Response", href: "/govern/regulatory-response" },
        { label: "New" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Log a regulator request</h1>
          <p className="text-sm text-text-muted mb-6">
            Capture the basics now; the questions, responses, substantiation and commitments come next.
          </p>

          {preselectedIncidentId && (
            <div className="glass-card rounded-xl p-3 mb-6 text-xs text-text-muted">
              Linked from a reportable incident. Once you add your first question, you can link it straight back to
              that incident in step 4.
            </div>
          )}

          <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FCA information request on TM thresholds" />

            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Regulator" value={regulator} onChange={(e) => setRegulator(e.target.value)} />
              <Input label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. FCA-2026-0417" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Channel (optional)</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as RegRequestChannel | "")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              >
                <option value="">Not specified</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {REG_REQUEST_CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input type="date" label="Received on (optional)" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
              <Input type="date" label="Deadline (optional)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

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
                  className="px-3 py-2 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 cursor-pointer shrink-0"
                >
                  New
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
                    onClick={() => void submitQuickAdd()}
                    disabled={quickAddBusy || !quickAddName.trim()}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button onClick={() => void submit()} disabled={submitting || !title.trim()}>
              {submitting ? "Logging..." : "Log request & continue"}
            </Button>
          </div>
        </div>
      </main>
    </ToolFrame>
  );
}
