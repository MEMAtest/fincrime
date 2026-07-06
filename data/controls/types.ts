import type { FirmType, RiskTheme, Metric, Source } from "../typologies/types";

/**
 * A first-class, implementation-ready financial crime control. Unlike the
 * control content embedded inside typologies (which is read-only reference), a
 * Control is a complete, citable specification a user can adapt into their own
 * defensible control: it carries the fields that make a control buildable
 * (type, owners, systems, threshold and its rationale, tuning, a test plan) plus
 * plain-language scaffolding so a non-expert can get it right.
 *
 * Controls link back to the typologies they mitigate (`typologySlugs`) and the
 * real enforcement cases they would have prevented (`enforcementRefs`, joined to
 * `data/enforcement/cases.ts` by firm + year), so the lab can run both ways:
 * risk -> control, and enforcement case -> control.
 */

export type ControlType = "preventive" | "detective" | "corrective";

export type ControlCategory =
  | "customer_due_diligence"
  | "transaction_monitoring"
  | "screening"
  | "ongoing_monitoring"
  | "governance_reporting";

/** A reference to a real enforcement case (joined to cases.ts by firm + year). */
export interface EnforcementRef {
  firm: string;
  year: number;
}

/** A worked "strong vs weak" example so a non-expert can calibrate. */
export interface StrongVsWeak {
  strong: string;
  weak: string;
}

/**
 * A user's in-session customisation of a control in the Control Builder. Empty
 * fields fall back to the control's catalogue defaults. Kept here so the builder
 * UI and the register exporter share one shape.
 */
/** A control's self-assessed rating in the register (all in-session, editable). */
export type ControlRating = "strong" | "adequate" | "weak" | "not_assessed";

/** Implementation status in the register (in-session, editable). */
export type ControlStatus = "not_started" | "in_progress" | "needs_review" | "gaps" | "implemented";

/** Priority in the register (in-session, editable; a sensible default is derived from risk). */
export type ControlPriority = "high" | "medium" | "low";

export interface ControlOverride {
  threshold?: string;
  firstLineOwner?: string;
  secondLineOwner?: string;
  system?: string;
  reviewCadence?: string;
  notes?: string;
  // Control Register workspace fields (editable, catalogue defaults where relevant).
  rating?: ControlRating;
  maturityLevel?: number; // 1-5, undefined = not assessed
  designEffectiveness?: ControlRating;
  operatingEffectiveness?: ControlRating;
  overallRating?: ControlRating;
  frequency?: string;
  nextReview?: string;
  lastReviewed?: string;
  // Control Register (table) + Builder wizard fields (all in-session, empty by default).
  status?: ControlStatus;
  priority?: ControlPriority;
  owner?: string;
  lastReview?: string;
  version?: string;
  effectiveDate?: string;
  // Builder: Scope step
  businessArea?: string;
  geography?: string;
  inScope?: string[];
  outOfScope?: string[];
  customerTypes?: string[];
  products?: string[];
  objectives?: string[];
  description?: string;
}

export interface Control {
  id: number;
  slug: string;
  name: string;
  category: ControlCategory;
  controlType: ControlType;
  /** One plain-English line: what this control does and why, for a non-expert. */
  plainSummary: string;
  /** The control objective in compliance terms. */
  objective: string;

  /**
   * Additive plain-English layer, shown FIRST in the read view so a non-expert
   * gets it before the cited/regulatory wording (which stays verbatim behind a
   * "Regulatory detail" expander). These paraphrase the fields named below; they
   * add no new facts, figures or thresholds. Optional so the UI falls back to the
   * original field when a plain version is not (yet) authored.
   */
  /** Plain restatement of `objective`: what the control is for. */
  plainObjective?: string;
  /** Plain restatement of `ruleLogic`: how the control works / how it spots things. */
  plainHowItWorks?: string;
  /** Plain restatement of `thresholdRationale`: why the default threshold is set where it is. */
  plainWhyThreshold?: string;

  riskThemes: RiskTheme[];
  applicableFirmTypes: FirmType[];
  /** Typology slugs this control mitigates (cross-ref to data/typologies). */
  typologySlugs: string[];
  /** Enforcement cases this control would have prevented (firm + year). */
  enforcementRefs: EnforcementRef[];

  /** Data the control consumes. */
  dataInputs: string[];
  /** The rule / scenario / procedure in plain logic terms. */
  ruleLogic: string;
  /** A sensible default threshold (editable by the user in the builder). */
  defaultThreshold: string;
  /** Why that threshold, so the user can defend or change it. */
  thresholdRationale: string;
  /** Rolling window the rule evaluates over (e.g. "rolling 30 days"). */
  lookbackWindow: string;
  /** Expected alert volume / false-positive posture and how to tune it. */
  tuningNotes: string;

  /** Suggested first-line owner (editable). */
  firstLineOwner: string;
  /** Suggested second-line owner (editable). */
  secondLineOwner: string;
  /** Example systems/tooling that implement this (editable, non-prescriptive). */
  suggestedSystems: string[];

  /** What happens on a hit and to whom. */
  escalation: string;
  /** Target response time. */
  sla: string;

  /** Effectiveness metrics (reuses the typology Metric shape). */
  metrics: Metric[];
  /** How to test/validate the control works (cases, synthetic data, coverage). */
  testPlan: string[];
  /** How often the control and its calibration are reviewed. */
  reviewCadence: string;
  /** Governance points (who signs off, what evidence is retained). */
  governance: string[];

  /** Non-expert scaffolding: what a good implementation looks like. */
  whatGoodLooksLike: string[];
  /** A worked strong-vs-weak example. */
  strongVsWeak: StrongVsWeak;

  sources: Source[];
}
