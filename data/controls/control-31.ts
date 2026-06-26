import type { Control } from "./types";

export const control31: Control = {
  id: 31,
  slug: "agent-distributor-oversight",
  name: "Agent & Distributor Oversight",
  category: "ongoing_monitoring",
  controlType: "preventive",
  plainSummary:
    "The firm vets and keeps watch over the agents and distributors who sell or move money on its behalf, so a rogue or nested agent cannot smuggle dirty money through its rails.",
  objective:
    "Ensure agents, distributors and intermediaries that act on the firm's behalf are properly due-diligenced, monitored and held to the firm's AML standards, and that nested or undisclosed sub-agent activity is identified and controlled.",
  riskThemes: ["money_laundering", "terrorist_financing", "sanctions_evasion"],
  applicableFirmTypes: ["msb", "emi", "pi", "bank"],
  typologySlugs: ["nested-msb-agent-risk", "high-risk-corridor-remittances", "third-party-round-tripping"],
  enforcementRefs: [{ firm: "Commerzbank AG", year: 2020 }],
  dataInputs: [
    "Agent onboarding due diligence (ownership, licensing, AML programme assessment)",
    "Agent registration and status feeds (regulator registers)",
    "Per-agent transaction volumes, corridors and customer mix",
    "Sub-agent and nested-relationship declarations",
    "Agent screening results (sanctions, PEP, adverse media on owners)",
    "Agent training, audit and remediation records",
  ],
  ruleLogic:
    "Onboard each agent with risk-based due diligence and assign an agent risk rating. Monitor each agent's activity against expected volumes, corridor profile and customer base, and against peer agents. Flag agents whose flows spike, who introduce undeclared corridors, whose customers cluster on shared attributes, or who appear to be passing through nested sub-agent traffic. Periodically re-due-diligence and audit agents on a risk-based cadence, and suspend or offboard agents that breach standards or fail audit.",
  defaultThreshold:
    "Re-due-diligence high-risk agents annually and others every two years; flag any agent whose monthly volume rises by 50 percent or more versus its trailing 6-month average, or that transacts in a corridor not in its approved profile; cap and review any agent originating volume above the limit set in its agreement.",
  thresholdRationale:
    "Agents are a recognised concentration risk because the firm relies on them for first-line CDD, so a risk-based re-due-diligence cadence and volume/corridor baselining are essential to catch an agent going rogue or being captured by a nested operator. The 50-percent month-on-month spike and out-of-profile corridor are practical, defensible flags for unexpected growth or scope creep; per-agent caps in the agreement give a hard control to fall back on.",
  lookbackWindow:
    "Agent activity baselined over a trailing 6 months with monthly comparison; due-diligence refresh on a 12 to 24 month risk-based cycle.",
  tuningNotes:
    "Calibrate volume and corridor flags per agent tier so that a large legitimate distributor is not flagged for normal growth while a small agent's sudden spike still fires. Expect the highest-value signals from corridor scope-creep and customer-attribute clustering across an agent's book. Prioritise audit effort on agents that are high volume, high-risk corridor or newly onboarded, and feed audit findings back into the agent risk rating.",
  firstLineOwner: "Agent / Partner Management team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Agent/partner lifecycle and due-diligence management system",
    "Transaction monitoring with per-agent and per-corridor analytics",
    "Screening platform for agent owners and beneficial owners",
    "Audit and remediation tracking tool",
  ],
  escalation:
    "Agents showing undeclared nesting, sanctions exposure or activity inconsistent with their declared business are escalated to the MLRO, transactions can be suspended, an audit is brought forward, and offboarding plus a SAR are considered where money laundering is suspected.",
  sla: "Agent risk flags triaged within 5 business days; high-severity flags (sanctions, suspected nesting) actioned within 1 business day.",
  metrics: [
    {
      name: "Agent due-diligence currency",
      target: "100% of agents within their risk-based refresh cadence",
      description: "Share of active agents whose due diligence is up to date for their risk tier.",
    },
    {
      name: "Agent audit coverage",
      target: "100% of high-risk agents audited annually",
      description: "High-risk agents receiving a completed AML audit each year.",
    },
    {
      name: "Out-of-profile activity resolution time",
      target: "Median < 5 business days",
      description: "Time to investigate and resolve agent volume or corridor flags.",
    },
  ],
  testPlan: [
    "Onboard a test agent with a missing AML programme assessment and confirm it cannot go live until due diligence is complete.",
    "Push a 60 percent month-on-month volume spike for one agent and confirm a flag and review case are raised.",
    "Route traffic through an undeclared corridor for an agent and confirm a scope-creep flag fires.",
    "Reconcile the active agent list against the due-diligence system to confirm no agent is transacting without current due diligence or a risk rating.",
  ],
  reviewCadence: "Agent risk ratings and monitoring thresholds reviewed quarterly; oversight programme reviewed annually.",
  governance: [
    "MLRO approves the agent onboarding standard, risk-rating methodology and offboarding triggers.",
    "Quarterly MI on agent population, due-diligence currency, audit coverage and flags to the Financial Crime Committee.",
    "Audit findings and remediation tracked to closure with second-line oversight.",
    "Agent due-diligence and monitoring records retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Every agent has current, risk-based due diligence and a baseline of expected activity.",
    "Nested and undeclared sub-agent activity is actively looked for, not assumed away.",
    "Agent volume and corridor flags are tiered so legitimate growth is not confused with abuse.",
    "Audit findings feed back into the agent's risk rating and can trigger offboarding.",
  ],
  strongVsWeak: {
    strong:
      "An MSB agent's volume jumps 60 percent in a month and a new high-risk corridor appears; the spike and scope-creep flags fire, an audit is brought forward, and it emerges the agent had been processing for an undeclared nested sub-agent, leading to suspension, offboarding and a SAR.",
    weak:
      "The same agent grows quietly for two years with no baseline and no refresh of its onboarding due diligence; the nested sub-agent is only discovered when a correspondent bank queries the corridor, by which point the firm cannot explain who was really behind the flows.",
  },
  sources: [
    {
      org: "JMLSG",
      reference: "Part I, Chapter 7",
      title: "JMLSG Guidance - Agents and Outsourcing",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "Recommendation 13",
      title: "FATF Recommendations - Correspondent and Agent Relationships",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Standards",
      title: "Wolfsberg Standards - Correspondent Banking and Agent Oversight",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
  ],
};
