import type { Control } from "./types";

export const control03: Control = {
  id: 3,
  slug: "expected-activity-profiling",
  name: "Expected Activity Profiling at Onboarding",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "At sign-up, ask and record what normal looks like for this customer (how much, how often, to where) so monitoring can later spot when they behave nothing like that.",
  objective:
    "Obtain and record information on the purpose and intended nature of the business relationship under reg.28(2)(c) of the MLR 2017, establishing a documented expected-activity baseline that ongoing monitoring can compare actual behaviour against.",
  riskThemes: ["money_laundering", "fraud", "tax_evasion"],
  applicableFirmTypes: [
    "emi",
    "pi",
    "bank",
    "msb",
    "crypto",
    "neobank",
    "wealth_manager",
  ],
  typologySlugs: [
    "unusual-business-vs-declared-profile",
    "high-risk-corridor-remittances",
  ],
  enforcementRefs: [{ firm: "Commerzbank AG", year: 2020 }],
  dataInputs: [
    "Declared purpose of the account / relationship",
    "Expected monthly turnover and per-transaction value range",
    "Expected transaction frequency and channels (card, transfer, cash)",
    "Expected counterparties, sectors and destination/source countries",
    "Source of incoming funds and nature of business or occupation",
    "Industry / occupation code and, for entities, trading model",
    "Expected products and services to be used",
    "Customer risk rating to set the depth of questions required",
  ],
  ruleLogic:
    "At onboarding, collect a structured expected-activity profile sized to the customer risk rating (light for low-risk, detailed for higher-risk). Validate internal consistency: declared turnover against stated occupation/income, declared geographies against the customer's footprint, declared product use against the account type. Store the profile in machine-readable fields (not free text) so transaction monitoring can compare actuals to expectations. If declared activity is internally inconsistent, implausibly high for the profile, or contradicts other CDD evidence, hold for review before activation.",
  defaultThreshold:
    "Profile mandatory for all customers; for higher-risk customers require itemised expected monthly turnover, expected corridors and expected counterparties. Flag for review where declared turnover exceeds 3x the income/turnover implied by occupation or filed accounts, or where declared geographies include high-risk jurisdictions not explained by the stated business.",
  thresholdRationale:
    "reg.28(2)(c) requires understanding the purpose and intended nature of the relationship, and a baseline is only useful to monitoring if it is structured and plausibility-checked. The 3x gap between declared activity and provable income is a defensible trigger because it is wide enough to allow legitimate variation yet catches profiles inflated to pre-authorise laundering volumes; Commerzbank was fined partly for weak, unmaintained customer profiles that let unusual activity pass as normal. Firms should tighten the multiplier for cash-intensive or high-risk sectors.",
  lookbackWindow:
    "Set at onboarding; reviewed at periodic CDD review and refreshed when actual activity diverges materially from profile or on a trigger event.",
  tuningNotes:
    "Avoid one giant questionnaire for everyone: low-risk retail customers should answer a few fields, while corporate and high-risk customers warrant detailed expected-counterparty and corridor capture. The profile is only worth collecting if monitoring actually consumes it, so test the end-to-end link. Watch for customers who declare implausibly wide ranges to pre-empt every alert (the 'I might do anything' profile) and treat over-broad declarations as a flag, not a free pass.",
  firstLineOwner: "Onboarding / KYC Operations team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Onboarding platform with structured expected-activity fields",
    "Customer risk-rating engine to scale question depth",
    "Transaction monitoring system that ingests the profile as a baseline",
    "Income/turnover corroboration source (payslip, bank data, filed accounts)",
    "Case management workflow for profile-plausibility holds",
  ],
  escalation:
    "Internally inconsistent or implausible declared activity routes to a KYC analyst; unresolved inconsistency or a profile that suggests deliberate misrepresentation escalates to the MLRO. Activation is held until the profile is plausible and consistent with other CDD, or the relationship is declined.",
  sla: "Profile captured at onboarding; plausibility review for flagged cases cleared within 1 business day; profile must be in place before transactional limits are released.",
  metrics: [
    { name: "Profile completeness", target: ">=98%", description: "Active customers with a complete, structured expected-activity profile sized to their risk rating" },
    { name: "Profile-to-monitoring linkage", target: "100%", description: "Customers whose stored profile actually feeds the transaction monitoring baseline" },
    { name: "Plausibility-hold rate", target: "Monitored by segment", description: "Onboardings held for inconsistent declared activity, trended by sector and channel" },
    { name: "Profile staleness", target: "<10%", description: "Customers whose profile has not been refreshed within its review cycle" },
  ],
  testPlan: [
    "Onboard a test customer declaring turnover far above their stated occupation and confirm the 3x plausibility rule holds the case for review.",
    "Confirm a captured profile is readable by the transaction monitoring system by simulating activity outside the declared corridor and checking an alert fires.",
    "Submit a profile with internally contradictory fields (e.g. domestic-only purpose but high-risk-corridor counterparties) and confirm it is flagged.",
    "Sample 25 active customers and confirm each has a structured, non-empty profile and that low-risk and high-risk customers were asked proportionate questions.",
  ],
  reviewCadence:
    "Plausibility rules and question sets reviewed semi-annually; individual profiles refreshed at periodic review or on material divergence from actual activity.",
  governance: [
    "MLRO approves the expected-activity question sets and plausibility thresholds per risk tier.",
    "Profiles stored as structured data and retained for the relationship plus 5 years.",
    "Plausibility-hold overrides require a documented rationale and are sampled by second line.",
    "Profile completeness and staleness metrics reported to the financial crime committee quarterly.",
  ],
  whatGoodLooksLike: [
    "Every customer has a structured baseline that monitoring can mathematically compare actuals against.",
    "Question depth scales with risk, so low-risk customers are not over-burdened and high-risk ones are properly probed.",
    "Declared activity is sanity-checked against income, occupation and geography, not just stored.",
    "Profiles are refreshed when behaviour drifts, so the baseline stays meaningful over time.",
  ],
  strongVsWeak: {
    strong:
      "An EMI onboarding a small importer captures expected monthly turnover of GBP 40k, expected corridors (UK-Germany-Poland), main counterparties and product mix as structured fields, checks turnover against filed accounts, and wires the profile into monitoring so a sudden GBP 300k flow to an unrelated high-risk corridor alerts.",
    weak:
      "A firm records 'business payments' in a free-text box, asks every customer the same single question, never checks declared turnover against anything, and stores it where the monitoring system cannot read it, so no actual behaviour can ever be judged abnormal.",
  },
  sources: [
    { org: "MLR", reference: "reg.28 CDD measures", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.10 Customer due diligence", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
};
