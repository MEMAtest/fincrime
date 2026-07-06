import type { Control } from "./types";

export const control14: Control = {
  id: 14,
  slug: "high-risk-corridor-monitoring",
  name: "High-Risk Corridor & Geography Monitoring",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Watches payments to and from higher-risk countries and routes, and flags activity that does not fit the customer or looks designed to disguise where money is really going.",
  objective:
    "Detect transactions involving higher-risk jurisdictions and corridors that are inconsistent with the customer's profile or show signs of disguised routing, so that exposure to money laundering, terrorist financing, sanctions evasion and proliferation financing through geography is identified and investigated.",
  plainObjective: "This control watches payments to and from higher-risk countries that do not fit the customer or look disguised, so money laundering, terrorist financing and sanctions risks through geography are caught.",
  plainHowItWorks: "It rates each cross-border payment using the firm's country-risk list and the customer's stated countries, flagging risky routes not in their profile, unusually high value, disguised routing, or missing sender details.",
  plainWhyThreshold: "Even one payment to a risky country the customer never mentioned is worth a look because geography alone says a lot, plus a separate rule catches small frequent payments.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "proliferation_financing",
  ],
  applicableFirmTypes: ["bank", "msb", "emi", "pi", "crypto"],
  typologySlugs: [
    "high-risk-corridor-remittances",
    "low-value-tf-high-risk-countries",
    "third-party-round-tripping",
  ],
  enforcementRefs: [
    { firm: "Commerzbank AG", year: 2020 },
    { firm: "Deutsche Bank AG", year: 2017 },
  ],
  dataInputs: [
    "Cross-border payment data with originating and beneficiary country, intermediary banks and currency",
    "Firm's country risk rating model (high-risk third countries, FATF lists, sanctions-adjacent geographies)",
    "Customer declared geographies and expected corridors",
    "Wire-transfer payload completeness (originator/beneficiary info per the travel rule)",
    "Routing data showing intermediary or transit jurisdictions",
  ],
  ruleLogic:
    "Score each cross-border transaction against the firm's country risk model and the customer's declared geographies. Raise alerts where a customer transacts with a high-risk corridor not in their profile, where value to high-risk jurisdictions exceeds expectations, where routing passes through a transit jurisdiction that masks the true origin or destination, or where wire payloads are incomplete for high-risk corridors. Sub-rules: (a) high-risk corridor outside declared profile, (b) cumulative high-risk geography value breach, (c) transit-jurisdiction round-tripping, (d) low-value but high-frequency flows to TF-risk geographies.",
  defaultThreshold:
    "Any payment to/from a high-risk jurisdiction not in the customer's declared geographies; OR cumulative value to high-risk corridors > 2x declared expectation in a rolling 30 days; OR 5+ low-value payments to a single TF-risk geography in a rolling 30 days.",
  thresholdRationale:
    "A single payment to an out-of-profile high-risk jurisdiction is itself meaningful because geography is one of the strongest standalone risk indicators, so this is intentionally sensitive rather than volume-gated. The 2x cumulative rule then catches escalation within already-expected corridors. The separate low-value high-frequency rule exists because terrorist financing is characteristically low-value, so a value-only model would systematically miss it; this directly addresses the Commerzbank-type failing of weak monitoring over high-risk correspondent and corridor flows. Tying everything to the firm's own country risk model keeps the rule defensible and updatable as lists change.",
  lookbackWindow: "Per-transaction screening at execution; rolling 30 days for cumulative-value and frequency rules.",
  tuningNotes:
    "The out-of-profile corridor rule can be high volume for firms with diaspora or remittance customers, so the most important calibration is an accurate country risk model and well-maintained customer geography profiles rather than a blunt threshold. Run 4 weeks in observation, segment expected corridors by customer base, and target true-positive yield above 8%. The low-value TF rule is intentionally sensitive and lower-yield by design; do not tune it on yield alone given the severity of the risk it covers. Suppress repeat alerts on an established, reviewed and documented legitimate corridor for the same customer.",
  firstLineOwner: "Financial Crime Operations Analyst (transaction monitoring / sanctions-adjacent)",
  secondLineOwner: "MLRO / Financial Crime Compliance (with sanctions team input)",
  suggestedSystems: [
    "Transaction monitoring platform with country-risk-weighted corridor scenarios",
    "Country risk model / list-management service (FATF high-risk lists, internal ratings)",
    "Wire-payload completeness checker and case management system",
  ],
  escalation:
    "Out-of-profile or anomalous high-risk corridor activity is escalated to the MLRO, with a parallel referral to the sanctions team where any sanctions or proliferation nexus is suspected, EDD on the corridor purpose and counterparties, and a SAR where the activity is unexplained. Incomplete wire payloads on high-risk corridors trigger a payment hold or RFI rather than straight-through processing.",
  sla: "Corridor alert triaged within 2 business days; sanctions-nexus alerts triaged same day and routed to the sanctions team; MLRO SAR decision within 5 business days of confirmation.",
  metrics: [
    {
      name: "True positive yield",
      target: ">= 8%",
      description: "Proportion of corridor alerts leading to EDD escalation, SAR or sanctions referral.",
    },
    {
      name: "Country model freshness",
      target: "Updated within 5 business days of list change",
      description: "Lag between an external high-risk list change and the model reflecting it.",
    },
    {
      name: "Wire-payload completeness",
      target: ">= 99%",
      description: "Share of high-risk corridor wires with complete originator/beneficiary information.",
    },
  ],
  testPlan: [
    "Send a payment to a high-risk jurisdiction absent from a customer's declared geographies; confirm the out-of-profile rule fires.",
    "Generate 6 low-value payments to a single TF-risk geography in a month; confirm the low-value high-frequency rule fires even though no single payment is large.",
    "Add a country to the high-risk list and confirm the model and rule reflect it within the freshness target.",
    "Route a payment through a transit jurisdiction that masks the ultimate beneficiary country and confirm the round-tripping rule flags the routing.",
  ],
  reviewCadence: "Country risk model reviewed on every external list change and at least quarterly; corridor thresholds reviewed quarterly; scenario logic reviewed annually.",
  governance: [
    "MLRO and sanctions lead jointly approve the country risk model and corridor thresholds.",
    "List-change updates to the model are logged with effective dates to evidence timely currency.",
    "Documented legitimate-corridor suppressions are dual-approved and periodically re-validated.",
  ],
  whatGoodLooksLike: [
    "Detection is driven by a current, governed country risk model that updates promptly when external lists change.",
    "A dedicated low-value high-frequency rule exists so terrorist-financing-shaped flows are not lost beneath value thresholds.",
    "Sanctions and proliferation nexuses are routed to the sanctions team in parallel, not handled solely as generic AML alerts.",
  ],
  strongVsWeak: {
    strong:
      "An MSB maintains a country risk model that refreshes within days of FATF list changes, alerts when a customer declared as sending only to one corridor begins making frequent low-value payments to a TF-risk geography, runs EDD, finds no credible purpose and files a SAR while referring a possible sanctions nexus to the sanctions desk.",
    weak:
      "A bank relies on a country list last updated 18 months ago, monitors only large cross-border values, and processes frequent small payments to a high-risk geography straight through with incomplete wire payloads, leaving disguised routing and low-value TF flows entirely unmonitored.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.16",
      title: "FATF Recommendation 16: Wire transfers",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
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
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
