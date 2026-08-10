"use client";

import EvidenceStep, { type NewEvidencePayload } from "@/components/evidence/EvidenceStep";
import type { EvidenceDTO } from "./types";

export type { NewEvidencePayload };

const EVIDENCE_TYPES = ["incident_report", "sample_data", "sign_off", "screenshot", "policy_reference", "correspondence", "other"];

interface StepEvidenceProps {
  evidence: EvidenceDTO[];
  loading: boolean;
  readOnly: boolean;
  onAdd: (payload: NewEvidencePayload) => Promise<boolean>;
  onEvidenceUpdated: (updated: EvidenceDTO) => void;
}

/** Step 6: the evidence list for this incident. Thin wrapper around the shared components/evidence/EvidenceStep.tsx (also used by control-testing and readiness), supplying this journey's evidence type list and copy. */
export default function StepEvidence({ evidence, loading, readOnly, onAdd, onEvidenceUpdated }: StepEvidenceProps) {
  return (
    <EvidenceStep
      description="Attach the working papers, correspondence, screenshots or sign-offs that support this incident record."
      evidenceTypes={EVIDENCE_TYPES}
      defaultType="incident_report"
      evidence={evidence}
      loading={loading}
      readOnly={readOnly}
      onAdd={onAdd}
      onEvidenceUpdated={onEvidenceUpdated}
    />
  );
}
