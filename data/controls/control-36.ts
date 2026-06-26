import type { Control } from "./types";

export const control36: Control = {
  id: 36,
  slug: "board-mi-reporting",
  name: "Board & Management Information Reporting",
  category: "governance_reporting",
  controlType: "detective",
  plainSummary:
    "Regular, honest numbers and trends about financial crime risk put in front of senior leaders, so problems are seen and acted on instead of being buried.",
  objective:
    "Provide the board and senior management with accurate, timely and decision-useful management information on financial crime risk and control performance, so that emerging issues, backlogs and control failures are detected and challenged at the right level, in line with reg.21 of the MLR 2017, FATF Recommendation 18 and the FCA's expectations on senior management responsibility.",
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
    { firm: "Santander UK Plc", year: 2022 },
    { firm: "Barclays Bank plc", year: 2025 },
  ],
  dataInputs: [
    "Alert and case volumes, ageing and backlog by scenario and queue",
    "SAR volumes, timeliness and quality trends",
    "Sanctions and PEP screening hit volumes, false-positive rates and ageing",
    "CDD/KYC coverage, periodic-review completion and overdue counts",
    "Key risk indicators and key control indicators against thresholds with trend arrows",
    "Open audit, assurance and remediation actions with due dates and overdue flags",
    "Material incidents, regulatory interactions and emerging-risk commentary",
  ],
  ruleLogic:
    "Define a standing financial crime MI pack with a fixed set of key risk and control indicators, each with a green/amber/red threshold and a trend. Populate it from authoritative source systems on a regular cadence, present it to the relevant committee and board, and require documented challenge and decisions. Any indicator breaching red, or trending adversely toward a threshold, is narrated with cause and remedial action rather than reported as a bare number. The control is detective: its job is to surface deterioration (a growing backlog, slipping SAR timeliness, rising overdue reviews) early enough for management to intervene.",
  defaultThreshold:
    "A defined financial crime MI pack delivered to the relevant committee at least quarterly and to the board at least twice a year; every red indicator accompanied by cause, owner and dated remediation; no material adverse trend reported without narrative.",
  thresholdRationale:
    "The FCA and MLR place financial crime accountability with senior management, who cannot discharge it without regular, reliable MI; a quarterly committee cadence with board sight at least twice yearly is the established minimum for a regulated firm, tightened for higher-risk firms to monthly. Requiring narrative and dated actions against red indicators is what converts reporting from a dashboard into a control. Santander 2022 and Barclays 2025 both reflected situations where risk and control weaknesses were not gripped at a senior level in time; decision-useful MI with mandatory challenge is the detective control that forces that grip.",
  lookbackWindow:
    "Each pack reports the latest period with rolling 12-month trends; cadence at least quarterly to committee and biannually to board.",
  tuningNotes:
    "Calibrate the indicator set so it shows risk, not activity vanity metrics: a pack full of green tiles that never moves is a sign the wrong things are being measured. Pressure-test by asking whether any recent issue (a backlog, a missed SAR deadline) would have shown up as an amber/red before it became a problem; if not, add the indicator. Keep the pack short and trend-led so the board can actually read it; relegate operational detail to appendices. Re-baseline thresholds when volumes structurally change (new product, growth) so the colours stay meaningful rather than permanently red or permanently green.",
  firstLineOwner: "Financial Crime Operations / MI team compiling the pack",
  secondLineOwner: "MLRO / Head of Financial Crime (owns the pack and the narrative to the board)",
  suggestedSystems: [
    "Management information / BI dashboard aggregating case, screening and CDD systems",
    "Data warehouse joining alert, SAR, screening and remediation data",
    "Committee and board governance / papers platform with retained minutes",
    "Action-tracking tool linking red indicators to dated remediation",
  ],
  escalation:
    "Red indicators and adverse trends are escalated by the MLRO to the Financial Crime Risk Committee with a remediation recommendation, and material items to the board. Where MI reveals a control failure or backlog breaching appetite, an action is raised with an owner and date and tracked to closure; repeated breaches of the same indicator are escalated as a thematic concern.",
  sla: "Standing pack produced and circulated at least 3 business days before each committee; red indicators carry a remediation action within 5 business days of being reported.",
  metrics: [
    {
      name: "Reporting cadence adherence",
      target: "100%",
      description: "Scheduled committee and board MI packs delivered on time and complete.",
    },
    {
      name: "Red-indicator action coverage",
      target: "100%",
      description: "Red key risk/control indicators that carry a dated, owned remediation action.",
    },
    {
      name: "MI accuracy",
      target: "0 material restatements",
      description: "Packs requiring correction after issue due to data errors.",
    },
    {
      name: "Early-warning effectiveness",
      target: "Issues flagged amber/red before crystallising",
      description: "Material control failures preceded by an adverse MI signal rather than discovered cold.",
    },
  ],
  testPlan: [
    "Pick a recent control failure or backlog and confirm the MI pack showed an amber or red signal before it crystallised; if it did not, identify the missing indicator.",
    "Reconcile three headline numbers in the latest pack (e.g. SAR count, overdue reviews) back to the source systems and confirm they tie out.",
    "Review the last four committee minutes and confirm every red indicator received documented challenge and a dated action.",
    "Check the action tracker and confirm remediation raised from red indicators is being closed on time, not rolling indefinitely.",
  ],
  reviewCadence:
    "MI pack delivered at least quarterly; indicator set and thresholds reviewed annually or when the business profile materially changes.",
  governance: [
    "Board and the Financial Crime Risk Committee receive the pack, and minutes evidence challenge and decisions, not passive noting.",
    "MLRO attests to the accuracy and completeness of the pack and owns the narrative.",
    "Indicator definitions, thresholds and rationale documented and version-controlled.",
    "Packs, minutes and resulting actions retained for at least five years as the governance audit trail.",
  ],
  whatGoodLooksLike: [
    "The board sees a short, trend-led pack that tells them where risk is moving, not a wall of static green tiles.",
    "Every red indicator comes with a cause, an owner and a date, and minutes show the board challenged it.",
    "Numbers reconcile to source systems and are rarely, if ever, restated after issue.",
    "Problems show up as amber on the dashboard before they become incidents a regulator finds first.",
  ],
  strongVsWeak: {
    strong:
      "A bank's quarterly pack shows alert backlog ageing trending red two periods before it breaches appetite; the committee challenges it, the MLRO presents a resourcing plan with dates, the board approves it, and the minutes capture the decision; the backlog is cleared before any SAR deadline is missed.",
    weak:
      "A firm tables a 60-page pack of activity counts with no thresholds or trends, the board notes it without discussion, a growing case backlog is buried on page 40, and the first time anyone grips it is when the regulator points to overdue suspicious-activity reviews.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.18",
      title: "FATF Recommendation 18: Internal controls and foreign branches and subsidiaries",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Financial crime systems and controls and governance",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 2",
      title: "JMLSG Guidance, Part I, Chapter 2: Senior management responsibility and governance",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: internal controls and management oversight",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
  ],
};
