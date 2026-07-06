import type { Control } from "./types";

export const control06: Control = {
  id: 6,
  slug: "source-of-wealth-corroboration",
  name: "Source of Wealth Corroboration (High Risk / PEP)",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "For high-risk and PEP customers, understand and prove how they built their overall wealth (not just one deposit), and make sure that story is plausible and independently corroborated.",
  objective:
    "For higher-risk relationships and PEPs, establish the customer's overall source of wealth and corroborate it with independent evidence under reg.33 and reg.35 of the MLR 2017, so that the firm is satisfied the customer's total wealth has a legitimate, plausible origin before and during the relationship.",
  plainObjective: "For high-risk and PEP customers, understand and independently prove how their whole fortune was built, so the firm is confident its origin is genuinely legitimate.",
  plainHowItWorks: "It requires a documented account of how the customer's total wealth was built, independently corroborated and tested for plausibility, with senior sign-off needed whenever the story cannot be evidenced or looks linked to corruption.",
  plainWhyThreshold: "Rules require corroborated, not just claimed, wealth here; the 75% evidence floor allows for genuinely hard-to-document legacy wealth, while the 10x income test flags the classic corruption warning sign.",
  riskThemes: ["bribery_corruption", "money_laundering", "tax_evasion"],
  applicableFirmTypes: [
    "bank",
    "wealth_manager",
    "insurance",
    "emi",
    "crypto",
  ],
  typologySlugs: [
    "pep-grand-corruption-proceeds",
    "real-estate-high-value-goods-integration",
    "tax-haven-transfers",
  ],
  enforcementRefs: [
    { firm: "EFG Private Bank", year: 2013 },
    { firm: "Standard Bank PLC", year: 2014 },
  ],
  dataInputs: [
    "Narrative of how overall wealth was accumulated (career, business sale, inheritance, investments)",
    "Public profile, role and remuneration where the customer is a PEP or official",
    "Corroborating evidence (audited company accounts, share-sale records, probate, tax filings)",
    "Estimated total net worth and its composition",
    "Adverse media and corruption-risk screening results",
    "Beneficial-ownership and connected-party information",
    "Jurisdictions where wealth was generated and held",
    "Consistency check against declared income and known official salary",
  ],
  ruleLogic:
    "For every high-risk and PEP relationship, require a documented source-of-wealth narrative explaining how total wealth was built, then corroborate it with independent evidence proportionate to risk. Test plausibility: does the claimed wealth reconcile with the customer's known career, remuneration and business history? For PEPs and officials, specifically test whether wealth materially exceeds what their public role could legitimately generate. Where the narrative is uncorroborated, implausible against a known salary, or linked to corruption-exposed sectors or jurisdictions, require senior sign-off to proceed or decline. Re-corroborate at periodic review and on adverse media.",
  defaultThreshold:
    "Mandatory documented and corroborated source of wealth for all high-risk and PEP relationships before onboarding; flag for escalation where corroborated wealth covers less than 75% of estimated net worth, or where wealth exceeds 10x the customer's known/declared legitimate income or official remuneration with no documented explanation.",
  thresholdRationale:
    "reg.35 requires firms to establish the source of wealth of PEPs and apply enhanced ongoing monitoring, and reg.33 mandates EDD for high-risk relationships, so corroboration (not mere assertion) is the defensible standard. The 75% corroboration floor accepts that some wealth is hard to document while ensuring most of it is evidenced; the 10x income test targets the classic grand-corruption red flag where an official's assets dwarf their lawful salary, the exact failing in the Standard Bank and EFG cases. Firms handling many genuinely wealthy clients may set a higher corroboration floor.",
  lookbackWindow:
    "Established at onboarding covering the customer's wealth history; re-corroborated at least annually for PEPs and high-risk customers and on any adverse-media trigger.",
  tuningNotes:
    "Source of wealth is about the whole picture, not a single transaction, so do not confuse it with source-of-funds checks. Expect genuine clients to have some hard-to-document legacy wealth; the corroboration floor allows for that without accepting a wholly unevidenced story. Pay particular attention to PEPs whose lifestyle and assets exceed their public remuneration, and to wealth generated in state-contracting, extractives or sanctioned-adjacent sectors. Avoid relationship-manager optimism bias: corroboration must be independent, not the RM vouching for the client.",
  firstLineOwner: "Relationship Management (private banking / wealth) with KYC support",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "EDD case management with structured source-of-wealth narrative and evidence linking",
    "Adverse-media and PEP screening with ongoing monitoring",
    "Corporate registry and accounts data for business-sale corroboration",
    "Net-worth reconciliation worksheet / tooling",
    "Senior-approval workflow for high-risk acceptance",
  ],
  escalation:
    "Uncorroborated, implausible or corruption-linked wealth escalates to the MLRO and senior management for an accept/decline decision before onboarding or continuation. PEP relationships require senior management approval to establish or continue (reg.35). Where wealth appears to be proceeds of corruption or crime, a SAR is considered and the relationship is reassessed for exit.",
  sla: "Source-of-wealth corroboration completed before onboarding a high-risk or PEP relationship; senior approval obtained within 5 business days of a complete EDD file; annual re-corroboration on schedule.",
  metrics: [
    { name: "SoW corroboration coverage", target: "100%", description: "High-risk and PEP relationships with a documented, independently corroborated source of wealth" },
    { name: "Net-worth reconciliation", target: ">=75% evidenced", description: "Share of estimated net worth backed by independent evidence per relationship" },
    { name: "Senior approval completeness", target: "100%", description: "PEP and high-risk relationships with recorded senior management approval (reg.35)" },
    { name: "Re-corroboration timeliness", target: ">=95%", description: "Annual PEP/high-risk source-of-wealth reviews completed by due date" },
  ],
  testPlan: [
    "Onboard a synthetic PEP whose estimated net worth is 20x their public salary with no business explanation and confirm the 10x rule escalates the case for senior decision.",
    "Submit a source-of-wealth file where only 50% of net worth is evidenced and confirm the corroboration floor blocks straight-through acceptance.",
    "Attempt to onboard a PEP without recorded senior management approval and confirm the relationship cannot be activated.",
    "Sample 15 live high-risk relationships and confirm each carries a corroborated wealth narrative with independent evidence and a net-worth reconciliation, not just an RM summary.",
  ],
  reviewCadence:
    "Corroboration standards and plausibility thresholds reviewed annually; individual PEP and high-risk source-of-wealth files re-corroborated at least annually and on adverse media.",
  governance: [
    "Senior management approves the establishment and continuation of every PEP relationship (reg.35).",
    "MLRO approves the corroboration standards and the net-worth reconciliation methodology.",
    "Source-of-wealth narratives, evidence and reconciliation retained for the relationship plus 5 years.",
    "PEP and high-risk acceptance decisions and exceptions reported to the financial crime committee at least quarterly.",
  ],
  whatGoodLooksLike: [
    "Each high-risk and PEP file tells a documented, evidenced story of how the customer's wealth was built, reconciled to net worth.",
    "An official's wealth is explicitly tested against what their public role could lawfully generate.",
    "Corroboration is independent and senior management has formally approved each PEP relationship.",
    "Wealth is re-corroborated on adverse media, not frozen at onboarding.",
  ],
  strongVsWeak: {
    strong:
      "A private bank onboarding a foreign minister documents that the bulk of his GBP 12m net worth predates office and traces to a 2009 sale of a logistics business, corroborated by audited accounts and the share-purchase agreement; the residual is reconciled to declared investment returns, adverse media is clear, and the board's PEP committee approves the relationship.",
    weak:
      "A bank records 'successful businessman' as the source of wealth for a PEP whose assets vastly exceed his ministerial salary, relies on the relationship manager's assurance with no documents, skips senior approval, and never revisits it when corruption allegations surface in the press.",
  },
  sources: [
    { org: "MLR", reference: "reg.35 PEPs", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.12 Politically exposed persons", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "Wolfsberg", reference: "Wolfsberg CDD Standards", title: "Wolfsberg CDD Standards", url: "https://www.wolfsberg-principles.com/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
};
