"use client";

import { useEffect, useState, useCallback } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

interface Pra {
  id: string;
  product: string;
  description: string | null;
  customer_types: string[];
  status: string;
  spend_pence: number;
  cost_cap_pence: number | null;
}

interface Section {
  id: string;
  section_number: string;
  title: string;
  is_empty: boolean;
  sort_order: number;
}

interface LintIssue {
  rule: string;
  severity: string;
  message: string;
}

interface Enhancement {
  id: string;
  section_id: string;
  sort_order: number;
  control_text: string | null;
  rationale: string | null;
  backoffice_control_label: string | null;
  evidence_refs: { label: string; value: string }[];
  placeholders: { original: string; reason: string }[];
  review_result: { lint: LintIssue[]; status: string; error?: string } | null;
  is_gap: boolean;
}

interface OpenItem {
  id: string;
  item_type: string;
  description: string;
}

interface CandidateControl {
  id: string;
  title: string;
  reqIds: string[];
  backofficeControl: string | null;
  group: "reuse" | "adapt" | "new" | "unassessed";
  agreedWording: string | null;
  usedIn: { praId: string; product: string }[];
}

interface CandidatesGrouped {
  reuse: CandidateControl[];
  adapt: CandidateControl[];
  new: CandidateControl[];
  unassessed: CandidateControl[];
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  pass: "success",
  minor: "warning",
  critical: "danger",
  not_reviewed: "default",
};

export default function DrafterPraDraftClient({ praId }: { praId: string }) {
  const [pra, setPra] = useState<Pra | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [candidates, setCandidates] = useState<CandidatesGrouped | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gapDescription, setGapDescription] = useState("");
  const [gapSection, setGapSection] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await drafterFetch<{ pra: Pra; sections: Section[]; enhancements: Enhancement[]; openItems: OpenItem[] }>(`/api/drafter/pras/${praId}`);
    if (r.ok && "pra" in r.data) {
      setPra(r.data.pra);
      setSections(r.data.sections);
      setEnhancements(r.data.enhancements);
      setOpenItems(r.data.openItems);
    }
  }, [praId]);

  useEffect(() => {
    drafterFetch<{ pra: Pra; sections: Section[]; enhancements: Enhancement[]; openItems: OpenItem[] }>(`/api/drafter/pras/${praId}`).then((r) => {
      if (r.ok && "pra" in r.data) {
        setPra(r.data.pra);
        setSections(r.data.sections);
        setEnhancements(r.data.enhancements);
        setOpenItems(r.data.openItems);
      }
    });
    drafterFetch<{ grouped: CandidatesGrouped }>(`/api/drafter/pras/${praId}/candidates`).then((r) => {
      if (r.ok && "grouped" in r.data) setCandidates(r.data.grouped);
    });
  }, [praId]);

  const submitCandidates = async () => {
    const gaps = gapDescription.trim() && gapSection ? [{ description: gapDescription.trim(), sectionNumber: gapSection }] : [];
    const r = await drafterFetch(`/api/drafter/pras/${praId}/candidates`, {
      method: "POST",
      body: JSON.stringify({ selectedControlIds: Array.from(selected), gaps }),
    });
    if (r.ok) {
      setMessage(null);
      await load();
    } else {
      setMessage("Could not assign the selected controls.");
    }
  };

  const draftOne = async (enhId: string) => {
    const r = await drafterFetch<{ enhancement: Enhancement }>(`/api/drafter/pras/${praId}/enhancements/${enhId}/draft`, { method: "POST" });
    if (r.ok && "enhancement" in r.data) {
      const updated = r.data.enhancement;
      setEnhancements((prev) => prev.map((e) => (e.id === enhId ? updated : e)));
    }
    return r;
  };

  const draftAllRemaining = async () => {
    const pending = enhancements.filter((e) => !e.is_gap && !e.control_text);
    if (pending.length === 0) return;
    setDrafting(true);
    setProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const r = await draftOne(pending[i].id);
      if (!r.ok) {
        setMessage("error" in r.data ? r.data.error ?? "Drafting stopped" : "Drafting stopped");
        break;
      }
      setProgress({ done: i + 1, total: pending.length });
    }
    setDrafting(false);
    await load(); // refresh spend/open items
  };

  const saveEdit = async (enhId: string, controlText: string, rationale: string) => {
    const r = await drafterFetch<{ enhancement: Enhancement }>(`/api/drafter/pras/${praId}/enhancements/${enhId}`, {
      method: "PATCH",
      body: JSON.stringify({ controlText, rationale }),
    });
    if (r.ok && "enhancement" in r.data) {
      const updated = r.data.enhancement;
      setEnhancements((prev) => prev.map((e) => (e.id === enhId ? updated : e)));
    }
  };

  if (!pra) {
    return (
      <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Loading..." }]}>
        <main className="flex-1 p-8 text-sm text-text-muted">Loading...</main>
      </ToolFrame>
    );
  }

  const hasEnhancements = enhancements.length > 0;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: pra.product }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{pra.product}</h1>
              <p className="text-sm text-text-muted">{pra.description}</p>
            </div>
            <Badge>{pra.status}</Badge>
          </div>

          {!hasEnhancements && candidates && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Candidate controls</h2>
              {(["reuse", "adapt", "new"] as const).map((group) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-foreground capitalize mb-1">{group} ({candidates[group].length})</h3>
                  <ul className="space-y-1">
                    {candidates[group].map((c) => (
                      <li key={c.id} className="text-sm flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setSelected(next);
                          }}
                        />
                        <span>
                          {c.title} - <span className="text-text-muted">{c.backofficeControl ?? "no back office control tag"}</span>
                          {c.usedIn.length > 0 && <span className="text-text-muted"> - used in {c.usedIn.map((u) => u.product).join(", ")}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Unassessed ({candidates.unassessed.length}) - excluded until a coverage value is set</h3>
              </div>

              <div className="border-t border-border pt-3">
                <h3 className="text-sm font-semibold text-foreground mb-2">Manual gap</h3>
                <div className="flex gap-2">
                  <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Gap description" value={gapDescription} onChange={(e) => setGapDescription(e.target.value)} />
                  <select className="border rounded px-2 py-1 text-sm" value={gapSection} onChange={(e) => setGapSection(e.target.value)}>
                    <option value="">Section...</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.section_number}>
                        {s.section_number} {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {message && <p className="text-sm text-red-600">{message}</p>}
              <button className="px-4 py-2 rounded bg-accent text-white text-sm" onClick={submitCandidates}>
                Confirm selection and build sections
              </button>
            </div>
          )}

          {hasEnhancements && (
            <>
              <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
                <div className="text-sm text-text-muted">
                  Spend so far: {pra.spend_pence}
                  {pra.cost_cap_pence ? ` / cap ${pra.cost_cap_pence}` : ""} (smallest unit of the configured writer/judge currency)
                  {progress && ` - drafted ${progress.done}/${progress.total}`}
                </div>
                <button className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={drafting} onClick={draftAllRemaining}>
                  {drafting ? "Drafting..." : "Draft all remaining"}
                </button>
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}

              {sections.map((section) => {
                const sectionEnhancements = enhancements.filter((e) => e.section_id === section.id);
                return (
                  <div key={section.id} className="glass-card rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">
                      {section.section_number} {section.title}
                    </h2>
                    {sectionEnhancements.length === 0 ? (
                      <p className="text-sm text-text-muted italic">No control enhancements apply to this section for the current product.</p>
                    ) : (
                      sectionEnhancements.map((e) => (
                        <EnhancementCard key={e.id} enhancement={e} onDraft={() => draftOne(e.id)} onSave={saveEdit} />
                      ))
                    )}
                  </div>
                );
              })}

              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">Open items ({openItems.length})</h2>
                {openItems.length === 0 ? (
                  <p className="text-sm text-text-muted">None.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {openItems.map((item) => (
                      <li key={item.id}>
                        <Badge variant={item.item_type === "placeholder" ? "warning" : item.item_type === "gap" ? "danger" : "info"}>{item.item_type}</Badge>{" "}
                        {item.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

function EnhancementCard({
  enhancement,
  onDraft,
  onSave,
}: {
  enhancement: Enhancement;
  onDraft: () => Promise<unknown>;
  onSave: (id: string, controlText: string, rationale: string) => Promise<void>;
}) {
  const [controlText, setControlText] = useState(enhancement.control_text ?? "");
  const [rationale, setRationale] = useState(enhancement.rationale ?? "");
  const [busy, setBusy] = useState(false);
  // Resets the editable fields whenever the server-side draft changes (e.g.
  // after "Draft this enhancement" succeeds) - done during render rather
  // than in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedControlText, setSyncedControlText] = useState(enhancement.control_text);
  const [syncedRationale, setSyncedRationale] = useState(enhancement.rationale);
  if (enhancement.control_text !== syncedControlText || enhancement.rationale !== syncedRationale) {
    setSyncedControlText(enhancement.control_text);
    setSyncedRationale(enhancement.rationale);
    setControlText(enhancement.control_text ?? "");
    setRationale(enhancement.rationale ?? "");
  }

  const status = enhancement.review_result?.status ?? "not_reviewed";

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant={STATUS_VARIANT[status] ?? "default"}>{status.replace("_", " ")}</Badge>
        {enhancement.is_gap ? (
          <Badge variant="warning">Manual gap - placeholder</Badge>
        ) : !enhancement.control_text ? (
          <button
            className="text-xs px-3 py-1 rounded bg-accent text-white disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDraft();
              setBusy(false);
            }}
          >
            Draft this enhancement
          </button>
        ) : null}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-text-muted">Control enhancement</span>
        <textarea className="border rounded px-2 py-1" rows={3} value={controlText} onChange={(e) => setControlText(e.target.value)} disabled={enhancement.is_gap} />
      </label>
      {!enhancement.is_gap && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-text-muted">Control enhancement rationale</span>
          <textarea className="border rounded px-2 py-1" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </label>
      )}
      <div className="text-xs text-text-muted">
        <span className="font-medium">Backoffice control impacted:</span> {enhancement.backoffice_control_label ?? "(none)"}
      </div>
      <div className="text-xs text-text-muted">
        <span className="font-medium">Evidence of delivery:</span> {enhancement.evidence_refs.map((ev) => ev.value).join(", ") || "(none)"}
      </div>
      {enhancement.review_result?.lint && enhancement.review_result.lint.length > 0 && (
        <ul className="text-xs text-amber-700 space-y-0.5">
          {enhancement.review_result.lint.map((issue, i) => (
            <li key={i}>
              {issue.severity === "critical" ? "Critical" : "Warning"}: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {enhancement.review_result?.error && <p className="text-xs text-red-600">Model error: {enhancement.review_result.error}</p>}
      {!enhancement.is_gap && (
        <button className="text-xs px-3 py-1 rounded border border-border" onClick={() => onSave(enhancement.id, controlText, rationale)}>
          Save
        </button>
      )}
    </div>
  );
}
