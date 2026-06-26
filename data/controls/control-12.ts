import type { Control } from "./types";

export const control12: Control = {
  id: 12,
  slug: "rapid-movement-passthrough-detection",
  name: "Rapid Movement / Pass-Through Detection",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "Spots money that arrives and leaves almost immediately, where the account is being used as a channel to move funds on rather than to hold or spend them.",
  objective:
    "Detect accounts being used as conduits, where incoming funds are moved out rapidly with little or no economic purpose (layering), so that pass-through behaviour, including mule and pay-in/pay-out patterns, is identified and investigated before funds are dissipated.",
  riskThemes: ["money_laundering", "fraud", "terrorist_financing"],
  applicableFirmTypes: ["bank", "neobank", "emi", "pi", "msb"],
  typologySlugs: [
    "rapid-movement-of-funds",
    "mule-account-activity",
    "third-party-round-tripping",
  ],
  enforcementRefs: [
    { firm: "Starling Bank Limited", year: 2024 },
    { firm: "Santander UK Plc", year: 2022 },
  ],
  dataInputs: [
    "Inbound and outbound transactions with precise timestamps",
    "Account balance time series (to measure how much of an inflow is passed on)",
    "Counterparty data inbound and outbound (to detect in/out symmetry)",
    "Time-in-account / dwell time per inflow",
    "Customer expected activity profile and account age",
  ],
  ruleLogic:
    "For each material inflow, measure how quickly and how completely it leaves the account. Raise an alert where a high proportion of an inflow is paid out within a short dwell time, especially where the residual balance returns near zero, where inbound and outbound counterparties are unrelated, and where this pattern repeats. Sub-rules: (a) high pass-through ratio within short dwell, (b) repeated near-zero-balance cycling, (c) in/out value matching across unrelated counterparties.",
  defaultThreshold:
    "Outbound >= 90% of a qualifying inflow within 24 hours, with residual balance returning to < 10% of the inflow, occurring 2+ times in a rolling 7 days.",
  thresholdRationale:
    "The 90% pass-through within 24 hours captures the defining feature of a conduit account, that funds are not retained or spent on the customer's own activity but forwarded almost intact. Requiring the balance to fall back near zero filters out customers who simply receive and then spend money normally over days. Requiring repetition (2+ times in a week) distinguishes a one-off large legitimate payment, such as a property completion, from a recurring layering pattern. Dwell time is the most discriminating single signal for pass-through and is harder to disguise than value alone.",
  lookbackWindow: "Per-inflow evaluation over a 24 to 72 hour dwell window; pattern aggregation over a rolling 7 days.",
  tuningNotes:
    "Expect legitimate pass-through users (treasury sweeps, in-app savings pots, sole traders paying suppliers same-day) to generate false positives, so exclude internal/own-account transfers and known sweep patterns before measuring volume. The dwell-time and pass-through-ratio pair is precise, so tune dwell first; widening dwell beyond 72 hours sharply increases noise. Run 4 weeks in observation, target true-positive yield above 12%, and prioritise excluding own-account and recognised-supplier flows over loosening the ratio. New accounts exhibiting this pattern within their first 30 days should score higher, as mule accounts are typically young.",
  firstLineOwner: "Financial Crime Operations Analyst (transaction monitoring team)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Transaction monitoring platform with dwell-time and pass-through-ratio scenarios",
    "Real-time or near-real-time event stream for fast-moving funds",
    "Case management system with mule-account playbook",
  ],
  escalation:
    "On a confirmed pass-through pattern, the analyst escalates to the MLRO with a recommendation to restrict outbound payments pending review (where the firm's risk appetite and account terms allow), raise inbound payment-recall checks where fraud is suspected, and file a SAR. Speed matters because conduit funds dissipate quickly.",
  sla: "High-velocity alerts triaged same business day where feasible, otherwise within 1 business day; MLRO restriction/SAR decision within 2 business days.",
  metrics: [
    {
      name: "True positive yield",
      target: ">= 12%",
      description: "Proportion of pass-through alerts confirmed as conduit / mule behaviour.",
    },
    {
      name: "Time to first action",
      target: "<= 1 business day",
      description: "Median time from alert to first protective action on confirmed cases.",
    },
    {
      name: "Funds preserved",
      target: "Trend up",
      description: "Value of suspicious funds frozen or recalled before dissipation, tracked over time.",
    },
  ],
  testPlan: [
    "Inject an inflow followed by a 95% outbound to an unrelated counterparty within 6 hours, twice in a week; confirm the rule fires.",
    "Inject the same inflow but paid out over 5 days in small amounts on the customer's own card; confirm no alert.",
    "Confirm own-account / sweep transfers are excluded and do not generate pass-through alerts.",
    "Back-test against a confirmed mule account and verify the dwell-time rule would have caught the cycling within its active window.",
  ],
  reviewCadence: "Dwell-time and pass-through-ratio thresholds reviewed quarterly; exclusion lists reviewed quarterly; scenario logic reviewed annually.",
  governance: [
    "MLRO approves dwell-time and ratio thresholds and the exclusion lists at the Financial Crime Risk Committee.",
    "Pre-emptive restriction policy is documented and aligned to account terms, with each restriction decision logged.",
    "Independent validation confirms exclusions are not masking genuine conduit behaviour.",
  ],
  whatGoodLooksLike: [
    "Detection uses dwell time and pass-through ratio together, not value alone, so conduit behaviour is distinguished from normal spending.",
    "Own-account and recognised sweep flows are excluded so the rule targets genuine pass-through.",
    "Fast triage and a pre-agreed restriction playbook mean funds can be preserved before they leave the firm.",
  ],
  strongVsWeak: {
    strong:
      "A neobank flags a 14-day-old account that receives a 9,800 inflow and forwards 9,600 to an unrelated payee within four hours, then repeats it twice; the analyst restricts outbound payments the same day, the inbound payment is confirmed as APP fraud, funds are recalled and a SAR is filed.",
    weak:
      "A bank monitors only daily aggregate value with a 24-hour batch run, so a mule account receives and forwards stolen funds the same morning and is emptied before the overnight job even produces an alert; by review time there is nothing left to freeze.",
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
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance, Part I, Chapter 5: Monitoring customer activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "R.10",
      title: "FATF Recommendation 10: Customer due diligence and ongoing monitoring",
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
