import type { FirmType, ProductType, CustomerType, RiskTheme } from "./typologies/types";

/**
 * Firm-archetype profiles: one per FirmType. Each is a plain-English picture of a
 * business model (what it sells, who to, where its money-laundering and wider
 * financial-crime risk concentrates) usable both as interview preparation and as
 * an on-the-job quick reference.
 *
 * This file holds only the QUALITATIVE archetype content. The applicable
 * typologies are derived at render time from
 * `allTypologies.filter(t => t.applicableFirmTypes.includes(firmType))`, and the
 * enforcement KPIs/cases from `benchmarksForFirmType` / `casesForFirmType`. So
 * the profile stays in lockstep with the typology library and the FCA dataset.
 */

export type RiskLevel = "very_high" | "high" | "medium" | "low";

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  very_high: "Very high",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Heatmap weight (0-1) so the dashboard can shade a theme by inherent risk. */
export const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  very_high: 1,
  high: 0.72,
  medium: 0.45,
  low: 0.2,
};

export interface InherentRisk {
  theme: RiskTheme;
  level: RiskLevel;
  /** Why this theme sits where it does for this business model. */
  rationale: string;
}

export interface FirmExample {
  /** A widely known firm operating this business model. */
  name: string;
  /** Neutral description of WHAT they do (the business model), never a finding. */
  note: string;
}

export interface FirmProfile {
  firmType: FirmType;
  /** One-line positioning. */
  tagline: string;
  /** Plain-English description of the business model. */
  description: string;
  /** The regulatory perimeter the model usually sits in. */
  regulatoryContext: string;
  /** What the firm actually sells, in plain words. */
  typicalServices: string[];
  /** Mapped to the ProductType enum so the profile cross-links cleanly. */
  products: ProductType[];
  /** Primary customer base, mapped to the CustomerType enum. */
  primaryCustomers: CustomerType[];
  /** Archetype illustrations of the business model, NOT allegations (see disclaimer). */
  illustrativeExamples: FirmExample[];
  /** Inherent risk themes, ranked high to low, with rationale. */
  inherentRisks: InherentRisk[];
  /** The controls that matter most for this model, in priority order. */
  controlPriorities: string[];
  /** What KYC/CDD has to get right for this model. */
  kycPointers: string[];
}

/**
 * Shown wherever the named examples appear. The named firms illustrate a
 * business model so the archetype is concrete; nothing here asserts any control
 * weakness or wrongdoing by a named firm.
 */
export const FIRM_PROFILE_DISCLAIMER =
  "Named firms illustrate the business model only. They show what an archetype looks like in the real market and are not an allegation of any control weakness or wrongdoing.";

const emi: FirmProfile = {
  firmType: "emi",
  tagline: "Issues electronic money and payment accounts without being a bank.",
  description:
    "An e-money institution issues stored-value e-money and offers payment accounts, cards and transfers, but does not take deposits or lend them on. Funds are safeguarded rather than covered by deposit protection. Many EMIs run distributor, agent or banking-as-a-service programmes, so a single licence can sit behind dozens of consumer brands.",
  regulatoryContext:
    "Electronic Money Regulations 2011 and Payment Services Regulations 2017, supervised by the FCA, with AML obligations under the Money Laundering Regulations 2017.",
  typicalServices: [
    "E-money wallets and IBAN-style payment accounts",
    "Prepaid and debit card issuing",
    "Domestic and cross-border transfers",
    "Currency conversion and multi-currency balances",
    "Banking-as-a-service and programme management for third-party brands",
  ],
  products: ["e_money_accounts", "card_issuing", "domestic_payments", "cross_border_payments", "fx_transfers"],
  primaryCustomers: ["individuals", "smes", "agents_intermediaries"],
  illustrativeExamples: [
    { name: "Wise", note: "Multi-currency e-money accounts and low-cost international transfers." },
    { name: "Revolut", note: "App-based multi-currency wallets and cards across the EEA." },
    { name: "Modulr", note: "Embedded payment accounts and banking-as-a-service for businesses." },
    { name: "Payoneer", note: "Cross-border payouts and accounts for online sellers and freelancers." },
  ],
  inherentRisks: [
    { theme: "money_laundering", level: "very_high", rationale: "Fast remote onboarding, low-friction loads and instant transfers make e-money accounts attractive as layering and mule vehicles." },
    { theme: "fraud", level: "high", rationale: "Authorised push payment scams and account takeover target instant-settling e-money rails." },
    { theme: "sanctions_evasion", level: "high", rationale: "Cross-border and multi-currency flows expose the firm to sanctioned parties and jurisdictions on both legs." },
    { theme: "terrorist_financing", level: "medium", rationale: "Low-value, high-volume transfers can fund terrorism below traditional thresholds, especially via prepaid cards." },
    { theme: "tax_evasion", level: "medium", rationale: "Multi-jurisdiction accounts can be used to route undeclared income away from the customer's home tax authority." },
  ],
  controlPriorities: [
    "Real-time transaction monitoring tuned to e-money load and spend patterns",
    "Money-mule and network detection across linked accounts and devices",
    "Sanctions screening against the full consolidated list at onboarding and payment",
    "Agent, distributor and programme-partner due diligence and oversight",
    "Source-of-funds checks on large or rapid balance loads",
  ],
  kycPointers: [
    "Simplified due diligence is only available within the e-money thresholds in the MLR; confirm limits are enforced in the system",
    "Beneficial ownership and control for SME and corporate account holders",
    "Programme-partner and distributor onboarding due diligence, with clear AML responsibility split",
  ],
};

const pi: FirmProfile = {
  firmType: "pi",
  tagline: "Moves money for customers without issuing e-money or taking deposits.",
  description:
    "A payment institution provides payment services such as money remittance, cross-border transfers, merchant acquiring and payment initiation. It executes payments rather than storing value, so funds move quickly from payer to beneficiary, often across borders and through agent or partner networks.",
  regulatoryContext:
    "Payment Services Regulations 2017, supervised by the FCA, with AML obligations under the Money Laundering Regulations 2017 and the funds-transfer (wire) information rules.",
  typicalServices: [
    "Money remittance and cross-border transfers",
    "Foreign exchange and multi-currency settlement",
    "Merchant acquiring and payment processing",
    "Payment initiation and open-banking services",
    "Bulk and marketplace payouts",
  ],
  products: ["cross_border_payments", "fx_transfers", "remittance", "domestic_payments", "marketplace_payouts"],
  primaryCustomers: ["individuals", "smes", "corporates", "agents_intermediaries"],
  illustrativeExamples: [
    { name: "Wise", note: "Cross-border money transfer at close to the interbank rate." },
    { name: "PayPal", note: "Online payment acceptance and consumer-to-business transfers." },
    { name: "Ebury", note: "Business FX and international payments for SMEs and corporates." },
    { name: "Airwallex", note: "Global business accounts, collections and cross-border payouts." },
  ],
  inherentRisks: [
    { theme: "sanctions_evasion", level: "very_high", rationale: "Cross-border corridors mean either the payer, the beneficiary or an intermediary bank can be a sanctioned party or jurisdiction." },
    { theme: "money_laundering", level: "high", rationale: "High-velocity payments through corridors and agents are used to layer and integrate illicit funds." },
    { theme: "fraud", level: "high", rationale: "Push-payment scams and invoice redirection exploit fast, hard-to-recall cross-border payments." },
    { theme: "terrorist_financing", level: "medium", rationale: "Remittance corridors to higher-risk regions can move small sums to fund terrorism." },
  ],
  controlPriorities: [
    "Sanctions and beneficiary screening on every payment leg, including intermediary banks",
    "Corridor and jurisdiction risk scoring with purpose-of-payment capture",
    "Agent and partner network due diligence and ongoing oversight",
    "Authorised push payment scam detection and interdiction",
    "Funds-transfer (wire) information completeness on payer and payee",
  ],
  kycPointers: [
    "Payer and payee information must travel with the payment under the funds-transfer rules (FATF Recommendation 16)",
    "Corporate and merchant beneficial ownership, plus expected payment profile",
    "Occasional-transaction identification thresholds for one-off remittance customers",
  ],
};

const bank: FirmProfile = {
  firmType: "bank",
  tagline: "Takes deposits, lends and offers the full product range across customer segments.",
  description:
    "A bank takes deposits, lends, and offers current accounts, cards, mortgages, trade finance, treasury and often correspondent banking. The breadth of products, the presence of cash, and relationships with other banks make it the most exposed model across almost every financial-crime theme.",
  regulatoryContext:
    "Dual-regulated by the PRA and FCA, with AML obligations under the Money Laundering Regulations 2017 and, for the largest firms, the FCA systematic AML programme.",
  typicalServices: [
    "Current and savings accounts and overdrafts",
    "Retail and commercial lending and mortgages",
    "Trade finance and documentary credits",
    "Correspondent and nostro/vostro banking",
    "Cards, treasury and foreign exchange",
  ],
  products: ["lending", "trade_finance", "cross_border_payments", "domestic_payments", "card_issuing", "fx_transfers"],
  primaryCustomers: ["individuals", "smes", "corporates", "high_net_worth", "politically_exposed"],
  illustrativeExamples: [
    { name: "HSBC", note: "Global universal bank spanning retail, commercial and correspondent banking." },
    { name: "Barclays", note: "Universal bank with retail, corporate and investment banking arms." },
    { name: "Santander UK", note: "Retail and commercial bank serving individuals and SMEs." },
    { name: "NatWest", note: "Retail and commercial banking across the UK and Ireland." },
  ],
  inherentRisks: [
    { theme: "money_laundering", level: "very_high", rationale: "The full product set, cash handling and correspondent relationships give criminals every stage of the laundering cycle in one place." },
    { theme: "sanctions_evasion", level: "very_high", rationale: "Correspondent banking and cross-border trade expose the bank to sanctioned parties through nested and intermediary relationships." },
    { theme: "bribery_corruption", level: "high", rationale: "PEP, sovereign and large corporate relationships carry grand-corruption and facilitation-payment exposure." },
    { theme: "fraud", level: "high", rationale: "Scale and product breadth attract authorised push payment, application and account-takeover fraud." },
    { theme: "proliferation_financing", level: "medium", rationale: "Trade finance and correspondent flows can fund dual-use procurement for weapons programmes." },
    { theme: "terrorist_financing", level: "medium", rationale: "Retail accounts and remittances can be exploited for low-value terrorist financing." },
  ],
  controlPriorities: [
    "Comprehensive transaction-monitoring scenario coverage with regular tuning and gap analysis",
    "Correspondent banking due diligence, including nesting and downstream-bank checks",
    "Trade-based money laundering controls on documentary trade",
    "PEP and source-of-wealth enhanced due diligence",
    "Sanctions screening calibrated to the corridors and customers served",
  ],
  kycPointers: [
    "Full customer due diligence with beneficial ownership to the 25 percent threshold",
    "Enhanced due diligence and senior approval for PEPs and high-risk customers",
    "Correspondent due diligence under FATF Recommendation 13 before establishing the relationship",
  ],
};

const msb: FirmProfile = {
  firmType: "msb",
  tagline: "Cash-intensive money transmission and currency exchange, often via agents.",
  description:
    "A money service business transmits money, exchanges currency and cashes cheques, frequently through a network of agents and with significant cash handling. Speed, cash and agent reach make it a classic placement and corridor-laundering channel, and a remittance route into higher-risk regions.",
  regulatoryContext:
    "Registered with the FCA (or HMRC for some bureaux) and supervised for AML under the Money Laundering Regulations 2017, with the funds-transfer information rules applying to transfers.",
  typicalServices: [
    "Cash-to-cash and account-to-cash remittance",
    "Bureau de change and currency exchange",
    "Cheque cashing and bill payment",
    "Mobile top-ups and prepaid load",
  ],
  products: ["remittance", "fx_transfers", "cross_border_payments"],
  primaryCustomers: ["individuals", "smes", "agents_intermediaries"],
  illustrativeExamples: [
    { name: "Western Union", note: "Global cash and account remittance through a large agent network." },
    { name: "MoneyGram", note: "International money transfer across retail agent locations." },
    { name: "Ria", note: "Cross-border remittance focused on migrant corridors." },
  ],
  inherentRisks: [
    { theme: "money_laundering", level: "very_high", rationale: "Cash intensity and agent reach support structuring, smurfing and rapid placement of illicit cash." },
    { theme: "terrorist_financing", level: "high", rationale: "Remittance corridors into conflict and higher-risk regions are a known terrorist-financing channel for small sums." },
    { theme: "fraud", level: "high", rationale: "Romance, investment and impersonation scams rely on irreversible cash payout at the receiving agent." },
    { theme: "sanctions_evasion", level: "high", rationale: "Corridor exposure to sanctioned jurisdictions and parties on the receiving leg." },
  ],
  controlPriorities: [
    "Agent oversight, training and transaction surveillance across the network",
    "Cash structuring and smurfing detection across senders and receivers",
    "Corridor and beneficiary risk scoring with payout interdiction",
    "Scam interdiction and consumer warnings at the point of send",
  ],
  kycPointers: [
    "Identification at occasional-transaction thresholds and on linked or aggregated activity",
    "Agent due diligence, ongoing monitoring and clear AML responsibility",
    "Sender and beneficiary information completeness on every transfer",
  ],
};

const crypto: FirmProfile = {
  firmType: "crypto",
  tagline: "Exchanges, custodies and transfers crypto assets across pseudonymous rails.",
  description:
    "A crypto-asset business exchanges fiat and crypto, custodies wallets and moves crypto on public blockchains. Pseudonymity, instant cross-border settlement, mixers and cross-chain bridges make tracing harder, and the sector is a focus for investment-scam proceeds, sanctions evasion and state-linked theft.",
  regulatoryContext:
    "Registered with the FCA under the Money Laundering Regulations 2017, subject to the crypto travel rule for transfers and the financial promotions regime for marketing.",
  typicalServices: [
    "Fiat-to-crypto and crypto-to-crypto exchange",
    "Custody and hosted wallets",
    "On-chain transfers and withdrawals",
    "Staking, lending and over-the-counter desks",
  ],
  products: ["crypto_exchange", "cross_border_payments"],
  primaryCustomers: ["individuals", "corporates", "high_net_worth"],
  illustrativeExamples: [
    { name: "Coinbase", note: "Retail and institutional crypto exchange and custody." },
    { name: "Kraken", note: "Spot and derivatives crypto exchange with custody." },
    { name: "Gemini", note: "Regulated crypto exchange and custodian." },
  ],
  inherentRisks: [
    { theme: "money_laundering", level: "very_high", rationale: "Mixers, peel chains and cross-chain bridges are used to break the trail between illicit origin and cash-out." },
    { theme: "fraud", level: "very_high", rationale: "Investment and romance (pig-butchering) scams convert victim funds into crypto at the on-ramp." },
    { theme: "sanctions_evasion", level: "very_high", rationale: "Sanctioned addresses, mixers and non-compliant exchanges route value around restrictions." },
    { theme: "proliferation_financing", level: "high", rationale: "State-linked theft and laundering, including by sanctioned regimes, fund weapons programmes." },
    { theme: "terrorist_financing", level: "high", rationale: "Public donation campaigns and wallets solicit crypto for terrorist groups." },
  ],
  controlPriorities: [
    "Blockchain analytics for wallet attribution, exposure scoring and mixer detection",
    "Travel-rule data exchange and counterparty (VASP) due diligence",
    "Sanctioned-address and high-risk-service screening before transfer",
    "Source-of-funds and scam-typology detection at the fiat on-ramp",
  ],
  kycPointers: [
    "Identity verification linked to wallet attribution and ongoing on-chain monitoring",
    "Travel-rule originator and beneficiary information for transfers above the threshold",
    "Counterparty exchange (VASP) due diligence before opening a relationship",
  ],
};

const neobank: FirmProfile = {
  firmType: "neobank",
  tagline: "App-only bank with fast remote onboarding and rapid customer growth.",
  description:
    "A neobank delivers current accounts, cards, instant payments and increasingly lending entirely through an app, with fully remote onboarding and very fast growth. The combination of frictionless onboarding, instant rails and scale means financial-crime controls must keep pace with customer numbers, which is where the model is most often tested.",
  regulatoryContext:
    "Holds a banking licence (PRA and FCA) or operates on an e-money permission, with AML obligations under the Money Laundering Regulations 2017.",
  typicalServices: [
    "App-based current accounts and cards",
    "Instant domestic and faster payments",
    "Savings, overdrafts and consumer lending",
    "In-app foreign exchange and travel spend",
  ],
  products: ["e_money_accounts", "card_issuing", "domestic_payments", "cross_border_payments", "lending", "fx_transfers"],
  primaryCustomers: ["individuals", "smes"],
  illustrativeExamples: [
    { name: "Monzo", note: "App-only UK current accounts, cards and instant payments." },
    { name: "Starling", note: "Digital bank for personal and small-business banking." },
    { name: "Revolut", note: "Multi-product app spanning accounts, cards, FX and crypto." },
    { name: "Chime", note: "US app-based banking through partner-bank rails." },
  ],
  inherentRisks: [
    { theme: "fraud", level: "very_high", rationale: "Authorised push payment and account-takeover fraud target instant payments and rapid remote onboarding." },
    { theme: "money_laundering", level: "very_high", rationale: "Mule accounts open quickly and move funds instantly, and controls can lag explosive customer growth." },
    { theme: "sanctions_evasion", level: "high", rationale: "Screening must cover the full sanctions list and scale with onboarding volume, a recurring weak point." },
    { theme: "terrorist_financing", level: "medium", rationale: "Low-value instant transfers can fund terrorism below traditional review thresholds." },
  ],
  controlPriorities: [
    "Money-mule detection across linked accounts, devices and payment networks",
    "Real-time transaction monitoring scaled to the rate of customer growth",
    "Full consolidated sanctions-list screening with coverage testing",
    "Onboarding and application-fraud controls (identity, liveness, device and behaviour)",
    "Financial-crime staffing and SAR throughput scaled to volume",
  ],
  kycPointers: [
    "Remote digital identity verification with liveness and document authentication",
    "Device, behavioural and network signals to catch synthetic and mule onboarding",
    "Ongoing monitoring that re-rates customers as their behaviour changes",
  ],
};

const wealth_manager: FirmProfile = {
  firmType: "wealth_manager",
  tagline: "Manages and advises on wealth for affluent and high-net-worth clients.",
  description:
    "A wealth manager provides discretionary and advisory portfolio management, brokerage and custody for affluent, high-net-worth and family-office clients, often through trusts and complex structures. The risk concentrates in opaque ownership, source of wealth, third-party funds and PEP relationships, and in market-abuse and dividend-arbitrage schemes on the trading side.",
  regulatoryContext:
    "FCA-regulated for investment business, with AML obligations under the Money Laundering Regulations 2017 and market-abuse obligations under UK MAR.",
  typicalServices: [
    "Discretionary and advisory portfolio management",
    "Brokerage and dealing in securities",
    "Custody of client assets",
    "Trust, family-office and structured-product services",
    "Lombard and securities-backed lending",
  ],
  products: ["lending", "fx_transfers", "cross_border_payments"],
  primaryCustomers: ["high_net_worth", "politically_exposed", "corporates", "individuals"],
  illustrativeExamples: [
    { name: "St. James's Place", note: "Advice-led wealth management for retail and affluent clients." },
    { name: "Rathbones", note: "Discretionary investment management and financial planning." },
    { name: "Coutts", note: "Private banking and wealth management for high-net-worth clients." },
  ],
  inherentRisks: [
    { theme: "money_laundering", level: "very_high", rationale: "Investments, trusts and third-party funds are used to layer and integrate illicit wealth behind legitimate-looking holdings." },
    { theme: "bribery_corruption", level: "high", rationale: "PEP and sovereign-linked clients carry grand-corruption proceeds and source-of-wealth risk." },
    { theme: "tax_evasion", level: "high", rationale: "Offshore structures and complex ownership can conceal undeclared income and assets." },
    { theme: "sanctions_evasion", level: "high", rationale: "Wealth tied to sanctioned individuals can be hidden behind nominee and trust structures." },
    { theme: "fraud", level: "medium", rationale: "Trading desks face cum-ex and dividend-arbitrage schemes and market-abuse exposure." },
  ],
  controlPriorities: [
    "Source-of-wealth and source-of-funds corroboration against independent evidence",
    "PEP identification with enhanced due diligence and senior approval",
    "Beneficial-ownership analysis through trusts and layered structures",
    "Third-party payment scrutiny into and out of client accounts",
    "Market-abuse and dividend-arbitrage surveillance on the dealing side",
  ],
  kycPointers: [
    "Documented and corroborated source of wealth for high-net-worth onboarding",
    "Look-through to the beneficial owners and controllers of trusts and structures",
    "PEP and adverse-media screening with refreshed enhanced due diligence",
  ],
};

const insurance: FirmProfile = {
  firmType: "insurance",
  tagline: "Life, investment and general insurance, where savings-style policies carry laundering risk.",
  description:
    "An insurer underwrites life, investment and general insurance. The money-laundering risk concentrates in savings-style life and investment products (single-premium bonds, unit-linked policies and annuities) where premiums can be laundered and surrendered, while general insurance carries significant claims-fraud risk. Brokers and intermediaries add an oversight layer.",
  regulatoryContext:
    "Dual-regulated by the PRA and FCA for insurance business, with AML obligations under the Money Laundering Regulations 2017 applying to life and investment business.",
  typicalServices: [
    "Single-premium and unit-linked life and investment bonds",
    "Annuities and pensions",
    "General (property and casualty) insurance",
    "Claims handling and settlement",
    "Distribution through brokers and intermediaries",
  ],
  products: ["lending", "cross_border_payments"],
  primaryCustomers: ["individuals", "high_net_worth", "corporates"],
  illustrativeExamples: [
    { name: "Aviva", note: "Life, pensions, investments and general insurance." },
    { name: "Legal & General", note: "Life insurance, retirement and investment products." },
    { name: "Prudential", note: "Life and investment business across multiple markets." },
  ],
  inherentRisks: [
    { theme: "fraud", level: "very_high", rationale: "Claims fraud, from staged losses to inflated and ghost-broking claims, is the dominant exposure in general insurance." },
    { theme: "money_laundering", level: "high", rationale: "Single-premium and early-surrendered investment policies launder funds through a regulated product wrapper." },
    { theme: "sanctions_evasion", level: "medium", rationale: "Premium and claim payouts can involve sanctioned policyholders, beneficiaries or jurisdictions." },
    { theme: "bribery_corruption", level: "medium", rationale: "Broker and intermediary commissions and facilitation payments create corruption exposure in distribution." },
  ],
  controlPriorities: [
    "Single-premium, top-up and early-surrender monitoring on investment policies",
    "Source-of-funds checks on large or unusual premium payments",
    "Claims-fraud detection, including staged-loss and ghost-broking analytics",
    "Broker and intermediary due diligence and oversight",
    "Sanctions screening on policyholders, beneficiaries and payees",
  ],
  kycPointers: [
    "Identify the policyholder, the beneficial owner and the beneficiary at payout",
    "Source-of-funds evidence for large or single-premium investment business",
    "Intermediary and broker onboarding due diligence with AML responsibility defined",
  ],
};

export const FIRM_PROFILES: Record<FirmType, FirmProfile> = {
  emi,
  pi,
  bank,
  msb,
  crypto,
  neobank,
  wealth_manager,
  insurance,
};

/** Display order for the dashboard switcher (payments-first, then specialist). */
export const FIRM_TYPE_ORDER: FirmType[] = [
  "neobank",
  "emi",
  "pi",
  "bank",
  "msb",
  "crypto",
  "wealth_manager",
  "insurance",
];

export const ALL_FIRM_PROFILES: FirmProfile[] = FIRM_TYPE_ORDER.map((ft) => FIRM_PROFILES[ft]);

export function firmProfileFor(firmType: FirmType): FirmProfile {
  return FIRM_PROFILES[firmType];
}
