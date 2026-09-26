"use client";

import { useEffect, useState, useCallback } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";
import { applyFix as applyFixText, fieldForQuote } from "@/lib/drafter/apply-fix";

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

interface JudgeCriterionResult {
  quote: string;
  pass: boolean;
  reason: string;
  suggestedRewrite: string | null;
}

interface JudgeResult {
  criteria: Record<string, JudgeCriterionResult>;
  overall: "pass" | "fail";
  modelName: string;
  promptVersion: string;
}

interface JudgeInvalid {
  error: string;
  invalid: true;
}

interface ReviewResult {
  lint: LintIssue[];
  status: string;
  error?: string;
  judge?: JudgeResult | JudgeInvalid | null;
  judgeStale?: boolean;
}

interface Enhancement {
  id: string;
  section_id: string;
  sort_order: number;
  control_ids: string[];
  control_text: string | null;
  rationale: string | null;
  backoffice_control_label: string | null;
  evidence_refs: { label: string; value: string }[];
  placeholders: { original: string; reason: string }[];
  review_result: ReviewResult | null;
  is_gap: boolean;
  model_name: string | null;
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

interface UnassignedControl {
  controlId: string;
  reason: string;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  pass: "success",
  minor: "warning",
  critical: "danger",
  not_reviewed: "default",
};

function isJudgeInvalid(judge: JudgeResult | JudgeInvalid | null | undefined): judge is JudgeInvalid {
  return Boolean(judge && "invalid" in judge && judge.invalid);
}

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
  const [unassigned, setUnassigned] = useState<UnassignedControl[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<{ blocking: { enhancementId: string; reason: string }[] } | null>(null);
  const [calibrationBanner, setCalibrationBanner] = useState<string | null>(null);

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
    drafterFetch<{ modelName: string; promptVersion: string; calibrated: boolean }>(`/api/drafter/calibration/status`).then((r) => {
      if (r.ok && "calibrated" in r.data && !r.data.calibrated) {
        setCalibrationBanner(
          `Reviewer not yet calibrated: no passing calibration run for judge model "${r.data.modelName}" / prompt "${r.data.promptVersion}". Judge results should be treated as provisional. See /drafter/calibration.`
        );
      }
    });
  }, [praId, load]);

  const submitCandidates = async () => {
    const gaps = gapDescription.trim() && gapSection ? [{ description: gapDescription.trim(), sectionNumber: gapSection }] : [];
    const r = await drafterFetch<{ assignment: { assigned: number; unassigned: UnassignedControl[] } }>(`/api/drafter/pras/${praId}/candidates`, {
      method: "POST",
      body: JSON.stringify({ selectedControlIds: Array.from(selected), gaps }),
    });
    if (r.ok) {
      setMessage(null);
      if ("assignment" in r.data) setUnassigned(r.data.assignment.unassigned);
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
    await load();
  };

  const judgeOne = async (enhId: string) => {
    const r = await drafterFetch<{ enhancement: Enhancement }>(`/api/drafter/pras/${praId}/enhancements/${enhId}/judge`, { method: "POST" });
    if ("enhancement" in r.data && r.data.enhancement) {
      const updated = r.data.enhancement;
      setEnhancements((prev) => prev.map((e) => (e.id === enhId ? updated : e)));
    }
    if (!r.ok) setMessage("error" in r.data ? r.data.error ?? "Judge run failed" : "Judge run failed");
    await load();
    return r;
  };

  const judgeAllDrafted = async () => {
    const pending = enhancements.filter((e) => !e.is_gap && e.control_text && (!e.review_result?.judge || e.review_result.judgeStale));
    if (pending.length === 0) return;
    setDrafting(true);
    setProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      await judgeOne(pending[i].id);
      setProgress({ done: i + 1, total: pending.length });
    }
    setDrafting(false);
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
    await load();
  };

  const approveOne = async (enhId: string, promoteAsExemplar: boolean) => {
    const r = await drafterFetch(`/api/drafter/pras/${praId}/enhancements/${enhId}/approve`, {
      method: "POST",
      body: JSON.stringify({ promoteAsExemplar }),
    });
    if (!r.ok) setMessage("error" in r.data ? r.data.error ?? "Could not approve" : "Could not approve");
    else setMessage(promoteAsExemplar ? "Approved and promoted as an exemplar." : "Approved - agreed wording saved to the library control.");
  };

  const runExport = async (overrideReason?: string) => {
    setExportBusy(true);
    setExportError(null);
    const res = await fetch(`/api/drafter/pras/${praId}/export`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrideReason: overrideReason ?? "" }),
    });
    if (res.status === 409) {
      const body = await res.json();
      setExportError(body);
      setExportBusy(false);
      return;
    }
    if (!res.ok) {
      setMessage("Export failed.");
      setExportBusy(false);
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameMatch?.[1] ?? "pra-draft.docx";
    a.click();
    URL.revokeObjectURL(url);
    setExportBusy(false);
    await load();
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
            <Badge>{pra.status.replace(/_/g, " ")}</Badge>
          </div>

          {calibrationBanner && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-800">{calibrationBanner}</div>
          )}

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
                          {c.title} - <span className="text-text-muted">{c.backofficeControl ?? "no back office control tag - will not be assigned to a section, see the template's section map"}</span>
                          {c.usedIn.length > 0 && <span className="text-text-muted"> - used in {c.usedIn.map((u) => u.product).join(", ")}</span>}
                          {group === "reuse" && !c.agreedWording && (
                            <span className="text-amber-700"> - no agreed wording held yet, will draft as a placeholder</span>
                          )}
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

          {unassigned.length > 0 && (
            <div className="rounded-lg border border-red-400 bg-red-50 p-3 text-xs text-red-800 space-y-1">
              <p className="font-semibold">{unassigned.length} selected control(s) were NOT assigned to any section - they are never silently dropped:</p>
              <ul className="list-disc pl-4">
                {unassigned.map((u) => (
                  <li key={u.controlId}>
                    Control {u.controlId}: {u.reason} - fix the section&apos;s back office control map on the Template review screen, then re-select this control.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasEnhancements && (
            <>
              <div className="glass-card rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-text-muted">
                  Token spend so far: {pra.spend_pence}
                  {pra.cost_cap_pence ? ` / cap ${pra.cost_cap_pence}` : ""} (smallest unit of the configured writer/judge currency)
                  {progress && ` - ${progress.done}/${progress.total}`}
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={drafting} onClick={draftAllRemaining}>
                    {drafting ? "Working..." : "Draft all remaining"}
                  </button>
                  <button className="px-3 py-2 rounded border border-border text-sm disabled:opacity-50" disabled={drafting} onClick={judgeAllDrafted}>
                    Judge all drafted
                  </button>
                  <button className="px-3 py-2 rounded border border-border text-sm disabled:opacity-50" disabled={exportBusy} onClick={() => runExport()}>
                    {exportBusy ? "Exporting..." : "Export to Word"}
                  </button>
                </div>
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}

              {exportError && (
                <div className="rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-800 space-y-2">
                  <p className="font-semibold">Export blocked - {exportError.blocking.length} unresolved reviewer issue(s):</p>
                  <ul className="list-disc pl-4 text-xs">
                    {exportError.blocking.map((b, i) => (
                      <li key={i}>{b.reason} (enhancement {b.enhancementId})</li>
                    ))}
                  </ul>
                  <ExportOverride onOverride={(reason) => runExport(reason)} />
                </div>
              )}

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
                        <EnhancementCard
                          key={e.id}
                          praId={praId}
                          enhancement={e}
                          onDraft={() => draftOne(e.id)}
                          onJudge={() => judgeOne(e.id)}
                          onSave={saveEdit}
                          onApprove={approveOne}
                        />
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

function ExportOverride({ onOverride }: { onOverride: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex gap-2 items-center">
      <input
        className="border rounded px-2 py-1 text-sm flex-1"
        placeholder="Reason for exporting with unresolved issues (logged with your account)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        className="text-xs px-3 py-1 rounded bg-red-700 text-white disabled:opacity-50"
        disabled={!reason.trim()}
        onClick={() => onOverride(reason.trim())}
      >
        Override and export anyway
      </button>
    </div>
  );
}

function EnhancementCard({
  praId,
  enhancement,
  onDraft,
  onJudge,
  onSave,
  onApprove,
}: {
  praId: string;
  enhancement: Enhancement;
  onDraft: () => Promise<unknown>;
  onJudge: () => Promise<unknown>;
  onSave: (id: string, controlText: string, rationale: string) => Promise<void>;
  onApprove: (id: string, promoteAsExemplar: boolean) => Promise<void>;
}) {
  const [controlText, setControlText] = useState(enhancement.control_text ?? "");
  const [rationale, setRationale] = useState(enhancement.rationale ?? "");
  const [busy, setBusy] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState<{ controls: { control: { title: string } | null; sourceFields: Record<string, string> }[] } | null>(null);
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
  const judge = enhancement.review_result?.judge;
  const judgeStale = Boolean(enhancement.review_result?.judgeStale);

  const applyFixToField = (quote: string, suggestion: string) => {
    const field = fieldForQuote(quote, controlText, rationale);
    if (!field) return;
    const current = field === "control_text" ? controlText : rationale;
    const result = applyFixText(current, quote, suggestion);
    if (!result.applied) return;
    if (field === "control_text") setControlText(result.text);
    else setRationale(result.text);
  };

  const toggleSource = async () => {
    if (!showSource && !source) {
      const r = await drafterFetch<{ controls: { control: { title: string } | null; sourceFields: Record<string, string> }[] }>(
        `/api/drafter/pras/${praId}/enhancements/${enhancement.id}/source`
      );
      if (r.ok && "controls" in r.data) setSource(r.data);
    }
    setShowSource((s) => !s);
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] ?? "default"}>{status.replace(/_/g, " ")}</Badge>
          {judgeStale && <Badge variant="warning">judge result stale - text changed since</Badge>}
          {enhancement.model_name && <span className="text-xs text-text-muted">model: {enhancement.model_name}</span>}
        </div>
        <div className="flex gap-2">
          {enhancement.is_gap ? (
            <Badge variant="warning">Manual gap - placeholder</Badge>
          ) : (
            <>
              {!enhancement.control_text ? (
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
              ) : (
                <button
                  className="text-xs px-3 py-1 rounded border border-border disabled:opacity-50"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onJudge();
                    setBusy(false);
                  }}
                >
                  Run judge
                </button>
              )}
              <button className="text-xs px-3 py-1 rounded border border-border" onClick={toggleSource}>
                Source
              </button>
            </>
          )}
        </div>
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
        <span className="font-medium">Backoffice control impacted (read-only):</span> {enhancement.backoffice_control_label ?? "(none)"}
      </div>
      <div className="text-xs text-text-muted">
        <span className="font-medium">Evidence of delivery (read-only):</span> {enhancement.evidence_refs.map((ev) => ev.value).join(", ") || "(none)"}
      </div>

      {showSource && source && (
        <div className="rounded border border-border bg-surface-alt p-3 text-xs space-y-2">
          {source.controls.map((c, i) => (
            <div key={i}>
              <p className="font-semibold">{c.control?.title ?? "Control"}</p>
              <ul className="pl-3 list-disc">
                {Object.entries(c.sourceFields).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-text-muted">{k}:</span> {v}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

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

      {judge && !isJudgeInvalid(judge) && (
        <div className="rounded border border-border p-3 space-y-2">
          <p className="text-xs font-semibold">Judge review ({judge.overall}, {judge.modelName})</p>
          {Object.entries(judge.criteria).map(([key, c]) => (
            <div key={key} className="text-xs border-t border-border pt-1 first:border-t-0 first:pt-0">
              <p>
                <Badge variant={c.pass ? "success" : "danger"}>{c.pass ? "pass" : "fail"}</Badge> <span className="font-medium">{key.replace(/_/g, " ")}</span>
              </p>
              <p className="text-text-muted italic">&quot;{c.quote}&quot;</p>
              <p>{c.reason}</p>
              {!c.pass && c.suggestedRewrite && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-text-muted">Suggested: {c.suggestedRewrite}</span>
                  <button
                    className="px-2 py-0.5 rounded border border-border"
                    onClick={() => applyFixToField(c.quote, c.suggestedRewrite!)}
                  >
                    Apply fix
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {judge && isJudgeInvalid(judge) && <p className="text-xs text-red-600">Judge result invalid: {judge.error}</p>}

      {!enhancement.is_gap && (
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1 rounded border border-border"
            onClick={() => onSave(enhancement.id, controlText, rationale)}
          >
            Save
          </button>
          <button className="text-xs px-3 py-1 rounded border border-border" onClick={() => onApprove(enhancement.id, false)}>
            Approve (save agreed wording)
          </button>
          <button className="text-xs px-3 py-1 rounded border border-border" onClick={() => onApprove(enhancement.id, true)}>
            Approve + promote as exemplar
          </button>
        </div>
      )}
    </div>
  );
}
