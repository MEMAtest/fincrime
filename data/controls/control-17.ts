import type { Control } from "./types";

export const control17: Control = {
  id: 17,
  slug: "tm-threshold-tuning",
  name: "Transaction-Monitoring Threshold Tuning",
  category: "transaction_monitoring",
  controlType: "corrective",
  plainSummary:
    "Regularly tests and adjusts monitoring rule settings so the firm catches real risk without drowning analysts in pointless alerts, with evidence for every change.",
  objective:
    "Maintain the effectiveness and efficiency of transaction-monitoring scenarios by periodically testing thresholds against outcomes, evidencing changes through above-the-line and below-the-line analysis, and ensuring tuning improves risk capture rather than simply reducing alert volume.",
  plainObjective: "This control keeps monitoring rules effective by regularly testing and adjusting their settings so they catch more genuine risk, not just cut the number of alerts.",
  plainHowItWorks: "It checks how each rule performs, samples alerts and near-misses, and only changes a setting where evidence backs it and a simulation and sign-off confirm it will not hide real risk.",
  plainWhyThreshold: "The trigger points sit where a rule mostly produces noise or where real suspicious activity is missed just below the cut-off, because both mean the setting is wrong.",
  riskThemes: ["money_laundering", "terrorist_financing", "fraud"],
  applicableFirmTypes: [
    "bank",
    "neobank",
    "emi",
    "pi",
    "msb",
    "crypto",
    "wealth_manager",
  ],
  typologySlugs: [
    "structuring-threshold-avoidance",
    "rapid-movement-of-funds",
    "behavioural-change-indicators",
  ],
  enforcementRefs: [
    { firm: "HSBC Bank plc", year: 2021 },
    { firm: "Santander UK Plc", year: 2022 },
    { firm: "Metro Bank plc", year: 2024 },
  ],
  dataInputs: [
    "Per-scenario alert volumes, dispositions and true-positive / SAR conversion outcomes",
    "Above-the-line (alerting) and below-the-line (just-missed) transaction samples",
    "Threshold change history and prior tuning rationale",
    "Customer/segment population distributions for the metric each scenario uses",
    "Analyst capacity and backlog data",
  ],
  ruleLogic:
    "For each scenario, periodically analyse outcomes: above-the-line testing reviews whether alerting is producing meaningful results and where false positives concentrate, while below-the-line testing samples transactions just under the threshold to confirm productive activity is not being missed. Propose threshold or logic changes only where evidence supports them, simulate the change's impact on volume and risk capture before deployment, and never lower a threshold's sensitivity without confirming via below-the-line sampling that nothing material sits in the suppressed band. This is a corrective control over the other TM scenarios.",
  defaultThreshold:
    "Trigger a tuning review for any scenario whose true-positive yield falls below 5% (over-alerting) or whose below-the-line sample shows any productive (SAR-worthy) activity in the just-missed band (under-alerting); each change requires simulated impact and documented sign-off.",
  thresholdRationale:
    "A sub-5% yield flags scenarios drowning analysts in noise, which both wastes capacity and, as several enforcement cases show, leads to genuine alerts being missed in the backlog. The below-the-line trigger is the critical safeguard against the most dangerous form of tuning, loosening a threshold purely to cut volume: if any SAR-worthy activity is found just under the line, the threshold is too high regardless of how clean the alert queue looks. Requiring simulated impact and sign-off before any change prevents tuning being used to manufacture a quiet queue at the expense of detection, the failing regulators have repeatedly penalised.",
  lookbackWindow: "Outcome analysis over a rolling 6 to 12 months per scenario; below-the-line sampling over a representative recent period (typically 3 months).",
  tuningNotes:
    "This control governs the calibration of every other scenario, so its discipline matters more than its frequency. Always pair above-the-line (reduce false positives) with below-the-line (confirm no missed risk) so tuning cannot quietly degrade detection. Use statistically valid sample sizes for below-the-line review rather than a token handful. Simulate every proposed change against historic data to forecast volume and yield impact before production. Resist the temptation to raise thresholds purely to clear a backlog; the corrective answer to a backlog is capacity or scenario redesign, not blunting sensitivity. Record every change with rationale so the estate stays defensible and reversible.",
  firstLineOwner: "TM Optimisation / Detection Engineering Analyst",
  secondLineOwner: "MLRO / Financial Crime Compliance (challenge and approval)",
  suggestedSystems: [
    "Transaction monitoring platform with sandbox / what-if simulation capability",
    "Tuning analytics and below-the-line sampling tooling",
    "Model-change log / governance repository for tuning evidence",
  ],
  escalation:
    "Proposed threshold or logic changes are documented with above-the-line and below-the-line evidence and simulated impact, then submitted to the MLRO (or a tuning governance forum) for approval before deployment. Any below-the-line finding of missed productive activity is escalated immediately and may require lowering rather than raising sensitivity, plus a look-back over the affected period.",
  sla: "Tuning review completed on schedule per scenario tier; approved changes deployed within 10 business days of sign-off; below-the-line missed-risk findings actioned within 5 business days.",
  metrics: [
    {
      name: "Scenario true-positive yield",
      target: ">= 5% (per scenario, post-tuning)",
      description: "Alerts converting to confirmed suspicion or SARs, tracked per scenario over time.",
    },
    {
      name: "Below-the-line missed-risk findings",
      target: "0 unactioned",
      description: "SAR-worthy activity found in just-missed bands that has not been remediated.",
    },
    {
      name: "Change-evidence completeness",
      target: "100%",
      description: "Threshold changes with documented above/below-the-line evidence, simulation and sign-off.",
    },
  ],
  testPlan: [
    "Take an over-alerting scenario (yield < 5%), run above-the-line analysis to locate false-positive concentration, propose a change and simulate its volume and yield impact before any deployment.",
    "Run a below-the-line sample on a scenario after a proposed threshold increase and confirm no SAR-worthy activity sits in the suppressed band before approving.",
    "Attempt to deploy a threshold change without simulation or sign-off in a test workflow and confirm governance controls block it.",
    "Re-test a previously tuned scenario after one cycle to confirm the change held its yield and did not introduce a coverage gap.",
  ],
  reviewCadence: "High-risk scenarios tuned at least annually (more often if volatile); full estate tuning programme reviewed annually; ad hoc on material yield drift or risk change.",
  governance: [
    "MLRO or a documented tuning governance forum approves every threshold and logic change before production.",
    "Each change is recorded in a model-change log with above/below-the-line evidence, simulated impact and rationale, retained for audit.",
    "Independent validation periodically re-performs below-the-line sampling to confirm tuning has not suppressed genuine risk.",
  ],
  whatGoodLooksLike: [
    "Every tuning decision pairs above-the-line and below-the-line analysis, so reducing noise can never silently reduce detection.",
    "Changes are simulated against historic data and signed off before deployment, with full evidence retained.",
    "Backlogs are solved with capacity or redesign, not by quietly raising thresholds to make the queue look clean.",
  ],
  strongVsWeak: {
    strong:
      "A bank finds a structuring scenario at 3% yield, runs above-the-line analysis to target the noisiest false-positive pattern, runs a statistically valid below-the-line sample to confirm nothing SAR-worthy sits just under the line, simulates the change, gets MLRO sign-off, deploys, and logs the full evidence trail.",
    weak:
      "A firm facing a growing alert backlog simply raises several thresholds overnight to cut volume, performs no below-the-line testing, keeps no evidence beyond a changed parameter, and only discovers at the next regulatory review that the 'tuning' had suppressed a whole band of genuinely suspicious activity.",
  },
  sources: [
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Transaction Monitoring",
      title: "Wolfsberg Statement on Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
    {
      org: "FATF",
      reference: "R.1",
      title: "FATF Recommendation 1: Assessing risks and applying a risk-based approach",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
