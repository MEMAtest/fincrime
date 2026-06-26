import type { Control } from "./types";

export const control09: Control = {
  id: 9,
  slug: "cash-deposit-anomaly-monitoring",
  name: "Cash Deposit Anomaly Monitoring",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Flags when a customer pays in cash that does not fit their declared business or income, so unexplained cash can be reviewed before it disappears into the system.",
  objective:
    "Detect and review cash credits that are inconsistent with the customer's expected profile, declared turnover or source of funds, so that potentially laundered cash entering the firm is identified, investigated and reported where appropriate.",
  riskThemes: ["money_laundering", "tax_evasion"],
  applicableFirmTypes: ["bank", "neobank", "msb", "emi"],
  typologySlugs: [
    "cash-intensive-business-integration",
    "unusual-business-vs-declared-profile",
    "cuckoo-smurfing",
  ],
  enforcementRefs: [
    { firm: "National Westminster Bank Plc", year: 2021 },
    { firm: "Santander UK Plc", year: 2022 },
  ],
  dataInputs: [
    "Cash deposit transactions (amount, date, channel: branch, ATM, agent, post office)",
    "Customer declared expected monthly turnover / income at onboarding",
    "Declared business type / SIC code and source of funds",
    "Historic cash deposit baseline per customer (rolling average)",
    "Depositing party identity where captured (third-party payer)",
  ],
  ruleLogic:
    "For each customer, aggregate cash credits over the lookback window and compare against the declared expected cash turnover. Raise an alert where cumulative cash deposits materially exceed the declared expectation, where cash forms an implausible share of total credits for the declared business type, or where the cash baseline jumps sharply with no documented explanation. Sub-rules: (a) ratio breach vs declared turnover, (b) absolute volume breach, (c) sudden uplift vs 6-month baseline.",
  defaultThreshold:
    "Cumulative cash deposits > 3x declared expected monthly cash turnover in a rolling 30 days, OR cash > 80% of total credits where the declared profile is not cash-intensive.",
  thresholdRationale:
    "A 3x multiple over the customer's own stated expectation captures genuine anomalies while tolerating normal seasonal and lumpy trading variance, so the firm is not chasing every customer whose turnover ticks up. The 80% cash-share rule catches integration of cash into accounts (e.g. a consultancy or e-commerce business that should be card-led) that a pure volume rule would miss. Both anchor to the customer's own declared profile rather than a flat industry number, which is the calibration NatWest was criticised for not doing.",
  lookbackWindow: "Rolling 30 days for ratio breach; rolling 6 months for baseline-uplift detection.",
  tuningNotes:
    "Expect this rule to be noisy at launch for genuinely cash-intensive segments (retail, hospitality, car washes), so segment thresholds by declared business type before go-live. Start in observation mode for 4 to 6 weeks to size alert volume, then calibrate the multiple per segment to hold true-positive yield above roughly 8 to 10% per scenario. Most false positives come from stale or absent expected-turnover data, so prioritise refreshing declared-turnover fields over loosening the threshold. Suppress repeat alerts on the same already-reviewed pattern within 30 days to avoid analyst fatigue.",
  firstLineOwner: "Financial Crime Operations Analyst (transaction monitoring team)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Transaction monitoring platform (e.g. rules engine with peer-group and ratio scenarios)",
    "Customer risk profile / expected-activity store",
    "Case management system for alert triage and SAR drafting",
  ],
  escalation:
    "Confirmed anomalies with no plausible documented explanation are escalated by the first-line analyst to the MLRO with a recommendation, who decides on a SAR to the NCA and any account restriction. Source-of-funds queries to the customer are raised before, not instead of, escalation.",
  sla: "Alert triaged within 3 business days; SAR decision by MLRO within 5 business days of a confirmed anomaly.",
  metrics: [
    {
      name: "True positive yield",
      target: ">= 10%",
      description: "Proportion of alerts that result in a confirmed anomaly or SAR, per scenario.",
    },
    {
      name: "Expected-turnover coverage",
      target: ">= 95%",
      description: "Share of in-scope customers with a current declared expected cash turnover on file.",
    },
    {
      name: "Alert ageing",
      target: "0 alerts > 10 business days open",
      description: "Backlog of untriaged cash-anomaly alerts.",
    },
  ],
  testPlan: [
    "Inject synthetic customers with declared low-cash profiles and feed cash credits at 2x, 3x and 5x expected turnover; confirm only the 3x and 5x cases alert.",
    "Replay a known historic cuckoo-smurfing pattern (multiple sub-threshold third-party cash deposits) and confirm the aggregation rule fires.",
    "Set a customer's expected-turnover field to null and confirm the alert routing flags missing reference data rather than silently passing.",
    "Back-test the rule over 6 months of production data and confirm true-positive yield and alert volume sit within calibration targets per segment.",
  ],
  reviewCadence: "Threshold and segment calibration reviewed quarterly; scenario logic reviewed annually or on material product change.",
  governance: [
    "MLRO approves threshold and segment calibration at the quarterly Financial Crime Risk Committee.",
    "Calibration changes recorded with rationale and before/after volume impact in a model-change log.",
    "Annual independent validation of scenario coverage and threshold appropriateness retained as evidence.",
  ],
  whatGoodLooksLike: [
    "Thresholds are anchored to each customer's declared profile and segmented by business type, not a single firm-wide number.",
    "Expected-turnover data is captured at onboarding and refreshed, so the rule has a meaningful baseline to compare against.",
    "Every alert disposition records the documented explanation (or its absence) and feeds back into tuning.",
  ],
  strongVsWeak: {
    strong:
      "A neobank segments cash-deposit thresholds by declared SIC code, refreshes expected turnover at each annual review, and alerts when a 'management consultancy' starts receiving 90% of its credits as branch cash at 4x its stated turnover; the analyst raises a source-of-funds query, gets no satisfactory answer, and the MLRO files a SAR.",
    weak:
      "A bank applies a single flat cash threshold across all customers, never refreshes the onboarding turnover figure, and only reviews cash when an external tip-off arrives; large cash credits inconsistent with the customer's declared profile pass unexamined for years.",
  },
  sources: [
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "R.10",
      title: "FATF Recommendation 10: Customer due diligence and ongoing monitoring",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "MLR",
      reference: "reg.28(11)",
      title: "Money Laundering Regulations 2017, reg.28(11): ongoing monitoring",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
  ],
};
