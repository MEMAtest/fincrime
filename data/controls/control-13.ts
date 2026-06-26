import type { Control } from "./types";

export const control13: Control = {
  id: 13,
  slug: "money-mule-network-detection",
  name: "Money-Mule & Network Detection",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Finds accounts being used by other people to receive and pass on dirty or stolen money, and links them together when they are part of the same ring.",
  objective:
    "Detect money-mule accounts and the networks that operate them by combining behavioural indicators with link analysis, so that recruited or compromised accounts and the coordinators behind them are identified, closed and reported rather than treated as isolated low-value cases.",
  riskThemes: ["money_laundering", "fraud", "terrorist_financing"],
  applicableFirmTypes: ["bank", "neobank", "emi", "pi"],
  typologySlugs: [
    "mule-account-activity",
    "money-mule-herding-recruitment",
    "app-fraud-push-payments",
  ],
  enforcementRefs: [
    { firm: "Starling Bank Limited", year: 2024 },
    { firm: "Santander UK Plc", year: 2022 },
  ],
  dataInputs: [
    "Transaction history (rapid in/out, fan-in from many senders, fan-out to few)",
    "Device, IP, geolocation and login fingerprint data",
    "Shared static data across accounts (address, phone, email, payee, beneficiary)",
    "Account age, onboarding channel and KYC anomalies",
    "Inbound fraud markers and confirmed-fraud / scam reports from other banks (e.g. fraud-reporting feeds)",
  ],
  ruleLogic:
    "Combine mule behavioural indicators (young account, low-value KYC profile, sudden inbound from multiple unrelated payers, rapid full pay-out) with network linkage (shared device, IP, payee, contact details) to surface both individual mule accounts and the clusters they belong to. Sub-rules: (a) fan-in then rapid fan-out, (b) cluster of accounts sharing devices/IPs and forwarding to a common downstream beneficiary, (c) inbound flagged as suspected scam payment by the sending bank.",
  defaultThreshold:
    "Account receiving from 3+ unrelated payers and forwarding >= 80% within 48 hours, scored higher where account age < 90 days; cluster alert where 3+ accounts share a device/IP and forward to a common beneficiary within a rolling 14 days.",
  thresholdRationale:
    "Fan-in from multiple unrelated senders followed by rapid forwarding is the signature of a collection mule, and weighting young accounts reflects the reality that recruited mules are typically newly opened or freshly repurposed. The cluster threshold exists because the real risk and the recruiter sit at the network level: closing one mule while leaving the ring intact achieves little, which is the criticism levelled at firms with weak mule controls. Requiring a shared identifier plus a common downstream beneficiary keeps clustering precise and avoids grouping unrelated customers who merely transact quickly.",
  lookbackWindow: "Rolling 48 hours for fan-in/fan-out behaviour; rolling 14 days for network clustering; 90 days for account-age weighting.",
  tuningNotes:
    "Behavioural mule rules are moderate volume; the network layer's precision depends entirely on linkage-data quality, so invest in device/IP/contact normalisation before tightening thresholds. Expect false positives from shared household devices, shared public IPs and legitimate group/family payments, so combine at least two independent linkage signals before raising a cluster. Integrate inbound suspected-scam markers from external feeds to lift yield sharply. Run 4 weeks in observation, target true-positive yield above 15% for behavioural alerts and confirm clusters resolve to genuine networks rather than coincidental colocation. Score and fast-track accounts where an inbound payment is externally flagged as fraud.",
  firstLineOwner: "Fraud / Financial Crime Operations Analyst (mule investigations)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Transaction monitoring platform with fan-in/fan-out scenarios",
    "Entity-resolution / network analytics platform (device, IP, payee graph)",
    "Inbound fraud-data sharing feed integration and case management with network grouping",
  ],
  escalation:
    "Confirmed mule accounts and their clusters are escalated to the MLRO as a single network case, with coordinated freezing of the linked accounts, recall/repatriation of in-flight funds where possible, SARs covering the network, and account closure. The recruiter/coordinator account (common downstream beneficiary) is prioritised for investigation.",
  sla: "Behavioural mule alert triaged within 1 business day; protective action on confirmed cases same day where feasible; network case worked within 5 business days; SAR decision within 5 business days of confirmation.",
  metrics: [
    {
      name: "True positive yield",
      target: ">= 15%",
      description: "Proportion of behavioural mule alerts confirmed as mule accounts.",
    },
    {
      name: "Network resolution rate",
      target: ">= 20%",
      description: "Cluster alerts that resolve into a confirmed multi-account mule network.",
    },
    {
      name: "Funds recovered / preserved",
      target: "Trend up",
      description: "Value of mule funds frozen or repatriated before dissipation.",
    },
  ],
  testPlan: [
    "Create a 30-day-old account receiving from 4 unrelated payers and forwarding 90% within a day; confirm a high-scored mule alert.",
    "Build 4 accounts sharing a device fingerprint and a common downstream payee; confirm the cluster alert groups them and surfaces the common beneficiary.",
    "Feed an inbound payment flagged by the sending bank as suspected APP fraud and confirm the receiving account is fast-tracked.",
    "Confirm a shared household device with two genuine family accounts and no common downstream beneficiary does not raise a cluster alert.",
  ],
  reviewCadence: "Behavioural thresholds and linkage rules reviewed quarterly; network methodology and external-feed integration reviewed annually or on a known typology shift.",
  governance: [
    "MLRO approves behavioural thresholds, linkage rules and the minimum number of independent linkage signals for clustering.",
    "Use of external fraud-data feeds and any pre-emptive freezing is governed by documented policy aligned to account terms.",
    "Network-case methodology and outcomes are evidenced for independent validation and law-enforcement engagement.",
  ],
  whatGoodLooksLike: [
    "Behavioural indicators and link analysis are combined, so both the mule and the ring it belongs to are identified.",
    "Clustering requires at least two independent linkage signals, keeping networks precise rather than catching coincidental colocation.",
    "Inbound suspected-fraud markers from other firms are ingested and used to fast-track receiving accounts.",
  ],
  strongVsWeak: {
    strong:
      "A bank links five recently opened accounts by shared device and a common downstream payee, sees each receive scam-flagged inbound payments and forward them within hours, freezes all five plus the coordinator account the same day, repatriates part of the funds and files a single network SAR naming the recruiter.",
    weak:
      "A neobank treats each mule account as a standalone low-value alert, never links accounts by device or payee, closes each case as 'closed-no-action' on the customer's bland explanation, and lets an entire mule ring keep operating across dozens of accounts under one coordinator.",
  },
  sources: [
    {
      org: "FCA",
      reference: "FCA FCG 6",
      title: "FCA Financial Crime Guide, Chapter 6: Transaction monitoring",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/6/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 6",
      title: "JMLSG Guidance, Part I, Chapter 6: Suspicious activities, reporting and data protection",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "R.20",
      title: "FATF Recommendation 20: Reporting of suspicious transactions",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Transaction Monitoring",
      title: "Wolfsberg Statement on Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
  ],
};
