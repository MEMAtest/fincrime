import type { Control } from "./types";

export const control25: Control = {
  id: 25,
  slug: "trade-based-ml-controls",
  name: "Trade-Based Money Laundering Controls",
  category: "screening",
  controlType: "detective",
  plainSummary:
    "Checks trade finance deals for tell-tale signs of laundering, such as over- or under-priced goods, dual-use items and shell counterparties, before the firm finances or pays for them.",
  objective:
    "Detect trade-based money laundering and sanctions or proliferation risk in trade finance and trade-related payments by screening counterparties, vessels, ports and goods, and by checking price, quantity and documentary consistency, so the firm does not finance disguised value transfer or prohibited trade.",
  plainObjective: "Aims to spot money laundering and sanctions or proliferation risk hidden in trade deals, so the firm never finances disguised value transfer or banned trade.",
  plainHowItWorks: "It screens every trade party, vessel and port against sanctions lists, compares invoiced prices to market benchmarks, checks quantities, and flags dual-use goods or shell counterparties for compliance review before financing.",
  plainWhyThreshold: "The 85% match floor matches the firm's other screening, the 25% price band catches serious mispricing while allowing normal variation, and dual-use or sanctioned-port hits always trigger review.",
  riskThemes: ["money_laundering", "sanctions_evasion", "proliferation_financing", "tax_evasion"],
  applicableFirmTypes: ["bank", "emi", "pi", "msb"],
  typologySlugs: ["trade-based-money-laundering", "dual-use-export-procurement-diversion", "sanctions-evasion-via-intermediaries"],
  enforcementRefs: [{ firm: "Standard Chartered Bank", year: 2019 }],
  dataInputs: [
    "Trade documents: invoices, bills of lading, packing lists, letters of credit, certificates of origin",
    "Buyer, seller, shipping and notify-party identities, addresses and beneficial owners",
    "Goods description, HS / commodity codes, quantity, unit price and total value",
    "Vessel name, IMO number, ports of loading and discharge, and routing",
    "Sanctions, PEP and adverse media lists, plus dual-use / controlled-goods and high-risk-port reference data",
    "Market price benchmarks for the goods to assess over- and under-invoicing",
  ],
  ruleLogic:
    "Screen all trade parties, vessels and ports against sanctions and watch lists. Compare invoiced unit prices against market benchmarks to flag material over- or under-invoicing, and check quantities and weights for consistency across documents. Flag goods descriptions that match dual-use or controlled categories, vague or generic descriptions that mask value, circular or third-party routing, and counterparties that appear to be shells or front companies. Material flags route to a trade-compliance review that can hold the financing or payment, request explanation, decline or report.",
  defaultThreshold:
    "Counterparty/vessel/port screening hit at fuzzy score >= 85% holds the transaction; invoiced unit price deviating more than 25% from the benchmark band, or any dual-use / controlled-goods or sanctioned-port indicator, routes to mandatory trade-compliance review.",
  thresholdRationale:
    "The 85% screening floor aligns with the firm's other screening controls. A 25% price-deviation band catches material mispricing while tolerating genuine commercial variation in volatile or bespoke goods; the band is set per commodity where benchmarks are reliable. Dual-use and sanctioned-port indicators are absolute routing triggers regardless of price because the proliferation and sanctions consequence of missing one is severe.",
  lookbackWindow:
    "Per-transaction at financing or payment, screening real-time; supplemented by a rolling 12-month view of a counterparty's trade activity to detect structuring, repeated mispricing and phantom-shipment patterns.",
  tuningNotes:
    "Price-deviation flags are noisy where benchmarks are thin or goods are bespoke, so calibrate the band by commodity and require analyst judgement rather than auto-decline. False positives cluster on legitimate commodity volatility and incomplete benchmark data; tune by improving reference pricing and HS-code mapping. Watch for the harder, low-volume true positives: dual-use diversion, phantom shipments and circular trades, which need pattern analysis across multiple transactions rather than single-deal thresholds. Coordinate with trade-operations staff who read the documents.",
  firstLineOwner: "Trade Finance Operations / Trade Compliance team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["trade-document screening (for example Traydstream, Conpend, Bottomline)", "vessel / IMO and port screening (Lloyd's List / Pole Star)", "commodity price benchmarking data", "sanctions and dual-use goods reference feeds"],
  escalation:
    "Confirmed sanctions, proliferation or dual-use exposure is escalated to the MLRO for blocking, OFSI / export-control reporting and possible exit; unexplained mispricing, phantom shipments or front-company indicators that give rise to suspicion trigger a SAR and a financing or payment hold.",
  sla: "Trade-compliance reviews of flagged transactions completed within 2 working days to limit trade-cycle disruption; sanctions and dual-use hits actioned same day.",
  metrics: [
    { name: "Trade-party and vessel screening coverage", target: "100%", description: "Trade counterparties, vessels and ports screened before financing or payment." },
    { name: "Price-consistency check coverage", target: "100% of in-scope deals", description: "Trade transactions subjected to over/under-invoicing and quantity-consistency checks." },
    { name: "Dual-use / sanctioned-port detection", target: "Identified and held", description: "Transactions with controlled-goods or sanctioned-port indicators routed to review, none auto-released." },
    { name: "Flag-review SLA", target: ">= 95% within SLA", description: "Flagged trade transactions dispositioned within the response target." },
  ],
  testPlan: [
    "Submit a synthetic trade deal naming a sanctioned vessel or port and confirm screening holds it before financing.",
    "Submit an invoice priced well outside the benchmark band and confirm the over/under-invoicing flag routes it to trade-compliance review.",
    "Submit documents with inconsistent quantities or a vague, generic goods description and confirm the consistency check raises a flag.",
    "Submit a dual-use goods description and confirm the controlled-goods indicator forces mandatory review regardless of price.",
  ],
  reviewCadence: "Price-deviation bands, HS-code mappings and red-flag rules reviewed quarterly; full trade-control framework and benchmark data reviewed annually.",
  governance: [
    "MLRO approves the trade red-flag rules, price-deviation bands and dual-use reference scope.",
    "Trade-compliance decisions, holds and rationale are documented and retained for at least five years.",
    "Financial Crime Committee reviews trade-finance risk MI (flags, holds, reports) at least quarterly.",
    "Dual-use and sanctions findings are reported to the relevant authorities and the export-control function as required.",
  ],
  whatGoodLooksLike: [
    "Every trade party, vessel and port is screened, and goods descriptions are checked against dual-use and controlled categories.",
    "Invoiced prices and quantities are tested for consistency against benchmarks and across documents, not taken at face value.",
    "Pattern analysis across a counterparty's deals catches structuring, phantom shipments and circular trades that single-deal checks miss.",
    "Flagged deals get a documented trade-compliance decision before the firm finances or pays.",
  ],
  strongVsWeak: {
    strong:
      "A bank screens the vessel and ports on a letter of credit, benchmarks the invoiced electronics against market price, spots a 60% over-invoice plus a dual-use component, holds the financing, obtains no credible explanation, declines and reports.",
    weak:
      "A bank finances trade deals on the documents alone, never benchmarks prices or checks goods against dual-use lists, screens neither the vessel nor the discharge port, and processes years of mispriced and sanctions-linked trade flows that only surface in enforcement.",
  },
  sources: [
    { org: "FATF", reference: "R.16", title: "Recommendation 16: Wire transfers", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "FATF", reference: "R.7", title: "Recommendation 7: Targeted financial sanctions related to proliferation", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "Wolfsberg", reference: "Wolfsberg Guidance on Sanctions Screening", title: "Wolfsberg Guidance on Sanctions Screening", url: "https://www.wolfsberg-principles.com/" },
    { org: "JMLSG", reference: "Part III", title: "JMLSG Guidance Part III: Specialist guidance (trade finance)", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
  ],
};
