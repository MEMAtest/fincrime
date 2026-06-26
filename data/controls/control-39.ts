import type { Control } from "./types";

export const control39: Control = {
  id: 39,
  slug: "staff-training-awareness",
  name: "Staff Training & Awareness",
  category: "governance_reporting",
  controlType: "preventive",
  plainSummary:
    "Make sure everyone, especially front-line and high-risk roles, knows how to spot financial crime and what to do about it, and prove they have understood it.",
  objective:
    "Ensure all relevant employees are made aware of the law and their obligations and are given regular, role-appropriate training on recognising and handling financial crime, including how and to whom to report suspicions, in line with reg.24 of the MLR 2017 and FATF Recommendation 18.",
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
  typologySlugs: ["behavioural-change-indicators"],
  enforcementRefs: [{ firm: "Barclays Bank plc", year: 2025 }],
  dataInputs: [
    "Employee population segmented by role and financial crime risk exposure",
    "Training curriculum mapped to role (general awareness vs specialist)",
    "Completion records with dates and pass/fail assessment results",
    "Assessment scores and pass thresholds evidencing understanding, not just attendance",
    "New-joiner induction training status before access to in-scope tasks",
    "Targeted training triggered by incidents, typology alerts or regulatory change",
    "Feedback and effectiveness data (e.g. SAR quality, near-miss reporting trends)",
  ],
  ruleLogic:
    "Define a role-based training matrix: every relevant employee receives general awareness training at induction and at a regular refresh cadence, while higher-risk and specialist roles (front line, onboarding, operations, MLRO team) receive deeper, role-specific content. Training requires a passed assessment to evidence understanding, not mere attendance. New joiners complete induction training before performing in-scope tasks. Completion and pass rates are tracked, overdue training is chased and escalated, and content is refreshed for regulatory change, emerging typologies and lessons from incidents. The control is preventive: trained staff are the firm's first detective sensor, so under-training is an upstream control failure.",
  defaultThreshold:
    "100% of in-scope staff complete role-appropriate training at induction and at least annually, with a passed assessment (e.g. >= 80% score); new joiners trained before in-scope access; targeted training delivered within an agreed period of a material regulatory change or relevant incident.",
  thresholdRationale:
    "reg.24 requires relevant employees to be made aware of the law and given training, and the FCA expects training to be regular and role-relevant rather than a one-off tick-box; annual refresh with induction and event-driven top-ups is the established baseline, tightened for higher-risk roles. Requiring a passed assessment converts 'completed' from 'opened the slides' into evidenced understanding. Barclays 2025 reflected failures in recognising and managing financial crime risk; competent, role-trained staff who know what bad looks like and how to escalate are the preventive control that reduces that failure mode.",
  lookbackWindow:
    "Induction plus at least annual refresh; completion measured on a rolling 12-month basis; event-driven training tracked from the triggering change.",
  tuningNotes:
    "Calibrate by measuring whether training changes behaviour, not just completion: rising-quality SARs, more near-miss reports and better alert dispositions are the real signals; flat behaviour with 100% completion means the content is not landing. Differentiate content by role so front-line staff get scenario-based, relevant material rather than generic legal recitation. Use incidents and live typologies to keep examples current; stale, abstract training is ignored. Watch assessment pass rates: a 100% first-time pass on a trivial quiz proves nothing, so set a meaningful difficulty and re-test failures. Tighten refresh cadence for the highest-risk teams.",
  firstLineOwner: "Line managers and HR/Learning (delivery and completion in their teams)",
  secondLineOwner: "MLRO / Financial Crime Compliance (owns curriculum and competence standard)",
  suggestedSystems: [
    "Learning management system (LMS) with role-based assignment, assessment and reporting",
    "HR system feeding the employee population and role data",
    "Content authoring / e-learning platform for role-specific modules",
    "Completion and overdue-training dashboard feeding governance MI",
  ],
  escalation:
    "Overdue training beyond the grace period is escalated by Compliance to the line manager and, if unresolved, to senior management, with access to in-scope tasks restricted where appropriate. Repeated failures of an assessment trigger remedial coaching before the individual continues in-scope work. Material under-completion across a team is escalated to the Financial Crime Risk Committee as a control weakness.",
  sla: "Induction training completed before in-scope access; annual refresh completed within the assigned window; event-driven training delivered within an agreed period (e.g. 30 business days) of the triggering change.",
  metrics: [
    {
      name: "On-time completion rate",
      target: ">= 98%",
      description: "In-scope staff completing role-appropriate training within the assigned window.",
    },
    {
      name: "Assessment pass rate",
      target: ">= 95% (meaningful threshold)",
      description: "Staff passing a non-trivial competence assessment, with failures re-trained.",
    },
    {
      name: "New-joiner gating",
      target: "0 ungated",
      description: "New joiners performing in-scope tasks before completing induction training (should be zero).",
    },
    {
      name: "Behavioural effect",
      target: "Trending up",
      description: "Quality of SARs and near-miss reporting improving as a proxy for training effectiveness.",
    },
  ],
  testPlan: [
    "Pull the completion report and confirm 100% of a sampled high-risk team completed role-appropriate training within window, with passed assessments.",
    "Check that a recent new joiner could not perform an in-scope task until induction training was recorded complete.",
    "Pick a recent regulatory change or incident and confirm targeted training was delivered to the affected roles within SLA.",
    "Review the assessment to confirm it is non-trivial and that failures were re-trained rather than waved through.",
  ],
  reviewCadence:
    "Curriculum reviewed at least annually and on regulatory change; completion MI reviewed monthly; content refreshed for new typologies and lessons learned as they arise.",
  governance: [
    "MLRO owns the training curriculum and the competence standard and reports completion and effectiveness to governance.",
    "Completion, pass rates and overdue training reported in the financial crime MI pack.",
    "Training records, assessment results and content versions retained for at least five years.",
    "Senior management hold managers accountable for completion in their teams.",
  ],
  whatGoodLooksLike: [
    "Front-line staff get scenario-based training relevant to their actual role, not a generic legal lecture.",
    "Completion means a passed, non-trivial assessment, and new joiners cannot start in-scope work without it.",
    "Content is refreshed for live typologies and recent incidents, so examples feel current and real.",
    "Training effectiveness is judged by better SARs and more near-miss reports, not just a green completion bar.",
  ],
  strongVsWeak: {
    strong:
      "An MSB assigns onboarding agents scenario-based training on mule and smurfing red flags, gates account-handling access on a passed assessment, pushes a targeted module within two weeks of a new sanctions designation, and sees SAR quality and near-miss reporting rise; managers are held to 100% completion in their teams.",
    weak:
      "A firm sends one generic annual e-learning to everyone, counts 'opened the slides' as complete, lets new joiners handle accounts before any training, never updates the content for new typologies, and is surprised when front-line staff miss obvious red flags they were never meaningfully taught.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.24 training",
      title: "The Money Laundering Regulations 2017, reg.24: training of relevant employees",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FATF",
      reference: "R.18",
      title: "FATF Recommendation 18: Internal controls including employee training",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Training and competence",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 2",
      title: "JMLSG Guidance, Part I, Chapter 2: Staff awareness, training and alertness",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
