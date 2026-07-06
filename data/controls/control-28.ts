import type { Control } from "./types";

export const control28: Control = {
  id: 28,
  slug: "customer-rerating",
  name: "Dynamic Customer Re-Rating",
  category: "ongoing_monitoring",
  controlType: "detective",
  plainSummary:
    "The customer's risk score is recalculated automatically from their real behaviour, so a customer who starts acting riskier is re-rated without waiting for a manual review.",
  objective:
    "Continuously recompute each customer's residual risk rating from a blend of static profile factors and dynamic behavioural signals, so that monitoring intensity, review cadence and controls track the customer's actual risk rather than their onboarding snapshot.",
  plainObjective: "Keeps recalculating each customer's risk rating from both their fixed profile and their real behaviour, so monitoring and controls follow their actual risk, not their sign-up snapshot.",
  plainHowItWorks: "A scoring model blends fixed and behavioural factors into a risk score, recalculating regularly; a rating rise automatically tightens monitoring, while a drop is held until an analyst confirms it.",
  plainWhyThreshold: "A 20-point or band-crossing jump is big enough to signal a real change, upgrades apply automatically because under-monitoring is riskier, and downgrades wait for a person.",
  riskThemes: ["money_laundering", "fraud", "sanctions_evasion", "terrorist_financing"],
  applicableFirmTypes: ["bank", "emi", "neobank", "msb", "wealth_manager", "pi", "crypto"],
  typologySlugs: ["behavioural-change-indicators", "unusual-business-vs-declared-profile", "mule-account-activity"],
  enforcementRefs: [{ firm: "Commerzbank AG", year: 2020 }],
  dataInputs: [
    "Static risk factors (geography, customer type, product, PEP status)",
    "Behavioural factors (volume vs expected, corridor mix, counterparty diversity, cash equivalence)",
    "Alert and SAR history",
    "Screening and adverse-media status",
    "Network signals (links to known mules or flagged accounts)",
    "Current and historical risk rating with change reasons",
  ],
  ruleLogic:
    "A scoring model combines weighted static factors with rolling behavioural factors to produce a residual risk score, mapped to a rating band. The model recalculates on a schedule and on demand when a behavioural input crosses a band boundary. A rating increase auto-applies tighter monitoring and a shorter review cadence; a rating decrease is held for analyst confirmation before it can relax controls. Every rating change records the factors that moved it so the decision is explainable.",
  defaultThreshold:
    "Recompute scores nightly; auto-escalate the rating band when the residual score rises by 20 or more points or crosses a band boundary; require analyst sign-off before any rating downgrade takes effect.",
  thresholdRationale:
    "A 20-point or band-crossing move is large enough to reflect a genuine behavioural shift rather than normal variance, keeping auto-escalations meaningful. Upgrades auto-apply because under-monitoring is the greater regulatory risk, while downgrades are held for human review so the model cannot quietly weaken controls on a customer that has simply gone quiet. Nightly recompute keeps the rating current without the cost of true real-time scoring.",
  lookbackWindow:
    "Behavioural factors computed over a rolling 90 days with a 12-month trailing comparison to detect step changes.",
  tuningNotes:
    "Start by running the model in shadow mode against current manual ratings and investigate every divergence before letting it auto-apply. Expect most customers never to change band; if more than 10 percent re-rate each month the behavioural weights are too sensitive. Calibrate weights with the second line, document every weight, and never let the model produce a rating it cannot explain in plain factors.",
  firstLineOwner: "Financial Crime Analytics / Customer Risk team",
  secondLineOwner: "MLRO / Financial Crime Compliance and Model Risk",
  suggestedSystems: [
    "Customer risk-rating / scoring engine",
    "Feature store fed by transaction monitoring and screening",
    "Model governance and shadow-testing tooling",
    "CLM case manager for downgrade confirmations and re-rating reviews",
  ],
  escalation:
    "Auto-upgrades into the high-risk band open an enhanced-review case and notify the MLRO; customers re-rated high two periods running are referred for relationship review and possible exit. Model divergence beyond tolerance is escalated to model governance.",
  sla: "Auto-upgrade enhanced reviews opened same day; downgrade confirmations and re-rating reviews completed within 10 business days.",
  metrics: [
    {
      name: "Re-rating accuracy",
      target: ">= 90% of auto re-ratings upheld on analyst review",
      description: "Share of model-driven rating changes confirmed correct when checked by an analyst.",
    },
    {
      name: "Upgrade-to-enhanced-monitoring latency",
      target: "Same day for high-band upgrades",
      description: "Time from a rating crossing into high risk to enhanced monitoring being applied.",
    },
    {
      name: "Stale-rating population",
      target: "0 customers on an onboarding-only rating beyond review cadence",
      description: "Customers still carrying their original onboarding rating despite material behavioural change.",
    },
  ],
  testPlan: [
    "Run the model in shadow mode and reconcile its ratings against current manual ratings, documenting and resolving every material divergence.",
    "Push a synthetic customer's behaviour across a band boundary and confirm an auto-upgrade applies tighter monitoring and opens an enhanced review the same day.",
    "Submit a downgrade scenario and confirm controls are not relaxed until an analyst confirms it.",
    "Pull the factor breakdown for a sample of rating changes and confirm each change is fully explainable from the recorded factors.",
  ],
  reviewCadence: "Model and weights formally validated annually; performance and divergence MI reviewed monthly.",
  governance: [
    "Model risk and the MLRO approve the scoring model, factor weights and band thresholds.",
    "Annual independent model validation with documented results.",
    "Monthly MI on re-rating volumes, accuracy and stale-rating population to the Financial Crime Committee.",
    "Full audit trail of factors behind every rating change retained for five years.",
  ],
  whatGoodLooksLike: [
    "Risk ratings move with behaviour, so no customer drifts on a years-old onboarding score.",
    "Every rating change can be explained from the factors that caused it.",
    "Upgrades tighten controls automatically while downgrades need a human to confirm.",
    "The model was shadow-tested and validated before it was ever allowed to change a live rating.",
  ],
  strongVsWeak: {
    strong:
      "A customer onboarded as low risk begins fanning small inbound payments from many new payers and forwarding them out within hours; the nightly model lifts the residual score across the high-risk boundary, enhanced monitoring applies that day, an analyst confirms mule-like behaviour and the case is referred for SAR consideration.",
    weak:
      "The same customer keeps the low-risk rating assigned at onboarding three years earlier; transaction monitoring thresholds tuned for low-risk customers never fire, and the mule activity runs unimpeded because nothing recalculated the rating.",
  },
  sources: [
    {
      org: "FATF",
      reference: "Recommendation 1",
      title: "FATF Recommendations - Risk-Based Approach",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "MLR",
      reference: "reg.28(11) ongoing monitoring",
      title: "The Money Laundering Regulations 2017",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Risk Assessment and Ongoing Monitoring",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
  ],
};
