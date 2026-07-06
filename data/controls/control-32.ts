import type { Control } from "./types";

export const control32: Control = {
  id: 32,
  slug: "monitoring-coverage-reconciliation",
  name: "Monitoring Coverage Reconciliation",
  category: "ongoing_monitoring",
  controlType: "detective",
  plainSummary:
    "The firm regularly proves that every account and every payment is actually being watched by its monitoring system, so nothing slips through an un-monitored gap.",
  objective:
    "Continuously reconcile the population of customers, accounts and transactions in the firm's books against what the transaction monitoring and screening systems are actually ingesting, so that no account or product line is left without coverage.",
  plainObjective: "Regularly checks that every customer, account and transaction on the firm's books is actually being fed into its monitoring and screening systems, so nothing is left uncovered.",
  plainHowItWorks: "On a set cycle it compares the ledger's true list of accounts and transactions against what monitoring and screening actually took in, raising any missing account, unmapped product or count mismatch as a gap.",
  plainWhyThreshold: "Accounts never added to monitoring are a known failure, so coverage is zero-tolerance, while a small count tolerance absorbs normal timing differences yet still catches whole feeds that fail.",
  riskThemes: ["money_laundering", "fraud", "sanctions_evasion", "terrorist_financing"],
  applicableFirmTypes: ["bank", "emi", "neobank", "msb", "wealth_manager", "pi", "crypto", "insurance"],
  typologySlugs: ["mule-account-activity", "unusual-business-vs-declared-profile"],
  enforcementRefs: [{ firm: "Metro Bank plc", year: 2024 }],
  dataInputs: [
    "Source-of-truth account and customer master (core banking / ledger)",
    "Transaction monitoring system ingested-account and ingested-transaction lists",
    "Screening system covered-population list",
    "Product and channel catalogue (every product, scheme and corridor that can move money)",
    "Daily transaction counts and values by product from the ledger",
    "Onboarding feed of newly created accounts",
  ],
  ruleLogic:
    "On a fixed cycle, take the authoritative population of accounts and transactions from the ledger and reconcile it line for line against what the monitoring and screening systems ingested. Any account present in the ledger but absent from monitoring, any product/channel not mapped to a monitoring scenario, and any day where ingested transaction counts or values diverge from the ledger beyond tolerance, is raised as a coverage gap. Gaps are tracked to closure with backfill of the missed period.",
  defaultThreshold:
    "Daily transaction-count reconciliation with a 0.1 percent variance tolerance; weekly full account-population reconciliation; zero tolerance for any account, product line or payment channel with no mapped monitoring scenario.",
  thresholdRationale:
    "Accounts that were never onboarded into monitoring are a known systemic failure mode, so coverage is treated as a hard, zero-tolerance control rather than a risk-scored one. A small count-variance tolerance allows for legitimate timing and in-flight items while still catching whole streams that fail to ingest; daily counts catch feed breaks fast, and weekly population reconciliation catches accounts that exist but were never enrolled.",
  lookbackWindow:
    "Daily counts reconciled same day; account population reconciled weekly; a full historical coverage attestation performed at least annually.",
  tuningNotes:
    "The aim is not alert tuning but completeness, so tune the variance tolerance only enough to absorb genuine timing differences between ledger cut-off and feed cut-off. Expect most gaps at product launches, system migrations and new channel rollouts, so tighten reconciliation around change events. Every confirmed gap should trigger a backfill of the un-monitored period and a root-cause fix to the feed, not just a one-off catch-up.",
  firstLineOwner: "Financial Crime Systems / Monitoring Operations team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Data reconciliation / control framework (e.g. data quality engine, Gresham-style recon)",
    "Transaction monitoring system ingestion logs",
    "Screening system coverage reports",
    "Core ledger / data warehouse as source of truth",
  ],
  escalation:
    "Any account, product or channel found with no monitoring coverage is escalated immediately to the MLRO, the un-monitored period is backfilled and reviewed for suspicious activity, and a root-cause fix is logged; material or prolonged gaps are reported to senior management and considered for regulatory notification.",
  sla: "Daily count breaks investigated same day; coverage gaps (un-monitored accounts/products) escalated within 1 business day and backfilled within 5 business days.",
  metrics: [
    {
      name: "Monitoring coverage completeness",
      target: "100% of accounts and payment channels under monitoring",
      description: "Share of the ledger population confirmed ingested by monitoring and screening.",
    },
    {
      name: "Daily reconciliation pass rate",
      target: ">= 99.9% of days within variance tolerance",
      description: "Days where ingested counts and values match the ledger within tolerance.",
    },
    {
      name: "Gap closure time",
      target: "Median < 5 business days to backfill and fix",
      description: "Time from detecting a coverage gap to backfilling the missed period and fixing the feed.",
    },
  ],
  testPlan: [
    "Create a new account in the ledger and deliberately exclude it from the monitoring feed, then confirm the weekly population reconciliation flags it as un-monitored.",
    "Drop one product's transaction feed for a day and confirm the daily count variance breaches tolerance and raises a break.",
    "Introduce a new payment channel with no mapped scenario and confirm the unmapped-channel check flags it before it goes live.",
    "Take a confirmed gap end to end and verify the un-monitored period is backfilled, reviewed for SARs and the feed root cause is fixed.",
  ],
  reviewCadence: "Reconciliation results reviewed daily/weekly by operations; coverage attestation reviewed by the MLRO monthly and audited annually.",
  governance: [
    "MLRO owns the coverage attestation and signs off that the monitored population matches the book.",
    "Monthly coverage MI and any open gaps reported to the Financial Crime Committee.",
    "Every coverage gap logged with root cause, backfill evidence and remediation, retained for five years.",
    "Internal Audit independently tests coverage completeness at least annually.",
  ],
  whatGoodLooksLike: [
    "The monitored population is reconciled to the ledger as the source of truth, not assumed to match.",
    "New products and channels cannot go live without a mapped monitoring scenario.",
    "Coverage gaps are rare, found fast, backfilled and root-caused rather than quietly tolerated.",
    "There is a signed periodic attestation that every account is under monitoring.",
  ],
  strongVsWeak: {
    strong:
      "A migration leaves 4,000 legacy accounts out of the new monitoring feed; the weekly population reconciliation flags the shortfall the same week, the accounts are reconnected, the un-monitored period is backfilled and reviewed, two SARs result, and the feed defect is fixed and attested.",
    weak:
      "The same 4,000 accounts sit outside monitoring for two years because nobody ever reconciled the monitored population against the ledger; the firm believes everything is covered until a regulator finds whole account cohorts that were never onboarded into monitoring at all.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.28(11) ongoing monitoring",
      title: "The Money Laundering Regulations 2017",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Standards",
      title: "Wolfsberg Standards - Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Monitoring Systems and Controls",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
