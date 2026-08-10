"use client";

import EvidenceStep, { type NewEvidencePayload } from "@/components/evidence/EvidenceStep";
import type { EvidenceDTO } from "./types";

export type { NewEvidencePayload };

const EVIDENCE_TYPES = ["policy_reference", "sign_off", "sample_data", "screenshot", "correspondence", "regulatory_guidance", "other"];

interface StepEvidenceProps {
  evidence: EvidenceDTO[];
  readOnly: boolean;
  onAdd: (payload: NewEvidencePayload) => Promise<boolean>;
  onEvidenceUpdated: (updated: EvidenceDTO) => void;
}

/** Step 5: assessment-level evidence, separate from the obligation-scoped evidence attached in step 4. Thin wrapper around the shared components/evidence/EvidenceStep.tsx (also used by control-testing and incidents), supplying this journey's evidence type list and copy. */
export default function StepEvidence({ evidence, readOnly, onAdd, onEvidenceUpdated }: StepEvidenceProps) {
  return (
    <EvidenceStep
      description="Attach the working papers, policies or sign-offs that support this readiness assessment as a whole. Use the Gaps step for evidence tied to a specific obligation."
      evidenceTypes={EVIDENCE_TYPES}
      defaultType="policy_reference"
      evidence={evidence}
      readOnly={readOnly}
      onAdd={onAdd}
      onEvidenceUpdated={onEvidenceUpdated}
    />
  );
}
