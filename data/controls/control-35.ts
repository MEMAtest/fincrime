import type { Control } from "./types";

export const control35: Control = {
  id: 35,
  slug: "sar-str-process",
  name: "SAR / STR Process & Timeliness",
  category: "governance_reporting",
  controlType: "corrective",
  plainSummary:
    "A clear, fast route for staff to raise a suspicion, for the MLRO to decide, and for a report to reach the authorities on time without tipping off the customer.",
  objective:
    "Ensure that internal suspicions are raised, evaluated by the nominated officer and, where suspicion remains, reported to the National Crime Agency as a Suspicious Activity Report promptly and without tipping off, with defence-against-money-laundering consent sought where required, in line with reg.21 of the MLR 2017, the Proceeds of Crime Act and FATF Recommendations 20 and 21.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "fraud",
    "bribery_corruption",
    "sanctions_evasion",
  ],
  applicableFirmTypes: [
    "emi",
    "pi",
    "bank",
    "msb",
    "crypto",
    "neobank",
    "wealth_manager",
    "insurance",
  ],
  typologySlugs: ["app-fraud-push-payments", "mule-account-activity"],
  enforcementRefs: [
    { firm: "Santander UK Plc", year: 2022 },
    { firm: "Commerzbank AG", year: 2020 },
  ],
  dataInputs: [
    "Internal suspicious activity reports (SARs) raised by staff or generated from alerts",
    "MLRO / nominated officer decision log (report / no report, with rationale)",
    "Date suspicion was formed, date of internal report, date of NCA submission",
    "DAML (defence) request and response status where consent is needed to proceed",
    "Account restriction / hold status linked to each report",
    "Tipping-off controls evidence (who knew, what the customer was told)",
    "NCA SAR reference numbers and glossary codes applied",
  ],
  ruleLogic:
    "Provide every member of staff a single, confidential internal-reporting route to the nominated officer. The nominated officer evaluates each internal report against all available information, records a documented decision to report or not, and where suspicion remains submits a SAR to the NCA as soon as practicable. Where the firm needs to carry out an act that might otherwise be a money-laundering offence, seek a defence (DAML) and do not proceed until consent or the statutory notice period expires. Throughout, restrict any disclosure that could tip off the customer or prejudice an investigation. Timeliness is the calibrated dimension: the procedure measures the elapsed time at each stage and flags overruns.",
  defaultThreshold:
    "Internal report acknowledged by the nominated officer within 1 business day; SAR submitted to the NCA within 5 business days of the decision to disclose; DAML requested before any consent-dependent act, with no transaction processed against a pending defence.",
  thresholdRationale:
    "POCA requires reporting as soon as is practicable and the NCA expects firms not to sit on formed suspicions; a five-business-day target from the disclosure decision gives time to quality-assure the narrative without letting reports age. The one-day acknowledgement stops internal reports being lost in an inbox, which is the failure pattern behind enforcement for slow action. Santander 2022 and Commerzbank 2020 both involved delayed or backlogged action on suspicious activity, so an explicit, measured stage clock is the corrective control that prevents recurrence. Firms should tighten the clock where harm is ongoing (e.g. live mule activity).",
  lookbackWindow:
    "Per-report stage timing measured continuously; aggregate timeliness and quality reviewed monthly and reported quarterly.",
  tuningNotes:
    "Calibrate by monitoring the distribution of stage times, not just the average: a small tail of very old undecided reports is the real risk, so track the oldest open item and the percentage breaching SLA. If submission times drift, the cause is usually nominated-officer capacity or a quality-assurance bottleneck rather than the target being wrong, so resource the function before relaxing the SLA. Watch the no-report rate and sample no-report decisions: an unusually high no-report rate can signal defensive under-reporting or, conversely, a low rate can signal defensive over-reporting that swamps the NCA. Tune the glossary-code usage so reports are actionable.",
  firstLineOwner: "Financial Crime Operations / investigators raising and drafting internal reports",
  secondLineOwner: "MLRO / Nominated Officer (statutory decision-maker on disclosure)",
  suggestedSystems: [
    "Case management system with an internal SAR workflow and decision log",
    "NCA SAR Online / SAR Portal submission integration",
    "Account restriction / hold capability linked to DAML status",
    "Management information dashboard tracking stage timing and ageing",
  ],
  escalation:
    "Internal reports where suspicion is confirmed are escalated to the nominated officer, who decides on disclosure and any DAML request. Reports breaching the submission SLA are escalated to the Head of Financial Crime and surfaced in the board MI. Any attempt to process a consent-dependent transaction before a defence is obtained is blocked and escalated immediately.",
  sla: "Internal report acknowledged within 1 business day; disclosure decision documented within 3 business days; SAR submitted within 5 business days of that decision; no consent-dependent act processed before DAML is resolved.",
  metrics: [
    {
      name: "On-time submission rate",
      target: ">= 98%",
      description: "SARs submitted to the NCA within 5 business days of the decision to disclose.",
    },
    {
      name: "Oldest open internal report",
      target: "0 reports > 10 business days undecided",
      description: "Ageing of internal reports awaiting a nominated-officer decision.",
    },
    {
      name: "DAML compliance",
      target: "100%",
      description: "Consent-dependent acts where a defence was requested and resolved before proceeding.",
    },
    {
      name: "Tipping-off incidents",
      target: "0",
      description: "Confirmed disclosures to a customer or third party that could prejudice an investigation.",
    },
  ],
  testPlan: [
    "Raise a synthetic internal report and trace it end-to-end, confirming acknowledgement, decision log entry, NCA submission and reference capture all occur within SLA.",
    "Attempt to process a consent-dependent transaction while a DAML request is pending and confirm the system blocks it and escalates.",
    "Sample 20 no-report decisions and confirm each carries a documented, defensible rationale rather than a blank closure.",
    "Review the ageing report and confirm no internal report has sat undecided beyond the threshold; investigate any tail items.",
  ],
  reviewCadence:
    "Stage-timing and quality MI reviewed monthly; the procedure and SLAs reviewed annually or on legislative change (e.g. POCA amendments, NCA guidance updates).",
  governance: [
    "MLRO holds personal statutory responsibility for disclosure decisions and signs the SAR quality and timeliness MI to the board.",
    "Decision logs, narratives, DAML correspondence and NCA references retained for at least five years.",
    "SLA breaches and tipping-off near-misses recorded as incidents with root-cause analysis.",
    "Board receives SAR volume, timeliness and quality MI and challenges adverse trends.",
  ],
  whatGoodLooksLike: [
    "Any staff member knows exactly how to raise a suspicion confidentially, and reports never get lost in transit.",
    "Every disclosure decision is documented with a rationale, and the oldest open report is days old, not months.",
    "No consent-dependent transaction is ever processed while a defence is pending, enforced by the platform.",
    "Timeliness and quality are visible to the board as MI, so drift is caught before a regulator finds it.",
  ],
  strongVsWeak: {
    strong:
      "A neobank routes a staff suspicion to the nominated officer the same day; the officer documents the decision, submits the SAR to the NCA on day three, requests a DAML before releasing a held payment, and waits for consent; the customer is told nothing, and the board sees a clean timeliness dashboard.",
    weak:
      "A bank lets internal reports pile up in a shared inbox for weeks, has no stage clock so nobody notices a three-month backlog, processes a flagged payment because the DAML status was never checked, and only realises when the regulator asks why action on suspicious activity was so slow.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.20",
      title: "FATF Recommendation 20: Reporting of suspicious transactions",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FATF",
      reference: "R.21",
      title: "FATF Recommendation 21: Tipping-off and confidentiality",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 6",
      title: "JMLSG Guidance, Part I, Chapter 6: Suspicious activity reporting",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: internal controls and nominated officer",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Financial crime systems and controls",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
  ],
};
