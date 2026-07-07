/**
 * Hand-authored teaching annotations for real enforcement cases, kept in a
 * SIDECAR so the generated `cases.ts` is never hand-edited. Joined to a case by
 * `firm` (or an alias) + `year`. Each says what actually failed and the controls
 * that would have caught it. Single source of truth for "what would have caught
 * this", reused by the TypologyIQ Evidence panel and the Controls Library.
 */
export interface CaseLesson {
  firm: string;
  year: number;
  /** Alternate firm names used elsewhere (e.g. the Controls Library short names). */
  aliases?: string[];
  /** One line: what actually failed. */
  rootCause: string;
  /** 2-4 controls that would have caught or prevented it. */
  preventedBy: string[];
}

export const CASE_LESSONS: CaseLesson[] = [
  {
    firm: "National Westminster Bank Plc", year: 2021, aliases: ["NatWest", "National Westminster Bank"],
    rootCause: "Automated and manual red flags were not acted on as a commercial customer deposited around £365m, much of it in cash, far beyond its expected activity.",
    preventedBy: [
      "Cash-deposit anomaly rules tuned to expected turnover",
      "Activity-versus-expected-profile monitoring with hard stops",
      "EDD and re-rating triggers for cash-intensive businesses",
      "Escalation when alerts repeat without resolution",
    ],
  },
  {
    firm: "Deutsche Bank AG", year: 2017,
    rootCause: "Deficient KYC and a flawed mirror-trading scheme allowed billions to be moved out of Russia through matched trades with no economic purpose.",
    preventedBy: [
      "KYC and source-of-funds checks proportionate to client risk",
      "Detection of matched or mirror trades lacking economic rationale",
      "Front-to-back monitoring across the investment bank",
      "Independent assurance over high-risk corridors",
    ],
  },
  {
    firm: "Credit Suisse International, Credit Suisse Securities (Europe) Ltd, and Credit Suisse AG", year: 2021,
    rootCause: "Weak financial-crime and anti-bribery controls around opaque loans connected to sovereign debt.",
    preventedBy: [
      "Enhanced due diligence on PEP and sovereign exposures",
      "Bribery and corruption risk assessment on each deal",
      "Independent credit and financial-crime sign-off",
      "Gifts, hospitality and conflicts controls",
    ],
  },
  {
    firm: "Santander UK Plc", year: 2022,
    rootCause: "Inadequate monitoring let business accounts receive far more than expected, including funds linked to money laundering, with slow action on alerts.",
    preventedBy: [
      "Expected-turnover thresholds set at onboarding and review",
      "Transaction monitoring tuned to declared activity",
      "Timely action on alerts, including account restriction",
      "Board MI on overdue and backlogged cases",
    ],
  },
  {
    firm: "Standard Chartered Bank", year: 2019,
    rootCause: "Insufficient CDD and monitoring in higher-risk markets and correspondent relationships.",
    preventedBy: [
      "Risk-based CDD in higher-risk jurisdictions",
      "Correspondent banking due diligence and nesting checks",
      "Sanctions and screening calibration for the corridors served",
      "Independent testing of controls in high-risk units",
    ],
  },
  {
    firm: "HSBC Bank plc", year: 2021, aliases: ["HSBC"],
    rootCause: "Automated transaction monitoring was deficient across several business lines, with weak scenario coverage and data-quality gaps.",
    preventedBy: [
      "Comprehensive monitoring scenario coverage",
      "Regular scenario tuning and gap analysis",
      "End-to-end data-quality assurance",
      "Independent assurance over monitoring effectiveness",
    ],
  },
  {
    firm: "Barclays Bank plc", year: 2025,
    rootCause: "Failed to identify and assess financial-crime risk with due skill, care and diligence over several years.",
    preventedBy: [
      "Documented financial-crime risk assessment refreshed on change",
      "Clear ownership across the three lines of defence",
      "Customer risk-rating model validation",
      "Board MI on residual risk",
    ],
  },
  {
    firm: "Commerzbank AG", year: 2020,
    rootCause: "Long-running failure to conduct timely CDD and to fix known monitoring weaknesses despite internal warnings.",
    preventedBy: [
      "Periodic CDD refresh with overdue tracking",
      "Remediation of known monitoring gaps to deadline",
      "Automated coverage checks for un-monitored accounts",
      "Senior accountability for backlog clearance",
    ],
  },
  {
    firm: "Starling Bank Limited", year: 2024, aliases: ["Starling Bank", "Starling"],
    rootCause: "Sanctions screening covered only a fraction of the sanctions list, and financial-crime controls did not scale with rapid customer growth.",
    preventedBy: [
      "Screening against the full consolidated sanctions list",
      "Screening coverage testing and model validation",
      "Controls scaled to the rate of customer growth",
      "Regulatory requirements (VREQ) tracked to closure",
    ],
  },
  {
    firm: "Metro Bank plc", year: 2024, aliases: ["Metro Bank"],
    rootCause: "An automated-system gap meant accounts opened from a certain date were never monitored, leaving tens of millions of transactions unscreened.",
    preventedBy: [
      "End-to-end coverage testing of transaction monitoring",
      "Reconciliation between the onboarding and monitoring populations",
      "Alerting on accounts excluded from monitoring",
      "Independent assurance over monitoring coverage",
    ],
  },
  {
    firm: "Monzo Bank Limited", year: 2025, aliases: ["Monzo", "Monzo Bank"],
    rootCause: "Inadequate customer onboarding, customer risk assessment and transaction monitoring during rapid growth, plus repeated breaches of a voluntary requirement not to onboard high-risk customers (tens of thousands were opened, some with implausible address details).",
    preventedBy: [
      "Onboarding controls that check address and identity plausibility",
      "Risk-based customer risk assessment scaled to growth",
      "Transaction monitoring tuned to the actual onboarded population",
      "Adherence to and board MI on regulatory restrictions (VREQ)",
    ],
  },
  {
    firm: "Equifax Limited", year: 2023, aliases: ["Equifax"],
    rootCause: "Outsourced data processing suffered a major breach with weak oversight of the outsourced provider.",
    preventedBy: [
      "Outsourcing and third-party risk due diligence",
      "Data-security controls and breach monitoring",
      "Governance over incident handling and customer treatment",
    ],
  },
  // ── 33 new entries ───────────────────────────────────────────────────────
  {
    firm: "John Wood Group PLC", year: 2026,
    rootCause: "The firm published misleading information, breaching Listing Principle 1 by failing to meet its disclosure obligations.",
    preventedBy: [
      "Three Lines of Defence & Accountability",
      "Independent Assurance & Control Testing",
      "Board & Management Information Reporting",
    ],
  },
  {
    firm: "Santander plc", year: 2014,
    rootCause: "The firm gave unsuitable investment advice and issued financial promotions that were not clear, fair or non-misleading.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Staff Training & Awareness",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "Metro Bank Plc", year: 2022,
    rootCause: "The firm breached Listing Rules by publishing misleading information, failing to meet market disclosure requirements.",
    preventedBy: [
      "Three Lines of Defence & Accountability",
      "Independent Assurance & Control Testing",
      "Board & Management Information Reporting",
    ],
  },
  {
    firm: "7722656 Canada Inc formerly trading as Swift Trade Inc", year: 2014,
    rootCause: "The firm executed trades to create a false or misleading impression in the market for profit, constituting market abuse.",
    preventedBy: [
      "Mirror & Matched-Trade Detection",
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "JLT Specialty Limited", year: 2022,
    rootCause: "The firm failed to maintain adequate anti-bribery, corruption and financial crime controls in its insurance operations.",
    preventedBy: [
      "Firm-Wide Financial Crime Risk Assessment",
      "Agent & Distributor Oversight",
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "Guaranty Trust Bank (UK) Limited (GT Bank)", year: 2023,
    rootCause: "The firm failed to maintain adequate controls to manage the risk of financial crime in its wholesale banking operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Firm-Wide Financial Crime Risk Assessment",
      "Ongoing CDD & Periodic Review",
    ],
  },
  {
    firm: "Standard Bank PLC", year: 2014,
    rootCause: "The firm lacked adequate AML policies for corporate customers connected to politically exposed persons.",
    preventedBy: [
      "PEP Identification & Enhanced Due Diligence",
      "PEP Screening",
      "Enhanced Due Diligence Programme",
      "Beneficial Ownership Identification & Verification",
    ],
  },
  {
    firm: "ADM Investor Services International Limited", year: 2023,
    rootCause: "The firm had serious financial crime control failings across its wholesale intermediary and broking operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Ghana International Bank Plc", year: 2022,
    rootCause: "The firm breached the Money Laundering Regulations in its corporate banking by failing to meet required AML standards.",
    preventedBy: [
      "Customer Identification & Verification (CIP/CDD)",
      "Customer Risk Assessment & Rating",
      "Ongoing CDD & Periodic Review",
      "Transaction-Monitoring Scenario Coverage Assurance",
    ],
  },
  {
    firm: "EFG Private Bank", year: 2013,
    rootCause: "The firm failed to take reasonable care to establish and maintain effective AML controls for high-risk customers.",
    preventedBy: [
      "Enhanced Due Diligence Programme",
      "Customer Risk Assessment & Rating",
      "Activity vs Expected Profile Monitoring",
      "Ongoing CDD & Periodic Review",
    ],
  },
  {
    firm: "Al Rayan Bank PLC", year: 2023,
    rootCause: "The firm breached PRIN 3 by failing to maintain adequate financial crime controls in its retail banking operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Ongoing CDD & Periodic Review",
      "Firm-Wide Financial Crime Risk Assessment",
    ],
  },
  {
    firm: "Sonali Bank (UK) Limited", year: 2016,
    rootCause: "The firm had governance failures, failed to be open with the regulator, and lacked adequate financial crime controls.",
    preventedBy: [
      "Three Lines of Defence & Accountability",
      "Firm-Wide Financial Crime Risk Assessment",
      "Board & Management Information Reporting",
      "Staff Training & Awareness",
    ],
  },
  {
    firm: "Bastion Capital London Limited", year: 2023,
    rootCause: "The firm failed to act with skill and care and lacked adequate financial crime controls in its trading operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Credit Suisse International", year: 2014,
    rootCause: "The firm failed to ensure its financial promotions for the Cliquet Product were clear, fair and not misleading.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
      "Staff Training & Awareness",
    ],
  },
  {
    firm: "The TJM Partnership Limited (Formerly known as Neovision Global Capital Limited) (In Liquidation)", year: 2022,
    rootCause: "The firm failed to act with skill and care and lacked adequate financial crime controls in trading.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Mako Financial Markets Partnership LLP", year: 2025,
    rootCause: "The firm failed to act with skill and care and lacked adequate financial crime controls in its trading firm operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Gatehouse Bank plc", year: 2022,
    rootCause: "The firm breached the Money Laundering Regulations in retail banking, failing to meet required AML standards.",
    preventedBy: [
      "Customer Identification & Verification (CIP/CDD)",
      "Customer Risk Assessment & Rating",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Ongoing CDD & Periodic Review",
    ],
  },
  {
    firm: "Yorkshire Building Society", year: 2014,
    rootCause: "The firm distributed financial promotions for the Cliquet Product that were not clear, fair or non-misleading.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Agent & Distributor Oversight",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "Gurpreet Singh Chadda", year: 2013,
    rootCause: "The individual deliberately misled vulnerable customers for personal financial gain, failing to act with integrity.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
      "Staff Training & Awareness",
    ],
  },
  {
    firm: "Canara Bank", year: 2018,
    rootCause: "The firm breached Principle 3 and SYSC by failing to maintain adequate financial crime systems and controls.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Firm-Wide Financial Crime Risk Assessment",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Barclays Bank plc", year: 2022,
    rootCause: "The firm breached PRIN 2 by failing to act with due skill and care over financial crime in its corporate banking sector.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Ongoing CDD & Periodic Review",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Sunrise Brokers LLP", year: 2021,
    rootCause: "The firm failed to act with skill, care and diligence and lacked adequate financial crime controls in trading.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Mark Bentley-Leek", year: 2013,
    rootCause: "The individual gave misleading investment advice to clients, failing to act honestly and in their best interests.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
      "Staff Training & Awareness",
    ],
  },
  {
    firm: "Guaranty Trust Bank (UK) Limited", year: 2013,
    rootCause: "The firm had failings in its AML controls for high-risk customers, lacking adequate due diligence and monitoring.",
    preventedBy: [
      "Enhanced Due Diligence Programme",
      "Customer Risk Assessment & Rating",
      "Activity vs Expected Profile Monitoring",
      "Ongoing CDD & Periodic Review",
    ],
  },
  {
    firm: "Mustafa Dervish", year: 2013,
    rootCause: "The individual gave misleading investment advice to clients, failing to act honestly and in their best interests.",
    preventedBy: [
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
      "Staff Training & Awareness",
    ],
  },
  {
    firm: "Arian Financial LLP", year: 2025,
    rootCause: "The firm breached PRIN 2 and PRIN 3 by failing to act with skill and care and lacking financial crime controls.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Sapien Capital Limited", year: 2021,
    rootCause: "The firm breached PRIN 2 and PRIN 3 by failing to maintain adequate financial crime controls in its trading operations.",
    preventedBy: [
      "Customer Risk Assessment & Rating",
      "Firm-Wide Financial Crime Risk Assessment",
      "Transaction-Monitoring Scenario Coverage Assurance",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Daniel James Plunkett", year: 2014,
    rootCause: "The individual placed orders to influence the Gold Fixing, breaching proper market conduct and integrity standards.",
    preventedBy: [
      "Mirror & Matched-Trade Detection",
      "Three Lines of Defence & Accountability",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Hall and Hanley Limited (HHL)", year: 2020,
    rootCause: "The firm misled consumers and treated them unfairly in claims management, breaching conduct of authorised persons rules.",
    preventedBy: [
      "Staff Training & Awareness",
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "Professional Personal Claims Limited", year: 2019,
    rootCause: "The firm misled consumers in the claims management sector, breaching conduct of authorised persons rules.",
    preventedBy: [
      "Staff Training & Awareness",
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "Steven Smith", year: 2016,
    rootCause: "The individual was knowingly concerned in financial crime and lacked the fitness and propriety of an approved person.",
    preventedBy: [
      "Three Lines of Defence & Accountability",
      "Staff Training & Awareness",
      "Independent Assurance & Control Testing",
    ],
  },
  {
    firm: "Douglas Jones", year: 2013,
    rootCause: "The individual failed to ensure mortgage application controls and altered client files to mislead the regulator.",
    preventedBy: [
      "Onboarding Fraud & Identity Controls",
      "Independent Assurance & Control Testing",
      "Three Lines of Defence & Accountability",
    ],
  },
  {
    firm: "City & Provincial", year: 2014,
    rootCause: "The individual deliberately provided false and misleading information in their own mortgage application.",
    preventedBy: [
      "Onboarding Fraud & Identity Controls",
      "Independent Assurance & Control Testing",
    ],
  },
];

const lessonIndex: Record<string, CaseLesson> = {};
for (const l of CASE_LESSONS) {
  lessonIndex[`${l.firm.trim().toLowerCase()}|${l.year}`] = l;
  for (const a of l.aliases ?? []) lessonIndex[`${a.trim().toLowerCase()}|${l.year}`] = l;
}

export function lessonFor(firm: string, year: number): CaseLesson | undefined {
  return lessonIndex[`${firm.trim().toLowerCase()}|${year}`];
}
