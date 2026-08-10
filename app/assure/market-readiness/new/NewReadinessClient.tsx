"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { AssessmentListItem } from "@/components/pra/types";
import {
  ENTITY_LABEL,
  ENTITY_ORDER,
  JURISDICTION_LABEL,
  JURISDICTION_ORDER,
  type EntityType,
  type Jurisdiction,
} from "@/data/kyc/types";
import { RISK_LEVEL_LABEL, type PersonDTO, type PersonRole, type RiskLevel } from "@/components/readiness/types";

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

interface NewReadinessClientProps {
  /** Carried from /assure/market-readiness/new?productId=<products id>. */
  preselectedProductId: string | null;
  /** Carried from the KYC Matrix "Turn this into a readiness assessment" bridge. */
  preselectedEntityType: string | null;
  preselectedJurisdiction: string | null;
}

function isEntityType(v: string | null): v is EntityType {
  return v !== null && (ENTITY_ORDER as string[]).includes(v);
}

function isJurisdiction(v: string | null): v is Jurisdiction {
  return v !== null && (JURISDICTION_ORDER as string[]).includes(v);
}

/** Creation form: title, entity type, jurisdiction, risk level, an optional product link (or a free-text note), target launch date and owner, then hand off to the 6-step journey. */
export default function NewReadinessClient({ preselectedProductId, preselectedEntityType, preselectedJurisdiction }: NewReadinessClientProps) {
  const router = useRouter();
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [praAssessments, setPraAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [entityType, setEntityType] = useState<EntityType>(isEntityType(preselectedEntityType) ? preselectedEntityType : "corporate");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(isJurisdiction(preselectedJurisdiction) ? preselectedJurisdiction : "uk");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [useProductNote, setUseProductNote] = useState(!preselectedProductId);
  const [productId, setProductId] = useState(preselectedProductId ?? "");
  const [productNote, setProductNote] = useState("");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this creation form. Mirrors
  // app/assure/incidents/new/NewIncidentClient.tsx's gate. Derived rather
  // than set from inside the effect below, so there is no synchronous
  // setState-in-effect.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const [peopleRes, praRes] = await Promise.all([
          wsFetch("/api/workspace/people").catch(() => null),
          wsFetch("/api/pra/assessments").catch(() => null),
        ]);
        if (cancelled) return;
        if (peopleRes?.ok) {
          const data = await peopleRes.json();
          setPeople(Array.isArray(data.people) ? data.people : []);
        }
        if (praRes?.ok) {
          const data = await praRes.json();
          setPraAssessments(Array.isArray(data.assessments) ? data.assessments : []);
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
      const res = await wsFetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          entityType,
          jurisdiction,
          riskLevel,
          productId: !useProductNote && productId ? productId : undefined,
          productNote: useProductNote && productNote.trim() ? productNote.trim() : undefined,
          targetLaunchDate: targetLaunchDate || undefined,
          ownerPersonId: ownerPersonId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create readiness assessment");
      const data: unknown = await res.json();
      const id = data && typeof data === "object" && (data as { assessment?: { id?: unknown } }).assessment?.id;
      if (typeof id !== "string" || !id) throw new Error("Unexpected response");

      router.push(`/assure/market-readiness/${id}`);
    } catch {
      setSubmitError("Could not create the readiness assessment. Please try again.");
      setSubmitting(false);
    }
  };

  const crumb = [
    { label: "Home", href: "/" },
    { label: "Market Readiness", href: "/assure/market-readiness" },
    { label: "New" },
  ];

  return (
    <ToolFrame breadcrumb={crumb}>
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold text-foreground mb-1">New readiness assessment</h1>
          <p className="text-sm text-text-muted mb-6">
            Set the entity type, jurisdiction and product, then generate the obligation register in the next step.
          </p>

          {loading && !noWorkspaceYet ? (
            <div className="glass-card rounded-2xl p-8 text-center text-text-muted text-sm">Loading...</div>
          ) : (
            <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 space-y-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Corporate onboarding, UK launch"
                required
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-soft">Entity type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value as EntityType)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  >
                    {ENTITY_ORDER.map((e) => (
                      <option key={e} value={e}>
                        {ENTITY_LABEL[e]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-soft">Jurisdiction</label>
                  <select
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                  >
                    {JURISDICTION_ORDER.map((j) => (
                      <option key={j} value={j}>
                        {JURISDICTION_LABEL[j]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-soft">Risk level</label>
                <div className="grid grid-cols-3 gap-2">
                  {RISK_LEVELS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRiskLevel(r)}
                      className={`px-3 py-2.5 rounded-lg border text-sm text-center transition-colors cursor-pointer ${
                        riskLevel === r ? "border-accent bg-accent/5 text-accent font-medium" : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                      }`}
                    >
                      {RISK_LEVEL_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink-soft">Product (optional)</label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setUseProductNote(false)}
                    className={`px-2.5 py-1 rounded-full border cursor-pointer ${
                      !useProductNote ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-text-muted border-line-2"
                    }`}
                  >
                    Link a PRA product
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseProductNote(true)}
                    className={`px-2.5 py-1 rounded-full border cursor-pointer ${
                      useProductNote ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-text-muted border-line-2"
                    }`}
                  >
                    Free-text note instead
                  </button>
                </div>
                {!useProductNote ? (
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Not linked</option>
                    {praAssessments.map((a) => (
                      <option key={a.id} value={a.productId}>
                        {a.productName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={productNote}
                    onChange={(e) => setProductNote(e.target.value)}
                    placeholder="e.g. New embedded-finance card product, not yet in a PRA"
                  />
                )}
              </div>

              <Input
                type="date"
                label="Target launch date (optional)"
                value={targetLaunchDate}
                onChange={(e) => setTargetLaunchDate(e.target.value)}
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

              {submitError && <p className="text-xs text-red-500">{submitError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create assessment"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
