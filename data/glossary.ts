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
    long: "A PEP is defined in the UK's MLR 2017 and JMLSG Guidance as an individual entrusted with a prominent public function, such as a head of state, government minister, member of parliament, senior judiciary, senior military officer, or executive of a state enterprise. Their position gives them access to public funds and decision-making that creates elevated bribery and corruption exposure. UK firms must apply EDD to PEPs and maintain it for at least 12 months after they leave office; family members and known close associates are captured by the definition too.",
    source: S.jmlsg,
  },
  {
    term: "SAR", slug: "sar", aliases: ["suspicious activity report", "suspicious activity reports", "str", "suspicious transaction report"],
    short: "A Suspicious Activity Report: the disclosure a firm files (in the UK, to the NCA) when it knows or suspects money laundering or terrorist financing.",
    long: "In the UK, a SAR is submitted to the National Crime Agency via the SARs Online system when a firm's nominated officer concludes that a knowledge or suspicion threshold is met under POCA 2002 or the Terrorism Act 2000. Filing a SAR may also obtain a defence against money laundering (DAML) when a transaction is involved, allowing the firm to proceed if the NCA does not refuse within the moratorium period. Failure to report when the threshold is met can be a criminal offence, and the firm must not tip off the customer that a report has been made.",
    source: S.jmlsg,
  },
  {
    term: "CDD", slug: "cdd", aliases: ["customer due diligence"],
    short: "Customer Due Diligence: identifying and verifying the customer and their beneficial owners, and understanding the purpose of the relationship.",
    long: "CDD is required before a business relationship begins or an occasional transaction is executed above the applicable threshold under MLR 2017. It has three core elements: identifying the customer and verifying their identity using reliable, independent source documents; identifying any beneficial owners and taking risk-based steps to verify their identity; and understanding the nature and purpose of the relationship to build a baseline for ongoing monitoring. Firms must refresh CDD when circumstances change, when doubts arise about existing information, or on a risk-based periodic schedule.",
    source: S.mlr,
  },
  {
    term: "EDD", slug: "edd", aliases: ["enhanced due diligence"],
    short: "Enhanced Due Diligence: the extra measures applied to higher-risk customers (e.g. PEPs, high-risk countries), such as source-of-wealth checks and senior sign-off.",
    long: "EDD is triggered by a higher-risk finding in the customer risk assessment: examples include PEPs and their associates, customers or transactions linked to high-risk third countries, complex or opaque ownership structures, and correspondent banking relationships. Specific EDD measures include obtaining senior management approval before establishing or continuing the relationship, establishing source of wealth and source of funds, and increasing the frequency and depth of ongoing monitoring. JMLSG Guidance and MLR 2017 leave firms discretion on the form EDD takes, provided it is genuinely proportionate to the identified risk.",
    source: S.mlr,
  },
  {
    term: "SDD", slug: "sdd", aliases: ["simplified due diligence"],
    short: "Simplified Due Diligence: reduced measures permitted where a customer or product is demonstrably lower risk.",
    long: "SDD is available where a firm has established that a customer, product or transaction presents a demonstrably lower risk of money laundering or terrorist financing, based on a documented risk assessment. Eligible situations under MLR 2017 include regulated financial institutions as customers, companies listed on major exchanges with disclosure obligations, and certain low-risk public bodies. SDD does not mean no due diligence: firms must still collect sufficient information to monitor the relationship and cannot apply SDD to any customer or product that exhibits higher-risk features.",
    source: S.mlr,
  },
  {
    term: "KYC", slug: "kyc", aliases: ["know your customer"],
    short: "Know Your Customer: the onboarding and ongoing process of identifying customers and understanding their expected activity. Closely related to CDD.",
    long: "KYC is the collective term for the policies, procedures and controls a firm uses to know who its customers are, what they do, and what to expect from the relationship. It encompasses initial identification and verification, beneficial ownership checks, risk profiling, ongoing monitoring, and periodic review. While the term originates in banking practice, it applies across all regulated sectors and is used largely interchangeably with CDD in many jurisdictions, including in the FATF Recommendations.",
    source: S.jmlsg,
  },
  {
    term: "MLRO", slug: "mlro", aliases: ["money laundering reporting officer", "nominated officer"],
    short: "Money Laundering Reporting Officer: the senior individual accountable for a firm's AML programme and for deciding on and filing SARs.",
    long: "The MLRO (termed the Nominated Officer in MLR 2017) must be of sufficient seniority and independence to exercise genuine judgment on internal disclosures and SAR decisions, without commercial pressure to delay or suppress reporting. They receive internal disclosures from staff, determine whether the knowledge or suspicion threshold is met, and file externally with the NCA. The FCA also expects MLROs to report regularly to the board, maintain the firm's risk assessment and AML policies, and be consulted on high-risk customer decisions. In larger firms an experienced deputy MLRO is a common control.",
    source: S.fca,
  },
  {
    term: "Three lines of defence", slug: "three-lines-of-defence", aliases: ["3lod", "three lines of defense", "1lod", "2lod"],
    short: "A governance model: the business owns and manages risk (first line), compliance/risk oversees it (second line), and internal audit independently assures it (third line).",
    long: "The three lines model was formally articulated by the Institute of Internal Auditors and is adopted by the FCA in its Financial Crime Guide as the expected governance structure for AML. The first line (the business) owns and manages risk day to day; the second line (compliance and risk) sets policy, monitors, and provides oversight and challenge; the third line (internal audit) provides periodic, independent assurance over both. Each line must be genuinely independent: a function that both generates revenue and signs off on its own controls does not satisfy the model.",
    source: S.jmlsg,
  },
  {
    term: "Source of funds", slug: "source-of-funds", aliases: ["sof", "source of wealth", "sow"],
    short: "Source of funds is the origin of the money in a specific transaction; source of wealth is how the customer accumulated their overall assets. Both are tested in EDD.",
    long: "Source of funds asks where the money for a specific transaction or account relationship originated, for example salary, a property sale, or business income. Source of wealth asks the broader question of how the customer built up their overall net assets over time. Both are central EDD tools: a customer whose stated source of wealth is inconsistent with their transaction history, employment, or apparent lifestyle presents a red flag that should be investigated and documented before the relationship proceeds or continues.",
    source: S.jmlsg,
  },
  {
    term: "Sanctions screening", slug: "sanctions-screening", aliases: ["sanctions"],
    short: "Checking customers and transactions against sanctions lists (e.g. OFSI, OFAC, UN, EU) to prevent dealing with designated persons or asset-freeze targets.",
    long: "UK firms must not deal with, or make funds or economic resources available to, sanctioned persons or entities under the Sanctions and Anti-Money Laundering Act 2018 and the implementing statutory instruments. Screening must cover customers, beneficial owners, counterparties and payees against HM Treasury/OFSI, UN, OFAC and EU consolidated lists, as relevant to the firm's activities and geographic footprint. Screens must be repeated when consolidated lists are updated, when new designations are published, and on a risk-based periodic basis for existing relationships.",
    source: S.ofsi,
  },
  {
    term: "Structuring", slug: "structuring", aliases: ["smurfing"],
    short: "Breaking a large sum into many smaller transactions to stay below reporting or CDD thresholds and avoid detection.",
    long: "Structuring exploits the fact that many CDD, reporting and scrutiny obligations are triggered only above a value threshold, so criminals split large amounts into multiple smaller transactions across different times, locations or accounts. The FATF Recommendations identify structuring as a key money-laundering technique that transaction monitoring should detect through cumulative-value rules and frequency analysis. Structuring is itself a criminal offence in the UK under the Proceeds of Crime Act 2002, regardless of whether the underlying funds are illicit.",
    source: S.fatf,
  },
  {
    term: "Layering", slug: "layering",
    short: "The stage of money laundering that moves and disguises illicit funds through complex transfers to obscure their origin.",
    long: "Common layering techniques include wire transfers across multiple jurisdictions, conversion between asset classes such as cash to cryptocurrency to real estate, use of shell companies and nominees to obscure ownership, and back-to-back loans. FATF mutual evaluation reports consistently identify weak beneficial-ownership registers and inadequate correspondent-banking controls as key enablers of successful layering. Transaction monitoring rules targeting rapid in/out movement, geographic dispersion and complex ownership structures are the principal detective controls.",
    source: S.fatf,
  },
  {
    term: "Placement", slug: "placement",
    short: "The first stage of money laundering: introducing illicit cash into the financial system.",
    long: "Classic placement methods include cash deposits split across branches or ATMs, cash-intensive businesses used to commingle illicit funds with legitimate revenue, currency exchange, and purchase of monetary instruments. The placement stage is typically the most visible and carries the most risk for the criminal, which is why cash reporting obligations and cash-acceptance limits exist. Firms handling large amounts of physical cash, acting as payment intermediaries, or operating in sectors with high cash turnover face the greatest placement risk.",
    source: S.fatf,
  },
  {
    term: "Integration", slug: "integration",
    short: "The final stage of money laundering: returning laundered funds to the criminal as apparently legitimate wealth.",
    long: "Integration completes the money laundering cycle by re-introducing funds into the legitimate economy in a form that appears indistinguishable from lawful wealth. Common integration vehicles include real estate purchases, luxury goods, business investments, and professional services fees paid from layered accounts. Because integration blends into normal commercial activity, it is the hardest stage to detect; EDD on high-value transactions, source-of-funds checks, and behavioural monitoring of long-standing customers are the main controls.",
    source: S.fatf,
  },
  {
    term: "Nominee", slug: "nominee",
    short: "A person or entity that holds an asset or position on behalf of someone else, often used to obscure the real beneficial owner.",
    long: "Nominees are commonly used in combination with shell companies and trusts to create opaque ownership chains that disguise who ultimately controls or benefits from an asset or account. FATF Recommendations 24 and 25 require countries to hold adequate, current and accessible information on beneficial owners of legal persons and arrangements, precisely because nominee arrangements frustrate that transparency. Firms must look through nominee arrangements to identify and verify the ultimate beneficial owner rather than accepting the face of the legal documentation.",
    source: S.fatf,
  },
  {
    term: "Shell company", slug: "shell-company",
    short: "A company with no significant operations or assets, sometimes used to hide ownership or move funds.",
    long: "Shell companies are not inherently illegitimate: they are widely used for legitimate holding, joint-venture and tax-planning purposes. The financial crime risk arises when they are layered, when their beneficial ownership is concealed, or when they conduct transactions that lack any commercial rationale. FATF Recommendation 24 requires countries to maintain accurate beneficial ownership information on legal persons; UK firms must take risk-based measures to identify and verify the beneficial owners of corporate customers and understand why a layered structure exists.",
    source: S.fatf,
  },
  {
    term: "Correspondent banking", slug: "correspondent-banking",
    short: "Where one bank provides accounts and payment services to another (often cross-border), creating nested third-party exposure that needs enhanced controls.",
    long: "The correspondent bank cannot know the ultimate customers of the respondent institution, creating a nested exposure problem where illicit funds can pass through as payment instructions with no customer-level visibility. The Wolfsberg Correspondent Banking Principles set out the due-diligence standard, including understanding the respondent's AML programme, ownership, management and jurisdiction risk before establishing the relationship. FATF Recommendation 13 prohibits correspondent relationships with shell banks and requires senior management approval and satisfactory respondent due diligence before establishing or continuing any correspondent relationship.",
    source: S.wolfsberg,
  },
  {
    term: "Money mule", slug: "money-mule", aliases: ["mule account", "mule network"],
    short: "An account or person used to receive and pass on the proceeds of fraud or crime, often layered into networks to launder funds.",
    long: "Mule networks typically involve an organiser directing the scheme, one or more mule account holders who receive and forward the funds, and sometimes additional layers of onward transfer to further obscure origin. The FCA expects firms to have controls that detect accounts being used as mules, including behavioural monitoring for new accounts that rapidly receive and forward funds with no apparent economic purpose. Mule detection is both an AML and a fraud control: many mules are unwitting victims of social-engineering scams and may not understand that receiving and forwarding funds on instruction is a criminal offence.",
    source: S.fca,
  },
  {
    term: "Red-flag indicator", slug: "red-flag-indicator", aliases: ["red flag", "red flags"],
    short: "An observable warning sign associated with a typology (e.g. rapid pass-through of funds) that should trigger review.",
    long: "FATF and sector guidance publish red-flag indicators for each typology; the JMLSG Guidance contains extensive sector-specific and product-specific lists. A single red flag is rarely conclusive: firms are expected to assess indicators in combination and in the context of everything they know about the customer. Red-flag indicators inform both the rule parameters in transactional monitoring systems and the narrative a nominated officer uses when deciding whether a knowledge or suspicion threshold for a SAR has been met.",
    source: S.fatf,
  },
  {
    term: "Risk-based approach", slug: "risk-based-approach", aliases: ["rba"],
    short: "Allocating AML effort in proportion to assessed risk, applying more scrutiny where risk is higher and less where it is demonstrably lower.",
    long: "The FATF Recommendations require both countries and obliged entities to apply a risk-based approach as the foundation of their AML/CFT systems, rather than applying identical measures to all customers. In practice this means completing and documenting a business-wide risk assessment (BWRA) to identify inherent risks, using it to set proportionate policies and controls, and reviewing it when circumstances change. The FCA's Financial Crime Guide and JMLSG Guidance both describe how firms should evidence that their approach is genuinely risk-based and not a tick-box exercise.",
    source: S.fatf,
  },
  {
    term: "Transaction monitoring", slug: "transaction-monitoring", aliases: ["tm"],
    short: "Ongoing scrutiny of transactions against rules and the customer's expected profile to detect activity that may indicate financial crime.",
    long: "JMLSG Guidance and the FCA Financial Crime Guide describe transaction monitoring as a mandatory ongoing obligation and a key detective control for identifying suspicious patterns after onboarding. Effective systems combine automated rules covering velocity limits, geographic risk scoring and behavioural anomalies with periodic manual reviews and clear alert-investigation workflows. The FCA has brought enforcement action against firms whose monitoring was inadequate in coverage, poorly calibrated to the firm's risk profile, or generating alerts that were not genuinely reviewed and closed within a documented timeframe.",
    source: S.jmlsg,
  },
  {
    term: "Proliferation financing", slug: "proliferation-financing", aliases: ["pf"],
    short: "Financing the spread of weapons of mass destruction, including evasion of related sanctions; an explicit FATF and UK obligation.",
    long: "The FATF updated its Recommendation 7 to require countries and financial institutions to implement targeted financial sanctions related to proliferation financing following the 2018 revision, making it an explicit AML/CFT obligation rather than just a sanctions compliance issue. UK firms must screen against PF-related designations under the Sanctions and Anti-Money Laundering Act 2018 and the relevant implementing regulations, and must include PF in their business-wide risk assessment. The risk for most UK financial institutions comes not from directly financing WMD programmes but from exposure through trade finance, complex ownership chains, and correspondent relationships with institutions in higher-risk jurisdictions.",
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
