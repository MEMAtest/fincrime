import type { RiskTheme } from "./typologies/types";

/**
 * Cited red-flag indicators and threshold references per risk theme, plus the
 * authoritative frameworks behind them. Used by the Evidence tabs. Every entry
 * attributes a real, published source, no invented thresholds.
 */

export interface CitedIndicator {
  indicator: string;
  source: string; // short label, e.g. "FATF" / "JMLSG"
  url: string;
}

export const FRAMEWORK_SOURCES: { org: string; title: string; url: string }[] = [
  { org: "FATF", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  { org: "JMLSG", title: "JMLSG Guidance (current)", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  { org: "Wolfsberg", title: "Wolfsberg Principles & Standards", url: "https://www.wolfsberg-principles.com/" },
  { org: "OFSI", title: "Office of Financial Sanctions Implementation", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
  { org: "FCA", title: "FCA Financial Crime Guide (FCG)", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  { org: "MLR", title: "UK Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
  { org: "FinCEN", title: "FinCEN CDD Rule (31 CFR 1010.230) & CIP (1020.220)", url: "https://www.law.cornell.edu/cfr/text/31/1010.230" },
  { org: "EU", title: "EU AMLD5 (Dir. 2015/849) & AMLR (Reg. 2024/1624)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02015L0849-20241230" },
  { org: "BaFin", title: "Germany Geldwäschegesetz (GwG)", url: "https://www.gesetze-im-internet.de/gwg_2017/" },
  { org: "ACPR", title: "France Code monétaire et financier (LCB-FT)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  { org: "AMF", title: "AMF guidance on client & beneficial-owner identification", url: "https://www.amf-france.org/" },
  { org: "MAS", title: "MAS Notice 626 (AML/CFT, Banks)", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  { org: "HKMA", title: "HK AMLO (Cap. 615) & HKMA AML/CFT Guideline", url: "https://www.elegislation.gov.hk/hk/cap615" },
  { org: "SFC", title: "SFC AML/CFT Guideline for Licensed Corporations", url: "https://www.sfc.hk/en/Rules-and-standards/Anti-money-laundering-and-counter-financing-of-terrorism" },
];

export const INDICATORS_BY_THEME: Record<RiskTheme, CitedIndicator[]> = {
  money_laundering: [
    { indicator: "Structuring: multiple transactions just below reporting/CDD thresholds", source: "FATF", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
    { indicator: "Rapid movement of funds in and out with no apparent economic purpose", source: "JMLSG", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { indicator: "Use of nominees, shell companies or complex ownership to obscure beneficial owners", source: "FATF R.24/25", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
    { indicator: "Activity inconsistent with the customer's known profile or expected behaviour", source: "FCA FCG", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
  terrorist_financing: [
    { indicator: "Low-value transfers, sent frequently, to higher-risk jurisdictions", source: "FATF", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
    { indicator: "Links to entities on UN/OFSI sanctions or designated-persons lists", source: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { indicator: "Misuse of non-profit organisations to move or raise funds", source: "FATF R.8", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  ],
  sanctions_evasion: [
    { indicator: "Use of intermediaries / front companies to obscure ultimate ownership or destination", source: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
    { indicator: "Payment routing through opaque or high-risk jurisdictions", source: "Wolfsberg", url: "https://www.wolfsberg-principles.com/" },
    { indicator: "Dual-use goods shipped toward higher-risk destinations", source: "OFSI / ECJU", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
  ],
  fraud: [
    { indicator: "Mule indicators: new account quickly receiving and forwarding funds", source: "FCA FCG", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
    { indicator: "Sudden, unexplained change in established account behaviour", source: "JMLSG", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { indicator: "Application data reused across multiple unrelated customers", source: "FCA FCG", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
  tax_evasion: [
    { indicator: "Offshore structures concealing beneficial ownership of income/assets", source: "FATF", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
    { indicator: "Round-sum invoicing or trade mispricing inconsistent with goods/services", source: "FATF", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  ],
  bribery_corruption: [
    { indicator: "Payments to PEPs or intermediaries lacking clear commercial rationale", source: "FCA FCG", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
    { indicator: "Use of consultants / agents in high-corruption-risk jurisdictions", source: "FATF", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  ],
  proliferation_financing: [
    { indicator: "Front companies linked to sanctioned weapons/dual-use programmes", source: "FATF R.7", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
    { indicator: "Trade in controlled/dual-use goods toward designated end-users", source: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
  ],
};
