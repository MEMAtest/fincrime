import type { Control } from "./types";

export const control20: Control = {
  id: 20,
  slug: "pep-screening",
  name: "PEP Screening",
  category: "screening",
  controlType: "preventive",
  plainSummary:
    "Flags customers who are senior public officials or their close associates so the firm applies extra checks before and during the relationship.",
  objective:
    "Identify customers, beneficial owners and connected parties who are politically exposed persons (PEPs), their family members or known close associates, so that the firm applies enhanced due diligence, senior sign-off and ongoing monitoring proportionate to the corruption and bribery risk they present.",
  riskThemes: ["bribery_corruption", "money_laundering"],
  applicableFirmTypes: ["bank", "wealth_manager", "emi", "pi", "neobank", "crypto", "insurance", "msb"],
  typologySlugs: ["pep-grand-corruption-proceeds", "bribery-facilitation-payments"],
  enforcementRefs: [{ firm: "Credit Suisse International, Credit Suisse Securities (Europe) Ltd, and Credit Suisse AG", year: 2021 }],
  dataInputs: [
    "Customer name, date of birth, nationality and country of residence at onboarding",
    "Beneficial owner, director and controller identities for entity customers",
    "PEP reference data from a commercial provider, including family-member and close-associate links and the public function held",
    "Customer-declared occupation, employer and source of wealth",
    "Domestic versus foreign PEP classification and the seniority of the public role",
  ],
  ruleLogic:
    "Screen every customer, beneficial owner and connected party against a maintained PEP database using fuzzy and exact name matching plus secondary identifiers. A match at or above threshold flags the relationship as PEP, triggering enhanced due diligence, source-of-wealth and source-of-funds verification, and senior management approval before the relationship proceeds. Classify by PEP type (foreign, domestic, international organisation) and by family or close-associate status to set the EDD intensity. Re-screen periodically and on each provider update so newly appointed PEPs are caught.",
  defaultThreshold:
    "Fuzzy match score >= 85% auto-routes to a PEP review queue; matches with corroborating secondary identifiers (DOB, nationality) at >= 80% are also routed for review.",
  thresholdRationale:
    "85% mirrors sanctions screening recall but PEP matching tolerates more analyst review because a PEP flag triggers EDD rather than an automatic block, so the cost of a false positive is investigative time rather than a wrongly declined customer. Secondary identifiers are weighted in because PEP databases carry rich biographical data, letting the firm demote common-name collisions without missing genuine officials.",
  lookbackWindow:
    "Real-time at onboarding; periodic rescreen of the full book at least every 12 months and on every provider data update so newly designated PEPs are identified.",
  tuningNotes:
    "PEP false-positive rates are high for common names and for domestic-PEP-heavy populations; tune with secondary-identifier scoring and by separating foreign (always EDD) from domestic PEPs (risk-based assessment per FCA guidance on the treatment of domestic PEPs). Avoid blanket de-risking of all PEPs: the FCA expects proportionate treatment, especially for domestic PEPs and their families. Review the standing PEP flag list periodically because PEP status can lapse when a person leaves office, though a step-down period applies.",
  firstLineOwner: "Onboarding / Relationship management",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["Dow Jones Risk & Compliance", "LexisNexis WorldCompliance", "ComplyAdvantage", "RDC / Moody's", "in-house screening over a licensed PEP feed"],
  escalation:
    "A confirmed PEP match is escalated to the relevant senior manager (and the MLRO for foreign or higher-risk PEPs) who must approve establishing or continuing the relationship after EDD and source-of-wealth review. Adverse findings during EDD are escalated for a relationship-continuation decision and possible SAR.",
  sla: "PEP matches dispositioned within 2 working days; senior management approval recorded before account activation for confirmed foreign PEPs.",
  metrics: [
    { name: "PEP screening coverage", target: "100%", description: "Customers, beneficial owners and connected parties screened against the current PEP data." },
    { name: "Senior approval completeness", target: "100%", description: "Confirmed PEP relationships with documented senior management sign-off before activation." },
    { name: "EDD completion timeliness", target: ">= 95% on time", description: "PEP source-of-wealth and EDD packs completed within the target window." },
    { name: "Periodic rescreen currency", target: "<= 12 months", description: "Maximum age of the last full-book PEP rescreen for any active customer." },
  ],
  testPlan: [
    "Inject synthetic customers matching known public officials in the PEP feed and confirm each flags and routes to EDD rather than auto-clearing.",
    "Inject family-member and close-associate test records and confirm the connection-based flags fire, not just direct PEP names.",
    "Sample 25 live PEP relationships and confirm source-of-wealth evidence and senior sign-off are on file and dated before activation.",
    "Run the periodic rescreen with a seeded newly appointed PEP and confirm an existing customer is re-flagged within the update window.",
  ],
  reviewCadence: "Threshold and classification logic reviewed annually; PEP population and EDD quality sampled quarterly by second line.",
  governance: [
    "MLRO approves the PEP data sources, match threshold and the domestic-versus-foreign treatment policy.",
    "Senior management sign-off for each foreign PEP relationship is documented and retained.",
    "Financial Crime Committee reviews PEP MI (population, EDD backlog, declines) at least quarterly.",
    "PEP determinations, EDD evidence and approvals are retained for at least five years after the relationship ends.",
  ],
  whatGoodLooksLike: [
    "PEP status drives proportionate EDD, not automatic de-risking, with domestic PEPs assessed on a risk-sensitive basis.",
    "Family members and close associates are screened through connection data, not just direct name lists.",
    "Source of wealth is independently corroborated and refreshed for higher-risk PEPs, not taken on the customer's word.",
    "Periodic rescreening catches newly appointed PEPs in the existing book within the review window.",
  ],
  strongVsWeak: {
    strong:
      "A wealth manager screens beneficial owners and connected parties, flags a foreign minister's daughter through close-associate data, completes corroborated source-of-wealth checks, and records named senior sign-off before the account transacts.",
    weak:
      "A firm screens only the named account holder against a PEP list it has not refreshed in two years, takes the customer's self-declared occupation at face value, and has no senior approval trail for a high-risk foreign PEP it onboarded.",
  },
  sources: [
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions and politically exposed persons", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "JMLSG Guidance Part I, Chapter 5: Enhanced due diligence and PEPs", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FATF", reference: "R.6", title: "Recommendation 6: Targeted financial sanctions related to terrorism and terrorist financing", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "MLR", reference: "reg.33 EDD / correspondent", title: "Money Laundering Regulations 2017 reg.33: enhanced customer due diligence", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
  ],
};
