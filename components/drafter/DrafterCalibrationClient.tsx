"use client";

import { useEffect, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

const CRITERIA_KEYS = [
  "mechanism_not_policy_restatement",
  "trigger_actor_action_outcome",
  "rationale_explains_risk",
  "scope_stated",
  "tone_measured",
  "correct_section",
];

interface CalibrationItem {
  id: string;
  enhancement_text: string;
  rationale_text: string;
  section_type: string;
  human_labels: Record<string, "pass" | "fail">;
  judge_output: { criteria: Record<string, { pass: boolean }> } | null;
}

interface CalibrationRun {
  id: string;
  model_name: string;
  prompt_version: string;
  item_count: number;
  agreement_by_criterion: Record<string, { agree: number; total: number; pct: number }>;
  overall_agreement_pct: number;
  threshold_pct: number;
  passed_threshold: boolean;
  created_at: string;
}

/**
 * Calibration screen (SPEC.md calibration): hold a labelled set, run the
 * judge over it, show agreement per criterion vs the threshold, keep run
 * history keyed by model + prompt version.
 */
export default function DrafterCalibrationClient() {
  const [items, setItems] = useState<CalibrationItem[]>([]);
  const [runs, setRuns] = useState<CalibrationRun[]>([]);
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [labels, setLabels] = useState<Record<string, "pass" | "fail">>({});
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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

  const runCalibration = async () => {
    setRunning(true);
    setMessage(null);
    const r = await drafterFetch("/api/drafter/calibration/run", { method: "POST" });
    if (!r.ok) setMessage("error" in r.data ? r.data.error ?? "Run failed" : "Run failed");
    setRunning(false);
    await load();
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Calibration" }]}>
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviewer calibration</h1>
            <p className="text-sm text-text-muted">Hold a labelled set of enhancements with human pass/fail per criterion, run the judge over it, and check agreement against the threshold before trusting judge output on real drafts.</p>
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

          <div className="glass-card rounded-2xl p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Labelled set ({items.length} items)</h2>
              <button className="px-3 py-1.5 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={running || items.length === 0} onClick={runCalibration}>
                {running ? "Running..." : "Run judge over the set"}
              </button>
            </div>
            <ul className="text-xs space-y-1">
              {items.map((item) => (
                <li key={item.id} className="border-t border-border pt-1">
                  {item.enhancement_text.slice(0, 100)}... - {Object.keys(item.human_labels).length} label(s){item.judge_output ? " - judged" : ""}
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
                  <div className="flex items-center gap-2">
                    <Badge variant={run.passed_threshold ? "success" : "danger"}>{run.passed_threshold ? "passed" : "failed"} threshold</Badge>
                    <span>
                      {run.model_name} / {run.prompt_version} - {run.overall_agreement_pct}% overall (threshold {run.threshold_pct}%) - {run.item_count} items
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
    </ToolFrame>
  );
}
