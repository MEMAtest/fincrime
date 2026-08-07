"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { EvidenceDTO } from "./types";

interface StepSupportingDataProps {
  changeId: string;
  supportingData: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function numberField(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

const EVIDENCE_TYPES = ["test_result", "sample_data", "sign_off", "screenshot", "policy_reference", "other"];

/** Step 3: the numeric case for the change (baseline/expected alert volumes, TP/FP counts), free-text testing notes, and an evidence list. */
export default function StepSupportingData({ changeId, supportingData, onSave }: StepSupportingDataProps) {
  const { wsFetch } = useWorkspace();

  const [baselineAlertVolume, setBaselineAlertVolume] = useState<number | "">(numberField(supportingData.baselineAlertVolume));
  const [truePositives, setTruePositives] = useState<number | "">(numberField(supportingData.truePositives));
  const [falsePositives, setFalsePositives] = useState<number | "">(numberField(supportingData.falsePositives));
  const [expectedVolume, setExpectedVolume] = useState<number | "">(numberField(supportingData.expectedVolume));
  const [testingNotes, setTestingNotes] = useState<string>(typeof supportingData.testingNotes === "string" ? supportingData.testingNotes : "");
  const [saving, setSaving] = useState(false);

  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState({ type: "test_result", title: "", description: "", linkUrl: "", evidenceDate: "" });
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    wsFetch(`/api/control-changes/${changeId}/evidence`)
      .then((res) => (res.ok ? res.json() : { evidence: [] }))
      .then((data) => {
        if (!cancelled) setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
      })
      .catch(() => {
        if (!cancelled) setEvidence([]);
      })
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [changeId, wsFetch]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        baselineAlertVolume: baselineAlertVolume === "" ? null : baselineAlertVolume,
        truePositives: truePositives === "" ? null : truePositives,
        falsePositives: falsePositives === "" ? null : falsePositives,
        expectedVolume: expectedVolume === "" ? null : expectedVolume,
        testingNotes: testingNotes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const addEvidence = async () => {
    if (!evidenceDraft.title.trim()) {
      setEvidenceError("Title is required.");
      return;
    }
    setAddingEvidence(true);
    setEvidenceError(null);
    try {
      const res = await wsFetch(`/api/control-changes/${changeId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: evidenceDraft.type,
          title: evidenceDraft.title.trim(),
          description: evidenceDraft.description.trim() || undefined,
          linkUrl: evidenceDraft.linkUrl.trim() || undefined,
          evidenceDate: evidenceDraft.evidenceDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setEvidence((prev) => [...prev, data.evidence]);
      setEvidenceDraft({ type: "test_result", title: "", description: "", linkUrl: "", evidenceDate: "" });
      setShowAddEvidence(false);
    } catch {
      setEvidenceError("Could not add that evidence. Please try again.");
    } finally {
      setAddingEvidence(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Supporting data</h2>
        <p className="text-sm text-text-muted">
          The evidence base for this change: what the control currently produces, what testing showed, and what you
          expect once the change is live.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          type="number"
          label="Baseline alert volume / month"
          value={baselineAlertVolume}
          onChange={(e) => setBaselineAlertVolume(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <Input
          type="number"
          label="Expected volume after change / month"
          value={expectedVolume}
          onChange={(e) => setExpectedVolume(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <Input
          type="number"
          label="Current true positives / month"
          value={truePositives}
          onChange={(e) => setTruePositives(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <Input
          type="number"
          label="Current false positives / month"
          value={falsePositives}
          onChange={(e) => setFalsePositives(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Testing notes</label>
        <textarea
          value={testingNotes}
          onChange={(e) => setTestingNotes(e.target.value)}
          rows={4}
          placeholder="What testing has been done on this change (back-testing, sampling, parallel run)?"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
        />
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save supporting data"}
      </Button>

      <div className="pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Evidence ({evidence.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowAddEvidence((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Add evidence
          </button>
        </div>

        {showAddEvidence && (
          <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-soft">Type</label>
                <select
                  value={evidenceDraft.type}
                  onChange={(e) => setEvidenceDraft((d) => ({ ...d, type: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {EVIDENCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Title"
                value={evidenceDraft.title}
                onChange={(e) => setEvidenceDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <Input
              label="Description (optional)"
              value={evidenceDraft.description}
              onChange={(e) => setEvidenceDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Link URL (optional)"
                value={evidenceDraft.linkUrl}
                onChange={(e) => setEvidenceDraft((d) => ({ ...d, linkUrl: e.target.value }))}
              />
              <Input
                type="date"
                label="Evidence date (optional)"
                value={evidenceDraft.evidenceDate}
                onChange={(e) => setEvidenceDraft((d) => ({ ...d, evidenceDate: e.target.value }))}
              />
            </div>
            {evidenceError && <p className="text-xs text-red-500">{evidenceError}</p>}
            <Button size="sm" onClick={addEvidence} disabled={addingEvidence}>
              {addingEvidence ? "Adding..." : "Add evidence"}
            </Button>
          </div>
        )}

        {evidenceLoading ? (
          <p className="text-sm text-text-muted">Loading evidence...</p>
        ) : evidence.length === 0 ? (
          <p className="text-sm text-text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                <div className="min-w-0">
                  <span className="text-foreground">{e.title}</span>
                  {e.description && <span className="text-xs text-text-muted ml-2">{e.description}</span>}
                </div>
                <span className="text-xs text-text-muted shrink-0">{e.type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
