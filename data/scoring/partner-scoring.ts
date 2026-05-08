import type { PartnerFlow, ModelType, FlowType, Actor, ControlOwnership } from "../partner-flows/types";
import { allPartnerFlows } from "../partner-flows";

export interface PartnerAnswers {
  modelType: ModelType;
  flowType: FlowType;
  actors: Actor[];
  controlOverrides: Record<string, ControlOwnership>;
  dataReceived: string[];
}

export interface PartnerRiskResult {
  flow: PartnerFlow;
  riskScore: number;
  riskRating: "low" | "medium" | "high" | "critical";
  gapControls: { id: string; control: string; category: string }[];
  missingDataFields: { id: string; field: string }[];
  controlSummary: {
    yourFirm: number;
    partner: number;
    shared: number;
    gap: number;
  };
}

const POINTS = {
  gapControl: 10,
  partnerOwned: 5,
  missingDataField: 6,
  flowComplexity: { embedded: 10, correspondent: 15, marketplace: 20 } as Record<string, number>,
  actorPenalty: 4,
} as const;

function getRating(score: number): "low" | "medium" | "high" | "critical" {
  if (score < 25) return "low";
  if (score < 50) return "medium";
  if (score < 75) return "high";
  return "critical";
}

export function findBestFlow(modelType: ModelType, flowType: FlowType): PartnerFlow | undefined {
  return allPartnerFlows.find(
    (f) => f.modelType === modelType && f.flowType === flowType
  ) || allPartnerFlows.find((f) => f.modelType === modelType);
}

export function scorePartnerRisk(answers: PartnerAnswers): PartnerRiskResult | null {
  const flow = findBestFlow(answers.modelType, answers.flowType);
  if (!flow) return null;

  // Merge control overrides with defaults
  const controlOwnership = flow.controlOwnershipTemplate.map((c) => ({
    ...c,
    currentOwner: (answers.controlOverrides[c.id] || c.defaultOwner) as ControlOwnership,
  }));

  // Count ownership distribution
  const controlSummary = { yourFirm: 0, partner: 0, shared: 0, gap: 0 };
  const gapControls: { id: string; control: string; category: string }[] = [];

  for (const c of controlOwnership) {
    switch (c.currentOwner) {
      case "your_firm": controlSummary.yourFirm++; break;
      case "partner": controlSummary.partner++; break;
      case "shared": controlSummary.shared++; break;
      case "gap":
        controlSummary.gap++;
        gapControls.push({ id: c.id, control: c.control, category: c.category });
        break;
    }
  }

  // Identify missing data fields
  const requiredFields = flow.dataFieldsTemplate.filter((f) => f.required);
  const missingDataFields = requiredFields
    .filter((f) => !answers.dataReceived.includes(f.id))
    .map((f) => ({ id: f.id, field: f.field }));

  // Calculate risk score
  let riskScore = 0;

  // Partner-owned controls (less visibility = more risk)
  riskScore += controlSummary.partner * POINTS.partnerOwned;

  // Gap controls (unowned = highest risk)
  riskScore += controlSummary.gap * POINTS.gapControl;

  // Missing data fields
  riskScore += missingDataFields.length * POINTS.missingDataField;

  // Flow complexity
  riskScore += POINTS.flowComplexity[flow.modelType] || 10;

  // Actor count (more actors = more handoff risk)
  riskScore += Math.max(0, answers.actors.length - 2) * POINTS.actorPenalty;

  return {
    flow,
    riskScore,
    riskRating: getRating(riskScore),
    gapControls,
    missingDataFields,
    controlSummary,
  };
}
