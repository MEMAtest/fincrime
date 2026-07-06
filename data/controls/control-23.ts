import type { Control } from "./types";

export const control23: Control = {
  id: 23,
  slug: "name-screening-fuzzy-tuning",
  name: "Name-Screening Fuzzy-Match Tuning",
  category: "screening",
  controlType: "corrective",
  plainSummary:
    "Adjusts how loosely or tightly the screening engine matches names so it keeps catching real hits while cutting the flood of false alarms.",
  objective:
    "Maintain the precision and recall of fuzzy name matching across sanctions, PEP and adverse media screening by calibrating algorithm settings, thresholds and rules using evidence, so analysts spend effort on genuine matches without lowering detection of true positives.",
  plainObjective: "This control keeps name matching across sanctions, PEP and adverse media both accurate and complete by tuning its settings with evidence, so analysts focus on real hits without losing detection.",
  plainHowItWorks: "It studies the scores at which real matches actually land, sets the review cut-off just below the lowest with a safety margin, demotes weak hits through extra rules, and re-tests known matches after every change.",
  plainWhyThreshold: "The cut-off follows where real matches actually score, not alert volume, with a safety margin for name variation, and precision improves through extra rules rather than raising the bar.",
  riskThemes: ["sanctions_evasion", "bribery_corruption", "money_laundering", "proliferation_financing"],
  applicableFirmTypes: ["bank", "emi", "pi", "msb", "crypto", "neobank", "wealth_manager", "insurance"],
  typologySlugs: ["sanctions-evasion-via-intermediaries", "pep-grand-corruption-proceeds"],
  enforcementRefs: [{ firm: "Starling Bank Limited", year: 2024 }],
  dataInputs: [
    "Historical alert and disposition data labelled true positive, false positive and not relevant",
    "Match-score distribution of alerts and of confirmed true positives",
    "Current algorithm configuration: matching method, secondary-identifier weighting, threshold and rule set",
    "A seeded test-name library of known true matches and near-misses (shared with coverage testing)",
    "Analyst feedback on recurring false-positive patterns (common names, short names, name order)",
  ],
  ruleLogic:
    "Analyse the distribution of confirmed true positives by match score to find the lowest score at which real matches appear, then set the auto-review threshold below that point with a safety margin. Add rules that demote weak hits (secondary-identifier corroboration, good-guy lists, de-duplication) without raising the base threshold past the true-positive floor. Re-run the seeded test library after every change to prove recall is preserved, and roll back any change that drops seeded detection. All changes are evidenced, peer-reviewed and version-controlled.",
  defaultThreshold:
    "Auto-review threshold set no higher than the lowest confirmed true-positive score minus a safety margin (typically keeping the review cut-off at 85% unless evidence supports otherwise); any proposed increase requires a passing seeded-detection re-test.",
  thresholdRationale:
    "The threshold is data-driven, not volume-driven: it is anchored to where real matches actually score so tuning never removes coverage to reduce noise, which is exactly the failure pattern penalised in screening enforcement. The safety margin absorbs variation in transliteration and name presentation. Precision is improved through corroborating rules rather than by raising the cut-off, preserving recall.",
  lookbackWindow:
    "Tuning analysis over a rolling 12 months of alert and disposition data; seeded re-test run on each change and a full recalibration review at least annually.",
  tuningNotes:
    "The whole control is tuning, so the discipline is to improve precision only by methods that do not cost recall. Track false-positive rate before and after each change and require evidence that seeded true-positive detection is unchanged or improved. Watch for over-fitting to historical names, model drift after list growth, and the temptation to raise thresholds to hit a volume target. Any threshold increase is treated as a coverage-reducing change and must pass control 19 testing before deployment.",
  firstLineOwner: "Screening tooling / Sanctions configuration team",
  secondLineOwner: "Financial Crime Compliance assurance / MLRO",
  suggestedSystems: ["screening engine tuning module", "match-score analytics / BI tooling", "Napier / ComplyAdvantage configuration", "internal calibration scripts over labelled alert data"],
  escalation:
    "Any proposed change that reduces seeded true-positive detection is blocked and escalated to the MLRO; if a past tuning change is found to have suppressed real matches, a remedial lookback over the affected period is commissioned and the gap assessed for FCA reportability.",
  sla: "Tuning changes peer-reviewed and seeded-tested before deployment; emergency recalibration after a detected miss completed within 5 working days.",
  metrics: [
    { name: "Seeded recall after tuning", target: ">= prior baseline", description: "True-positive detection on the seed library must not fall after any change." },
    { name: "False-positive rate", target: "Trended down", description: "Share of alerts cleared as not relevant, tracked before and after tuning." },
    { name: "Change evidence completeness", target: "100%", description: "Tuning changes with documented rationale, peer review and seeded-test evidence." },
    { name: "Threshold-justification currency", target: "Reviewed annually", description: "Match threshold re-justified against current true-positive score distribution." },
  ],
  testPlan: [
    "Plot the match-score distribution of the last 12 months of confirmed true positives and confirm the review threshold sits below the lowest one.",
    "Apply a candidate tuning change in a mirror environment, re-run the seeded library and confirm detection is unchanged or improved before promotion.",
    "Simulate a threshold increase and demonstrate via seeded testing which true positives it would now miss, evidencing why it is rejected.",
    "Sample 20 newly suppressed alerts after a precision change and confirm none were genuine matches.",
  ],
  reviewCadence: "Tuning review at least quarterly using fresh disposition data; full recalibration and threshold re-justification annually and after major list growth or engine upgrades.",
  governance: [
    "MLRO approves the tuning methodology and any threshold change, with seeded-test evidence attached.",
    "All configuration changes are version-controlled with before/after settings and peer-review sign-off.",
    "Tuning decisions and their recall evidence are reported to the Financial Crime Committee.",
    "Change records and supporting analysis are retained for at least five years for regulatory inspection.",
  ],
  whatGoodLooksLike: [
    "The match threshold is anchored to where real matches score, with documented evidence, not chosen to hit an alert-volume target.",
    "Precision improvements come from corroboration rules and good-guy lists, leaving recall intact.",
    "Every tuning change is peer-reviewed, seeded-tested and version-controlled before it goes live.",
    "Threshold increases are treated as coverage changes and must pass independent coverage testing first.",
  ],
  strongVsWeak: {
    strong:
      "A team finds 92% of false positives come from a handful of common short names, adds DOB and nationality corroboration to demote them, re-runs the seed library to confirm recall is unchanged, and cuts false positives by a third with full evidence.",
    weak:
      "Under pressure to clear a backlog, a firm raises the screening threshold from 85% to 95%, the alert volume falls overnight, and nobody tests that the change quietly stopped the engine catching transliterated sanctions names, the precise gap that later draws enforcement.",
  },
  sources: [
    { org: "Wolfsberg", reference: "Wolfsberg Guidance on Sanctions Screening", title: "Wolfsberg Guidance on Sanctions Screening", url: "https://www.wolfsberg-principles.com/" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
    { org: "OFSI", reference: "OFSI Financial Sanctions Guidance", title: "OFSI Financial Sanctions Guidance", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { org: "FATF", reference: "R.6", title: "Recommendation 6: Targeted financial sanctions related to terrorism and terrorist financing", url: "https://www.fatf-gafi.org/en/recommendations.html" },
  ],
};
