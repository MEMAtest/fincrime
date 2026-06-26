import type { Control } from "./types";

export const control07: Control = {
  id: 7,
  slug: "pep-identification-edd",
  name: "PEP Identification & Enhanced Due Diligence",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "Spot customers (and their close family and associates) who hold or held prominent public office, then apply extra checks and senior approval because they carry higher corruption risk.",
  objective:
    "Identify whether a customer, beneficial owner or connected party is a politically exposed person, family member or known close associate, and apply the enhanced measures required by reg.35 of the MLR 2017 (senior approval, source of wealth and funds, enhanced ongoing monitoring) proportionate to the corruption risk they present.",
  riskThemes: ["bribery_corruption", "money_laundering", "sanctions_evasion"],
  applicableFirmTypes: [
    "bank",
    "wealth_manager",
    "insurance",
    "emi",
    "pi",
    "msb",
    "crypto",
  ],
  typologySlugs: [
    "pep-grand-corruption-proceeds",
    "bribery-facilitation-payments",
  ],
  enforcementRefs: [
    { firm: "Standard Bank PLC", year: 2014 },
    { firm: "EFG Private Bank", year: 2013 },
  ],
  dataInputs: [
    "Customer, beneficial owner and connected-party names and dates of birth",
    "PEP reference data (positions held, country, in/out of office dates)",
    "Family-member and close-associate relationship data",
    "PEP category (foreign, domestic, international organisation) and seniority",
    "Source-of-wealth and source-of-funds evidence",
    "Adverse-media and corruption-risk screening results",
    "Jurisdiction corruption-risk rating",
    "Screening match scores and disposition history",
  ],
  ruleLogic:
    "Screen every customer, beneficial owner and material connected party against PEP reference data at onboarding and continuously thereafter. On a confirmed match, classify PEP type and seniority, assess corruption risk by role and jurisdiction, and route into EDD: obtain senior management approval to establish/continue, establish source of wealth and funds, and apply enhanced ongoing monitoring. Family members and known close associates are treated as PEPs. A potential match must be adjudicated by a person (true match, false positive, or de-classified ex-PEP after a documented stand-down period) before the relationship proceeds. Block onboarding of a confirmed PEP without senior approval on file.",
  defaultThreshold:
    "PEP screening match score >= 85% auto-routes to manual adjudication; all confirmed PEPs require senior management approval before activation; family members and close associates screened to the same standard; ex-PEP de-classification only after a documented risk assessment and a minimum 12-month stand-down (longer for foreign/high-corruption-risk roles).",
  thresholdRationale:
    "reg.35 makes PEP status (and that of family members and close associates) mandatory-EDD with senior approval, so screening must catch these populations and a human must confirm any match. An 85% fuzzy-match floor balances catching name variants and transliterations against drowning analysts in false positives; the 12-month minimum stand-down reflects guidance that risk does not evaporate the instant someone leaves office, especially for foreign officials. Standard Bank and EFG were both penalised for inadequate scrutiny of PEP-connected customers, so weak adjudication or auto-clearing is the failure mode to avoid.",
  lookbackWindow:
    "Continuous: screened at onboarding and re-screened on every reference-data refresh (at least daily) so newly designated PEPs are caught mid-relationship; match dispositions retained for audit.",
  tuningNotes:
    "PEP screening is false-positive heavy because of common names and transliteration; tune the match score by name commonness and add secondary identifiers (DOB, country) to suppress noise rather than simply raising the score and missing true matches. Do not let analysts mass-clear matches to hit volume targets, which is the classic rubber-stamp failing. Keep the PEP list current and broad enough to include domestic PEPs and close associates, and ensure de-classified ex-PEPs are re-flagged if they return to office.",
  firstLineOwner: "Screening Operations / KYC team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "PEP and adverse-media screening engine with fuzzy matching and ongoing rescreening",
    "Curated PEP reference data feed (e.g. Dow Jones, Refinitiv World-Check)",
    "Match-adjudication workflow with audit trail and stand-down tracking",
    "EDD case management linking source-of-wealth and senior-approval steps",
    "Connected-party / relationship data store for family and associates",
  ],
  escalation:
    "A confirmed PEP match routes to EDD and to senior management for an approval decision before onboarding or continuation. Adverse media or corruption indicators escalate to the MLRO for enhanced review and SAR consideration. A PEP cannot be activated or retained without recorded senior approval; declined or exited PEPs are documented with rationale.",
  sla: "Screening at submission with daily rescreening; PEP match adjudication within 1 business day; senior approval decision within 5 business days of a complete EDD file; no activation without approval.",
  metrics: [
    { name: "PEP screening coverage", target: "100%", description: "Customers, beneficial owners and material connected parties screened and rescreened against PEP data" },
    { name: "Senior approval completeness", target: "100%", description: "Confirmed PEPs with recorded senior management approval before activation" },
    { name: "Match adjudication SLA", target: ">=95% on time", description: "PEP matches adjudicated by a person within SLA, not auto-cleared" },
    { name: "False-positive rate", target: "Tuned, monitored", description: "Share of PEP alerts dispositioned as false positives, tracked to keep matching effective without overload" },
  ],
  testPlan: [
    "Submit a known PEP under a transliterated name variant and confirm the fuzzy match fires at the configured score and routes to manual adjudication.",
    "Attempt to activate a confirmed PEP without senior approval on file and confirm the system blocks activation.",
    "Add a customer who is the spouse of a serving minister and confirm they are screened and treated as a PEP, not just the principal.",
    "Designate a test individual as a new PEP in the reference feed mid-relationship and confirm daily rescreening flags the existing customer.",
  ],
  reviewCadence:
    "Match thresholds, reference-data sources and stand-down policy reviewed annually; PEP relationships subject to enhanced ongoing monitoring with at least annual EDD refresh.",
  governance: [
    "Senior management approval recorded for every PEP relationship established or continued (reg.35).",
    "MLRO approves the PEP screening configuration, stand-down policy and adjudication standards.",
    "All PEP match dispositions, approvals and EDD evidence retained for the relationship plus 5 years.",
    "PEP onboarding/exit decisions, adjudication quality samples and false-positive trends reported to the financial crime committee quarterly.",
  ],
  whatGoodLooksLike: [
    "PEPs, their families and close associates are reliably identified and continuously rescreened, not just checked once at onboarding.",
    "Every PEP relationship carries recorded senior approval and a corroborated source of wealth.",
    "Matches are adjudicated by trained people with documented rationale, not bulk-cleared.",
    "Ex-PEP de-classification follows a documented stand-down and reverses if they return to office.",
  ],
  strongVsWeak: {
    strong:
      "A bank's daily rescreening flags an existing customer who has just been appointed to a foreign cabinet; the 90% match is adjudicated as a true PEP, EDD is engaged, source of wealth is corroborated, the PEP committee approves continuation, and enhanced monitoring is switched on.",
    weak:
      "A firm screens only the named applicant once at onboarding, never the beneficial owners or spouse, sets the match score so high that a transliterated name slips through, lets an analyst bulk-clear alerts to clear a backlog, and onboards a foreign official with no senior approval.",
  },
  sources: [
    { org: "MLR", reference: "reg.35 PEPs", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.12 Politically exposed persons", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
    { org: "Wolfsberg", reference: "Wolfsberg CDD Standards", title: "Wolfsberg CDD Standards", url: "https://www.wolfsberg-principles.com/" },
  ],
};
