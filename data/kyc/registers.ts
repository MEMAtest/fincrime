/**
 * Reference registers underpinning the matrix, derived from the source workbook.
 * A regulated entity's home/host regulator must appear on the recognised-regulators
 * list; a listed entity's exchange must appear on the recognised-exchanges list;
 * customers in restricted industries fall outside simplified due diligence.
 *
 * Representative, not exhaustive. Each regulator/exchange links to its official site.
 */

export interface RecognisedRegulator {
  country: string;
  name: string;
  acronym: string;
  url: string;
}

export interface RecognisedExchange {
  country: string;
  name: string;
  acronym: string;
  url: string;
}

export const recognisedRegulators: RecognisedRegulator[] = [
  { country: "United Kingdom", name: "Financial Conduct Authority", acronym: "FCA", url: "https://www.fca.org.uk/" },
  { country: "United Kingdom", name: "Prudential Regulation Authority", acronym: "PRA", url: "https://www.bankofengland.co.uk/prudential-regulation" },
  { country: "United States", name: "Financial Crimes Enforcement Network", acronym: "FinCEN", url: "https://www.fincen.gov/" },
  { country: "United States", name: "Office of the Comptroller of the Currency", acronym: "OCC", url: "https://www.occ.gov/" },
  { country: "United States", name: "Securities and Exchange Commission", acronym: "SEC", url: "https://www.sec.gov/" },
  { country: "European Union", name: "Anti-Money Laundering Authority", acronym: "AMLA", url: "https://www.amla.europa.eu/" },
  { country: "Germany", name: "Bundesanstalt für Finanzdienstleistungsaufsicht", acronym: "BaFin", url: "https://www.bafin.de/" },
  { country: "France", name: "Autorité de Contrôle Prudentiel et de Résolution", acronym: "ACPR", url: "https://acpr.banque-france.fr/" },
  { country: "France", name: "Autorité des Marchés Financiers", acronym: "AMF", url: "https://www.amf-france.org/" },
  { country: "Singapore", name: "Monetary Authority of Singapore", acronym: "MAS", url: "https://www.mas.gov.sg/" },
  { country: "Hong Kong", name: "Hong Kong Monetary Authority", acronym: "HKMA", url: "https://www.hkma.gov.hk/" },
  { country: "Hong Kong", name: "Securities and Futures Commission", acronym: "SFC", url: "https://www.sfc.hk/" },
  { country: "Australia", name: "Australian Securities and Investments Commission", acronym: "ASIC", url: "https://asic.gov.au/" },
  { country: "Japan", name: "Financial Services Agency", acronym: "FSA", url: "https://www.fsa.go.jp/en/" },
  { country: "Switzerland", name: "Swiss Financial Market Supervisory Authority", acronym: "FINMA", url: "https://www.finma.ch/en/" },
  { country: "Ireland", name: "Central Bank of Ireland", acronym: "CBI", url: "https://www.centralbank.ie/" },
  { country: "Luxembourg", name: "Commission de Surveillance du Secteur Financier", acronym: "CSSF", url: "https://www.cssf.lu/en/" },
  { country: "Netherlands", name: "De Nederlandsche Bank", acronym: "DNB", url: "https://www.dnb.nl/en/" },
];

export const recognisedExchanges: RecognisedExchange[] = [
  { country: "United Kingdom", name: "London Stock Exchange", acronym: "LSE", url: "https://www.londonstockexchange.com/" },
  { country: "United States", name: "New York Stock Exchange", acronym: "NYSE", url: "https://www.nyse.com/" },
  { country: "United States", name: "Nasdaq", acronym: "NASDAQ", url: "https://www.nasdaq.com/" },
  { country: "European Union", name: "Euronext (Paris/Amsterdam/Brussels/Dublin/Lisbon)", acronym: "ENX", url: "https://www.euronext.com/" },
  { country: "Germany", name: "Deutsche Börse / Frankfurt Stock Exchange", acronym: "FWB", url: "https://www.deutsche-boerse.com/" },
  { country: "Singapore", name: "Singapore Exchange", acronym: "SGX", url: "https://www.sgx.com/" },
  { country: "Hong Kong", name: "Hong Kong Exchanges and Clearing", acronym: "HKEX", url: "https://www.hkex.com.hk/" },
  { country: "Japan", name: "Japan Exchange Group (Tokyo)", acronym: "JPX", url: "https://www.jpx.co.jp/english/" },
  { country: "Australia", name: "Australian Securities Exchange", acronym: "ASX", url: "https://www.asx.com.au/" },
  { country: "Switzerland", name: "SIX Swiss Exchange", acronym: "SIX", url: "https://www.six-group.com/" },
];

/** Sectors typically outside simplified due diligence / carrying elevated risk appetite. */
export const restrictedIndustries: string[] = [
  "Unlicensed money services / value transfer",
  "Unregulated virtual-asset services",
  "Online gambling / unlicensed gaming",
  "Adult entertainment",
  "Arms, defence and dual-use goods",
  "Precious metals and stones dealing",
  "Cash-intensive businesses",
  "Shell companies / companies with bearer shares",
  "Cannabis and related products (where federally restricted)",
  "Sanctioned-jurisdiction nexus businesses",
];
