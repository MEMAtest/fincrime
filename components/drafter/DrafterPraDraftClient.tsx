"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";
import { applyFix as applyFixText, fieldForQuote } from "@/lib/drafter/apply-fix";
import { STATUS_LABELS } from "@/lib/drafter/review-status";
import { formatUsdFromStoredUnits } from "@/lib/drafter/money";
import ModelStatusBanner from "./ModelStatusBanner";
import ConfirmDialog from "./ConfirmDialog";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  rewriteAdjusted?: boolean;
  rewriteFlags?: string[];
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
  enhancement_id: string | null;
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
  needs_input: "default",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status.replace(/_/g, " ");
}

// pra.spend_pence / pra.cost_cap_pence are both stored in the fine-grained
// "stored units" documented in lib/drafter/money.ts (1/10,000 of a USD
// cent), not whole cents - dividing by 100 previously rounded a real
// per-call spend down to "$0.00" even after many calls.
const formatUsd = formatUsdFromStoredUnits;

function isJudgeInvalid(judge: JudgeResult | JudgeInvalid | null | undefined): judge is JudgeInvalid {
  return Boolean(judge && "invalid" in judge && judge.invalid);
}

export default function DrafterPraDraftClient({ praId }: { praId: string }) {
  const router = useRouter();
  const [pra, setPra] = useState<Pra | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
  const [showCalibrationBanner, setShowCalibrationBanner] = useState(false);
  const [selectedEnhId, setSelectedEnhId] = useState<string | null>(null);
  const [reviewContainer, setReviewContainer] = useState<HTMLDivElement | null>(null);
  const [submittingCandidates, setSubmittingCandidates] = useState(false);
  // A ref lock, not just the `submittingCandidates` state: React state
  // updates only take effect on the next render, so two clicks dispatched
  // in the same tick (a fast double-click, or a scripted double-submit)
  // can both read `submittingCandidates === false` before either re-render
  // happens. The ref is set synchronously, inside the handler, before any
  // await - it is checked first and closes that window.
  const submittingCandidatesRef = useRef(false);

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
    drafterFetch<{ calibrated: boolean; judgeConfigured: boolean }>(`/api/drafter/calibration/status`).then((r) => {
      // Hidden entirely when no judge model is configured - ModelStatusBanner
      // already covers that case, and showing model names/prompt versions
      // here as well was jargon repeated on top of jargon.
      if (r.ok && "calibrated" in r.data && !r.data.calibrated && r.data.judgeConfigured) {
        setShowCalibrationBanner(true);
      }
    });
  }, [praId, load]);

  const submitCandidates = async () => {
    if (submittingCandidatesRef.current) return;
    submittingCandidatesRef.current = true;
    setSubmittingCandidates(true);
    try {
      await submitCandidatesInner();
    } finally {
      submittingCandidatesRef.current = false;
      setSubmittingCandidates(false);
    }
  };

  const submitCandidatesInner = async () => {
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
    // One enhancement failing (a bad model response, a cost-cap hit, etc.)
    // must never silently stop the rest of the batch - every OTHER pending
    // enhancement still gets a draft attempt, and every failure (not just
    // the last one) is reported. A per-enhancement error is already shown
    // inline via review_result.error (set by draftOneEnhancement itself);
    // this summary is what tells the reviewer something needs attention
    // without having to scroll every card looking for a red line.
    const failures: string[] = [];
    for (let i = 0; i < pending.length; i++) {
      const r = await draftOne(pending[i].id);
      if (!r.ok) {
        failures.push("error" in r.data ? r.data.error ?? "Drafting failed" : "Drafting failed");
      }
      setProgress({ done: i + 1, total: pending.length });
    }
    setDrafting(false);
    if (failures.length > 0) {
      setMessage(
        `Drafted ${pending.length - failures.length} of ${pending.length}. ${failures.length} failed - see the red "Model error" line on each affected enhancement below.`
      );
    } else {
      setMessage(null);
    }
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

  /**
   * Returns whether the save actually persisted, so the card can tell the
   * user "Save failed - your edit is still unsaved" rather than silently
   * keeping the unsaved text on screen with no indication anything is
   * wrong (the bug behind "Apply fix updated the UI, Save clicked, but
   * after reload it reverted" - a failed PATCH was previously swallowed
   * here and `load()` ran regardless, refetching the still-old server
   * value while the untouched local textarea state masked the mismatch
   * until a hard reload remounted the component from scratch).
   */
  const saveEdit = async (enhId: string, controlText: string, rationale: string, editType: "manual" | "apply_fix"): Promise<boolean> => {
    const r = await drafterFetch<{ enhancement: Enhancement }>(`/api/drafter/pras/${praId}/enhancements/${enhId}`, {
      method: "PATCH",
      body: JSON.stringify({ controlText, rationale, editType }),
    });
    if (r.ok && "enhancement" in r.data) {
      const updated = r.data.enhancement;
      setEnhancements((prev) => prev.map((e) => (e.id === enhId ? updated : e)));
      await load();
      return true;
    }
    setMessage("error" in r.data ? r.data.error ?? "Save failed - your edit was not saved." : "Save failed - your edit was not saved.");
    return false;
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

  const deletePraNow = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await drafterFetch(`/api/drafter/pras/${praId}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (!res.ok) {
      setDeleteError("error" in res.data ? res.data.error ?? "Could not delete this PRA." : "Could not delete this PRA.");
      return;
    }
    router.push("/drafter/pras");
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
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{pra.product}</h1>
              <p className="text-sm text-text-muted">{pra.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{pra.status.replace(/_/g, " ")}</Badge>
              <button className="text-xs px-3 py-1.5 rounded bg-red-700 text-white" onClick={() => setShowDeleteDialog(true)}>
                Delete PRA
              </button>
            </div>
          </div>

          {showDeleteDialog && (
            <ConfirmDialog
              title="Delete this PRA?"
              description={`"${pra.product}" and all its sections, enhancements, edit history and open items will be permanently removed. This cannot be undone.`}
              busy={deleteBusy}
              error={deleteError}
              onConfirm={deletePraNow}
              onCancel={() => setShowDeleteDialog(false)}
            />
          )}

          <ModelStatusBanner />

          {showCalibrationBanner && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-800">
              The automated reviewer has not passed calibration yet, so treat its results as provisional.{" "}
              <Link href="/drafter/calibration" className="underline font-medium">
                Run calibration
              </Link>
            </div>
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
                        <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          aria-label={`Select candidate control: ${c.title}`}
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
                        </label>
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
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="sr-only">Gap description</span>
                    <input className="border rounded px-2 py-1 text-sm w-full" placeholder="Gap description" value={gapDescription} onChange={(e) => setGapDescription(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="sr-only">Gap section</span>
                    <select className="border rounded px-2 py-1 text-sm" value={gapSection} onChange={(e) => setGapSection(e.target.value)}>
                    <option value="">Section...</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.section_number}>
                        {s.section_number} {s.title}
                      </option>
                    ))}
                    </select>
                  </label>
                </div>
              </div>

              {message && <p className="text-sm text-red-600">{message}</p>}
              <button
                className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50"
                disabled={submittingCandidates}
                onClick={submitCandidates}
              >
                {submittingCandidates ? "Working..." : "Confirm selection and build sections"}
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
                  Spend {formatUsd(pra.spend_pence)}
                  {pra.cost_cap_pence ? ` of ${formatUsd(pra.cost_cap_pence)} cap` : ""}
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

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
                {/* Document page: the PRA's sections and enhancements, read as a document. */}
                <div className="space-y-6 min-w-0">
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
                              isSelected={selectedEnhId === e.id}
                              reviewContainer={reviewContainer}
                              onSelect={() => setSelectedEnhId(e.id)}
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
                </div>

                {/* Review panel: beside the document on wide screens, stacked below it on mobile. Shows the selected enhancement's review. */}
                <div className="lg:sticky lg:top-6 space-y-4">
                  <div ref={setReviewContainer} className="glass-card rounded-2xl p-5 min-h-[160px]">
                    {!selectedEnhId && (
                      <p className="text-sm text-text-muted">Select an enhancement on the left to see its review here.</p>
                    )}
                  </div>
                  <OpenItemsPanel openItems={openItems} selectedEnhId={selectedEnhId} />
                </div>
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
        placeholder="Reason for exporting with unresolved issues (logged with your name)"
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

function OpenItemsPanel({ openItems, selectedEnhId }: { openItems: OpenItem[]; selectedEnhId: string | null }) {
  const [tab, setTab] = useState<"selected" | "all">("selected");
  const items = tab === "selected" && selectedEnhId ? openItems.filter((i) => i.enhancement_id === selectedEnhId) : openItems;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Open items</h2>
        <div className="flex gap-1 text-xs">
          <button
            className={`px-2 py-0.5 rounded ${tab === "selected" ? "bg-accent/10 text-accent font-medium" : "text-text-muted"}`}
            onClick={() => setTab("selected")}
            disabled={!selectedEnhId}
          >
            This item
          </button>
          <button
            className={`px-2 py-0.5 rounded ${tab === "all" ? "bg-accent/10 text-accent font-medium" : "text-text-muted"}`}
            onClick={() => setTab("all")}
          >
            All ({openItems.length})
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">None.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <Badge variant={item.item_type === "placeholder" ? "warning" : item.item_type === "gap" ? "danger" : "info"}>{item.item_type}</Badge>{" "}
              {item.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnhancementCard({
  praId,
  enhancement,
  isSelected,
  reviewContainer,
  onSelect,
  onDraft,
  onJudge,
  onSave,
  onApprove,
}: {
  praId: string;
  enhancement: Enhancement;
  isSelected: boolean;
  reviewContainer: HTMLDivElement | null;
  onSelect: () => void;
  onDraft: () => Promise<unknown>;
  onJudge: () => Promise<unknown>;
  onSave: (id: string, controlText: string, rationale: string, editType: "manual" | "apply_fix") => Promise<boolean>;
  onApprove: (id: string, promoteAsExemplar: boolean) => Promise<void>;
}) {
  const [controlText, setControlText] = useState(enhancement.control_text ?? "");
  const [rationale, setRationale] = useState(enhancement.rationale ?? "");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState<{ controls: { control: { title: string } | null; sourceFields: Record<string, string> }[] } | null>(null);
  // Which kind of edit is currently unsaved in the boxes above - "apply_fix"
  // once Apply fix has touched a field, until either a manual keystroke or a
  // successful save resets it. Threaded through to onSave so
  // drafter_enhancement_edits records the real source of the change, per
  // SPEC.md's edit history.
  const [pendingEditType, setPendingEditType] = useState<"manual" | "apply_fix">("manual");
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
    setPendingEditType("manual");
    setSaveFailed(false);
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
    setPendingEditType("apply_fix");
    setSaveFailed(false);
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

  const reviewPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground">Review</h3>
        <Badge variant={STATUS_VARIANT[status] ?? "default"}>{statusLabel(status)}</Badge>
      </div>
      {judgeStale && <Badge variant="warning">Judge result out of date - text changed since</Badge>}
      {enhancement.model_name && <p className="text-xs text-text-muted">Drafted by model: {enhancement.model_name}</p>}

      {!enhancement.is_gap && (
        <div className="flex flex-wrap gap-2">
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
            {showSource ? "Hide source" : "Source"}
          </button>
        </div>
      )}

      {showSource && source && (
        <div className="rounded border border-border bg-surface-alt p-3 text-xs space-y-2">
          <p className="font-semibold text-foreground">Source (register rows this was drafted from)</p>
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
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Lint findings</p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {enhancement.review_result.lint.map((issue, i) => (
              <li key={i}>
                {issue.severity === "critical" ? "Critical" : "Warning"}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
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
              <p className="text-text-muted italic">Quote: &quot;{c.quote}&quot;</p>
              <p>Reason: {c.reason}</p>
              {!c.pass && c.suggestedRewrite && (
                <div className="mt-1 space-y-1">
                  {c.rewriteAdjusted && (
                    <p className="text-amber-700">
                      This suggestion was adjusted: the reviewer&apos;s wording included a fact not found in your inputs, so it has been replaced with a placeholder. Never fill a placeholder with a guessed fact - only with your own.
                    </p>
                  )}
                  {c.rewriteFlags && c.rewriteFlags.length > 0 && (
                    <p className="text-amber-700">
                      Check before applying: {c.rewriteFlags.join(", ")} - not found in your inputs, verify it is not an invented role or system name.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Suggested: {c.suggestedRewrite}</span>
                    <button
                      className="px-2 py-0.5 rounded border border-border"
                      onClick={() => applyFixToField(c.quote, c.suggestedRewrite!)}
                    >
                      Apply fix
                    </button>
                  </div>
                </div>
              )}
              {!c.pass && !c.suggestedRewrite && (
                <p className="text-text-muted mt-1">
                  No rewrite suggested: this needs a fact only you can supply. Fill the placeholder and save.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {judge && isJudgeInvalid(judge) && (
        <p className="text-xs text-red-600">
          {judge.error.includes("not found verbatim")
            ? "The reviewer's answer could not be verified against your text. Run the review again."
            : `Judge result invalid: ${judge.error}`}
        </p>
      )}
      {!judge && status !== "needs_input" && enhancement.control_text && (
        <p className="text-xs text-text-muted">Not reviewed yet. Run judge above to see criteria here.</p>
      )}
      {status === "needs_input" && <p className="text-xs text-text-muted">Nothing to review yet - this enhancement needs input first.</p>}

      {!enhancement.is_gap && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            className="text-xs px-3 py-1 rounded border border-border disabled:opacity-50"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setSaveFailed(false);
              const ok = await onSave(enhancement.id, controlText, rationale, pendingEditType);
              setSaving(false);
              if (ok) setPendingEditType("manual");
              else setSaveFailed(true);
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saveFailed && <span className="text-xs text-red-600">Save failed - your edit above is NOT saved. Try again.</span>}
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

  return (
    <div
      className={`border rounded-lg p-4 space-y-2 cursor-pointer transition-colors ${isSelected ? "border-accent bg-accent/5" : "border-border"}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] ?? "default"}>{statusLabel(status)}</Badge>
          {judgeStale && <Badge variant="warning">judge result out of date</Badge>}
        </div>
        {enhancement.is_gap ? (
          <Badge variant="warning">Manual gap - placeholder</Badge>
        ) : (
          <button
            className={`text-xs px-3 py-1 rounded ${isSelected ? "bg-accent text-white" : "border border-border"}`}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect();
            }}
          >
            {isSelected ? "Reviewing" : "Review"}
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-text-muted">Control enhancement</span>
        <textarea className="border rounded px-2 py-1" rows={3} value={controlText} onChange={(e) => { setControlText(e.target.value); setPendingEditType("manual"); setSaveFailed(false); }} disabled={enhancement.is_gap} />
      </label>
      {!enhancement.is_gap && (
        <label className="flex flex-col gap-1 text-sm" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-text-muted">Control enhancement rationale</span>
          <textarea className="border rounded px-2 py-1" rows={2} value={rationale} onChange={(e) => { setRationale(e.target.value); setPendingEditType("manual"); setSaveFailed(false); }} />
        </label>
      )}
      <div className="text-xs text-text-muted">
        <span className="font-medium">Backoffice control impacted (read-only):</span> {enhancement.backoffice_control_label ?? "(none)"}
      </div>
      <div className="text-xs text-text-muted">
        <span className="font-medium">Evidence of delivery (read-only):</span> {enhancement.evidence_refs.map((ev) => ev.value).join(", ") || "(none)"}
      </div>

      {isSelected && reviewContainer ? createPortal(reviewPanel, reviewContainer) : null}
    </div>
  );
}
