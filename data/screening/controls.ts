import type { ScreeningControl } from "./types";

export const screeningControls: ScreeningControl[] = [
  {
    id: 1,
    slug: "sanctions-screening",
    title: "Sanctions Screening Control",
    category: "sanctions",
    description:
      "Screen customers, connected parties and payment counterparties against consolidated sanctions and asset-freeze lists, at onboarding and on every list change.",
    applicableFirmTypes: ["emi", "pi", "bank", "msb", "crypto", "neobank", "wealth_manager", "insurance"],
    applicableTriggers: ["onboarding", "ongoing", "real_time", "periodic"],
    riskThemes: ["sanctions_evasion", "money_laundering"],
    controlObjective:
      "Prevent the firm from establishing or maintaining a relationship with, or processing a payment for, a designated person — and rescreen the book whenever a list is updated.",
    dataInputs: [
      "Full legal name, aliases and date of birth / incorporation",
      "Nationality, country of residence and registration",
      "Payment originator and beneficiary details (name, country, bank)",
      "Consolidated OFSI list + any applicable OFAC/EU/UN lists",
    ],
    matchingConfig: [
      { aspect: "List coverage", guidance: "Screen against the full HM Treasury/OFSI consolidated list; add OFAC/EU/UN where the firm has exposure. Verify the list updates daily.", source: "OFSI" },
      { aspect: "Fuzzy matching", guidance: "Calibrate fuzzy thresholds to balance missed hits against false positives; tune on a risk basis and revalidate after each calibration change.", source: "JMLSG" },
      { aspect: "Rescreening trigger", guidance: "Rescreen the entire customer base whenever the consolidated list changes (not only at onboarding).", source: "OFSI" },
      { aspect: "Coverage assurance", guidance: "Reconcile records onboarded vs records screened to prove no accounts are excluded from screening.", source: "FCA FCG" },
    ],
    detectionLogic: [
      { id: "SCR-S1", name: "Exact / strong name match to designated person", logic: "Customer or counterparty name matches a consolidated-list entry above the configured match score", threshold: "Configured fuzzy threshold (risk-based)", priority: "critical" },
      { id: "SCR-S2", name: "List-change rescreen hit", logic: "Existing customer newly matches a designated person following a list update", priority: "critical" },
      { id: "SCR-S3", name: "Screening coverage gap", logic: "Onboarded accounts not present in the screening population (coverage reconciliation break)", priority: "high" },
    ],
    escalationWorkflow: [
      { step: 1, title: "Auto-hold", description: "Block onboarding / freeze the payment pending review; do not process.", sla: "Immediate", owner: "System / L1" },
      { step: 2, title: "Hit review", description: "Analyst confirms true/false match against identifiers; document rationale.", sla: "Same day", owner: "L1 Analyst" },
      { step: 3, title: "Report & freeze", description: "If a true match, freeze assets and report to OFSI; escalate to MLRO.", sla: "Without delay", owner: "MLRO" },
    ],
    metrics: [
      { name: "Screening coverage", target: "100%", description: "Accounts/payments screened vs total in scope" },
      { name: "False-positive rate", target: "Monitored / tuned", description: "Discounted alerts vs total alerts, tracked over time" },
      { name: "List-update latency", target: "< 24h", description: "Time from list publication to rescreen completion" },
    ],
    governanceChecklist: [
      { id: "GOV-S1", item: "Independent validation of fuzzy-matching calibration", frequency: "At least annually and after each change", owner: "Compliance / 2LOD" },
      { id: "GOV-S2", item: "List-source and update-frequency assurance", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [
      { org: "OFSI", reference: "Financial sanctions guidance", title: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
      { org: "JMLSG", reference: "Part I, Ch.4", title: "Sanctions screening", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    ],
  },
  {
    id: 2,
    slug: "pep-screening",
    title: "PEP Screening Control",
    category: "pep",
    description:
      "Identify politically exposed persons, their family members and close associates, and apply risk-based enhanced due diligence and ongoing monitoring.",
    applicableFirmTypes: ["emi", "pi", "bank", "msb", "crypto", "neobank", "wealth_manager", "insurance"],
    applicableTriggers: ["onboarding", "ongoing", "periodic"],
    riskThemes: ["money_laundering", "bribery_corruption"],
    controlObjective:
      "Detect PEP status at onboarding and on an ongoing basis, apply proportionate EDD, and obtain senior-management approval where required — without de-risking lawful customers wholesale.",
    dataInputs: [
      "Name, date of birth, nationality and role/office held",
      "Family members and known close associates",
      "Source of wealth and source of funds evidence",
      "PEP reference data (domestic and foreign)",
    ],
    matchingConfig: [
      { aspect: "Scope", guidance: "Apply the FCA's proportionate approach to domestic vs foreign PEPs; do not apply blanket high-risk treatment to all PEPs.", source: "FCA FG17/6" },
      { aspect: "Association mapping", guidance: "Screen family members and close associates, not just the PEP.", source: "JMLSG" },
      { aspect: "Declassification", guidance: "Define when a person ceases to be treated as a PEP on a risk-sensitive basis.", source: "FCA FG17/6" },
    ],
    detectionLogic: [
      { id: "SCR-P1", name: "PEP match", logic: "Customer or connected party matches a PEP reference record", priority: "high" },
      { id: "SCR-P2", name: "Unexplained wealth signal", logic: "Activity or source-of-wealth inconsistent with the PEP's known profile", priority: "high" },
    ],
    escalationWorkflow: [
      { step: 1, title: "EDD trigger", description: "Apply enhanced due diligence and gather source-of-wealth evidence.", sla: "Pre-onboarding", owner: "L1 / Onboarding" },
      { step: 2, title: "Senior approval", description: "Obtain senior-management approval to establish/continue the relationship.", sla: "Pre-onboarding", owner: "Senior Management" },
      { step: 3, title: "Enhanced monitoring", description: "Apply ongoing enhanced monitoring proportionate to risk.", sla: "Ongoing", owner: "MLRO" },
    ],
    metrics: [
      { name: "PEP EDD completion", target: "100% before activation", description: "PEP relationships with completed EDD + approval" },
      { name: "Periodic review timeliness", target: "Per risk rating", description: "PEP reviews completed within their due dates" },
    ],
    governanceChecklist: [
      { id: "GOV-P1", item: "PEP policy aligned to FCA proportionate guidance", frequency: "Annually", owner: "Compliance" },
      { id: "GOV-P2", item: "Senior-management approval evidenced for PEP relationships", frequency: "Per relationship", owner: "MLRO" },
    ],
    sources: [
      { org: "FCA", reference: "FG17/6", title: "The treatment of PEPs under the MLRs", url: "https://www.fca.org.uk/publications/finalised-guidance/fg17-6-treatment-politically-exposed-persons-peps-under-money-laundering-regulations" },
      { org: "JMLSG", reference: "Part I, Ch.5", title: "Enhanced due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    ],
  },
  {
    id: 3,
    slug: "adverse-media-screening",
    title: "Adverse Media Screening Control",
    category: "adverse_media",
    description:
      "Screen customers and connected parties against negative-news sources for financial-crime, predicate-offence and reputational signals, with structured disposition.",
    applicableFirmTypes: ["bank", "wealth_manager", "crypto", "emi", "pi", "insurance"],
    applicableTriggers: ["onboarding", "ongoing", "periodic"],
    riskThemes: ["money_laundering", "fraud", "bribery_corruption"],
    controlObjective:
      "Surface credible negative news relevant to financial-crime risk, disposition it consistently, and feed material findings into the customer risk assessment.",
    dataInputs: [
      "Customer / connected-party names and identifiers",
      "Adverse-media data source(s) with category tagging",
      "Customer risk rating and relationship context",
    ],
    matchingConfig: [
      { aspect: "Relevance filtering", guidance: "Filter to financial-crime-relevant categories (e.g. ML, fraud, corruption, sanctions) and credible sources to manage noise.", source: "Wolfsberg" },
      { aspect: "Entity resolution", guidance: "Confirm the article refers to the customer (corroborate identifiers) before treating as a true match.", source: "JMLSG" },
      { aspect: "Disposition standard", guidance: "Apply a consistent, documented disposition rationale for each hit.", source: "FCA FCG" },
    ],
    detectionLogic: [
      { id: "SCR-A1", name: "Relevant adverse-media hit", logic: "Credible negative news in a financial-crime category corroborated to the customer", priority: "high" },
      { id: "SCR-A2", name: "Escalating coverage", logic: "New or intensifying adverse media on an existing customer", priority: "medium" },
    ],
    escalationWorkflow: [
      { step: 1, title: "Triage", description: "Confirm relevance and entity match; discount irrelevant noise with rationale.", sla: "Per SLA", owner: "L1 Analyst" },
      { step: 2, title: "Risk reassessment", description: "Feed confirmed findings into the customer risk rating and EDD.", sla: "Per SLA", owner: "L2 / EDD" },
      { step: 3, title: "Decision", description: "Decide exit / restrict / monitor; document and escalate where material.", sla: "Per SLA", owner: "MLRO" },
    ],
    metrics: [
      { name: "Disposition timeliness", target: "Within SLA", description: "Adverse-media alerts dispositioned within the defined SLA" },
      { name: "Escalation quality", target: "QA-sampled", description: "Sampled dispositions meeting the documented standard" },
    ],
    governanceChecklist: [
      { id: "GOV-A1", item: "Source list and category taxonomy reviewed", frequency: "Annually", owner: "Compliance" },
      { id: "GOV-A2", item: "Disposition QA sampling", frequency: "Monthly", owner: "2LOD" },
    ],
    sources: [
      { org: "Wolfsberg", reference: "Negative News Screening", title: "Wolfsberg guidance", url: "https://www.wolfsberg-principles.com/" },
      { org: "JMLSG", reference: "Part I", title: "Ongoing monitoring", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    ],
  },
  {
    id: 4,
    slug: "customer-name-screening",
    title: "Customer Name Screening Control",
    category: "name_screening",
    description:
      "End-to-end name-screening control across onboarding and the existing book, with calibration, coverage assurance and alert handling.",
    applicableFirmTypes: ["emi", "pi", "bank", "msb", "neobank", "crypto", "wealth_manager", "insurance"],
    applicableTriggers: ["onboarding", "ongoing", "periodic"],
    riskThemes: ["sanctions_evasion", "money_laundering"],
    controlObjective:
      "Ensure every in-scope customer and connected party is screened with calibrated matching, complete coverage, and timely, well-documented alert disposition.",
    dataInputs: [
      "Customer and connected-party names, DOB and identifiers",
      "Reference lists (sanctions, PEP, adverse media as applicable)",
      "Onboarding vs screened population for reconciliation",
    ],
    matchingConfig: [
      { aspect: "Calibration", guidance: "Set and validate fuzzy thresholds on a risk basis; revalidate after each change and document the rationale.", source: "JMLSG" },
      { aspect: "Coverage", guidance: "Reconcile screened population to onboarded population to evidence no exclusions.", source: "FCA FCG" },
      { aspect: "Transliteration", guidance: "Handle non-Latin scripts and name variants to reduce missed matches.", source: "Wolfsberg" },
    ],
    detectionLogic: [
      { id: "SCR-N1", name: "List match", logic: "Customer name matches a reference-list entry above the configured score", threshold: "Configured fuzzy threshold", priority: "high" },
      { id: "SCR-N2", name: "Coverage break", logic: "Onboarded accounts absent from the screened population", priority: "high" },
    ],
    escalationWorkflow: [
      { step: 1, title: "Alert generation", description: "System raises alerts above threshold; route to the queue.", sla: "Real-time / batch", owner: "System" },
      { step: 2, title: "Disposition", description: "Analyst confirms or discounts with documented rationale.", sla: "Per SLA", owner: "L1 Analyst" },
      { step: 3, title: "Escalation", description: "Escalate confirmed sanctions/PEP matches per the relevant control.", sla: "Per SLA", owner: "MLRO" },
    ],
    metrics: [
      { name: "Screening coverage", target: "100%", description: "In-scope records screened vs total" },
      { name: "Alert backlog", target: "Within SLA", description: "Open alerts older than the SLA" },
    ],
    governanceChecklist: [
      { id: "GOV-N1", item: "Independent calibration validation", frequency: "Annually + after changes", owner: "2LOD" },
      { id: "GOV-N2", item: "Coverage reconciliation evidenced", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [
      { org: "JMLSG", reference: "Part I, Ch.4", title: "Screening systems", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { org: "FCA", reference: "FCG", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
    ],
  },
  {
    id: 5,
    slug: "transaction-payment-screening",
    title: "Transaction / Payment Screening Control",
    category: "transaction_screening",
    description:
      "Real-time screening of payment messages (originator, beneficiary, banks and free-text fields) against sanctions lists before settlement.",
    applicableFirmTypes: ["emi", "pi", "bank", "msb", "neobank"],
    applicableTriggers: ["real_time"],
    riskThemes: ["sanctions_evasion", "money_laundering"],
    controlObjective:
      "Interdict payments involving designated persons or sanctioned destinations before funds move, with low latency and complete field coverage.",
    dataInputs: [
      "Originator and beneficiary name, country and account",
      "Ordering and beneficiary institution (BIC) details",
      "Payment free-text / reference fields",
      "Consolidated sanctions lists",
    ],
    matchingConfig: [
      { aspect: "Field coverage", guidance: "Screen all relevant message fields including free-text/reference, not just named parties.", source: "Wolfsberg" },
      { aspect: "Stop-the-payment", guidance: "Hold matching payments pre-settlement; never auto-release a true sanctions match.", source: "OFSI" },
      { aspect: "Latency", guidance: "Keep screening latency within payment SLAs while preserving hit quality.", source: "Wolfsberg" },
    ],
    detectionLogic: [
      { id: "SCR-T1", name: "Payment party match", logic: "Originator/beneficiary/institution matches a designated person above threshold", priority: "critical" },
      { id: "SCR-T2", name: "Free-text reference match", logic: "Sanctioned name/term detected in payment reference fields", priority: "high" },
    ],
    escalationWorkflow: [
      { step: 1, title: "Interdict", description: "Hold the payment pre-settlement; do not release.", sla: "Immediate", owner: "System / L1" },
      { step: 2, title: "Review", description: "Confirm true/false match against identifiers and routing.", sla: "Same day", owner: "L1 Analyst" },
      { step: 3, title: "Report", description: "If a true match, freeze and report to OFSI; escalate to MLRO.", sla: "Without delay", owner: "MLRO" },
    ],
    metrics: [
      { name: "Field coverage", target: "All in-scope fields", description: "Message fields included in screening" },
      { name: "Decision latency", target: "Within payment SLA", description: "Time to disposition held payments" },
    ],
    governanceChecklist: [
      { id: "GOV-T1", item: "Message-field coverage validated", frequency: "Annually + on rail changes", owner: "2LOD" },
      { id: "GOV-T2", item: "No auto-release of true matches (control test)", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [
      { org: "Wolfsberg", reference: "Payment Transparency / Screening", title: "Wolfsberg guidance", url: "https://www.wolfsberg-principles.com/" },
      { org: "OFSI", reference: "Financial sanctions guidance", title: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    ],
  },
];
