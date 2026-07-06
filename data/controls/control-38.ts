import type { Control } from "./types";

export const control38: Control = {
  id: 38,
  slug: "independent-assurance-testing",
  name: "Independent Assurance & Control Testing",
  category: "governance_reporting",
  controlType: "detective",
  plainSummary:
    "People independent of the day-to-day teams regularly test whether financial crime controls actually work, so weaknesses are found internally before a regulator finds them.",
  objective:
    "Provide independent, risk-based assurance that financial crime controls are designed appropriately and operating effectively, through second-line monitoring and third-line audit, so that control failures and design gaps are detected, reported and remediated, in line with reg.21 of the MLR 2017 and FATF Recommendation 18.",
  plainObjective: "To give independent, risk-based assurance that financial crime controls are well designed and actually working, so gaps and failures are found, reported and fixed rather than assumed away.",
  plainHowItWorks: "It runs a risk-based plan that tests the highest-risk controls for both design and real-world operation using proper sampling, rates and root-causes findings, then tracks fixes to closure with an independent re-test.",
  plainWhyThreshold: "Rules expect an independent audit function and controls to be tested not assumed, so high-risk controls are checked yearly and serious findings close only after an independent re-test.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
    "bribery_corruption",
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
  typologySlugs: [],
  enforcementRefs: [
    { firm: "HSBC Bank plc", year: 2021 },
    { firm: "Barclays Bank plc", year: 2025 },
    { firm: "Metro Bank plc", year: 2024 },
  ],
  dataInputs: [
    "Risk-based assurance plan mapped to the firm-wide financial crime risk assessment",
    "Control inventory with design and operating-effectiveness ratings",
    "Sampling methodology, sample sizes and tolerable-error thresholds per control",
    "Test results, exceptions and root-cause findings",
    "Remediation actions with owners, due dates and status",
    "Independence evidence for the assurance and audit functions",
    "Prior findings and their closure verification (re-test results)",
  ],
  ruleLogic:
    "Maintain a risk-based assurance plan that prioritises testing toward the controls covering the firm's highest residual risks. For each control in scope, test both design (is it capable of mitigating the risk) and operating effectiveness (does it actually do so in practice) using defensible sampling. Findings are rated by severity, root-caused, assigned to an owner with a due date and tracked to closure with independent re-test verification. Coverage is driven by risk and refreshed when the risk assessment changes. This is a detective control: it exists to catch design gaps and operating failures that first-line controls and routine MI miss.",
  defaultThreshold:
    "A risk-based assurance plan covering all high-residual-risk controls at least annually (lower-risk controls on a multi-year rotation); sampling sized to a defensible confidence level; every finding rated, owned, dated and re-tested at closure; no high-severity finding closed without independent verification.",
  thresholdRationale:
    "reg.21 requires firms to establish an independent audit function where appropriate to the size and nature of the business, and the FCA expects controls to be tested rather than assumed to work; annual coverage of high-risk controls with risk-tiered rotation balances assurance depth against cost. Independent re-test before closure prevents the common failure of marking findings 'closed' on a promise. Both Barclays 2025 and Metro Bank 2024 involved control weaknesses that effective independent testing should have surfaced and forced remediation on before they crystallised into enforcement.",
  lookbackWindow:
    "High-risk controls tested at least annually; lower-risk controls on a documented multi-year rotation; plan re-prioritised whenever the firm-wide risk assessment changes.",
  tuningNotes:
    "Calibrate coverage to residual risk, not to whatever is easy to test: if the plan repeatedly skips the highest-risk areas because they are hard, the assurance is theatre. Size samples to a stated confidence level and tolerable error rate so a clean result actually means something; tiny ad hoc samples give false comfort. Track repeat findings: the same issue recurring means root cause was never fixed, so escalate it as systemic rather than re-testing forever. Guard independence: if assurance is pressured to soften ratings, the control is compromised. Re-baseline the plan when the risk assessment moves so testing follows the risk.",
  firstLineOwner: "Control owners (remediate findings); first-line QA where it performs in-line checking",
  secondLineOwner: "Compliance Assurance / Internal Audit (independent testing and reporting)",
  suggestedSystems: [
    "GRC / audit management platform with planning, sampling and findings workflow",
    "Control inventory linked to the firm-wide risk assessment",
    "Issue and action tracker with re-test and closure verification",
    "Sampling and analytics tooling for population-based testing",
  ],
  escalation:
    "High-severity findings are escalated by the assurance function to the Financial Crime Risk Committee and, where material, the Audit Committee and board, with a remediation owner and date. Overdue or repeat findings are escalated as systemic. Any attempt to dilute a finding's rating or close it without re-test is escalated to protect independence.",
  sla: "Findings reported within an agreed period of fieldwork completion; high-severity remediation due dates agreed at reporting and tracked to closure; closure verified by independent re-test before sign-off.",
  metrics: [
    {
      name: "High-risk control coverage",
      target: "100% annually",
      description: "Controls covering high residual risks tested at least once in the plan year.",
    },
    {
      name: "Finding closure on time",
      target: ">= 90%",
      description: "Remediation actions closed by their agreed due date with verified re-test.",
    },
    {
      name: "Repeat-finding rate",
      target: "Trending down",
      description: "Findings recurring across cycles, indicating root cause not addressed.",
    },
    {
      name: "Independence integrity",
      target: "0 compromised tests",
      description: "Assurance work where independence was breached or a rating was overridden under pressure.",
    },
  ],
  testPlan: [
    "Cross-check the assurance plan against the firm-wide risk assessment and confirm every high-residual-risk control is scheduled at least annually.",
    "Take a sample of closed findings and confirm each was re-tested independently, not closed on the owner's assertion alone.",
    "Review sampling for a recent test and confirm the sample size supports the stated confidence and tolerable-error level.",
    "Identify any repeat findings across two cycles and confirm they were escalated as systemic rather than quietly re-raised.",
  ],
  reviewCadence:
    "Assurance plan reviewed and re-prioritised at least annually and whenever the risk assessment materially changes; methodology reviewed annually.",
  governance: [
    "Audit Committee or board approves the assurance plan and receives findings and closure reporting.",
    "Assurance and audit functions report independently of the first line, with protected reporting lines.",
    "Findings, evidence, ratings and re-test results retained for at least five years.",
    "High-severity and repeat findings escalated to senior governance with tracked remediation.",
  ],
  whatGoodLooksLike: [
    "Testing is aimed at the riskiest controls first, with samples big enough that a clean result genuinely means something.",
    "Findings are root-caused, owned, dated and independently re-tested before anyone calls them closed.",
    "Repeat findings are treated as a systemic alarm, not re-raised politely each cycle.",
    "The assurance function can rate a control red without that rating being softened under pressure.",
  ],
  strongVsWeak: {
    strong:
      "A bank's compliance assurance team tests its highest-risk monitoring and screening controls annually with risk-based samples, rates a screening gap high-severity, agrees a dated fix with the owner, independently re-tests before closing it, and escalates a repeat CDD finding to the Audit Committee as systemic; the board sees coverage and closure trends.",
    weak:
      "A firm runs a token annual review that samples five easy files, never tests the high-risk areas because they are hard, lets owners self-certify findings as closed, re-raises the same CDD weakness three years running without escalating it, and softens a red rating to amber after pushback from the business.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.18",
      title: "FATF Recommendation 18: Internal controls and the independent audit function",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: independent audit function",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Systems, controls and assurance",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Statement on Effectiveness",
      title: "Wolfsberg Group Statement on Demonstrating Effectiveness",
      url: "https://www.wolfsberg-principles.com/",
    },
  ],
};
