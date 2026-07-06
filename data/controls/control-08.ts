import type { Control } from "./types";

export const control08: Control = {
  id: 8,
  slug: "enhanced-due-diligence-program",
  name: "Enhanced Due Diligence Programme",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "For the highest-risk customers, run a deeper, joined-up due diligence package (extra evidence, senior sign-off, closer monitoring) and make sure it actually happens before and during the relationship.",
  objective:
    "Apply enhanced due diligence to all relationships and transactions presenting higher money-laundering or terrorist-financing risk, as required by reg.33 of the MLR 2017, by mandating additional information, corroboration, senior approval and enhanced ongoing monitoring as a coherent programme rather than ad hoc extra steps.",
  plainObjective: "For the highest-risk customers and transactions, run a full, joined-up package of extra evidence, senior approval and closer monitoring rather than scattered one-off extra steps.",
  plainHowItWorks: "When a high-risk trigger fires, it opens a structured case demanding a complete evidence pack and senior sign-off before the relationship can proceed, switches on closer monitoring, and treats overdue reviews as breaches.",
  plainWhyThreshold: "Because these enhanced checks are legally compulsory, a full evidence pack and senior approval are hard gates, while shorter reviews and a 30-day overdue limit keep high-risk files current.",
  riskThemes: [
    "money_laundering",
    "bribery_corruption",
    "sanctions_evasion",
    "terrorist_financing",
  ],
  applicableFirmTypes: [
    "bank",
    "wealth_manager",
    "insurance",
    "emi",
    "pi",
    "msb",
    "crypto",
    "neobank",
  ],
  typologySlugs: [
    "front-company-bo-obfuscation",
    "high-risk-corridor-remittances",
    "tax-haven-transfers",
  ],
  enforcementRefs: [
    { firm: "Standard Chartered Bank", year: 2019 },
    {
      firm:
        "Credit Suisse International, Credit Suisse Securities (Europe) Ltd, and Credit Suisse AG",
      year: 2021,
    },
  ],
  dataInputs: [
    "Trigger reason (high risk rating, PEP, high-risk third country, complex/opaque structure, unusual transaction)",
    "Enhanced identity, ownership and connected-party information",
    "Source-of-funds and source-of-wealth evidence",
    "Adverse-media, sanctions and PEP screening results",
    "Purpose and rationale for complex or unusually large transactions",
    "Senior-approval record and rationale for acceptance",
    "Enhanced ongoing monitoring configuration applied to the relationship",
    "EDD review due dates and completion status",
  ],
  ruleLogic:
    "Whenever an EDD trigger is met (customer rated high; PEP; established in or transacting with a reg.33 high-risk third country; complex or opaque ownership; unusually large or patternless transactions), open a structured EDD case that mandates a defined evidence pack: enhanced identity/ownership, source of funds and wealth, purpose of the relationship and of any unusual transaction, and adverse-media review. The relationship cannot onboard or continue without senior management approval recorded against the completed pack, and it must be placed on enhanced ongoing monitoring with a shorter review cycle. Block activation and continuation while any mandatory EDD item is outstanding, and surface overdue EDD reviews as a control breach.",
  defaultThreshold:
    "EDD mandatory on any reg.33 trigger; require 100% of the defined EDD evidence pack complete plus recorded senior approval before activation; enhanced ongoing monitoring with review at least every 12 months (every 6 months for PEPs and the highest-risk band); EDD review more than 30 days overdue is a reportable control breach.",
  thresholdRationale:
    "reg.33 makes EDD non-discretionary for the listed higher-risk situations, so completeness of the evidence pack and senior approval are hard gates, not best-efforts. The 12-month (6-month for PEP) review cadence reflects that high-risk relationships change and must be revisited far more often than standard customers. A 30-day overdue tolerance keeps the programme honest without flagging trivial slippage. Standard Chartered and Credit Suisse were both penalised for EDD that was inconsistent, incomplete or not applied to relationships that plainly warranted it, so the programme's value is in enforced completeness and timeliness.",
  lookbackWindow:
    "From the trigger event through the life of the relationship, with enhanced monitoring continuous and EDD refreshed at the band cadence or on any new trigger or adverse media.",
  tuningNotes:
    "EDD should be a defined, repeatable pack, not a free-form 'do more' instruction, so analysts and reviewers know exactly what completeness means. Size the pack to the trigger (a high-risk-country trade customer needs different evidence than a PEP), but always require senior approval and enhanced monitoring. The most common failure is not the depth of any single EDD file but inconsistency and overdue refreshes across the book, so instrument completeness and timeliness as first-class metrics and treat overdue EDD as a breach, not a backlog.",
  firstLineOwner: "Relationship Management / KYC Operations with EDD specialists",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "EDD case management with a configurable mandatory evidence checklist per trigger",
    "Sanctions, PEP and adverse-media screening with enhanced ongoing monitoring",
    "Source-of-funds and source-of-wealth evidence capture and reconciliation",
    "Senior-approval workflow with recorded rationale",
    "Review-scheduling and breach-reporting dashboard for overdue EDD",
  ],
  escalation:
    "Incomplete EDD or any unresolved adverse finding blocks activation/continuation and escalates to the MLRO. Acceptance of a high-risk relationship requires recorded senior management approval; overdue EDD reviews are escalated as control breaches. Where EDD surfaces knowledge or suspicion of financial crime, a SAR is considered and the relationship is reassessed for exit.",
  sla: "EDD case opened immediately on trigger; evidence pack and senior approval completed before activation (target 5-10 business days depending on complexity); enhanced monitoring active from day one; reviews completed by their due date.",
  metrics: [
    { name: "EDD trigger coverage", target: "100%", description: "Relationships meeting a reg.33 trigger that are actually placed on the EDD programme" },
    { name: "EDD pack completeness", target: "100%", description: "Active EDD relationships with every mandatory evidence item and recorded senior approval present" },
    { name: "EDD review timeliness", target: ">=95% on time", description: "Enhanced reviews completed by due date; <30 days overdue tolerance" },
    { name: "Enhanced monitoring coverage", target: "100%", description: "EDD relationships actually configured for enhanced ongoing transaction monitoring" },
  ],
  testPlan: [
    "Onboard a customer established in a reg.33 high-risk third country and confirm an EDD case opens automatically with the correct mandatory evidence checklist.",
    "Attempt to activate an EDD relationship with one mandatory evidence item missing or no senior approval and confirm the gate blocks activation.",
    "Advance the clock past an EDD review due date in a test environment and confirm the relationship surfaces as an overdue control breach, not a silent backlog.",
    "Sample 15 high-risk relationships and confirm each has a complete evidence pack, recorded senior approval and enhanced monitoring actually switched on.",
  ],
  reviewCadence:
    "EDD trigger list, evidence-pack definitions and review cadences reviewed at least annually and on any reg.33 / high-risk-country list change; individual EDD files reviewed at the band cadence (6-12 months) and on triggers.",
  governance: [
    "Senior management approves the establishment and continuation of every high-risk / EDD relationship (reg.33/35).",
    "MLRO approves the EDD trigger list, mandatory evidence packs and review cadences.",
    "Complete EDD files, approval rationale and monitoring configuration retained for the relationship plus 5 years.",
    "EDD coverage, completeness, timeliness and overdue-breach metrics reported to the financial crime committee at least quarterly.",
  ],
  whatGoodLooksLike: [
    "Every reg.33 trigger reliably opens a structured EDD case with a defined, complete evidence pack.",
    "No high-risk relationship goes live or continues without recorded senior approval and enhanced monitoring.",
    "EDD reviews are tracked to due dates and overdue ones are treated as breaches, not backlog.",
    "Completeness and timeliness are measured across the whole book, so inconsistency is visible and fixed.",
  ],
  strongVsWeak: {
    strong:
      "When a customer begins trading with a high-risk third country, the system auto-opens an EDD case requiring enhanced ownership, source of funds and transaction-purpose evidence; the pack is completed, a senior manager approves with written rationale, enhanced monitoring is switched on, and a 6-month review is scheduled and tracked.",
    weak:
      "A firm labels some customers 'high risk' but applies EDD inconsistently, lets relationships go live with half the evidence pack missing and no senior sign-off, never switches on enhanced monitoring, and lets EDD reviews fall a year overdue with no one accountable.",
  },
  sources: [
    { org: "MLR", reference: "reg.33 EDD", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/33" },
    { org: "FATF", reference: "R.1 Risk-based approach", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "FATF", reference: "R.10 Customer due diligence", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
};
