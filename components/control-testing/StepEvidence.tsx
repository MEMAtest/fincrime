"use client";

import EvidenceStep, { type NewEvidencePayload } from "@/components/evidence/EvidenceStep";
import type { EvidenceDTO } from "./types";

export type { NewEvidencePayload };

const EVIDENCE_TYPES = ["test_result", "sample_data", "sign_off", "screenshot", "policy_reference", "other"];

interface StepEvidenceProps {
  evidence: EvidenceDTO[];
  loading: boolean;
  readOnly: boolean;
  onAdd: (payload: NewEvidencePayload) => Promise<boolean>;
  onEvidenceUpdated: (updated: EvidenceDTO) => void;
}

/** Step 4: the evidence list for this test. Thin wrapper around the shared components/evidence/EvidenceStep.tsx (also used by incidents and readiness), supplying this journey's evidence type list and copy. */
export default function StepEvidence({ evidence, loading, readOnly, onAdd, onEvidenceUpdated }: StepEvidenceProps) {
  return (
    <EvidenceStep
      description="Attach the working papers, sample data, screenshots or sign-offs that support this test."
      evidenceTypes={EVIDENCE_TYPES}
      defaultType="test_result"
      evidence={evidence}
      loading={loading}
      readOnly={readOnly}
      onAdd={onAdd}
      onEvidenceUpdated={onEvidenceUpdated}
    />
  );
}
