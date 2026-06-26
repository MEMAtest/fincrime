import type { Control } from "./types";

export const control10: Control = {
  id: 10,
  slug: "activity-vs-expected-profile-monitoring",
  name: "Activity vs Expected Profile Monitoring",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Compares what a customer actually does on the account with what they told you they would do at sign-up, and flags when the two no longer match.",
  objective:
    "Detect material divergence between a customer's observed transactional behaviour and the expected activity profile captured at onboarding, so that accounts being used for a purpose other than the one disclosed are identified, the profile is refreshed and suspicious use is investigated.",
  riskThemes: ["money_laundering", "fraud", "tax_evasion"],
  applicableFirmTypes: ["bank", "neobank", "emi", "pi", "wealth_manager"],
  typologySlugs: [
    "unusual-business-vs-declared-profile",
    "behavioural-change-indicators",
    "mule-account-activity",
  ],
  enforcementRefs: [
    { firm: "Santander UK Plc", year: 2022 },
    { firm: "Starling Bank Limited", year: 2024 },
  ],
  dataInputs: [
    "Expected activity profile captured at onboarding (expected volume, value, counterparties, geographies, product use)",
    "Observed transaction history (counts, values, in/out ratio, counterparty count, currencies, corridors)",
    "Customer type, declared occupation / business and stated account purpose",
    "Account age and behavioural baseline (rolling)",
    "Prior alert and review history",
  ],
  ruleLogic:
    "Score observed activity against the declared expected profile across several dimensions (monthly throughput vs expected, number and type of counterparties vs expected, geographies vs declared, product use vs declared purpose). Raise an alert where one or more dimensions breach the agreed divergence tolerance, weighting hardest breaches such as a personal account behaving like a business pass-through, or a domestic-only declaration sending to high-risk corridors.",
  defaultThreshold:
    "Monthly throughput > 3x declared expected throughput in a rolling 30 days, OR appearance of a transaction dimension not in the declared profile (e.g. first international payment on a 'domestic only' account, or first business-pattern flow on a personal account).",
  thresholdRationale:
    "A 3x throughput multiple over the customer's own declared figure tolerates organic growth and lumpy months while still catching step-changes that signal repurposing of the account. The 'new dimension' trigger matters because the most material profile breaches are categorical (a stated-domestic account suddenly transacting cross-border), not just larger versions of expected behaviour; a pure value threshold would miss those entirely. Anchoring to the declared figure, not a peer average, gives the analyst a defensible reference point and a clear customer-outreach question.",
  lookbackWindow: "Rolling 30 days for throughput; rolling 90 days for counterparty and geography-set change detection.",
  tuningNotes:
    "Expect early volume to be driven by stale or thin onboarding profiles rather than real risk, so the single biggest tuning lever is profile-data quality, not threshold width. Run 4 weeks in observation mode, measure how many alerts trace to missing or never-refreshed expected-activity fields, and fix those before loosening tolerances. Hold true-positive yield above roughly 8% per dimension. Suppress repeat alerts where a profile has already been refreshed to match the new behaviour and the change was benign and documented.",
  firstLineOwner: "Financial Crime Operations Analyst (transaction monitoring team)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Transaction monitoring platform with profile-comparison / peer-deviation scenarios",
    "Customer expected-activity profile store linked to CDD records",
    "Case management system with profile-refresh workflow",
  ],
  escalation:
    "Where divergence cannot be explained by the customer or documentary evidence, the analyst escalates to the MLRO who decides on a SAR, an enhanced due diligence refresh and any restriction. Benign-but-real changes trigger a mandatory expected-profile update so the baseline stays accurate.",
  sla: "Alert triaged within 3 business days; customer outreach or EDD initiated within 5 business days; MLRO SAR decision within 5 business days of a confirmed unexplained divergence.",
  metrics: [
    {
      name: "True positive yield",
      target: ">= 8%",
      description: "Proportion of profile-divergence alerts leading to a SAR, restriction or material profile correction.",
    },
    {
      name: "Profile freshness",
      target: ">= 90%",
      description: "Share of in-scope customers with an expected-activity profile reviewed within the last 12 months.",
    },
    {
      name: "Profile-refresh closure",
      target: "100%",
      description: "Benign-but-real divergences that result in an updated expected-activity profile.",
    },
  ],
  testPlan: [
    "Create a synthetic 'domestic personal' customer, then post a first international payment to a high-risk corridor; confirm the new-dimension trigger fires.",
    "Ramp a customer's throughput to 2x, 3x and 4x declared expected and confirm only 3x and above alert.",
    "Confirm that a documented benign divergence which refreshes the profile suppresses subsequent duplicate alerts for the same pattern.",
    "Back-test over 90 days and verify alert volume and yield per dimension sit within calibration targets, and that thin profiles are surfaced for remediation.",
  ],
  reviewCadence: "Divergence tolerances reviewed quarterly; dimension weighting and scenario logic reviewed annually or on product change.",
  governance: [
    "MLRO signs off divergence tolerances and weightings at the quarterly Financial Crime Risk Committee.",
    "Profile-refresh outcomes are logged so the firm can evidence that expected-activity data is kept current under reg.28(11).",
    "Independent annual validation confirms the rule's dimensions still reflect the firm's product and customer mix.",
  ],
  whatGoodLooksLike: [
    "Expected activity is captured in structured fields at onboarding and refreshed at review, not free-text that the rule cannot read.",
    "Categorical breaches (new geography, new product use, personal-to-business shift) are weighted alongside pure value breaches.",
    "Every benign divergence updates the profile, so the baseline does not drift and re-alert.",
  ],
  strongVsWeak: {
    strong:
      "An EMI captures expected counterparties, geographies and monthly value as structured fields, and alerts when a sole-trader account declared as UK-domestic begins routing funds to three new high-risk corridors at 4x expected value; EDD finds no commercial rationale and the MLRO files a SAR and exits the relationship.",
    weak:
      "A bank stores 'account purpose: business' as free text, never refreshes it, and only the value of payments is monitored; an account repurposed as a cross-border pass-through grows quietly because the categorical change was never modelled and the throughput rise looked like growth.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.28(11)",
      title: "Money Laundering Regulations 2017, reg.28(11): ongoing monitoring",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FATF",
      reference: "R.10",
      title: "FATF Recommendation 10: Customer due diligence and ongoing monitoring",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
  ],
};
