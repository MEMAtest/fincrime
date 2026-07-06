import type { Control } from "./types";

export const control15: Control = {
  id: 15,
  slug: "crypto-blockchain-analytics-monitoring",
  name: "Crypto Blockchain Analytics Monitoring",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Uses blockchain analytics to check where crypto sent or received by a customer has been, and flags links to mixers, illicit services or sanctioned addresses.",
  objective:
    "Detect crypto-asset transactions whose on-chain exposure indicates illicit origin or destination, including mixers, peel chains, darknet markets, scams and sanctioned addresses, so that high-risk crypto flows through the firm are identified, investigated and reported, and travel-rule obligations are supported.",
  plainObjective: "This control checks where a customer's crypto has been on the blockchain and flags links to mixers, illegal marketplaces or sanctioned wallets, so high-risk crypto is investigated and reported.",
  plainHowItWorks: "For every crypto deposit and withdrawal, it uses blockchain analytics to trace direct and indirect connections, flagging too much exposure to risky sources, mixing or peel-chain patterns, or missing counterparty data.",
  plainWhyThreshold: "A direct link to a sanctioned or darknet wallet is unacceptable because there is no innocent reason, while indirect links get a sensible limit since some incidental exposure is unavoidable.",
  riskThemes: [
    "money_laundering",
    "sanctions_evasion",
    "fraud",
    "terrorist_financing",
  ],
  applicableFirmTypes: ["crypto", "neobank", "emi", "bank"],
  typologySlugs: [
    "cryptocurrency-laundering",
    "mixer-peel-chain-laundering",
    "rapid-movement-of-funds",
  ],
  enforcementRefs: [{ firm: "Starling Bank Limited", year: 2024 }],
  dataInputs: [
    "On-chain deposit and withdrawal addresses and transaction hashes",
    "Blockchain analytics risk scores and entity attribution (mixer, exchange, darknet, scam, sanctioned)",
    "Direct and indirect (hop-distance) exposure scores per address/transaction",
    "Travel-rule (originator/beneficiary) data from counterparty VASPs",
    "Customer expected crypto activity profile and fiat on/off-ramp linkage",
  ],
  ruleLogic:
    "For each deposit and withdrawal, evaluate on-chain exposure using blockchain analytics across direct and indirect counterparties. Raise alerts where exposure to high-risk categories (mixers, darknet, scams, sanctioned entities) exceeds tolerance, where peel-chain or rapid layering patterns are detected, where withdrawals route to risky destinations, or where travel-rule data is missing for a VASP-to-VASP transfer. Sub-rules: (a) direct exposure to a prohibited category, (b) indirect exposure above tolerance within N hops, (c) mixer/peel-chain pattern, (d) missing or mismatched travel-rule payload.",
  defaultThreshold:
    "Any direct exposure to a sanctioned or darknet address; OR indirect high-risk exposure > 25% of transaction value within 5 hops; OR aggregate mixer-attributed exposure > 10% of a customer's 30-day crypto volume.",
  thresholdRationale:
    "Direct exposure to sanctioned or darknet addresses is treated as zero-tolerance because there is no benign explanation and a sanctions breach is strict-liability. The indirect 25%-within-5-hops tolerance reflects that some indirect exposure is unavoidable on shared infrastructure, so the firm sets a defensible materiality line rather than alerting on every trace of taint. The mixer-share rule targets deliberate obfuscation, which is the defining laundering technique on-chain, while tolerating the occasional incidental hop. Hop distance and percentage thresholds should be set with reference to the chosen analytics provider's methodology so the rule is reproducible and defensible.",
  lookbackWindow: "Per-transaction at deposit/withdrawal; rolling 30 days for aggregate mixer-share and pattern detection.",
  tuningNotes:
    "Volume and quality depend heavily on the analytics provider's attribution coverage and the asset/chain mix, so validate provider coverage per supported chain before setting tolerances. Direct sanctioned/darknet rules are low-volume and high-severity, never tune them down on yield. Indirect-exposure tolerance is the main calibration dial: too tight and most deposits alert on incidental hops, too loose and layered taint passes. Run 4 weeks in observation per chain, target true-positive yield above 10% for indirect rules, and treat missing travel-rule data as a control gap to remediate rather than threshold noise. Re-score historic addresses when the provider updates attributions.",
  firstLineOwner: "Crypto Financial Crime Analyst (on-chain investigations)",
  secondLineOwner: "MLRO / Financial Crime Compliance (with sanctions team input)",
  suggestedSystems: [
    "Blockchain analytics provider (address attribution, exposure scoring, tracing)",
    "Transaction monitoring platform integrating on-chain risk scores with fiat-side activity",
    "Travel-rule solution and case management system supporting on-chain evidence",
  ],
  escalation:
    "Direct sanctioned/darknet exposure is escalated immediately to the MLRO and sanctions team, with the transaction blocked or frozen and a sanctions report made where required. High indirect or mixer exposure triggers EDD on source/use of funds and a SAR where unexplained. Missing travel-rule data triggers an RFI to the counterparty VASP before release where the firm's policy requires it.",
  sla: "Sanctioned/darknet exposure actioned same business day; indirect-exposure alerts triaged within 2 business days; MLRO SAR/sanctions decision within 2 business days of confirmation.",
  metrics: [
    {
      name: "True positive yield (indirect)",
      target: ">= 10%",
      description: "Proportion of indirect-exposure alerts leading to EDD escalation, SAR or sanctions action.",
    },
    {
      name: "Sanctioned-address detection",
      target: "100%",
      description: "Direct exposure to sanctioned addresses detected and blocked before settlement where in scope.",
    },
    {
      name: "Travel-rule completeness",
      target: ">= 98%",
      description: "VASP-to-VASP transfers with complete and matched originator/beneficiary data.",
    },
  ],
  testPlan: [
    "Feed a deposit with a direct hop from a known sanctioned address (test data) and confirm an immediate block and sanctions escalation.",
    "Feed a deposit with 30% value traced through a mixer within 4 hops and confirm the indirect-exposure rule fires at the 25% tolerance.",
    "Process a VASP transfer with missing beneficiary travel-rule data and confirm the RFI/hold path triggers rather than straight-through release.",
    "Re-run a previously clean address after a simulated provider attribution update and confirm re-scoring raises a retrospective alert.",
  ],
  reviewCadence: "Exposure tolerances and hop distances reviewed quarterly; provider coverage and attribution methodology reviewed at least annually or on a new chain/asset launch.",
  governance: [
    "MLRO and sanctions lead approve exposure categories, tolerances and hop distances, referencing the provider methodology.",
    "Provider selection, coverage limitations and any single-provider reliance are documented and risk-accepted at committee.",
    "On-chain evidence and re-scoring outcomes are retained to support SARs and sanctions reporting.",
  ],
  whatGoodLooksLike: [
    "Direct sanctioned and darknet exposure is zero-tolerance and blocked pre-settlement, separated from graded indirect-exposure handling.",
    "Indirect-exposure tolerances are defined against the provider's documented methodology so alerts are reproducible and defensible.",
    "Travel-rule completeness is monitored and missing data is remediated, not quietly tolerated.",
  ],
  strongVsWeak: {
    strong:
      "A crypto exchange blocks a withdrawal with direct exposure to an OFAC-listed address pre-settlement, separately alerts a deposit with 30% mixer-traced exposure within five hops, runs EDD that finds no credible source, files a SAR and reports the sanctions hit, and re-screens historic addresses when the analytics provider updates attributions.",
    weak:
      "A neobank offering crypto on/off-ramps screens only the immediate counterparty address, ignores indirect exposure and peel chains entirely, never reconciles travel-rule data, and lets funds layered through a mixer settle because the first hop looked like an ordinary exchange.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.16",
      title: "FATF Recommendation 16: Wire transfers (travel rule, including virtual assets)",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Transaction Monitoring",
      title: "Wolfsberg Statement on Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
