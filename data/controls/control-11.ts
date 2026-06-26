import type { Control } from "./types";

export const control11: Control = {
  id: 11,
  slug: "structuring-detection",
  name: "Structuring & Smurfing Detection",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Catches people breaking one big payment into lots of smaller ones to stay under reporting or alerting limits, including when several accounts act together.",
  objective:
    "Detect deliberate fragmentation of value into multiple sub-threshold transactions (structuring) and coordinated activity across multiple parties or accounts (smurfing) intended to evade reporting thresholds or detection limits, so the underlying aggregate flow is identified and investigated.",
  riskThemes: ["money_laundering", "terrorist_financing", "tax_evasion"],
  applicableFirmTypes: ["bank", "msb", "neobank", "emi", "pi"],
  typologySlugs: [
    "structuring-threshold-avoidance",
    "cuckoo-smurfing",
    "money-mule-herding-recruitment",
  ],
  enforcementRefs: [
    { firm: "National Westminster Bank Plc", year: 2021 },
    { firm: "Canara Bank", year: 2018 },
  ],
  dataInputs: [
    "All credit and debit transactions with amount, timestamp, channel and counterparty",
    "Known internal alerting / reporting thresholds the firm operates",
    "Account-to-account and customer-to-customer linkage data (shared devices, IPs, payees, addresses)",
    "Cash and value-transfer transactions across branches / agents",
    "Customer expected activity profile",
  ],
  ruleLogic:
    "Detect clustering of multiple transactions sitting just below a known threshold within a short window for a single customer (classic structuring), and detect aggregation across linked parties where individually small transactions sum to a material amount routed to a common destination (smurfing). Sub-rules: (a) N transactions within X% below a threshold in the window, (b) round-number repetition just under a limit, (c) many-to-one funnelling where multiple senders pay a common beneficiary in sub-threshold amounts.",
  defaultThreshold:
    "3 or more transactions each within 10% below a relevant threshold (e.g. the firm's cash reporting or alerting limit) by one customer in a rolling 7 days, OR 4+ sub-threshold credits from distinct linked parties funnelling to one beneficiary within a rolling 14 days.",
  thresholdRationale:
    "Requiring at least 3 near-threshold transactions in a tight window distinguishes deliberate fragmentation from coincidental clustering, and the 'within 10% below' band targets the tell-tale signature of someone calibrating amounts to stay under a limit rather than transacting naturally. The many-to-one funnelling rule is essential because pure single-customer logic is blind to smurfing, which spreads the structuring across recruited parties; this is the gap NatWest and others were penalised for. Linking on shared device, payee and address keeps the funnelling rule precise rather than catching unrelated payments to a popular beneficiary.",
  lookbackWindow: "Rolling 7 days for single-customer structuring; rolling 14 days for multi-party funnelling.",
  tuningNotes:
    "The single-customer rule is usually low volume and high yield; the multi-party funnelling rule is the noisy one and depends heavily on the quality of linkage data, so tune the linkage confidence threshold before the transaction threshold. Expect false positives around legitimate popular beneficiaries (landlords, utilities, payroll) and exclude these with a beneficiary allow-list informed by population analysis. Run in observation mode for 4 weeks, target true-positive yield above 12% for the structuring rule, and review the near-threshold band width if volume is dominated by amounts clustered well below the limit (which is normal behaviour, not structuring).",
  firstLineOwner: "Financial Crime Operations Analyst (transaction monitoring team)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Transaction monitoring platform with aggregation and threshold-proximity scenarios",
    "Entity-link / network analytics layer for multi-party funnelling",
    "Case management system supporting network-level case grouping",
  ],
  escalation:
    "Confirmed structuring or smurfing is escalated by the analyst to the MLRO as a single network case where relevant, with a SAR covering all linked parties, and consideration of coordinated account restriction across the network rather than account by account.",
  sla: "Single-customer alert triaged within 2 business days; network alert triaged within 5 business days given link analysis; MLRO SAR decision within 5 business days of confirmation.",
  metrics: [
    {
      name: "True positive yield (structuring)",
      target: ">= 12%",
      description: "Proportion of single-customer threshold-proximity alerts confirmed as deliberate structuring.",
    },
    {
      name: "Network case conversion",
      target: ">= 15%",
      description: "Proportion of funnelling alerts that resolve into a confirmed multi-party network case.",
    },
    {
      name: "Beneficiary allow-list accuracy",
      target: "<= 2% suppressed in error",
      description: "Genuine structuring suppressed by the legitimate-beneficiary allow-list (sampled).",
    },
  ],
  testPlan: [
    "Generate a customer making 3 deposits of 95%, 96% and 98% of the firm's cash threshold in 5 days; confirm the structuring rule fires and a single transaction at 50% does not.",
    "Simulate 5 linked accounts (shared device + common payee) each sending a sub-threshold credit to one beneficiary in 10 days; confirm the funnelling rule groups them into one network case.",
    "Pay a popular legitimate beneficiary from many unlinked customers and confirm the allow-list and linkage logic do not raise a false network alert.",
    "Back-test against a historic confirmed structuring case and confirm the rule would have grouped the relevant transactions.",
  ],
  reviewCadence: "Threshold-proximity band and linkage confidence reviewed quarterly; scenario and allow-list reviewed annually or when the firm's reporting thresholds change.",
  governance: [
    "MLRO approves the near-threshold band, linkage rules and beneficiary allow-list at the Financial Crime Risk Committee.",
    "Allow-list additions are evidenced and dual-approved to prevent suppression of genuine activity.",
    "Network-case methodology and its outcomes are documented for independent validation.",
  ],
  whatGoodLooksLike: [
    "Detection works at network level, grouping linked parties into one case rather than alerting each account in isolation.",
    "The near-threshold band is set against the firm's actual reporting and alerting limits, and updated when those limits move.",
    "A governed, evidenced beneficiary allow-list keeps the funnelling rule precise without quietly hiding real activity.",
  ],
  strongVsWeak: {
    strong:
      "An MSB links remitters by shared device and common beneficiary, detects eight individuals each sending just under the cash reporting limit to one recipient over two weeks, groups them into a single network case, files one SAR covering the network and restricts all linked accounts together.",
    weak:
      "A bank only checks single-account behaviour against a flat cash limit, never models cross-customer funnelling, and files isolated low-value alerts that each get closed as 'below threshold', so a smurfing ring operating across dozens of accounts is never seen as a network.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.20",
      title: "FATF Recommendation 20: Reporting of suspicious transactions",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
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
  ],
};
