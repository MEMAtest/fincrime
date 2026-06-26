import type { Control } from "./types";

export const control33: Control = {
  id: 33,
  slug: "mirror-matched-trade-detection",
  name: "Mirror & Matched-Trade Detection",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "The firm spots pairs of offsetting trades that move value across borders with no real economic purpose, the classic way of laundering or moving money disguised as trading.",
  objective:
    "Detect mirror trades, matched principal trades and other offsetting transaction pairs that have no genuine economic rationale and are used to transfer value across jurisdictions or to launder funds under the cover of legitimate trading.",
  riskThemes: ["money_laundering", "sanctions_evasion", "tax_evasion"],
  applicableFirmTypes: ["bank", "wealth_manager", "crypto", "emi"],
  typologySlugs: ["third-party-round-tripping", "high-risk-corridor-remittances", "unusual-business-vs-declared-profile"],
  enforcementRefs: [{ firm: "Deutsche Bank AG", year: 2017 }],
  dataInputs: [
    "Securities, FX and crypto trade records (instrument, size, price, side, time)",
    "Buy and sell legs with counterparty and settlement detail",
    "Beneficial-owner and related-party links between accounts",
    "Settlement currencies and jurisdictions of each leg",
    "Customer declared trading strategy and expected activity",
    "Cross-account and cross-entity common-ownership graph",
  ],
  ruleLogic:
    "Look for offsetting trade pairs in the same or fungible instrument, similar size and close in time, executed by related or commonly controlled accounts, where one leg buys in one jurisdiction or currency and a matching leg sells in another, netting to little or no market risk or profit. Score the pair on size match, time proximity, common ownership, cross-jurisdiction settlement and absence of economic rationale. Patterns above the score threshold, especially repeated round-trips, are alerted for investigation as potential value transfer rather than genuine trading.",
  defaultThreshold:
    "Flag offsetting buy/sell pairs in the same or fungible instrument where notional matches within 5 percent, the legs execute within 7 days, the accounts are commonly controlled or related, and the legs settle across different jurisdictions or currencies; prioritise where the round-trip nets near-zero P&L.",
  thresholdRationale:
    "Mirror trades are defined by near-identical offsetting legs that transfer value without market exposure, so matching on notional within a tight band, short time proximity and common control captures the structure while excluding ordinary hedging or two-sided market making. Cross-jurisdiction settlement is the value-transfer fingerprint, and near-zero P&L distinguishes laundering from genuine profit-seeking trading. These parameters are starting points to refine against confirmed cases and the firm's instrument mix.",
  lookbackWindow:
    "Pairs assessed over a rolling 7-day matching window, with a rolling 90-day view to detect repeated round-tripping between the same related accounts.",
  tuningNotes:
    "Expect false positives from legitimate hedging, internal transfers and genuine two-sided trading; suppress these with declared-strategy context and known-hedge relationships rather than by loosening the common-control criterion, which is the strongest signal. Watch alert volume by instrument and tighten the notional-match band or extend the time window per asset class. Repeated cross-jurisdiction round-trips between the same related parties should escalate regardless of individual-pair scores.",
  firstLineOwner: "Trade Surveillance / Financial Crime Investigations team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Trade surveillance / market-abuse and AML analytics platform",
    "Transaction monitoring with cross-account pair-matching",
    "Entity-resolution and beneficial-ownership graph",
    "Trade and settlement data warehouse",
  ],
  escalation:
    "Confirmed or strongly suspected mirror or matched-trade patterns are escalated to the MLRO, the related accounts are reviewed for a wider scheme, trading can be restricted, a SAR is filed, and where sanctioned jurisdictions or parties are involved the sanctions team and OFSI considerations are engaged.",
  sla: "Mirror/matched-trade alerts triaged within 3 business days; alerts touching sanctioned or high-risk jurisdictions actioned within 1 business day.",
  metrics: [
    {
      name: "Mirror-pattern detection precision",
      target: ">= 30% of alerts progressing to investigation",
      description: "Share of mirror/matched-trade alerts that are genuine enough to warrant deeper investigation.",
    },
    {
      name: "Repeated round-trip identification",
      target: "100% of related-party round-trip clusters surfaced",
      description: "Clusters of repeated offsetting trades between the same related accounts detected and linked.",
    },
    {
      name: "SAR conversion on confirmed patterns",
      target: "Tracked and explained",
      description: "Proportion of confirmed mirror-trade investigations resulting in a SAR.",
    },
  ],
  testPlan: [
    "Seed an offsetting buy-in-London / sell-in-another-jurisdiction pair of equal notional in commonly controlled accounts and confirm it is flagged as a mirror trade.",
    "Insert a legitimate hedge between unrelated counterparties and confirm it is not flagged, validating the common-control criterion.",
    "Create a 90-day series of repeated round-trips between two related accounts and confirm the cluster escalates regardless of individual-pair scores.",
    "Run a pair where one leg touches a sanctioned jurisdiction and confirm same-day escalation to the sanctions team.",
  ],
  reviewCadence: "Scenario logic and thresholds reviewed quarterly against confirmed cases; control design reviewed annually.",
  governance: [
    "MLRO approves the mirror/matched-trade scenarios, thresholds and escalation routing.",
    "Quarterly MI on alert volumes, precision and SAR outcomes to the Financial Crime Committee.",
    "Confirmed cases used to refine entity-resolution and matching logic, with the loop documented.",
    "Trade, pairing and investigation records retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Detection keys on the offsetting structure plus common control, not on single large trades.",
    "Cross-jurisdiction settlement and near-zero P&L are explicitly modelled as the value-transfer signal.",
    "Repeated round-trips between related parties are linked into one case rather than seen as isolated trades.",
    "Genuine hedging and market making are suppressed with context, keeping investigators focused on real schemes.",
  ],
  strongVsWeak: {
    strong:
      "An account buys a liquid stock in one country and a commonly owned account sells the same notional of the same stock in another within a day, repeatedly, netting near-zero profit; the surveillance scenario links the pairs into one round-tripping cluster, investigation confirms cross-border value transfer with no economic purpose and a SAR is filed.",
    weak:
      "Each leg is reviewed only against per-trade size thresholds and clears because no single trade is unusual; the offsetting structure and common ownership are never connected, and billions move across borders disguised as trading before an external investigation exposes it.",
  },
  sources: [
    {
      org: "FATF",
      reference: "Recommendation 1",
      title: "FATF Recommendations - Risk-Based Approach",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Standards",
      title: "Wolfsberg Standards - Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Monitoring and Suspicious Activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
