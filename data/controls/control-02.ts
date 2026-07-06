import type { Control } from "./types";

export const control02: Control = {
  id: 2,
  slug: "beneficial-ownership-verification",
  name: "Beneficial Ownership Identification & Verification",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "For any company or trust customer, find out who really owns or controls it (the actual humans), and prove it, before letting them transact.",
  objective:
    "Identify the beneficial owner(s) of a legal person or arrangement and take reasonable measures to verify their identity so that the firm knows the natural persons who ultimately own or control the customer, satisfying reg.28(2)-(4) of the MLR 2017 and supporting transparency of legal persons and arrangements.",
  plainObjective: "Work out and prove which real people ultimately own or control a company or trust customer, so the firm always knows the humans behind the business.",
  plainHowItWorks: "It traces the ownership chain down to actual people, flagging anyone with a big enough stake or control, screening them, and refusing to open the account until the structure is mapped and any gaps explained.",
  plainWhyThreshold: "The 25% ownership mark is the legal default, and expecting the chain to resolve within a few layers reflects that honest businesses rarely stack ownership as deeply as concealment schemes.",
  riskThemes: ["money_laundering", "bribery_corruption", "sanctions_evasion"],
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
  typologySlugs: [
    "front-company-bo-obfuscation",
    "shell-company-indicators",
    "third-party-round-tripping",
  ],
  enforcementRefs: [
    { firm: "Al Rayan Bank PLC", year: 2023 },
    { firm: "Ghana International Bank Plc", year: 2022 },
  ],
  dataInputs: [
    "Full ownership and control chain to ultimate natural persons",
    "Percentage shareholdings and voting rights at each layer",
    "Identity attributes for each beneficial owner (>25% threshold and any controller)",
    "Company registry / PSC register data for each entity in the chain",
    "Shareholder register, share certificates or trust deed",
    "Senior managing official details where no owner meets the threshold",
    "Nominee / bearer-share indicators and jurisdiction of each layer",
    "Sanctions and PEP screening result for every identified beneficial owner",
  ],
  ruleLogic:
    "For each entity or arrangement customer, build the ownership and control structure to natural persons. Identify every beneficial owner holding >25% of shares or voting rights and any person otherwise exercising control. Verify each identified beneficial owner on a risk-sensitive basis and screen them. If ownership cannot be traced to natural persons, or the structure relies on nominees, bearer shares or jurisdictions that frustrate transparency, treat as higher risk: where no owner meets the threshold, identify and record the senior managing official and the reason. Block activation until the structure is mapped, beneficial owners screened, and any control gaps are explained and signed off.",
  defaultThreshold:
    ">25% direct or indirect ownership/voting rights defines a beneficial owner; verify identity of every such person; require the full chain to be resolved to natural persons within 3 ownership layers before activation, or document why a deeper/opaque chain is acceptable.",
  thresholdRationale:
    "The MLR 2017 set the 25% beneficial-ownership threshold, so it is the defensible default; firms wanting tighter control on higher-risk structures may lower it (e.g. to 10%) for PEP-linked or high-risk-jurisdiction entities. Requiring resolution within three layers reflects that legitimate operating groups rarely need deep stacking, whereas layered chains across secrecy jurisdictions are a recognised obfuscation method (Al Rayan and Ghana International Bank were both penalised for failing to evidence the source and ownership behind entity customers).",
  lookbackWindow:
    "Point-in-time at onboarding, refreshed at periodic review and on any trigger event (change of control, registry filing change, adverse media); evidence retained for the relationship plus 5 years.",
  tuningNotes:
    "Most simple SMEs resolve to one or two named owners with no friction; effort should concentrate on multi-layer, cross-border or nominee structures. Do not auto-accept the PSC register as sole proof for higher-risk cases, as it is self-declared and known to contain gaps; corroborate with a second source. Track the share of entity customers where ownership was resolved fully to natural persons versus those parked on a senior managing official, and investigate any upward drift in the latter.",
  firstLineOwner: "KYC Operations / Corporate Onboarding team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Corporate registry and PSC data provider (Companies House, OpenCorporates, Dun & Bradstreet)",
    "UBO / ownership-graph visualisation tool",
    "Sanctions and PEP screening engine applied to each beneficial owner",
    "Document capture for share registers, trust deeds and structure charts",
    "Case management workflow with structured ownership-chain storage",
  ],
  escalation:
    "Unresolvable ownership, nominee or bearer-share indicators, or a beneficial owner who is a sanctions or PEP match escalate to the MLRO. The relationship cannot activate until either the structure is fully mapped or a documented higher-risk acceptance (with EDD) is approved by the appropriate authority. Sanctions matches follow the firm's sanctions-freeze and reporting process.",
  sla: "Standard entity structures cleared within 2 business days; complex multi-layer or cross-border structures within 5 business days; no activation until ownership is mapped and beneficial owners screened.",
  metrics: [
    { name: "UBO resolution rate", target: ">=95%", description: "Entity customers whose ownership is resolved to verified natural persons (vs parked on senior managing official)" },
    { name: "Beneficial-owner screening coverage", target: "100%", description: "Identified beneficial owners screened against sanctions and PEP lists" },
    { name: "Structure refresh timeliness", target: ">=90% on time", description: "Higher-risk entity ownership reviews completed within their due date" },
    { name: "Nominee/bearer-share flag rate", target: "Monitored, investigated", description: "Entities flagged for opacity indicators and the share subsequently exited or accepted with EDD" },
  ],
  testPlan: [
    "Onboard a synthetic 3-layer structure with a >25% ultimate owner buried under two holding companies and confirm the control surfaces and verifies that owner, not just the immediate parent.",
    "Onboard an entity where no person reaches 25% and confirm the senior managing official is captured with a recorded reason, and that this is flagged for review rather than treated as complete UBO.",
    "Plant a sanctioned individual as a 30% owner in a test structure and confirm screening blocks activation and triggers the sanctions process.",
    "Sample 20 live entity customers and confirm each has a stored ownership chain reaching natural persons, with verification evidence and screening results for every beneficial owner.",
  ],
  reviewCadence:
    "Beneficial-ownership thresholds and source-reliability reviewed annually; higher-risk entity structures re-verified at least annually and on trigger events.",
  governance: [
    "MLRO approves the beneficial-ownership threshold, acceptable proof sources, and any reliance on a senior managing official.",
    "Acceptance of opaque, nominee or bearer-share structures requires documented EDD and senior sign-off.",
    "Ownership chains, structure charts and per-owner screening results retained for the relationship plus 5 years.",
    "Volume of entities parked on senior managing official and of opacity flags reported to the financial crime committee quarterly.",
  ],
  whatGoodLooksLike: [
    "Every entity customer has a stored, navigable ownership graph that ends at named, verified natural persons.",
    "Beneficial owners are screened individually, not just the trading entity at the top.",
    "Opacity signals (nominees, bearer shares, secrecy-jurisdiction layers) are flagged and either explained or exited.",
    "The PSC register is corroborated, not trusted blindly, for higher-risk customers.",
  ],
  strongVsWeak: {
    strong:
      "A bank onboarding a trading company maps holding company A (60%) to individuals X (40%) and Y (20%) via the share register and registry data, identifies and screens X and Y as beneficial owners, notes a Cyprus intermediate layer and corroborates it with a second source before activating.",
    weak:
      "A firm records only the immediate parent company as 'the owner', takes the self-filed PSC register at face value, never identifies the natural persons behind two further layers, and activates the account despite a nominee shareholder appearing in the chain.",
  },
  sources: [
    { org: "MLR", reference: "reg.28 CDD measures", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.24 Transparency of legal persons", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "FATF", reference: "R.25 Transparency of legal arrangements", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "Wolfsberg", reference: "Wolfsberg CDD Standards", title: "Wolfsberg CDD Standards", url: "https://www.wolfsberg-principles.com/" },
  ],
};
