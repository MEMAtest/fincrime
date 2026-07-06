import type { Control } from "./types";

export const control01: Control = {
  id: 1,
  slug: "customer-identification-verification",
  name: "Customer Identification & Verification (CIP/CDD)",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "Before a customer can use the account, prove they are who they say they are using reliable, independent evidence, not just what they typed into the form.",
  objective:
    "Identify the customer and verify that identity on the basis of documents, data or information obtained from a reliable and independent source before establishing a business relationship, in line with reg.27 and reg.28 of the MLR 2017, so that no account is opened for an unidentified or impersonated party.",
  plainObjective: "Make sure every new customer is genuinely who they claim to be, checked against trustworthy independent evidence, before any account is opened.",
  plainHowItWorks: "It keeps the account frozen until each identity detail matches a reliable outside source and the ID and a liveness check pass, sending anything that fails to a person to review.",
  plainWhyThreshold: "One piece of self-reported information is too weak, so requiring two independent sources blocks fake and stolen identities while a sensible match-confidence floor avoids wrongly rejecting real people.",
  riskThemes: ["money_laundering", "fraud", "terrorist_financing"],
  applicableFirmTypes: [
    "emi",
    "pi",
    "bank",
    "msb",
    "crypto",
    "neobank",
    "wealth_manager",
    "insurance",
  ],
  typologySlugs: ["shell-company-indicators", "front-company-bo-obfuscation"],
  enforcementRefs: [
    { firm: "Sonali Bank (UK) Limited", year: 2016 },
    { firm: "Canara Bank", year: 2018 },
  ],
  dataInputs: [
    "Full legal name, date of birth, residential address (individuals)",
    "Registered name, company number, registered office, legal form (entities)",
    "Government-issued photo ID and a second identifier (proof of address or electronic data match)",
    "Liveness / biometric selfie result where remote onboarding is used",
    "Company registry extract (e.g. Companies House) and constitutional documents",
    "Sanctions and PEP screening result at point of identity capture",
    "Device, IP and geolocation signals for the onboarding session",
    "Verification provider audit trail (which source matched which attribute)",
  ],
  ruleLogic:
    "Block account activation until each mandatory identity attribute (name, DOB/incorporation date, address, ID number) is matched against at least one reliable, independent source, AND (for individuals) a document authenticity + liveness check passes, AND (for entities) a current registry extract confirms active status and the legal form. If any attribute is unmatched or any document fails authentication, hold the relationship in a pre-onboarding state and route to manual review; do not permit funding or transacting.",
  defaultThreshold:
    "100% of mandatory identity attributes matched to >=1 independent source before activation; for individuals require 2 of 3 attributes from electronic verification OR 1 authenticated photo-ID document plus a passing liveness check; document image quality / face-match confidence >= 90%.",
  thresholdRationale:
    "reg.28 requires verification on the basis of reliable, independent sources and treats remote onboarding as a higher-risk factor that warrants stronger evidence, so a single self-asserted data point is insufficient. A two-source (or document-plus-liveness) standard defeats simple synthetic-identity and impersonation attempts, while a 90% match-confidence floor keeps genuine customers from being wrongly blocked. Firms with higher impersonation-fraud rates should raise the confidence floor or require a second document.",
  lookbackWindow:
    "Point-in-time at onboarding; verification evidence retained for the relationship plus 5 years after it ends (reg.40), with re-verification triggered by material changes.",
  tuningNotes:
    "Expect 5-15% of remote applicants to fall to manual review; most are resolvable poor-quality images or address mismatches, not fraud. Tune by document type and channel rather than one global threshold: passports verify more cleanly than provisional licences. Track the manual-review false-positive rate and the proportion of confirmed fraud caught to avoid silently weakening the gate to cut friction.",
  firstLineOwner: "Onboarding / KYC Operations team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Identity verification / IDV provider (document + biometric, e.g. Onfido, Jumio, Veriff)",
    "Electronic identity data provider (e.g. GBG, LexisNexis, Experian)",
    "Company registry data feed (Companies House API or equivalent)",
    "Sanctions / PEP screening engine integrated at capture",
    "Case management workflow for manual review and evidence retention",
  ],
  escalation:
    "Failed or inconclusive verification routes to a KYC analyst for manual review within SLA. Suspected impersonation or use of a fraudulent document is escalated to the Fraud team and, where there is knowledge or suspicion of money laundering, to the MLRO for SAR consideration. The application stays blocked from funding throughout.",
  sla: "Automated verification at submission; manual review cleared within 1 business day; no funding or transacting permitted until verification passes.",
  metrics: [
    { name: "Verification completion rate", target: ">=98%", description: "Share of onboarded customers with all mandatory attributes verified to an independent source before activation" },
    { name: "Manual-review false-positive rate", target: "<25%", description: "Holds cleared as genuine customers with no fraud or AML concern" },
    { name: "Unverified-active accounts", target: "0", description: "Live, funded accounts lacking complete identity verification (should never be non-zero)" },
    { name: "Confirmed impersonation caught at onboarding", target: "Trend up vs leakage", description: "Fraudulent-identity attempts stopped at the gate versus those detected only after funding" },
  ],
  testPlan: [
    "Inject synthetic test applicants with deliberately mismatched name/DOB/address and confirm each is held in pre-onboarding state and cannot fund the account.",
    "Submit a known tampered or expired ID image through the IDV provider and confirm the authenticity check fails and routes to manual review rather than auto-passing.",
    "Sample 25 recently activated accounts and trace every mandatory attribute back to its independent source in the verification audit trail; flag any activated without a complete trail.",
    "Attempt to post a funding transaction on an account still in pre-onboarding state and confirm the platform rejects it.",
  ],
  reviewCadence:
    "Threshold and provider performance reviewed quarterly; full control design and source-reliability assessment reviewed annually or on any provider, product or regulatory change.",
  governance: [
    "MLRO approves the list of acceptable identity sources and documents and any deviation by product or channel.",
    "Verification evidence and the source-to-attribute audit trail retained for the relationship plus 5 years (reg.40).",
    "Manual-review overrides require a documented analyst rationale and are sampled by second line for quality.",
    "Onboarding verification statistics and exceptions reported to the financial crime committee quarterly.",
  ],
  whatGoodLooksLike: [
    "Every live account can be tied to specific independent evidence that verified each identity attribute, retrievable in seconds.",
    "Remote onboarding pairs an authenticated document with a liveness check, not two self-asserted data fields.",
    "No customer can move money before verification completes, enforced by the platform rather than by policy alone.",
    "Manual-review reasons are coded and trended so recurring failure modes drive provider or rule fixes.",
  ],
  strongVsWeak: {
    strong:
      "A neobank captures passport plus a liveness selfie, runs document authentication and face-match (95% confidence), and independently matches name, DOB and address against two electronic data sources before the account can be funded. A mismatch on address holds the account and an analyst confirms it against a recent utility bill, all logged.",
    weak:
      "A firm accepts the name, DOB and address typed into the signup form, treats a static photo of an ID as verification with no liveness or tamper check, and activates and funds the account immediately, leaving no record of which source verified what.",
  },
  sources: [
    { org: "MLR", reference: "reg.28 CDD measures", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.10 Customer due diligence", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
};
