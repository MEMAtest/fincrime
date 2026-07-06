import type { Control } from "./types";

export const control40: Control = {
  id: 40,
  slug: "alert-backlog-management",
  name: "Alert & Case Backlog Management",
  category: "governance_reporting",
  controlType: "corrective",
  plainSummary:
    "Stop financial crime alerts and cases piling up unworked by tracking how old they are, fixing the cause, and stepping in fast when the queue grows.",
  objective:
    "Ensure financial crime alerts and cases are worked within target timescales and that any backlog is identified, controlled and remediated before it lets suspicious activity go unreviewed, in line with the FCA's expectations on timely monitoring and reg.21 of the MLR 2017.",
  plainObjective: "To keep financial crime alerts and cases worked on time and to catch and clear any backlog before suspicious activity slips through unreviewed.",
  plainHowItWorks: "It constantly measures how old open items are against risk-tiered targets, watches new items against ones closed, and when a backlog trigger trips it runs a playbook to prioritise, add capacity and fix the cause.",
  plainWhyThreshold: "Regulators have criticised firms for letting queues build unseen, so risk-tiered targets with a clear backlog trigger force early action, and sanctions and live-harm items are ring-fenced to tight timescales.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
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
  typologySlugs: ["mule-account-activity"],
  enforcementRefs: [
    { firm: "Santander UK Plc", year: 2022 },
    { firm: "Commerzbank AG", year: 2020 },
  ],
  dataInputs: [
    "Open alert and case inventory by queue, scenario and risk rating",
    "Ageing of each item (time since creation and time since last action)",
    "Target turnaround SLAs per queue and risk tier",
    "Inflow vs throughput rates (new items vs items closed) per period",
    "Analyst capacity and utilisation",
    "Backlog cause codes (volume spike, tuning change, attrition, system outage)",
    "Oldest-item and SLA-breach counts feeding governance MI",
  ],
  ruleLogic:
    "Continuously measure the age of every open alert and case and compare against per-queue, risk-tiered SLAs. Maintain a backlog definition (e.g. items past SLA) and track inflow against throughput so a building queue is seen early. When backlog breaches a defined trigger, invoke a documented remediation playbook: prioritise oldest and highest-risk items first, add or reallocate capacity, and root-cause the build-up. Sanctions and live-harm cases (e.g. active mule accounts) are ring-fenced from backlog and worked to tight SLAs regardless. The control is corrective: it exists to recover and prevent the unreviewed-activity gap that backlogs create.",
  defaultThreshold:
    "Standard alerts worked within their queue SLA (e.g. 5 business days); high-risk and sanctions items within 1-2 business days; backlog trigger at a defined threshold (e.g. >2% of open items past SLA, or any sanctions item past SLA) invoking the remediation playbook; oldest open item tracked and capped.",
  thresholdRationale:
    "The FCA has repeatedly criticised firms for letting alert and case backlogs build so that suspicious activity went unreviewed; risk-tiered SLAs with an explicit backlog trigger force early intervention rather than discovery after months. Ring-fencing sanctions and live-harm items reflects that those cannot wait behind a general queue. Santander 2022 and Commerzbank 2020 both involved delayed action and backlogs in monitoring; an inflow-versus-throughput view plus a triggered playbook is the corrective control that would have surfaced and recovered those queues before they became enforcement findings. Tighten triggers where inflow is volatile.",
  lookbackWindow:
    "Ageing and inflow/throughput measured continuously; backlog position reviewed at least weekly operationally and reported monthly to governance.",
  tuningNotes:
    "Calibrate the backlog trigger to inflow volatility: a firm with spiky volumes needs a tighter early trigger so it can add capacity before the queue runs away. Distinguish a temporary spike (work it down with overtime) from a structural inflow increase (needs permanent capacity or rule tuning that reduces false positives) so the firm fixes the cause, not just the symptom. Never clear a backlog by closing alerts unreviewed or auto-closing en masse; that converts a backlog into a worse, hidden control failure. Track the oldest item, not just the average age, because the oldest unreviewed alert is where the real risk sits. Re-baseline SLAs when scenarios or volumes change.",
  firstLineOwner: "Financial Crime Operations team lead (queue management and throughput)",
  secondLineOwner: "MLRO / Head of Financial Crime (owns SLAs, backlog trigger and oversight)",
  suggestedSystems: [
    "Case management / workflow system with ageing, SLA timers and queue analytics",
    "Capacity and workforce-management tooling",
    "Backlog and inflow/throughput dashboard feeding governance MI",
    "Transaction monitoring rules engine (to tune false-positive inflow at source)",
  ],
  escalation:
    "Breaching the backlog trigger is escalated by the operations lead to the MLRO, who invokes the remediation playbook and reports to the Financial Crime Risk Committee. Any sanctions or live-harm item past SLA is escalated immediately. A structural inflow increase that capacity cannot absorb is escalated to the board for resourcing or rule-tuning decisions; clearing backlog by closing items unreviewed is prohibited and any instance is treated as an incident.",
  sla: "Standard items within queue SLA; high-risk and sanctions items within 1-2 business days; backlog remediation playbook invoked within 1 business day of the trigger breaching; oldest-item target maintained.",
  metrics: [
    {
      name: "SLA adherence",
      target: ">= 98%",
      description: "Alerts and cases closed within their queue and risk-tier SLA.",
    },
    {
      name: "Backlog as share of open items",
      target: "< 2%",
      description: "Open items past SLA, with sanctions/live-harm items held at zero.",
    },
    {
      name: "Inflow vs throughput",
      target: "Throughput >= inflow over time",
      description: "Closed items keep pace with new items so the queue does not structurally grow.",
    },
    {
      name: "Oldest open item",
      target: "Capped per policy",
      description: "Age of the single oldest unreviewed alert or case, the point of greatest residual risk.",
    },
  ],
  testPlan: [
    "Review the ageing report and confirm no sanctions or high-risk item sits past its tight SLA; investigate any that do.",
    "Simulate a volume spike that breaches the backlog trigger and confirm the remediation playbook is invoked and logged within SLA.",
    "Audit a sample of recently closed alerts to confirm they were genuinely reviewed, not bulk auto-closed to flatter the backlog.",
    "Compare inflow against throughput over the last quarter and confirm a structural increase, if present, was escalated for capacity or tuning.",
  ],
  reviewCadence:
    "Backlog position reviewed weekly operationally and monthly at governance; SLAs and the backlog trigger reviewed at least annually or when volumes structurally change.",
  governance: [
    "MLRO sets and approves queue SLAs and the backlog trigger and reports backlog MI to the board.",
    "Backlog ageing, inflow/throughput and oldest-item metrics included in the financial crime MI pack.",
    "Mass-closure or unreviewed clearance of alerts prohibited; any instance recorded as an incident with root-cause analysis.",
    "Remediation playbook invocations, cause codes and outcomes retained as evidence for at least five years.",
  ],
  whatGoodLooksLike: [
    "The team sees a building queue early from inflow-versus-throughput, and adds capacity before it becomes a backlog.",
    "Sanctions and live-harm items are ring-fenced and never wait behind the general queue.",
    "Backlogs are cleared by genuinely working items, never by bulk auto-closing them unreviewed.",
    "The board sees the oldest open item, not just an average, so the real risk point is visible.",
  ],
  strongVsWeak: {
    strong:
      "A neobank tracks inflow against throughput daily, spots a structural rise after a new rule goes live, tunes out false positives at source and adds two analysts, ring-fences sanctions alerts to a 24-hour SLA, and clears the temporary spike with reviewed dispositions; the board sees the oldest item capped at five days.",
    weak:
      "A bank lets alerts accumulate for months with no ageing view, only notices a 40,000-item backlog when an auditor asks, then 'fixes' it by auto-closing everything over 90 days unreviewed, leaving genuinely suspicious activity unexamined and a far worse control failure than the backlog it hid.",
  },
  sources: [
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Timely monitoring and management of alerts",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: internal controls and monitoring",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 6",
      title: "JMLSG Guidance, Part I, Chapter 6: Investigating and reporting suspicious activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "R.20",
      title: "FATF Recommendation 20: Reporting of suspicious transactions promptly",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
  ],
};
