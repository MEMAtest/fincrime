import type { Control } from "./types";

export const control04: Control = {
  id: 4,
  slug: "customer-risk-assessment-rating",
  name: "Customer Risk Assessment & Rating",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "Score each new and existing customer for money-laundering risk from clear factors (who they are, what they do, where they are) so the firm spends most effort on the riskiest ones.",
  objective:
    "Assess and assign a money-laundering and terrorist-financing risk rating to each customer using the risk factors in reg.28 and the risk-based approach in reg.18, so that the level of CDD, monitoring intensity and review frequency are proportionate to the risk the customer presents.",
  riskThemes: ["money_laundering", "terrorist_financing", "sanctions_evasion"],
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
  typologySlugs: [
    "unusual-business-vs-declared-profile",
    "tax-haven-transfers",
    "high-risk-corridor-remittances",
  ],
  enforcementRefs: [
    { firm: "Standard Chartered Bank", year: 2019 },
    { firm: "Commerzbank AG", year: 2020 },
  ],
  dataInputs: [
    "Customer type (individual, SME, corporate, trust, PEP, non-profit)",
    "Geography (residence, nationality, operating countries, transaction corridors)",
    "Product and channel risk (e.g. cash, crypto, cross-border, non-face-to-face)",
    "Industry / occupation risk classification",
    "Beneficial-ownership complexity and opacity indicators",
    "PEP, sanctions and adverse-media screening outcomes",
    "Expected and actual transaction behaviour signals",
    "Firm-wide risk assessment weightings (reg.18) feeding the model",
  ],
  ruleLogic:
    "Score each customer against weighted risk factors (customer type, geography, product/channel, industry, ownership complexity, PEP/adverse-media). Combine the weighted scores into a band (e.g. low / medium / high), with any sanctions nexus or PEP status acting as an override that floors the rating at high. The assigned band drives the required CDD level (SDD / standard / EDD), monitoring sensitivity and review frequency. Re-score on trigger events (new adverse media, change of ownership, behavioural shift) and at periodic review. Block downgrades below the floor set by overriding factors.",
  defaultThreshold:
    "3-band model: high if any override (sanctions nexus, PEP, high-risk-jurisdiction nexus per reg.33) OR weighted score >=70/100; medium 40-69; low <40. High = EDD + annual review; medium = standard CDD + biennial review; low = simplified where permitted + triennial review.",
  thresholdRationale:
    "reg.18 mandates a documented, risk-based methodology and reg.33 makes certain factors (high-risk third countries, PEPs) automatically high-risk, so overrides must floor the rating regardless of the numeric score. The 70/40 band cut-offs are a defensible starting calibration that concentrates EDD effort on roughly the top tier; Standard Chartered and Commerzbank were both penalised where weak or mechanical risk rating let high-risk customers sit in low-touch monitoring. Firms should calibrate weights to their own firm-wide risk assessment, not copy these blindly.",
  lookbackWindow:
    "Assessed at onboarding; re-assessed at the band's review cadence and immediately on trigger events; rating history retained for audit.",
  tuningNotes:
    "The split across bands should reflect the firm's actual book, not a target percentage; if 80% of customers land in 'high' the weights are too aggressive and EDD capacity will collapse, while a near-empty 'high' band suggests the model is blind. Back-test by checking that customers who later generated SARs were rated above low. Keep weightings transparent and documented so a reviewer can reproduce any score; opaque or hand-tuned scores are hard to defend.",
  firstLineOwner: "KYC Operations / Onboarding team (with model owned by Compliance)",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Customer risk-rating / KYC scoring engine with configurable weights",
    "Country-risk and product-risk reference data feeds",
    "Sanctions, PEP and adverse-media screening integration",
    "Firm-wide risk assessment model (reg.18) as the source of weightings",
    "Case management with rating history and override audit trail",
  ],
  escalation:
    "Any override (sanctions, PEP, high-risk jurisdiction) routes the customer into the EDD path and senior approval before onboarding or continuation. Manual downgrades below an override floor are blocked and require MLRO approval with documented rationale. Material upward re-ratings trigger monitoring uplift and a CDD refresh.",
  sla: "Initial rating produced at onboarding before activation; re-rating on a trigger event completed within 5 business days; EDD path engaged immediately on a high rating.",
  metrics: [
    { name: "Rating coverage", target: "100%", description: "Active customers carrying a current, documented risk rating" },
    { name: "Override integrity", target: "0 unapproved", description: "Customers rated below an override floor without MLRO-approved rationale" },
    { name: "Review timeliness", target: ">=95%", description: "Periodic re-ratings completed by their due date for each band" },
    { name: "Back-test alignment", target: ">=95%", description: "SAR-generating customers that were rated above low at the time" },
  ],
  testPlan: [
    "Run a synthetic customer with a PEP flag and confirm the rating is floored at high and routed to EDD regardless of an otherwise-low numeric score.",
    "Attempt to manually downgrade an override-floored customer to medium and confirm the system blocks it without MLRO approval.",
    "Feed a customer profile that should land at exactly the 70 boundary and confirm correct band assignment and review-frequency assignment.",
    "Back-test the last 12 months of SARs and confirm none of the underlying customers were rated low at the time of the activity.",
  ],
  reviewCadence:
    "Model weights and band cut-offs reviewed at least annually and on any firm-wide risk assessment update; individual ratings reviewed at their band cadence and on triggers.",
  governance: [
    "MLRO and the financial crime committee approve the rating methodology, weights and override list, aligned to the firm-wide risk assessment.",
    "Every rating and re-rating is reproducible from stored inputs and retained with override rationale.",
    "Downgrade overrides are sampled and challenged by second line.",
    "Band distribution, override exceptions and back-test results reported to the committee quarterly.",
  ],
  whatGoodLooksLike: [
    "The methodology is documented, weighted and reproducible, so any score can be defended to a regulator.",
    "Sanctions and PEP factors hard-floor the rating and cannot be silently overridden.",
    "Effort visibly concentrates on the high band, with proportionate light-touch handling of genuinely low-risk customers.",
    "Ratings are re-run on triggers, not frozen at onboarding, and back-testing confirms they predict real risk.",
  ],
  strongVsWeak: {
    strong:
      "A bank scores a corporate customer 62/100 (medium) on weighted geography, product and ownership factors, but adverse media linking a director to corruption triggers a re-score; the PEP-adjacent override floors it at high, EDD is engaged and the file is reviewed annually, all with a reproducible audit trail.",
    weak:
      "A firm assigns 'medium' to almost every customer by default, lets a relationship manager hand-set ratings with no recorded rationale, never re-scores on adverse media, and cannot explain why two similar customers ended up in different bands.",
  },
  sources: [
    { org: "MLR", reference: "reg.18 risk assessment", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
    { org: "FATF", reference: "R.1 Risk-based approach", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
    { org: "Wolfsberg", reference: "Wolfsberg CDD Standards", title: "Wolfsberg CDD Standards", url: "https://www.wolfsberg-principles.com/" },
  ],
};
