import type { Control } from "./types";

export const control18: Control = {
  id: 18,
  slug: "sanctions-list-screening",
  name: "Sanctions List Screening (Customer & Transaction)",
  category: "screening",
  controlType: "preventive",
  plainSummary:
    "Checks every customer and payment against official sanctions lists before money moves, so the firm does not deal with a sanctioned person or entity.",
  objective:
    "Prevent the firm from establishing or maintaining a business relationship with, or processing funds for, any person, entity or jurisdiction subject to UK or applicable financial sanctions, and to detect any existing customer who becomes a target following a list update.",
  riskThemes: ["sanctions_evasion", "terrorist_financing", "proliferation_financing"],
  applicableFirmTypes: ["emi", "pi", "bank", "msb", "crypto", "neobank", "wealth_manager", "insurance"],
  typologySlugs: ["sanctions-evasion-via-intermediaries", "proliferation-financing"],
  enforcementRefs: [{ firm: "Starling Bank Limited", year: 2024 }],
  dataInputs: [
    "Customer name, date of birth, nationality, registered address and known aliases at onboarding",
    "Beneficial owner and controller identities for entity customers",
    "Counterparty name, address and bank identifier on inbound and outbound payments",
    "UK OFSI consolidated list, plus any additional lists in scope (UN, EU, OFAC) and their delta updates",
    "Vessel, IMO, BIC, LEI and other structured identifiers where available",
  ],
  ruleLogic:
    "Normalise the customer and counterparty name and identifiers, then run fuzzy and exact matching against every active sanctions list entry. Any candidate at or above the match threshold generates a screening alert and blocks onboarding or holds the payment pending a human disposition. On each list update, rescreen the entire customer book against the delta so newly designated parties are caught for existing relationships.",
  defaultThreshold:
    "Fuzzy match score >= 85% auto-routes to a Level 1 review queue; exact identifier matches (passport, IMO, BIC, LEI) hard-block regardless of name score.",
  thresholdRationale:
    "85% balances recall and precision: lower thresholds (75-80%) catch more transliteration and spelling variants but flood analysts with noise, while higher thresholds (90%+) risk missing genuine matches where the source name is transliterated or abbreviated. Identifier matches bypass the name score because a structured identifier hit is a near-certain true positive and missing one is a strict-liability breach.",
  lookbackWindow:
    "Real-time at onboarding and on every payment; full-book rescreen on every list update (typically within hours of OFSI publication) and at least daily.",
  tuningNotes:
    "Expect 95%+ of name-only alerts to be false positives in the steady state; the dominant noise drivers are common names, short names and weak secondary identifiers. Tune by adding good-guy / whitelist entries for previously cleared customers (with periodic revalidation), enabling secondary-identifier scoring (DOB, nationality, country) to demote weak hits, and reviewing the score distribution monthly to confirm no cluster of true positives sits just below the auto-review cut-off. Never raise the threshold to manage volume without coverage testing (see control 19).",
  firstLineOwner: "Screening Operations / Onboarding team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["ComplyAdvantage", "LexisNexis Bridger", "Dow Jones Risk & Compliance", "Napier", "in-house screening engine over a managed list feed"],
  escalation:
    "Confirmed or unresolved matches against an asset-freeze target are escalated immediately to the MLRO, who must freeze any funds, decline the relationship or payment, and submit a report to OFSI. A SAR is filed where there is also knowledge or suspicion of money laundering.",
  sla: "Hard-blocked payments and onboarding holds dispositioned within 4 working hours; confirmed asset-freeze matches reported to OFSI without delay and in any event on the day of confirmation.",
  metrics: [
    { name: "Screening coverage", target: "100%", description: "Proportion of customers and in-scope payments screened against the current list version." },
    { name: "Alert disposition SLA", target: ">= 98% within SLA", description: "Share of screening alerts cleared or escalated within the response time target." },
    { name: "List ingestion latency", target: "< 24 hours", description: "Time from OFSI list publication to full-book rescreen completion." },
    { name: "True-positive escalation accuracy", target: "100%", description: "Confirmed asset-freeze matches correctly frozen and reported with no missed escalations." },
  ],
  testPlan: [
    "Inject synthetic customers and payments seeded with exact names from the current OFSI list and confirm each is blocked and queued, not auto-cleared.",
    "Inject transliteration and alias variants (for example reversed name order, dropped middle name, common misspellings) and confirm the engine still alerts at or above threshold.",
    "Designate a test entity in a sandbox list, run the delta update, and confirm an existing customer matching that entity is surfaced by the rescreen within the latency target.",
    "Sample 30 recently cleared alerts and re-perform the disposition independently to confirm no true match was wrongly cleared.",
  ],
  reviewCadence: "Threshold and rule review quarterly; full coverage and calibration test at least annually and after any list-provider or engine change.",
  governance: [
    "MLRO approves the lists in scope, the match threshold and any whitelist additions, with rationale documented.",
    "Screening configuration changes are change-controlled and version-logged with before/after evidence.",
    "Board or Financial Crime Committee receives screening MI (coverage, alert volumes, escalations) at least quarterly.",
    "All alert dispositions and OFSI reports are retained for a minimum of five years.",
  ],
  whatGoodLooksLike: [
    "Every customer and payment is screened against the live list version, with documented evidence of full-book rescreen on each update.",
    "Match thresholds are justified by coverage testing rather than chosen to suppress alert volume.",
    "Cleared alerts carry a written rationale and the disposing analyst is identifiable.",
    "Newly designated existing customers are caught and actioned within hours of the list update, not at next periodic review.",
  ],
  strongVsWeak: {
    strong:
      "A neobank screens at onboarding, on every payment and on every OFSI delta. When a new designation lands at 14:00, the full-book rescreen completes by 15:30, surfaces a five-year-old customer whose alias matches, the MLRO freezes the balance and reports to OFSI the same afternoon.",
    weak:
      "An EMI screens only at onboarding against a list it refreshes monthly, never rescreens the existing book, and quietly raised the match threshold to 92% to cut analyst workload, leaving a designated customer active and transacting for weeks.",
  },
  sources: [
    { org: "OFSI", reference: "OFSI Financial Sanctions Guidance", title: "OFSI Financial Sanctions Guidance", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
    { org: "Wolfsberg", reference: "Wolfsberg Guidance on Sanctions Screening", title: "Wolfsberg Guidance on Sanctions Screening", url: "https://www.wolfsberg-principles.com/" },
    { org: "FATF", reference: "R.6", title: "Recommendation 6: Targeted financial sanctions related to terrorism and terrorist financing", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part III", title: "JMLSG Guidance Part III: Specialist guidance (sanctions)", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  ],
};
