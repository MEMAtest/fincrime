import type { Control } from "./types";

export const control19: Control = {
  id: 19,
  slug: "sanctions-screening-coverage-testing",
  name: "Sanctions Screening Coverage & Calibration Testing",
  category: "screening",
  controlType: "detective",
  plainSummary:
    "Regularly tests the sanctions screening engine with known good and bad names to prove it actually catches what it should and is not silently letting hits through.",
  objective:
    "Provide independent, evidence-based assurance that the sanctions screening solution screens the full population, ingests every list completely, and detects true matches at the configured threshold, so that coverage gaps and miscalibration are found by the firm before a regulator finds them.",
  riskThemes: ["sanctions_evasion", "proliferation_financing", "terrorist_financing"],
  applicableFirmTypes: ["emi", "pi", "bank", "msb", "crypto", "neobank", "wealth_manager", "insurance"],
  typologySlugs: ["sanctions-evasion-via-intermediaries", "proliferation-financing"],
  enforcementRefs: [{ firm: "Starling Bank Limited", year: 2024 }],
  dataInputs: [
    "Full customer and counterparty population counts versus screened counts for the test period",
    "List version manifests and entry counts from the data provider versus what the engine actually loaded",
    "Configured match thresholds, name-matching algorithm settings and whitelist contents",
    "A maintained library of test names: exact list names, transliteration variants, alias and reversed-order variants, and negative controls",
    "Historical alert and disposition data for back-testing",
  ],
  ruleLogic:
    "Reconcile screened population to total population to confirm nothing is excluded. Reconcile loaded list entries to provider entries to confirm complete ingestion. Inject a controlled test set of seeded true positives and near-misses through the live or mirror configuration and measure detection rate by variant type. Back-test recent thresholds against historical confirmed matches to confirm none would now fall below the cut-off. Any unexplained gap is a control failure raised for remediation.",
  defaultThreshold:
    "Detection rate on seeded exact-name and identifier test cases must be 100%; detection on transliteration and alias variants must be >= 95%; population and list-ingestion reconciliation must show zero unexplained gap.",
  thresholdRationale:
    "Exact and identifier matches must never be missed because missing one is a strict-liability breach, so the bar is 100%. A 95% floor on fuzzy variants reflects that no engine catches every transliteration, but a drop below 95% signals the threshold is set too tight or the algorithm is misconfigured. A zero-gap reconciliation standard is non-negotiable because an unscreened slice of the book is a true blind spot, not a tuning question.",
  lookbackWindow:
    "Reconciliation runs daily against the live population and list versions; the full seeded-name detection test runs at least quarterly and after any engine, list-provider or threshold change.",
  tuningNotes:
    "This is the assurance layer over control 18, so its own output is the false-negative and coverage picture for the live screening control. If seeded detection falls below target, the fix is to lower the live threshold or correct the algorithm, not to weaken this test. Maintain the test-name library so it tracks the current list (refresh seeds when the provider adds high-profile designations). Document every detection miss with root cause; a recurring miss type is a calibration finding for the screening configuration owner.",
  firstLineOwner: "Screening Operations / Sanctions tooling team",
  secondLineOwner: "Financial Crime Compliance assurance / Compliance testing",
  suggestedSystems: ["screening engine test harness", "data reconciliation tooling", "Napier / ComplyAdvantage test mode", "internal QA scripting over the list feed"],
  escalation:
    "Any coverage gap or sub-target detection rate is logged as a control failure and escalated to the MLRO, who assesses whether live matches may have been missed, commissions a remedial lookback over the affected period, and considers whether the gap is reportable to the FCA under Principle 11.",
  sla: "Reconciliation breaks investigated within 1 working day; seeded-detection failures triaged within 2 working days and a remediation plan agreed within 5.",
  metrics: [
    { name: "Seeded true-positive detection rate", target: "100% exact / >= 95% variant", description: "Share of injected known matches the engine alerts on, by variant type." },
    { name: "Population screening reconciliation", target: "0 unexplained gap", description: "Difference between total in-scope population and screened population." },
    { name: "List ingestion completeness", target: "100%", description: "Provider list entries successfully loaded into the engine versus published." },
    { name: "Finding remediation timeliness", target: ">= 90% on time", description: "Coverage and calibration findings closed within agreed remediation dates." },
  ],
  testPlan: [
    "Reconcile a full day's customer and payment population to screened counts and explain any difference to zero.",
    "Compare the provider's published list entry count to the engine's loaded count for each in-scope list and confirm complete ingestion.",
    "Inject the seeded test-name library through the live configuration and measure detection rate split by exact, identifier, transliteration and alias variants.",
    "Back-test the current threshold against the last 12 months of confirmed true positives and confirm none would now auto-clear below the review cut-off.",
  ],
  reviewCadence: "Quarterly seeded-detection testing; annual independent review of the test methodology itself; ad hoc after any material engine, list or threshold change.",
  governance: [
    "Test methodology, seed library and pass thresholds are approved by the MLRO and version-controlled.",
    "Test results and any failures are reported to the Financial Crime Committee with remediation tracking.",
    "Findings are logged on the central risk and issues register with owners and due dates.",
    "Evidence packs (inputs, configuration, results) are retained for at least five years to support regulatory inspection.",
  ],
  whatGoodLooksLike: [
    "Coverage gaps are discovered by routine internal testing, not by a missed designation surfacing in production.",
    "Detection rate is measured separately by variant type so weaknesses in fuzzy matching are visible.",
    "Every test failure has a documented root cause and a tracked remediation that feeds back into the live screening configuration.",
    "The seed library is kept current and includes negative controls to confirm the engine is not simply alerting on everything.",
  ],
  strongVsWeak: {
    strong:
      "A bank runs daily population reconciliation and a quarterly seeded-name test; one quarter the alias-variant detection rate drops to 89%, the team traces it to a transliteration setting changed in an upgrade, lowers the live threshold, reseeds, and confirms 96% before signing off.",
    weak:
      "A firm assumes its vendor tool works because it was certified at purchase, never reconciles screened to total population, and only discovers a feed that silently stopped loading new designations months later when the regulator asks for evidence of coverage testing.",
  },
  sources: [
    { org: "Wolfsberg", reference: "Wolfsberg Guidance on Sanctions Screening", title: "Wolfsberg Guidance on Sanctions Screening", url: "https://www.wolfsberg-principles.com/" },
    { org: "OFSI", reference: "OFSI Financial Sanctions Guidance", title: "OFSI Financial Sanctions Guidance", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
    { org: "FATF", reference: "R.6", title: "Recommendation 6: Targeted financial sanctions related to terrorism and terrorist financing", url: "https://www.fatf-gafi.org/en/recommendations.html" },
  ],
};
