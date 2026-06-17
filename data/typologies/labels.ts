import type { FirmType, ProductType, CustomerType, RiskTheme } from "./types";

/**
 * Display labels for TypologyIQ enums. Single source of truth for rendering
 * selected firm types / products / customer types / risk themes outside the
 * wizard (results page, PDF export).
 */

export const FIRM_TYPE_LABEL: Record<FirmType, string> = {
  emi: "E-Money Institution (EMI)",
  pi: "Payment Institution (PI)",
  bank: "Bank / Credit Institution",
  msb: "Money Service Business (MSB)",
  crypto: "Crypto Asset Service Provider",
  neobank: "Neobank / Digital Bank",
  wealth_manager: "Wealth Manager",
  insurance: "Insurance Provider",
};

export const PRODUCT_LABEL: Record<ProductType, string> = {
  cross_border_payments: "Cross-Border Payments",
  domestic_payments: "Domestic Payments",
  e_money_accounts: "E-Money Accounts",
  crypto_exchange: "Crypto Exchange",
  remittance: "Remittance",
  trade_finance: "Trade Finance",
  lending: "Lending",
  fx_transfers: "FX Transfers",
  card_issuing: "Card Issuing",
  marketplace_payouts: "Marketplace Payouts",
};

export const CUSTOMER_LABEL: Record<CustomerType, string> = {
  individuals: "Individuals",
  smes: "SMEs",
  corporates: "Corporates",
  high_net_worth: "High Net Worth Individuals",
  politically_exposed: "PEPs & Associates",
  non_profit: "Non-Profit / Charities",
  agents_intermediaries: "Agents & Intermediaries",
};

export const RISK_THEME_LABEL: Record<RiskTheme, string> = {
  terrorist_financing: "Terrorist Financing",
  money_laundering: "Money Laundering",
  sanctions_evasion: "Sanctions Evasion",
  fraud: "Fraud",
  tax_evasion: "Tax Evasion",
  bribery_corruption: "Bribery & Corruption",
  proliferation_financing: "Proliferation Financing",
};
