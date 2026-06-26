import type { Control } from "./types";

export const control16: Control = {
  id: 16,
  slug: "tm-scenario-coverage-assurance",
  name: "Transaction-Monitoring Scenario Coverage Assurance",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Checks that the firm's monitoring rules actually cover the risks the firm faces, so no major money-laundering pattern is left with no rule watching for it.",
  objective:
    "Provide assurance that the deployed transaction-monitoring scenario set fully and demonstrably covers the firm's assessed money-laundering, terrorist-financing and sanctions-evasion risks across products, customers and geographies, so that coverage gaps are identified and remediated before they become enforcement findings.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
    "proliferation_financing",
  ],
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
    "high-risk-corridor-remittances",
  ],
  enforcementRefs: [
    { firm: "HSBC Bank plc", year: 2021 },
    { firm: "National Westminster Bank Plc", year: 2021 },
    { firm: "Metro Bank plc", year: 2024 },
  ],
  dataInputs: [
    "Firm-wide and business-line risk assessments (typologies, products, customers, geographies in scope)",
    "Inventory of deployed monitoring scenarios with the risk each addresses",
    "Coverage matrix mapping each assessed risk/typology to one or more live scenarios",
    "Data-feed completeness reports (products, channels and accounts actually flowing into the TM system)",
    "Population analysis of customer/product segments versus scenario applicability",
  ],
  ruleLogic:
    "Maintain and periodically test a coverage matrix that maps every assessed risk and typology to at least one deployed, active scenario, and every in-scope product, channel and account population to a data feed reaching the TM engine. Raise a coverage exception where a risk has no mapped scenario, where a scenario is mapped but inactive or not parameterised for a segment, or where a product/channel is in scope but its data does not reach the engine. This is a meta-control over the scenario estate rather than a transaction-level rule.",
  defaultThreshold:
    "Zero unmapped assessed risks and zero in-scope product/channel populations missing from TM data feeds; any single coverage gap is an exception requiring a remediation plan with an owner and date.",
  thresholdRationale:
    "Coverage assurance is binary at the level that matters: either a risk the firm has assessed is watched by a live scenario fed with the right data, or it is a gap. A percentage tolerance would normalise leaving some assessed risks unmonitored, which is precisely the failing behind several large fines where products or accounts were never connected to monitoring. Treating every gap as a tracked exception with an owner and date, rather than an acceptable error rate, keeps the control honest and auditable and forces remediation rather than risk-acceptance by omission.",
  lookbackWindow: "Full coverage assessment quarterly; data-feed completeness reconciled monthly; ad hoc on any product launch or risk-assessment change.",
  tuningNotes:
    "This control's effectiveness depends on the risk assessment and scenario inventory being accurate and current, so the main 'tuning' is keeping those source artefacts complete rather than adjusting a numeric threshold. Common silent gaps are new products or channels onboarded without a TM data feed, dormant scenarios switched off during an upgrade and never re-enabled, and segments excluded by scenario parameters. Reconcile the live scenario list extracted directly from the production engine against the documented inventory, since the documented list drifts from reality. Volume here is a handful of exceptions per cycle; the risk is false comfort from a stale matrix, not alert overload.",
  firstLineOwner: "TM / Detection Engineering Lead (scenario estate owner)",
  secondLineOwner: "MLRO / Financial Crime Compliance (assurance and challenge)",
  suggestedSystems: [
    "Transaction monitoring platform with an exportable live-scenario inventory",
    "Risk assessment and control-mapping repository (coverage matrix)",
    "Data-lineage / feed-reconciliation tooling and issue/remediation tracker",
  ],
  escalation:
    "Each coverage gap is logged as a financial crime issue with an owner, remediation plan and target date, and reported to the MLRO. Material gaps (an in-scope product with no monitoring) are escalated to the Financial Crime Risk Committee and, where they meet the threshold, considered for regulatory notification.",
  sla: "Coverage exceptions raised within 5 business days of the assessment; interim mitigation (e.g. manual review) agreed within 10 business days; remediation tracked to the committed date.",
  metrics: [
    {
      name: "Risk-to-scenario coverage",
      target: "100%",
      description: "Assessed risks/typologies mapped to at least one live, parameterised scenario.",
    },
    {
      name: "TM data-feed completeness",
      target: "100%",
      description: "In-scope product/channel populations whose data reaches the TM engine.",
    },
    {
      name: "Coverage-gap remediation timeliness",
      target: ">= 95% on time",
      description: "Coverage exceptions remediated by their committed date.",
    },
  ],
  testPlan: [
    "Extract the live scenario list from the production TM engine and reconcile against the documented inventory; confirm no documented scenario is inactive and no live scenario is undocumented.",
    "Take three assessed typologies from the latest risk assessment and trace each to a specific live scenario and its data feed; confirm a clear mapping exists.",
    "Inject a test transaction for a recently launched product/channel and confirm it reaches the TM engine and triggers an applicable scenario.",
    "Deliberately disable a scenario in a test environment and confirm the coverage assessment surfaces it as a gap.",
  ],
  reviewCadence: "Coverage matrix reviewed quarterly and on every material risk-assessment change or product launch; methodology reviewed annually.",
  governance: [
    "MLRO attests quarterly to the Financial Crime Risk Committee that the coverage matrix is complete and gaps are tracked.",
    "Coverage exceptions and their remediation are recorded in the firm's issue-management framework with named owners.",
    "Independent validation periodically re-performs the coverage reconciliation rather than relying on the first-line attestation.",
  ],
  whatGoodLooksLike: [
    "A live coverage matrix maps every assessed risk to a specific active scenario and every in-scope product to a verified data feed.",
    "The scenario inventory is reconciled against what is actually running in production, not just what is documented.",
    "New products and channels cannot go live without a confirmed TM data feed and applicable scenario.",
  ],
  strongVsWeak: {
    strong:
      "A bank reconciles its production scenario list against its risk assessment each quarter, catches that a newly launched marketplace-payouts product was onboarded without a TM feed, logs it as a gap with an owner and date, applies interim manual review, and connects the feed before the next cycle.",
    weak:
      "A bank assumes its TM system covers everything because it was 'set up years ago', never reconciles live scenarios to its current risk assessment, and only discovers during a regulatory visit that an entire product line and several account populations were never connected to monitoring at all.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.1",
      title: "FATF Recommendation 1: Assessing risks and applying a risk-based approach",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Transaction Monitoring",
      title: "Wolfsberg Statement on Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "MLR",
      reference: "reg.28(11)",
      title: "Money Laundering Regulations 2017, reg.28(11): ongoing monitoring",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
  ],
};
