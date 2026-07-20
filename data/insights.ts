export interface InsightCitation {
  key: string;
  org: string;
  reference: string;
  title: string;
  url: string;
}

export interface InsightSection {
  heading?: string;
  paragraphs: string[];
}

export interface InsightArticle {
  slug: string;
  title: string;
  publishDate: string;
  summary: string;
  readingMinutes: number;
  tags: string[];
  sections: InsightSection[];
  toolCTA: {
    href: string;
    label: string;
    description: string;
  };
  citations: InsightCitation[];
}

export const insightArticles: InsightArticle[] = [
  {
    slug: "fca-enforcement-aml-lessons",
    title: "FCA enforcement actions: what 44 cases tell us about AML failure",
    publishDate: "2025-07-01",
    summary:
      "Analysis of 44 FCA enforcement actions against UK financial institutions reveals consistent patterns: weak transaction monitoring, inadequate CDD and governance failures. Here is what the cases show and the controls that would have caught them.",
    readingMinutes: 6,
    tags: ["enforcement", "transaction monitoring", "CDD", "FCA", "MLRO"],
    sections: [
      {
        paragraphs: [
          "The Financial Conduct Authority has brought 44 enforcement actions for financial crime failures against UK-regulated firms. The fines range from tens of thousands to over GBP 100 million, but the failures that led to them share a recognisable pattern. Looking across the cases reveals where controls consistently break down and what firms that avoided enforcement did differently.",
          "This analysis draws on the mapped enforcement data in the FinCrime Control Lab dataset, which attributes root causes and preventative controls to each case. Three failure modes account for the majority of outcomes: transaction monitoring that was absent, miscalibrated or not genuinely reviewed; customer due diligence that did not keep pace with changing risk; and governance structures where the MLRO lacked the authority or resource to do their job.",
        ],
      },
      {
        heading: "The three failure modes are connected",
        paragraphs: [
          "These are not independent failures. Weak CDD produces inaccurate customer profiles, which makes transaction monitoring less effective because the expected-activity baseline is wrong. Where governance is weak, neither problem gets fixed because nobody is accountable for identifying or escalating them. The FCA's enforcement record shows these three failures co-occurring far more often than any one of them appears alone.",
          "Firms that structured their remediation around a single fix, typically adding monitoring rules after an FCA visit, without addressing the underlying CDD quality or governance accountability, frequently appeared in follow-up regulatory correspondence or later actions.",
        ],
      },
      {
        heading: "Transaction monitoring",
        paragraphs: [
          "The most common technical failure across the FCA's enforcement cases is transaction monitoring that was either not in place for all products and accounts, covered gaps the firm had not identified, or generated alerts that accumulated without being reviewed in a consistent or timely way.",
          "The JMLSG Guidance and the FCA Financial Crime Guide both treat ongoing transaction monitoring as a mandatory control. The FCA expects it to cover the full scope of a firm's activity, to be calibrated to the risk profile of the customer base, and to generate alerts that are genuinely reviewed and closed within a documented timeframe. In several enforcement cases, firms had monitoring in place but alert backlogs had grown to the point where the control had effectively ceased to function.",
          "The lesson is that a monitoring system is only as effective as the process behind it. Coverage gaps and unreviewed alerts are treated by the FCA as seriously as having no monitoring at all.",
        ],
      },
      {
        heading: "Customer due diligence",
        paragraphs: [
          "A recurring finding in enforcement cases is that CDD was applied at onboarding but did not evolve with the customer relationship. Customers whose risk profile changed, whose transactions became inconsistent with their original declared purpose, or who should have triggered EDD reviews were allowed to continue without further scrutiny.",
          "The MLR 2017 requires firms to apply ongoing CDD proportionate to risk. In practice this means periodic reviews, trigger-based reviews when transaction patterns change, and a process for upgrading a customer's risk rating when new information warrants it. Firms that had no mechanism for doing any of these things on an existing customer book featured in a disproportionate share of enforcement outcomes.",
          "The cases involving high-risk customers, particularly PEPs and customers linked to higher-risk jurisdictions, were especially consistent in showing that initial onboarding controls were applied but that no ongoing monitoring framework was in place to catch deterioration in the relationship.",
        ],
      },
      {
        heading: "Governance and the MLRO function",
        paragraphs: [
          "Several enforcement actions noted that the MLRO was not sufficiently senior, did not have adequate resource, or was not consulted on high-risk decisions. The FCA Financial Crime Guide is clear that the MLRO must have sufficient seniority and independence to exercise genuine judgment, and must have access to the management information needed to fulfil their role.",
          "Where the MLRO role is filled by someone without real authority, or where the function is understaffed relative to the volume of alerts and SARs it generates, the result is a compliance team that processes paperwork rather than exercises judgment. That distinction matters in an FCA supervisory assessment and in any subsequent enforcement outcome.",
        ],
      },
      {
        heading: "What the controls look like",
        paragraphs: [
          "Looking across the mapped controls for the 44 cases, the most frequently required interventions are activity-versus-expected-profile monitoring, ongoing CDD and periodic review, and SAR processes that ensure the MLRO receives adequate information to make a decision. Each of these addresses one of the three core failure modes described above.",
          "Firms that want to understand how their own control environment compares to the patterns in enforcement can explore the individual cases filtered by firm type or risk theme. Each case shows what failed and the specific controls that would have prevented it.",
        ],
      },
    ],
    toolCTA: {
      href: "/enforcement",
      label: "Explore the enforcement tracker",
      description:
        "Browse all 44 cases, filtered by risk theme and firm type. Each case shows the root cause and the controls that would have caught it.",
    },
    citations: [
      { key: "jmlsg", org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { key: "fca-fcg", org: "FCA", reference: "FCG", title: "FCA Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
      { key: "mlr", org: "MLR", reference: "MLR 2017", title: "Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    ],
  },

  {
    slug: "emi-aml-controls-guide",
    title: "AML controls for electronic money institutions: what the FCA expects",
    publishDate: "2025-07-08",
    summary:
      "Electronic money institutions face a specific regulatory pressure point: rapid digital onboarding, high transaction volumes and novel products create distinct AML risks that standard bank controls do not always address. This guide outlines what the FCA expects and the controls that matter.",
    readingMinutes: 6,
    tags: ["EMI", "electronic money", "AML controls", "FCA", "transaction monitoring"],
    sections: [
      {
        paragraphs: [
          "Electronic money institutions have emerged as one of the most closely scrutinised firm types in FCA financial crime supervision. The combination of rapid customer onboarding, high transaction velocity and a customer base that may include individuals with limited banking history creates a distinct risk profile that standard bank-era controls do not always address well.",
          "The Starling Bank enforcement action in 2024, resulting in a GBP 29 million fine, crystallised the FCA's expectations for the sector. At its core the case reflected the same three failures that appear across the broader enforcement record: monitoring coverage gaps, inadequate screening, and a control framework that did not scale with the business.",
        ],
      },
      {
        heading: "The EMI risk profile",
        paragraphs: [
          "EMIs typically onboard customers at higher velocity than traditional banks and with lower upfront friction. This creates a specific vulnerability to money mule recruitment, account takeover, and the use of accounts to layer proceeds of fraud or other predicate offences. Because accounts are opened quickly and transaction limits are initially low, the first sign of misuse is often a pattern of low-value rapid-movement activity rather than a single large suspicious transaction.",
          "EMIs that operate in the remittance or cross-border payment space also carry elevated sanctions and high-risk-corridor exposure. Where products allow customers to send funds internationally, the screening and monitoring controls need to reflect the specific corridors the firm serves and the customer base using them.",
        ],
      },
      {
        heading: "Transaction monitoring for high-velocity accounts",
        paragraphs: [
          "Standard transaction monitoring rules designed for infrequent, higher-value bank transactions often generate too many false positives or too few true positives when applied to EMI customer behaviour. EMI-specific monitoring needs to be calibrated to the typical transaction patterns for each customer segment and product type.",
          "The key indicators for EMIs are pass-through velocity (funds in and out within a short window with minimal balance retained), accounts that receive funds from multiple unrelated sources, and accounts that begin transacting immediately after opening with patterns inconsistent with the stated purpose. JMLSG Guidance and the FCA Financial Crime Guide both expect monitoring rules to be tuned to the firm's specific products and risk profile rather than applied generically.",
          "Coverage is as important as calibration. Several EMI enforcement outcomes involved monitoring that was not applied consistently across all product lines or that excluded certain account types or payment channels from the rule set.",
        ],
      },
      {
        heading: "Screening obligations",
        paragraphs: [
          "EMIs must screen customers, beneficial owners and counterparties against sanctions lists at onboarding and on an ongoing basis as lists are updated. The Starling enforcement action specifically highlighted screening weaknesses, including a financial sanctions screening system that was not updated when the firm's product range expanded.",
          "Name screening requires fuzzy matching to catch name variations, transliterations and aliases. The FCA expects firms to document their matching threshold and the rationale for it, and to test periodically that the threshold is not generating systematic false negatives.",
        ],
      },
      {
        heading: "CDD in a digital onboarding environment",
        paragraphs: [
          "Digital identity verification has expanded significantly since the pandemic, and the FCA has published guidance on the use of digital identity solutions for CDD purposes. However, the ease of digital verification has also made it easier for fraudsters to create synthetic or stolen-identity accounts at scale.",
          "EMIs need device fingerprinting, IP analysis and behavioural signals to complement document verification. The FCA expects the CDD process to identify not just the identity document but signals about whether the identity is being used genuinely. A customer who opens an account, sets up a payee and transacts immediately, without any of the exploratory behaviour typical of a new account holder, is a pattern worth flagging.",
        ],
      },
      {
        heading: "Scaling the control framework",
        paragraphs: [
          "The Starling case emphasised that a control framework needs to scale with the business. Controls that were adequate for a firm with ten thousand customers may not be adequate for one with seven million. The FCA expects firms to have a process for reviewing the adequacy of their controls as their customer base, product range and transaction volumes grow, and to document that review.",
          "For EMIs approaching scale, the question is not just whether the existing rules fire on new account types but whether the team behind the rules is sized to review and close the alerts they generate. An alert that is generated but not reviewed within a reasonable timeframe is not a functioning control.",
        ],
      },
    ],
    toolCTA: {
      href: "/typology-iq?firmType=emi",
      label: "Generate AML controls for your EMI",
      description:
        "Select your products, customer types and risk themes in TypologyIQ to generate a tailored control set for your EMI, grounded in JMLSG, FCA and Wolfsberg frameworks.",
    },
    citations: [
      { key: "jmlsg", org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { key: "fca-fcg", org: "FCA", reference: "FCG", title: "FCA Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
      { key: "mlr", org: "MLR", reference: "MLR 2017", title: "Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
      { key: "wolfsberg", org: "Wolfsberg", reference: "Wolfsberg Principles", title: "The Wolfsberg Group Principles and Standards", url: "https://www.wolfsberg-principles.com/" },
    ],
  },

  {
    slug: "neobank-financial-crime-typologies",
    title: "Financial crime typologies for neobanks: what to detect and how",
    publishDate: "2025-07-15",
    summary:
      "Neobanks face a disproportionate share of money mule, fraud and sanctions-evasion risk due to fast digital onboarding and high transaction velocity. Understanding the specific typologies that target them is the starting point for designing effective detection controls.",
    readingMinutes: 6,
    tags: ["neobank", "typologies", "money mule", "fraud", "sanctions"],
    sections: [
      {
        paragraphs: [
          "Neobanks sit at the intersection of several financial crime risk factors: they onboard customers quickly, often with fully digital processes; they serve a broad customer demographic including individuals who may be new to formal banking; and they typically offer real-time payments, which reduces the window for intervention between a suspicious instruction and the transfer leaving the firm.",
          "Understanding which typologies are most relevant to neobanks is essential before designing detection controls, because the controls for money mule detection are different from those for sanctions evasion, even if both involve monitoring the same transaction flows.",
        ],
      },
      {
        heading: "Money mule networks",
        paragraphs: [
          "Money mule recruitment is one of the most prevalent financial crime risks for neobanks. Mule accounts are opened, used briefly to receive and forward funds, and then abandoned or left dormant. The accounts are often recruited through social media scams, job advertisements or romance fraud, meaning the account holder may not understand they are participating in a criminal scheme.",
          "The behavioural indicators of a mule account are recognisable: the account receives funds from multiple unrelated sources shortly after opening, the funds are quickly transferred to other accounts or withdrawn, and the balance returns close to zero between activity periods. JMLSG Guidance and the FCA Financial Crime Guide both reference pass-through velocity and new-account-rapid-activity patterns as key indicators for this typology.",
          "Detection requires monitoring rules that track the ratio of credits to debits over short windows, the number of distinct credit counterparties, and the speed with which funds are moved after receipt. These rules need to be calibrated carefully: many legitimate neobank users move funds between accounts regularly, and the threshold needs to reflect the specific customer segment rather than being applied uniformly.",
        ],
      },
      {
        heading: "Fraud and account takeover",
        paragraphs: [
          "Neobanks are targeted for account takeover fraud because digital account access can be compromised through credential stuffing, phishing or social engineering. The pattern of an account takeover typically involves a change of contact details or security credentials followed quickly by a large outgoing payment to a new payee.",
          "Authorised push payment (APP) fraud is a particular concern: the customer is manipulated into authorising a payment themselves, which means the transaction appears legitimate from a monitoring perspective. The controls that catch APP fraud are focused on the profile of the payee, the novelty of the payment instruction, and any communications that accompanied the request, rather than just the transaction itself.",
          "The FCA has published guidance on APP fraud through the Payment Systems Regulator, and the introduction of mandatory reimbursement obligations has increased the pressure on neobanks to invest in preventative detection rather than relying on post-facto recovery.",
        ],
      },
      {
        heading: "Sanctions evasion",
        paragraphs: [
          "Neobanks that operate cross-border payment services or serve internationally mobile customers carry meaningful sanctions exposure. The risk arises not only from customers who are themselves designated but also from customers who are transacting with or on behalf of sanctioned individuals or entities.",
          "Effective sanctions controls for neobanks require real-time screening of payment counterparties at the point of instruction, not just at onboarding. Lists are updated frequently, and a customer who was clean at onboarding may transact with a newly designated payee six months later. The OFSI and Wolfsberg guidance on sanctions screening both emphasise the need for ongoing monitoring of transactions, not just a one-time check.",
          "Where neobanks use third-party rails or aggregators for international payment routing, the screening obligation extends to the counterparties on those rails, not just the immediate customer. The correspondent banking or pass-through relationship does not remove the obligation.",
        ],
      },
      {
        heading: "Designing controls for the neobank context",
        paragraphs: [
          "The common thread across these typologies is that neobank controls need to be faster, more behavioural and more customer-segment-aware than the controls designed for traditional banking. Rules that fire on a fixed value threshold may miss the high-frequency, low-value patterns that characterise mule accounts; screening that runs only at onboarding will miss sanctions exposure that develops later in the relationship.",
          "The starting point for control design is mapping the specific typologies relevant to the firm's products, customer types and geographic footprint, then identifying which detection logic applies to each. The TypologyIQ tool in FinCrime Control Lab does this mapping deterministically based on firm type, product and customer inputs.",
        ],
      },
    ],
    toolCTA: {
      href: "/typology-iq?firmType=neobank",
      label: "Map typologies for your neobank",
      description:
        "Enter your product set and customer types in TypologyIQ to get a scored list of the financial crime typologies most relevant to your firm, with the detection controls for each.",
    },
    citations: [
      { key: "jmlsg", org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { key: "fca-fcg", org: "FCA", reference: "FCG", title: "FCA Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
      { key: "ofsi", org: "OFSI", reference: "OFSI", title: "Office of Financial Sanctions Implementation guidance", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
      { key: "wolfsberg", org: "Wolfsberg", reference: "Wolfsberg Principles", title: "The Wolfsberg Group Principles and Standards", url: "https://www.wolfsberg-principles.com/" },
    ],
  },

  {
    slug: "aml-typology-risk-assessment",
    title: "How to run a financial crime typology risk assessment",
    publishDate: "2025-07-22",
    summary:
      "A typology risk assessment maps the specific financial crime methods relevant to your firm to the controls needed to detect them. This is how to approach it, what the FCA expects to see, and the common gaps that lead to enforcement action.",
    readingMinutes: 7,
    tags: ["risk assessment", "typologies", "BWRA", "FCA", "methodology"],
    sections: [
      {
        paragraphs: [
          "A typology risk assessment sits inside the broader business-wide risk assessment (BWRA) that the MLR 2017 and the FCA both require. Where the BWRA identifies the categories of financial crime risk a firm faces, the typology risk assessment goes one level deeper: it identifies the specific methods criminals use in the context of that firm's products, customers and geography, and maps those methods to the controls needed to detect them.",
          "The distinction matters because it determines what controls a firm actually deploys. Two firms might both assess themselves as high risk for money laundering, but if one distributes payments to consumers and the other provides trade finance to corporates, the typologies that are relevant to them are completely different, and so are the controls.",
        ],
      },
      {
        heading: "Step 1: Identify your firm's exposure by axis",
        paragraphs: [
          "The FATF Recommendations and JMLSG Guidance both describe the risk assessment as requiring a firm to consider risk across several dimensions: customer types, products and services, delivery channels and geographic exposure. The typology risk assessment adds a further dimension: which financial crime methods are associated with each combination of those factors.",
          "For example, a firm that offers cross-border payments to high-net-worth individuals in higher-risk jurisdictions should assess typologies including offshore layering, source-of-wealth concealment and sanctions evasion via intermediaries. A firm that offers digital current accounts to retail consumers should assess typologies including money mule networks, account takeover, and structuring below reporting thresholds.",
          "This is not a theoretical exercise. The FCA expects firms to be able to explain which typologies they have assessed as relevant and why, and to show that their controls are designed to detect those specific methods.",
        ],
      },
      {
        heading: "Step 2: Score and prioritise",
        paragraphs: [
          "Not all typologies present equal risk to every firm. A firm needs to score each typology across the relevant dimensions, weighting by the inherent likelihood given the firm's business model and the impact if the typology were exploited undetected.",
          "Scoring should be documented and should reflect the firm's own data and intelligence, not just sector guidance. Firms that can point to actual cases of mule accounts detected, or SARs filed on a particular typology, have a stronger evidence base for their scoring than firms that rely entirely on external publications.",
          "The output of this step should be a ranked list of typologies that drives the allocation of monitoring and control effort. The FATF risk-based approach principle applies here: more effort on higher-scoring typologies, less on demonstrably lower-risk ones.",
        ],
      },
      {
        heading: "Step 3: Map typologies to controls",
        paragraphs: [
          "For each material typology, the firm needs to identify the controls that are designed to detect it and assess whether those controls are in place and operating effectively. This is the bridge between the risk assessment and the control framework.",
          "Where a material typology has no corresponding control, that is a gap that needs to be addressed. Where a control exists but is miscalibrated, undocumented or not being reviewed, the typology is not genuinely mitigated even if the control appears on paper.",
          "The FCA Financial Crime Guide describes what the regulator looks for: controls that are explicitly designed to address the specific risks the firm has identified, with documented rationale for the design choices and evidence of ongoing effectiveness monitoring.",
        ],
      },
      {
        heading: "Step 4: Review and update",
        paragraphs: [
          "A typology risk assessment is not a one-time exercise. New typologies emerge, product sets change, and the external environment shifts. The FATF updates its typology guidance regularly, and national financial intelligence units publish sector-specific alerts. Firms need a process for incorporating new intelligence into their assessment.",
          "The MLR 2017 requires the BWRA (and therefore the typology assessment within it) to be kept up to date. In practice this means an annual review as a minimum, with interim updates when a material change occurs in the business or when credible intelligence suggests a new typology is targeting the firm's sector.",
        ],
      },
      {
        heading: "Common gaps the FCA finds",
        paragraphs: [
          "The most common gap in typology risk assessments that the FCA identifies in supervisory work is that the assessment exists at a high level of abstraction but does not drive specific control decisions. A risk assessment that concludes the firm faces money laundering risk without specifying which typologies are most relevant, or what controls address them, does not satisfy the regulatory expectation.",
          "A second common gap is that the assessment is written as a point-in-time document rather than a living framework. When the FCA asks to see evidence of how the assessment has been updated in response to new intelligence or product changes, firms that cannot provide it are demonstrating a process weakness rather than just a documentation one.",
        ],
      },
    ],
    toolCTA: {
      href: "/typology-iq",
      label: "Start a typology risk assessment",
      description:
        "TypologyIQ maps the financial crime typologies most relevant to your firm type, products and customers. The output is a scored list of typologies with the detection controls for each, grounded in FATF, JMLSG and FCA frameworks.",
    },
    citations: [
      { key: "fatf", org: "FATF", reference: "FATF Recommendations", title: "FATF Recommendations (international AML/CFT standards)", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
      { key: "jmlsg", org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { key: "fca-fcg", org: "FCA", reference: "FCG", title: "FCA Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
      { key: "mlr", org: "MLR", reference: "MLR 2017", title: "Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    ],
  },

  {
    slug: "partner-due-diligence-controls",
    title: "Third-party and partner due diligence: the control framework",
    publishDate: "2025-07-29",
    summary:
      "Outsourcing payment flows, distribution or onboarding to partners does not outsource the regulatory obligation. Firms remain responsible for the financial crime risks introduced by third-party relationships, and the FCA expects a proportionate control framework.",
    readingMinutes: 6,
    tags: ["third party", "partner", "due diligence", "outsourcing", "FCA"],
    sections: [
      {
        paragraphs: [
          "Third-party and partner relationships are one of the most complex areas of financial crime risk management. A firm that distributes its products through agents, relies on third parties for onboarding, or routes payments through a partner's infrastructure absorbs the financial crime risk that comes with those relationships, regardless of what the contract says.",
          "The MLR 2017 and the FCA's Financial Crime Guide both make clear that reliance on a third party to conduct CDD does not transfer the regulatory obligation: the firm remains responsible for the adequacy of the checks. The same principle applies to the financial crime risk introduced by the third party's own customer base and activity.",
        ],
      },
      {
        heading: "The three categories of third-party risk",
        paragraphs: [
          "Third-party financial crime risk arises in three main forms. The first is CDD reliance: a firm uses a third party to conduct customer identification and verification on its behalf. The second is distribution risk: a firm's products are sold through agents or intermediaries whose own AML controls may be inadequate. The third is flow risk: a third party routes payments or processes transactions on behalf of the firm, introducing counterparties and jurisdictions that the firm has not directly assessed.",
          "Each category requires a different control response. CDD reliance needs a documented due-diligence assessment of the third party's CDD quality before reliance is placed, and a process for obtaining the records on request. Distribution risk needs an agent or distributor oversight programme that monitors sales patterns and customer quality. Flow risk needs a correspondent or partner due-diligence programme that assesses the AML controls of the routing party.",
        ],
      },
      {
        heading: "What the due-diligence programme looks like",
        paragraphs: [
          "The Wolfsberg Correspondent Banking Principles and the JMLSG Guidance on outsourcing both describe what a partner due-diligence programme should cover: the partner's ownership and management, its regulatory status and compliance history, the quality of its AML programme, its jurisdiction risk profile, and the nature and volume of the business being introduced.",
          "Due diligence at onboarding is necessary but not sufficient. Partners need to be re-assessed periodically and when material changes occur, including changes of ownership, significant growth, or adverse regulatory findings. A partner that passed due diligence three years ago and has since tripled in size, changed its product mix, or received a supervisory finding may no longer meet the firm's standards.",
        ],
      },
      {
        heading: "Monitoring the flow",
        paragraphs: [
          "Once a partner relationship is established, the firm needs to monitor the flow of business being introduced or processed through it. A partner whose customer base begins to show elevated levels of suspicious activity, whose transaction patterns shift materially, or whose customers start failing screening more frequently is a signal that should trigger a review of the relationship.",
          "Transaction monitoring rules need to be applied to third-party-originated flows in the same way as direct customer flows. A firm that has a transaction monitoring gap for one distribution channel or payment rail is not managing its third-party risk; it has simply shifted it off-screen.",
        ],
      },
      {
        heading: "Contractual protections and exit",
        paragraphs: [
          "Contracts with partners should include the right to audit, the obligation to report suspicious activity to the firm, the right to terminate if AML standards are not maintained, and a requirement to cooperate with regulatory inquiries. These are not standard commercial terms and need to be negotiated specifically.",
          "The firm also needs a clear exit process for situations where a partner's risk profile deteriorates. A relationship that cannot be exited quickly without disrupting the business creates the wrong incentive: if exiting a partner is painful enough, the business may delay or avoid it even when the risk signals are clear. The FCA expects that firms have planned for exit, not just entry.",
        ],
      },
      {
        heading: "Common weaknesses",
        paragraphs: [
          "The most common weaknesses in third-party financial crime risk management are: due diligence that is completed at onboarding but never refreshed; monitoring that does not cover third-party-originated flows; and contracts that lack adequate AML obligations or audit rights.",
          "A second pattern is that partner due diligence is owned by a procurement or commercial team rather than by the financial crime or compliance function. Where the team assessing a partner does not have the financial crime expertise to evaluate the adequacy of its AML programme, the due diligence exercise is largely procedural rather than substantive.",
        ],
      },
    ],
    toolCTA: {
      href: "/partner-control-map",
      label: "Map controls for your partner relationships",
      description:
        "The Partner Control Map designs a control framework for your specific third-party or partner payment flow, assigning ownership and identifying gaps based on your relationship structure.",
    },
    citations: [
      { key: "jmlsg", org: "JMLSG", reference: "JMLSG Guidance", title: "JMLSG Guidance for the UK financial sector", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
      { key: "fca-fcg", org: "FCA", reference: "FCG", title: "FCA Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
      { key: "mlr", org: "MLR", reference: "MLR 2017", title: "Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
      { key: "wolfsberg", org: "Wolfsberg", reference: "Wolfsberg Correspondent Banking Principles", title: "Wolfsberg Correspondent Banking Principles", url: "https://www.wolfsberg-principles.com/" },
    ],
  },
];

export function getInsightBySlug(slug: string): InsightArticle | undefined {
  return insightArticles.find((a) => a.slug === slug);
}
