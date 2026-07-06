import type { Control } from "./types";

export const control22: Control = {
  id: 22,
  slug: "payment-transaction-screening",
  name: "Real-Time Payment Screening",
  category: "screening",
  controlType: "preventive",
  plainSummary:
    "Checks the names, banks and countries on each payment message against sanctions lists in real time and holds anything that hits before the money leaves.",
  objective:
    "Screen the parties and content of inbound and outbound payment messages against sanctions and watch lists in real time, blocking or holding any payment with a potential match so the firm does not process funds for a sanctioned party or via a prohibited jurisdiction.",
  plainObjective: "This control checks names and details on every incoming and outgoing payment against sanctions and watch lists in real time, holding any possible match so prohibited payments cannot go through.",
  plainHowItWorks: "It stops each payment message before release, tidies up stripped or non-Latin fields, and checks every party and the text against the lists, holding anything that matches for a person to review before release.",
  plainWhyThreshold: "The match level catches transliterated and shortened names in cross-border messages while keeping the hold queue workable, and identifier or country hard-blocks skip the name score because they are near-certain.",
  riskThemes: ["sanctions_evasion", "terrorist_financing", "proliferation_financing"],
  applicableFirmTypes: ["bank", "emi", "pi", "msb", "neobank", "crypto"],
  typologySlugs: ["sanctions-evasion-via-intermediaries", "high-risk-corridor-remittances", "proliferation-financing"],
  enforcementRefs: [{ firm: "Standard Chartered Bank", year: 2019 }],
  dataInputs: [
    "Payment message fields: ordering and beneficiary names, addresses, account numbers, BIC/IBAN and intermediary bank identifiers",
    "Free-text remittance information and reference fields",
    "Originating and destination country and currency",
    "Vessel, port and goods references where present in trade-related payments",
    "Current sanctions lists (OFSI, plus UN/EU/OFAC as in scope) and internal payment watch lists",
  ],
  ruleLogic:
    "Intercept each payment message before release and screen every party and the message content against sanctions and watch lists using exact and fuzzy matching. A candidate at or above threshold places the payment in a hold queue and blocks straight-through release pending human disposition. Stripped, abbreviated or non-Latin fields are normalised before matching. Confirmed matches are blocked and reported; cleared payments are released with an audit trail of the disposition.",
  defaultThreshold:
    "Fuzzy match score >= 85% holds the payment for Level 1 review; exact matches on structured identifiers (BIC, IBAN, sanctioned vessel/IMO) or a prohibited destination country hard-block automatically.",
  thresholdRationale:
    "85% holds enough variants to catch transliterated and abbreviated names common in cross-border messages while keeping the hold queue workable so genuine payments are not delayed unnecessarily. Identifier and country hard-blocks bypass name scoring because they are high-confidence and the regulatory cost of release is absolute. Payment screening leans slightly more towards recall than onboarding screening because a missed hit means funds actually leave the firm.",
  lookbackWindow:
    "Real-time, message by message, against the live list version; the rule re-evaluates immediately whenever a list update is ingested so in-flight and queued payments reflect the latest designations.",
  tuningNotes:
    "Payment screening false-positive rates are very high (frequently 95%+) because messages carry sparse, abbreviated and noisy free text. Tune with good-guy lists for repeat clean counterparties, country/BIC context scoring, and message-format normalisation, but never tune by stripping fields or raising thresholds in a way that reduces coverage, which is precisely the failing seen in correspondent-banking enforcement. Monitor hold-queue latency so legitimate payments are not stranded, and keep a clear segregation between auto-release and manual-clear paths.",
  firstLineOwner: "Payments Operations / Sanctions screening team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["Fircosoft", "SWIFT Sanctions Screening", "Bottomline / SmartStream", "Napier", "in-house real-time screening over a managed list feed"],
  escalation:
    "A confirmed match against an asset-freeze target results in the payment being blocked, the funds frozen and an immediate report to OFSI by the MLRO; a SAR is filed where money laundering is also suspected. Repeated hits on a corridor or counterparty are escalated for relationship review.",
  sla: "Held payments dispositioned within 1 working hour during operating hours to limit settlement impact; confirmed asset-freeze blocks reported to OFSI without delay on the day of confirmation.",
  metrics: [
    { name: "Payment screening coverage", target: "100%", description: "In-scope inbound and outbound payments screened before release." },
    { name: "Hold-queue disposition SLA", target: ">= 98% within SLA", description: "Held payments cleared or escalated within the response target." },
    { name: "List currency at screening", target: "Live version", description: "Payments screened against the current published list with no stale-list releases." },
    { name: "Missed-hit rate", target: "0", description: "Confirmed sanctioned payments released without a hold, measured by assurance testing." },
  ],
  testPlan: [
    "Inject test payment messages naming current list entries in ordering, beneficiary and intermediary fields and confirm each is held, not released.",
    "Inject messages with stripped, abbreviated and non-Latin party names and confirm normalisation still produces a match at threshold.",
    "Send a payment to a prohibited-country counterparty and confirm the hard-block fires before release.",
    "Sample 30 cleared held payments and re-perform the disposition to confirm no true match was wrongly released.",
  ],
  reviewCadence: "Threshold, normalisation rules and good-guy lists reviewed quarterly; full payment-screening coverage test at least annually and after any engine or message-format change.",
  governance: [
    "MLRO approves the lists in scope, match threshold, hard-block country list and any good-guy entries.",
    "All payment holds and dispositions are logged with the deciding analyst and rationale, retained for at least five years.",
    "Stripping or alteration of payment-message data is prohibited by policy and monitored.",
    "Board or Financial Crime Committee receives payment-screening MI (volumes, blocks, OFSI reports) at least quarterly.",
  ],
  whatGoodLooksLike: [
    "Every party and the message content is screened in real time against the live list before the payment is released.",
    "Payment data is never stripped or abbreviated to evade screening; normalisation improves matching rather than reducing it.",
    "Hard-blocks fire on identifiers and prohibited countries without relying on the name score alone.",
    "Hold-queue latency is managed so genuine payments clear quickly while true matches are stopped.",
  ],
  strongVsWeak: {
    strong:
      "A bank screens the ordering, beneficiary and intermediary fields plus remittance text on every message, holds a payment where the beneficiary's transliterated name matches a designated party, confirms the match, blocks the funds and reports to OFSI the same day.",
    weak:
      "A correspondent bank routes US-dollar payments for a sanctioned client and removes or abbreviates the originator details so the message clears its own and downstream screening, processing prohibited transactions undetected, the conduct at the heart of major correspondent-banking enforcement.",
  },
  sources: [
    { org: "FATF", reference: "R.16", title: "Recommendation 16: Wire transfers", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "OFSI", reference: "OFSI Financial Sanctions Guidance", title: "OFSI Financial Sanctions Guidance", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { org: "Wolfsberg", reference: "Wolfsberg Guidance on Sanctions Screening", title: "Wolfsberg Guidance on Sanctions Screening", url: "https://www.wolfsberg-principles.com/" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
  ],
};
