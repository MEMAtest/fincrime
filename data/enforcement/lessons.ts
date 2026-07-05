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
];

const lessonIndex: Record<string, CaseLesson> = {};
for (const l of CASE_LESSONS) {
  lessonIndex[`${l.firm.trim().toLowerCase()}|${l.year}`] = l;
  for (const a of l.aliases ?? []) lessonIndex[`${a.trim().toLowerCase()}|${l.year}`] = l;
}

export function lessonFor(firm: string, year: number): CaseLesson | undefined {
  return lessonIndex[`${firm.trim().toLowerCase()}|${year}`];
}
