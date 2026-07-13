import type { Control } from "./types";

export const control24: Control = {
  id: 24,
  slug: "correspondent-banking-due-diligence",
  name: "Correspondent Banking Due Diligence",
  category: "screening",
  controlType: "preventive",
  plainSummary:
    "Before banking another bank, the firm checks that respondent's ownership, controls and customers so it does not unknowingly process crime or sanctions risk on their behalf.",
  objective:
    "Apply enhanced due diligence to correspondent and respondent banking relationships, understanding the respondent's ownership, AML/CTF and sanctions controls, customer base and use of the account, so the firm does not provide indirect access to its payment rails for sanctioned, criminal or unscreened activity, including nested relationships.",
  plainObjective: "This control scrutinises a partner bank's ownership, controls and customers before banking it, so the firm does not let sanctioned, criminal or unscreened activity onto its payment rails.",
  plainHowItWorks: "Before opening the account it runs enhanced checks on the respondent's licence, ownership, controls and customers, screens it and its owners, requires senior sign-off, then monitors actual flows against the expected profile, watching for nesting.",
  plainWhyThreshold: "Because the firm leans on the partner bank's controls for people it never sees, the bar is thorough due diligence and senior accountability, not one number, with nesting gated.",
  riskThemes: ["sanctions_evasion", "money_laundering", "terrorist_financing", "proliferation_financing"],
  applicableFirmTypes: ["bank", "emi", "pi", "msb"],
  typologySlugs: ["sanctions-evasion-via-intermediaries", "nested-msb-agent-risk", "high-risk-corridor-remittances", "wmd-programme-financing-third-country-banking"],
  enforcementRefs: [
    { firm: "Standard Chartered Bank", year: 2019 },
    { firm: "Ghana International Bank Plc", year: 2022 },
  ],
  dataInputs: [
    "Respondent institution licensing, ownership and beneficial ownership, and group structure",
    "Respondent AML/CTF and sanctions programme details: policies, screening, named MLRO, audit findings",
    "Respondent customer base, products, geographies and expected account purpose and volumes",
    "Whether the respondent offers downstream / nested correspondent or payable-through services and how it controls them",
    "Sanctions and adverse media screening results on the respondent, its owners and senior management",
    "Actual transaction activity through the account versus the expected profile",
  ],
  ruleLogic:
    "Before opening a correspondent relationship, perform EDD on the respondent: confirm it is licensed and not a shell bank, identify ownership and management, assess its AML/sanctions controls and customer base, and document expected account use. Screen the respondent, owners and management against sanctions, PEP and adverse media. Obtain senior management approval before the relationship begins. Then monitor actual flows against the expected profile, with periodic re-assessment risk-rated by jurisdiction and activity, paying particular attention to nested relationships where the respondent's own customers transact through the account.",
  defaultThreshold:
    "No relationship without completed EDD and senior sign-off; respondent or owner screening hit at fuzzy score >= 85% holds onboarding for review; payable-through / nested access prohibited unless specifically assessed and controlled. Shell banks are an automatic decline.",
  thresholdRationale:
    "Correspondent banking is high-risk by nature because the firm relies on the respondent's controls for parties it never sees, so the bar is qualitative completeness of EDD and senior accountability rather than a single numeric cut-off. The 85% screening hold mirrors the firm's other screening controls. Nested and payable-through access is gated because it imports unscreened third-party customers, the very exposure behind correspondent-banking enforcement.",
  lookbackWindow:
    "EDD before onboarding and full re-assessment on a risk-based cycle (high-risk respondents at least annually); transaction-versus-profile monitoring is continuous, with screening real-time on each payment.",
  tuningNotes:
    "The risk is concentration and opacity rather than alert volume: a single respondent can route thousands of unseen third-party payments. Tune monitoring to flag deviation from expected corridors, currencies, volumes and customer types, and to detect nesting (downstream institutions appearing as originators or beneficiaries). Re-assessment frequency should follow respondent jurisdiction risk and observed behaviour. Do not rely solely on the respondent's attestations; corroborate with audit findings, regulatory status and actual flow analysis.",
  firstLineOwner: "Correspondent Banking / Financial Institutions relationship team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["Wolfsberg Correspondent Banking Due Diligence Questionnaire (CBDDQ)", "Bankers Almanac / Accuity", "Dow Jones / LexisNexis screening", "transaction monitoring with correspondent-flow analytics"],
  escalation:
    "Material adverse findings on a respondent, evidence of unapproved nesting, or activity materially out of profile are escalated to the MLRO and senior management for a relationship-continuation decision; sanctions exposure triggers blocking, OFSI reporting and possible exit, and suspicious activity triggers a SAR.",
  sla: "Onboarding EDD completed and approved before first transaction; out-of-profile or nesting alerts investigated within 5 working days; sanctions hits actioned same day.",
  metrics: [
    { name: "EDD and approval completeness", target: "100%", description: "Correspondent relationships with completed EDD and documented senior sign-off before first use." },
    { name: "Respondent re-assessment currency", target: "Within risk-based cycle", description: "Active respondents reviewed within their risk-rated re-assessment window." },
    { name: "Activity-versus-profile monitoring", target: "100% of accounts monitored", description: "Correspondent accounts with ongoing expected-versus-actual flow monitoring." },
    { name: "Nesting detection", target: "Identified and controlled", description: "Downstream / nested relationships identified and either approved with controls or terminated." },
  ],
  testPlan: [
    "Sample 15 live correspondent relationships and confirm pre-onboarding EDD, screening and senior approval are documented and dated before first transaction.",
    "Confirm at least one respondent file evidences assessment of the respondent's own AML/sanctions controls and customer base, not just its licence.",
    "Inject a synthetic flow that deviates from the expected corridor and volume profile and confirm the monitoring alerts.",
    "Trace a sample of payments through a respondent to test whether nested third-party originators are identifiable and within approved scope.",
  ],
  reviewCadence: "Respondent risk re-assessment on a risk-based cycle (at least annually for high-risk); policy and questionnaire framework reviewed annually.",
  governance: [
    "Senior management and the MLRO approve each correspondent relationship and any high-risk continuation, with rationale retained.",
    "EDD files, CBDDQ responses and screening evidence are documented and retained for at least five years.",
    "Financial Crime Committee reviews the correspondent portfolio risk profile, exceptions and exits at least quarterly.",
    "A standing prohibition on shell banks and uncontrolled payable-through accounts is policy-stated and monitored.",
  ],
  whatGoodLooksLike: [
    "The firm understands and documents the respondent's ownership, controls, customer base and expected account use before opening.",
    "Nested and payable-through arrangements are identified, specifically assessed and either controlled or refused.",
    "Actual flows are monitored against the expected profile, with deviations investigated rather than assumed benign.",
    "Senior management owns each relationship decision and re-assessment follows the respondent's risk, not a fixed calendar alone.",
  ],
  strongVsWeak: {
    strong:
      "A bank completes a full CBDDQ on a respondent in a higher-risk jurisdiction, assesses its sanctions screening, prohibits unapproved nesting, monitors flows against an agreed corridor profile, and exits when volumes spike into unrelated geographies.",
    weak:
      "A bank opens a correspondent account on the strength of the respondent's licence alone, never assesses its downstream customers or controls, processes years of high-risk, out-of-profile and nested flows unmonitored, and only learns of the exposure through enforcement, the failure pattern in Standard Chartered and Ghana International Bank.",
  },
  sources: [
    { org: "FATF", reference: "R.13", title: "Recommendation 13: Correspondent banking", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "Wolfsberg", reference: "Wolfsberg Correspondent Banking Principles", title: "Wolfsberg Correspondent Banking Principles", url: "https://www.wolfsberg-principles.com/" },
    { org: "MLR", reference: "reg.33 EDD / correspondent", title: "Money Laundering Regulations 2017 reg.33: enhanced due diligence and correspondent relationships", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions and correspondent banking", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
  ],
};
