import type { SourceOrg } from "./typologies/types";

/**
 * Plain-English glossary of financial-crime terms, each optionally cited to an
 * authoritative source. Powers inline GlossaryTerm popovers and the /glossary
 * page. Keep definitions short and neutral; the source is shown via SourceBadge.
 */

export interface GlossarySource {
  org: SourceOrg;
  reference: string;
  title: string;
  url: string;
}

export interface GlossaryEntry {
  term: string;
  slug: string;
  aliases?: string[];
  /** One-line tooltip definition. */
  short: string;
  /** Optional fuller definition for the /glossary page. */
  long?: string;
  source?: GlossarySource;
}

const S: Record<string, GlossarySource> = {
  fatf: { org: "FATF", reference: "FATF Recommendations", title: "FATF Recommendations (international AML/CFT standards)", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  jmlsg: { org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  fca: { org: "FCA", reference: "FCA Financial Crime Guide", title: "FCA Financial Crime Guide (FCG)", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ofsi: { org: "OFSI", reference: "OFSI", title: "Office of Financial Sanctions Implementation", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
  wolfsberg: { org: "Wolfsberg", reference: "Wolfsberg Principles", title: "The Wolfsberg Group Principles and Standards", url: "https://www.wolfsberg-principles.com/" },
  mlr: { org: "MLR", reference: "MLR 2017", title: "Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Typology", slug: "typology",
    short: "A recognised pattern of how financial crime is carried out (e.g. structuring or mule networks), used to design detection controls.",
    long: "A typology describes a repeatable method criminals use to launder money or move illicit funds. Mapping a typology to controls means the firm can detect the behaviour rather than guess at risk.",
    source: S.fatf,
  },
  {
    term: "Beneficial owner", slug: "beneficial-owner", aliases: ["beneficial ownership", "ubo", "ultimate beneficial owner", "beneficial owners"],
    short: "The natural person(s) who ultimately own or control a customer, typically anyone holding more than 25% of shares or voting rights.",
    long: "Identifying beneficial owners pierces nominee and corporate layers so the firm knows who is really behind a customer. The 25% threshold is the common trigger across UK, EU and US rules; control can also arise by other means.",
    source: S.fatf,
  },
  {
    term: "PEP", slug: "pep", aliases: ["politically exposed person", "politically exposed persons", "peps"],
    short: "A politically exposed person: someone entrusted with a prominent public function, plus their family and close associates, who present higher bribery/corruption risk.",
    source: S.jmlsg,
  },
  {
    term: "SAR", slug: "sar", aliases: ["suspicious activity report", "suspicious activity reports", "str", "suspicious transaction report"],
    short: "A Suspicious Activity Report: the disclosure a firm files (in the UK, to the NCA) when it knows or suspects money laundering or terrorist financing.",
    source: S.jmlsg,
  },
  {
    term: "CDD", slug: "cdd", aliases: ["customer due diligence"],
    short: "Customer Due Diligence: identifying and verifying the customer and their beneficial owners, and understanding the purpose of the relationship.",
    source: S.mlr,
  },
  {
    term: "EDD", slug: "edd", aliases: ["enhanced due diligence"],
    short: "Enhanced Due Diligence: the extra measures applied to higher-risk customers (e.g. PEPs, high-risk countries), such as source-of-wealth checks and senior sign-off.",
    source: S.mlr,
  },
  {
    term: "SDD", slug: "sdd", aliases: ["simplified due diligence"],
    short: "Simplified Due Diligence: reduced measures permitted where a customer or product is demonstrably lower risk.",
    source: S.mlr,
  },
  {
    term: "KYC", slug: "kyc", aliases: ["know your customer"],
    short: "Know Your Customer: the onboarding and ongoing process of identifying customers and understanding their expected activity. Closely related to CDD.",
    source: S.jmlsg,
  },
  {
    term: "MLRO", slug: "mlro", aliases: ["money laundering reporting officer", "nominated officer"],
    short: "Money Laundering Reporting Officer: the senior individual accountable for a firm's AML programme and for deciding on and filing SARs.",
    source: S.fca,
  },
  {
    term: "Three lines of defence", slug: "three-lines-of-defence", aliases: ["3lod", "three lines of defense", "1lod", "2lod"],
    short: "A governance model: the business owns and manages risk (first line), compliance/risk oversees it (second line), and internal audit independently assures it (third line).",
    source: S.jmlsg,
  },
  {
    term: "Source of funds", slug: "source-of-funds", aliases: ["sof", "source of wealth", "sow"],
    short: "Source of funds is the origin of the money in a specific transaction; source of wealth is how the customer accumulated their overall assets. Both are tested in EDD.",
    source: S.jmlsg,
  },
  {
    term: "Sanctions screening", slug: "sanctions-screening", aliases: ["sanctions"],
    short: "Checking customers and transactions against sanctions lists (e.g. OFSI, OFAC, UN, EU) to prevent dealing with designated persons or asset-freeze targets.",
    source: S.ofsi,
  },
  {
    term: "Structuring", slug: "structuring", aliases: ["smurfing"],
    short: "Breaking a large sum into many smaller transactions to stay below reporting or CDD thresholds and avoid detection.",
    source: S.fatf,
  },
  {
    term: "Layering", slug: "layering",
    short: "The stage of money laundering that moves and disguises illicit funds through complex transfers to obscure their origin.",
    source: S.fatf,
  },
  {
    term: "Placement", slug: "placement",
    short: "The first stage of money laundering: introducing illicit cash into the financial system.",
    source: S.fatf,
  },
  {
    term: "Integration", slug: "integration",
    short: "The final stage of money laundering: returning laundered funds to the criminal as apparently legitimate wealth.",
    source: S.fatf,
  },
  {
    term: "Nominee", slug: "nominee",
    short: "A person or entity that holds an asset or position on behalf of someone else, often used to obscure the real beneficial owner.",
    source: S.fatf,
  },
  {
    term: "Shell company", slug: "shell-company",
    short: "A company with no significant operations or assets, sometimes used to hide ownership or move funds.",
    source: S.fatf,
  },
  {
    term: "Correspondent banking", slug: "correspondent-banking",
    short: "Where one bank provides accounts and payment services to another (often cross-border), creating nested third-party exposure that needs enhanced controls.",
    source: S.wolfsberg,
  },
  {
    term: "Money mule", slug: "money-mule", aliases: ["mule account", "mule network"],
    short: "An account or person used to receive and pass on the proceeds of fraud or crime, often layered into networks to launder funds.",
    source: S.fca,
  },
  {
    term: "Red-flag indicator", slug: "red-flag-indicator", aliases: ["red flag", "red flags"],
    short: "An observable warning sign associated with a typology (e.g. rapid pass-through of funds) that should trigger review.",
    source: S.fatf,
  },
  {
    term: "Risk-based approach", slug: "risk-based-approach", aliases: ["rba"],
    short: "Allocating AML effort in proportion to assessed risk, applying more scrutiny where risk is higher and less where it is demonstrably lower.",
    source: S.fatf,
  },
  {
    term: "Transaction monitoring", slug: "transaction-monitoring", aliases: ["tm"],
    short: "Ongoing scrutiny of transactions against rules and the customer's expected profile to detect activity that may indicate financial crime.",
    source: S.jmlsg,
  },
  {
    term: "Proliferation financing", slug: "proliferation-financing", aliases: ["pf"],
    short: "Financing the spread of weapons of mass destruction, including evasion of related sanctions; an explicit FATF and UK obligation.",
    source: S.fatf,
  },
];

const byKey: Record<string, GlossaryEntry> = {};
for (const e of GLOSSARY) {
  byKey[e.term.toLowerCase()] = e;
  for (const a of e.aliases ?? []) byKey[a.toLowerCase()] = e;
}

export const GLOSSARY_BY_KEY: Record<string, GlossaryEntry> = byKey;

export function glossaryLookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY_BY_KEY[term.trim().toLowerCase()];
}
