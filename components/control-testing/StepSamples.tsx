"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { RatingBadge } from "@/components/controls/ControlBits";
import { scoreTestEffectiveness } from "@/data/scoring/test-effectiveness";
import { CONTROL_TEST_RESULT_LABEL, type ControlTestDTO, type ControlTestFindingDTO } from "./types";

interface StepSamplesProps {
  test: ControlTestDTO;
  findings: ControlTestFindingDTO[];
  readOnly: boolean;
  onSave: (fields: {
    sampleSize: number | null;
    samplesPassed: number | null;
    samplesFailed: number | null;
    samplesPartial: number | null;
  }) => Promise<void>;
}

/** Non-negative integer, or "" while the field is empty. Clamped at the input boundary so the stored, displayed and scored values never disagree. */
function clampToNonNegativeInt(raw: string): number | "" {
  if (raw === "") return "";
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function toCountOrNull(v: number | ""): number | null {
  return v === "" ? null : v;
}

/** Step 2: sample size and pass/fail/partial counts, with a live derived preview of the result and rating data/scoring/test-effectiveness.ts would apply. */
export default function StepSamples({ test, findings, readOnly, onSave }: StepSamplesProps) {
  const [sampleSize, setSampleSize] = useState<number | "">(test.sample_size ?? "");
  const [samplesPassed, setSamplesPassed] = useState<number | "">(test.samples_passed ?? "");
  const [samplesFailed, setSamplesFailed] = useState<number | "">(test.samples_failed ?? "");
  const [samplesPartial, setSamplesPartial] = useState<number | "">(test.samples_partial ?? "");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () =>
      scoreTestEffectiveness({
        sampleSize: toCountOrNull(sampleSize),
        samplesPassed: toCountOrNull(samplesPassed),
        samplesFailed: toCountOrNull(samplesFailed),
        samplesPartial: toCountOrNull(samplesPartial),
        findings: findings.map((f) => ({ severity: f.severity })),
      }),
    [sampleSize, samplesPassed, samplesFailed, samplesPartial, findings]
  );

  const hasHighFinding = findings.some((f) => f.severity === "high");
  const hasMediumOrHighFinding = findings.some((f) => f.severity === "medium" || f.severity === "high");
  const scoredSamples = (toCountOrNull(samplesPassed) ?? 0) + (toCountOrNull(samplesFailed) ?? 0) + (toCountOrNull(samplesPartial) ?? 0);

  const explanation = useMemo(() => {
    if (scoredSamples === 0) {
      return "No samples recorded yet, so this test cannot be scored - it stays not assessed.";
    }
    if (hasHighFinding) {
      return "A HIGH severity finding forces a fail and a weak rating, regardless of the pass rate.";
    }
    if (preview.passRate < 0.7) {
      return `The pass rate (${Math.round(preview.passRate * 100)}%) is below the 70% pass threshold, so this fails and rates weak.`;
    }
    if (preview.passRate >= 0.9 && !hasMediumOrHighFinding) {
      return `The pass rate (${Math.round(preview.passRate * 100)}%) is at or above 90% with no medium/high findings, so this passes and rates strong.`;
    }
    return `The pass rate (${Math.round(preview.passRate * 100)}%) is between 70% and 90%, or there are medium/high findings, so this passes with findings and rates adequate.`;
  }, [scoredSamples, hasHighFinding, hasMediumOrHighFinding, preview.passRate]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        sampleSize: toCountOrNull(sampleSize),
        samplesPassed: toCountOrNull(samplesPassed),
        samplesFailed: toCountOrNull(samplesFailed),
        samplesPartial: toCountOrNull(samplesPartial),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Samples</h2>
        <p className="text-sm text-text-muted">
          Record the sample size tested and how many samples passed, failed or partially passed. A partial counts as
          half a pass.
        </p>
      </div>

      <section className="glass-card rounded-xl p-5 space-y-4">
        <Input
          type="number"
          label="Sample size"
          min={0}
          value={sampleSize}
          onChange={(e) => setSampleSize(clampToNonNegativeInt(e.target.value))}
          disabled={readOnly}
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <Input
            type="number"
            label="Passed"
            min={0}
            value={samplesPassed}
            onChange={(e) => setSamplesPassed(clampToNonNegativeInt(e.target.value))}
            disabled={readOnly}
          />
          <Input
            type="number"
            label="Failed"
            min={0}
            value={samplesFailed}
            onChange={(e) => setSamplesFailed(clampToNonNegativeInt(e.target.value))}
            disabled={readOnly}
          />
          <Input
            type="number"
            label="Partial"
            min={0}
            value={samplesPartial}
            onChange={(e) => setSamplesPartial(clampToNonNegativeInt(e.target.value))}
            disabled={readOnly}
          />
        </div>
        {!readOnly && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save sample counts"}
          </Button>
        )}
      </section>

      <section className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Live result preview</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-text-muted">Pass rate</p>
            <p className="text-foreground font-medium">{scoredSamples === 0 ? "-" : `${Math.round(preview.passRate * 100)}%`}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Result</p>
            <p className="text-foreground font-medium">{preview.result ? CONTROL_TEST_RESULT_LABEL[preview.result] : "Not assessed"}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Rating applied to the control</p>
            <RatingBadge rating={preview.rating} />
          </div>
        </div>
        <p className="text-xs text-text-muted pt-2 border-t border-white/10">{explanation}</p>
        <p className="text-xs text-text-muted">
          This preview is computed live from the counts above plus any findings already recorded; it is not stored
          until you complete the test on the Conclusion step.
        </p>
      </section>
    </div>
  );
}
