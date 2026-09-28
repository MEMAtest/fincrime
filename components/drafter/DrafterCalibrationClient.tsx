"use client";

import { useEffect, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "./ConfirmDialog";
import { drafterFetch } from "./drafterFetch";

const CRITERIA_KEYS = [
  "mechanism_not_policy_restatement",
  "trigger_actor_action_outcome",
  "rationale_explains_risk",
  "scope_stated",
  "tone_measured",
  "correct_section",
];

interface JudgeCriterionResult {
  quote: string;
  pass: boolean;
  reason: string;
}

interface CalibrationItem {
  id: string;
  enhancement_text: string;
  rationale_text: string;
  section_type: string;
  human_labels: Record<string, "pass" | "fail">;
  judge_output: { criteria: Record<string, JudgeCriterionResult> } | { invalid: true; error: string } | null;
  judge_model_name: string | null;
  judge_prompt_version: string | null;
}

interface CalibrationRun {
  id: string;
  model_name: string;
  prompt_version: string;
  item_count: number;
  agreement_by_criterion: Record<string, { agree: number; total: number; pct: number }>;
  overall_agreement_pct: number;
  invalid_count: number;
  threshold_pct: number;
  min_items: number;
  passed_threshold: boolean;
  created_at: string;
}

function hasValidJudge(output: CalibrationItem["judge_output"]): output is { criteria: Record<string, JudgeCriterionResult> } {
  return Boolean(output) && "criteria" in (output as object);
}

/**
 * Calibration screen (SPEC.md calibration): hold a labelled set, judge each
 * item one request at a time (defect #2: never one request judging the
 * whole set), then finalise a run - agreement per criterion vs the
 * threshold, keyed by the CURRENT judge model + prompt version.
 */
export default function DrafterCalibrationClient() {
  const [items, setItems] = useState<CalibrationItem[]>([]);
  const [runs, setRuns] = useState<CalibrationRun[]>([]);
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [labels, setLabels] = useState<Record<string, "pass" | "fail">>({});
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finalising, setFinalising] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CalibrationItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const load = async () => {
    const r1 = await drafterFetch<{ items: CalibrationItem[] }>("/api/drafter/calibration/items");
    if (r1.ok && "items" in r1.data) setItems(r1.data.items);
    const r2 = await drafterFetch<{ runs: CalibrationRun[] }>("/api/drafter/calibration/runs");
    if (r2.ok && "runs" in r2.data) setRuns(r2.data.runs);
  };

  useEffect(() => {
    drafterFetch<{ items: CalibrationItem[] }>("/api/drafter/calibration/items").then((r) => {
      if (r.ok && "items" in r.data) setItems(r.data.items);
    });
    drafterFetch<{ runs: CalibrationRun[] }>("/api/drafter/calibration/runs").then((r) => {
      if (r.ok && "runs" in r.data) setRuns(r.data.runs);
    });
  }, []);

  const addItem = async () => {
    if (!text.trim() || Object.keys(labels).length === 0) {
      setMessage("Provide text and at least one criterion label.");
      return;
    }
    const r = await drafterFetch("/api/drafter/calibration/items", {
      method: "POST",
      body: JSON.stringify({ text, rationale, labels }),
    });
    if (r.ok) {
      setText("");
      setRationale("");
      setLabels({});
      setMessage(null);
      await load();
    } else setMessage("Could not add item.");
  };

  const importItems = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      const r = await drafterFetch<{ created: unknown[]; skipped: string[] }>("/api/drafter/calibration/items", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      if (r.ok && "created" in r.data) {
        setMessage(`Imported ${r.data.created.length} item(s), skipped ${r.data.skipped.length}.`);
        setImportJson("");
        await load();
      } else setMessage("Import failed.");
    } catch {
      setMessage("Invalid JSON.");
    }
  };

  /**
   * Judges every item ONE REQUEST AT A TIME with progress, instead of one
   * request judging the whole set (defect #2: 30 items sequentially inside
   * one request risked the serverless function timeout).
   */
  const judgeAll = async () => {
    setJudging(true);
    setMessage(null);
    setProgress({ done: 0, total: items.length });
    for (let i = 0; i < items.length; i++) {
      await drafterFetch(`/api/drafter/calibration/items/${items[i].id}/judge`, { method: "POST" });
      setProgress({ done: i + 1, total: items.length });
      await load();
    }
    setJudging(false);
    setProgress(null);
  };

  const judgeOne = async (id: string) => {
    setMessage(null);
    const r = await drafterFetch(`/api/drafter/calibration/items/${id}/judge`, { method: "POST" });
    if (!r.ok) setMessage("Could not judge this item.");
    await load();
  };

  const finalise = async () => {
    setFinalising(true);
    setMessage(null);
    const r = await drafterFetch("/api/drafter/calibration/run", { method: "POST" });
    if (!r.ok) setMessage("error" in r.data ? r.data.error ?? "Finalise failed" : "Finalise failed");
    setFinalising(false);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const r = await drafterFetch(`/api/drafter/calibration/items/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (r.ok) {
      setDeleteTarget(null);
      await load();
    } else setMessage("Could not delete item.");
  };

  const confirmClear = async () => {
    setClearBusy(true);
    const r = await drafterFetch<{ removed: number }>("/api/drafter/calibration/items/clear", { method: "POST" });
    setClearBusy(false);
    setShowClearConfirm(false);
    if (r.ok && "removed" in r.data) {
      setMessage(`Cleared ${r.data.removed} item(s).`);
      await load();
    } else setMessage("Could not clear the set.");
  };

  const judgedCount = items.filter((i) => i.judge_output !== null).length;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Calibration" }]}>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviewer calibration</h1>
            <p className="text-sm text-text-muted">Hold a labelled set of enhancements with human pass/fail per criterion, judge each item with the SAME judge production uses, then finalise a run and check agreement against the threshold before trusting judge output on real drafts.</p>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold">Add an item by hand</h2>
            <textarea className="border rounded px-2 py-1 text-sm w-full" rows={3} placeholder="Control text" value={text} onChange={(e) => setText(e.target.value)} />
            <textarea className="border rounded px-2 py-1 text-sm w-full" rows={2} placeholder="Rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              {CRITERIA_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between border rounded px-2 py-1">
                  <span>{key.replace(/_/g, " ")}</span>
                  <select
                    className="border rounded px-1"
                    value={labels[key] ?? ""}
                    onChange={(e) => setLabels((prev) => ({ ...prev, [key]: e.target.value as "pass" | "fail" }))}
                  >
                    <option value="">-</option>
                    <option value="pass">pass</option>
                    <option value="fail">fail</option>
                  </select>
                </label>
              ))}
            </div>
            <button className="px-3 py-1.5 rounded bg-accent text-white text-sm" onClick={addItem}>
              Add item
            </button>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold">Import JSON</h2>
            <p className="text-xs text-text-muted">An array of {"{text, rationale, sectionType, labels: {criterion: 'pass'|'fail'}}"}.</p>
            <textarea className="border rounded px-2 py-1 text-sm w-full font-mono" rows={4} value={importJson} onChange={(e) => setImportJson(e.target.value)} />
            <button className="px-3 py-1.5 rounded border border-border text-sm" onClick={importItems}>
              Import
            </button>
          </div>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold">
                Labelled set ({items.length} items, {judgedCount} judged)
              </h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={judging || items.length === 0} onClick={judgeAll}>
                  {judging ? `Judging... ${progress ? `${progress.done}/${progress.total}` : ""}` : "Judge every item"}
                </button>
                <button className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-50" disabled={finalising || judgedCount === 0} onClick={finalise}>
                  {finalising ? "Finalising..." : "Finalise run"}
                </button>
                <button
                  className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-sm disabled:opacity-50"
                  disabled={items.length === 0}
                  onClick={() => setShowClearConfirm(true)}
                >
                  Clear set
                </button>
              </div>
            </div>

            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="border-t border-border pt-3 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1">{item.enhancement_text.slice(0, 140)}...</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.judge_output === null && <Badge variant="default">not judged</Badge>}
                      {hasValidJudge(item.judge_output) && <Badge variant="success">judged</Badge>}
                      {item.judge_output && !hasValidJudge(item.judge_output) && <Badge variant="danger">invalid</Badge>}
                      <button className="px-2 py-1 rounded border border-border" onClick={() => judgeOne(item.id)} disabled={judging}>
                        Judge
                      </button>
                      <button className="px-2 py-1 rounded border border-red-300 text-red-700" onClick={() => setDeleteTarget(item)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {item.judge_output && !hasValidJudge(item.judge_output) && (
                    <p className="text-red-600">Judge error: {(item.judge_output as { invalid: true; error: string }).error}</p>
                  )}

                  {/* Human label vs judge verdict, per criterion, so disagreements can be inspected (task defect #6). */}
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-left text-text-muted">
                        <th className="pr-2 py-0.5">Criterion</th>
                        <th className="pr-2 py-0.5">Human</th>
                        <th className="pr-2 py-0.5">Judge</th>
                        <th className="pr-2 py-0.5">Quote / reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CRITERIA_KEYS.filter((key) => item.human_labels[key]).map((key) => {
                        const humanLabel = item.human_labels[key];
                        const judgeCriterion = hasValidJudge(item.judge_output) ? item.judge_output.criteria[key] : undefined;
                        const judgeLabel = judgeCriterion ? (judgeCriterion.pass ? "pass" : "fail") : "-";
                        const disagree = judgeCriterion ? judgeLabel !== humanLabel : Boolean(item.judge_output);
                        return (
                          <tr key={key} className={disagree ? "bg-red-50" : undefined}>
                            <td className="pr-2 py-0.5 align-top">{key.replace(/_/g, " ")}</td>
                            <td className="pr-2 py-0.5 align-top">{humanLabel}</td>
                            <td className="pr-2 py-0.5 align-top">{judgeLabel}</td>
                            <td className="pr-2 py-0.5 align-top text-text-muted">
                              {judgeCriterion ? `"${judgeCriterion.quote}" - ${judgeCriterion.reason}` : item.judge_output ? "no verdict (invalid response)" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold">Run history</h2>
            {runs.length === 0 ? (
              <p className="text-sm text-text-muted">No calibration runs yet.</p>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="border-t border-border pt-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={run.passed_threshold ? "success" : "danger"}>{run.passed_threshold ? "passed" : "failed"} threshold</Badge>
                    <span>
                      {run.model_name} / {run.prompt_version} - {run.overall_agreement_pct}% overall - {run.item_count} items ({run.invalid_count} invalid/unjudged) - needs {run.min_items} min items at {run.threshold_pct}% on every critical criterion
                    </span>
                  </div>
                  <ul className="pl-3 list-disc">
                    {Object.entries(run.agreement_by_criterion).map(([key, a]) => (
                      <li key={key}>
                        {key.replace(/_/g, " ")}: {a.pct}% ({a.agree}/{a.total})
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this calibration item?"
          description="This removes the item and its human labels/judge output. This cannot be undone."
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear the whole calibration set?"
          description={`This deletes all ${items.length} labelled item(s) so the set can be re-imported. This cannot be undone.`}
          confirmLabel="Clear set"
          busy={clearBusy}
          onConfirm={confirmClear}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </ToolFrame>
  );
}
