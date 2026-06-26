import type { Control } from "./types";

export const control34: Control = {
  id: 34,
  slug: "financial-crime-risk-assessment",
  name: "Firm-Wide Financial Crime Risk Assessment",
  category: "governance_reporting",
  controlType: "preventive",
  plainSummary:
    "A written, evidence-based picture of where the firm is most exposed to financial crime, kept current, so money and effort go to the riskiest areas first.",
  objective:
    "Identify, assess and document the money laundering, terrorist financing, sanctions, fraud and wider financial crime risks the firm is exposed to across its customers, products, channels, geographies and delivery methods, and use that assessment to drive the design and calibration of every downstream control, in line with reg.18 of the MLR 2017 and FATF Recommendation 1.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
    "proliferation_financing",
  ],
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
  typologySlugs: ["unusual-business-vs-declared-profile"],
  enforcementRefs: [{ firm: "Barclays Bank plc", year: 2025 }],
  dataInputs: [
    "Customer base segmented by risk rating, type, jurisdiction and PEP/sanctions exposure",
    "Product and service inventory with inherent risk ratings (e.g. cash, cross-border, crypto, agency banking)",
    "Channel and delivery-method mix (face-to-face, remote, third-party, intermediated)",
    "Geographic exposure of customers, counterparties and the firm's own footprint",
    "National Risk Assessment, FATF mutual evaluations, sector threat assessments and typology alerts",
    "Internal loss, SAR, alert and enforcement data evidencing where risk has crystallised",
    "Control effectiveness ratings from assurance, audit and testing to derive residual risk",
  ],
  ruleLogic:
    "Build the assessment bottom-up: enumerate inherent risk across the standard risk factor categories (customer, product/service, transaction/delivery channel, geography), score each on a consistent scale, then overlay the demonstrated effectiveness of mitigating controls to derive a residual risk rating per category and an aggregate firm-wide rating. The methodology is documented and repeatable so two assessors reach the same answer. Material residual risks above appetite generate documented actions with owners and dates; the assessment is the reference point against which CDD, monitoring and screening calibration are justified.",
  defaultThreshold:
    "Refreshed at least annually and on any material change (new product, new market, M&A, regulatory or threat-landscape shift); every residual risk rated above appetite carries a dated remediation action with a named owner.",
  thresholdRationale:
    "reg.18 requires the assessment to be kept up to date and the FCA expects it to be a live driver of controls rather than a shelf document refreshed once and forgotten. An annual minimum with event-driven triggers keeps it current without manufacturing churn, and tying above-appetite residual risks to dated actions is what turns the assessment from a description into a control. Barclays 2025 turned on a failure to adequately assess and manage financial crime risk for a specific client relationship, which is exactly the gap a robust, evidenced firm-wide assessment is meant to close.",
  lookbackWindow:
    "Reviewed at least annually and on material change; underlying inherent-risk and control-effectiveness inputs evidenced over the preceding 12 months.",
  tuningNotes:
    "The assessment is calibrated by stress-testing the scoring against where risk has actually crystallised: if SARs, alerts and losses cluster in a segment the assessment rates low, the methodology or the scores are wrong and must be recalibrated. Avoid scoring inflation that paints everything amber to look prudent, which destroys the prioritisation the assessment exists to deliver. Validate that control-effectiveness inputs come from independent assurance, not first-line self-assessment alone, otherwise residual risk is systematically understated.",
  firstLineOwner: "Business unit heads (owning their inherent risk inputs and remediation actions)",
  secondLineOwner: "MLRO / Head of Financial Crime (owning the methodology and aggregate assessment)",
  suggestedSystems: [
    "Risk assessment / GRC platform with scoring, evidence attachment and version control",
    "Customer risk-rating engine feeding segmentation data",
    "Management information warehouse aggregating SAR, alert, loss and assurance data",
    "Action-tracking tool for above-appetite residual risks",
  ],
  escalation:
    "Aggregate or category residual risks assessed above the board-approved appetite are escalated by the MLRO to the Financial Crime Risk Committee and, where material, to the board, with a recommended remediation plan. Assessment results that reveal a control gap are routed to the relevant first-line owner with a dated action; failure to close actions on time is itself escalated.",
  sla: "Annual refresh delivered and approved within the agreed governance cycle; event-driven reassessments completed within 30 business days of the triggering change.",
  metrics: [
    {
      name: "Assessment currency",
      target: "100%",
      description: "Firm-wide assessment refreshed within the last 12 months and after every material change.",
    },
    {
      name: "Residual-risk action closure",
      target: ">= 90% on time",
      description: "Above-appetite residual risks remediated by their agreed due date.",
    },
    {
      name: "Coverage of risk factor categories",
      target: "100%",
      description: "Customer, product, channel and geography factors all assessed with documented scoring.",
    },
    {
      name: "Score-to-outcome alignment",
      target: "No high-loss segment rated low",
      description: "Segments where SARs, alerts or losses concentrate are not rated below appetite.",
    },
  ],
  testPlan: [
    "Take three high-risk segments and trace each inherent-risk score back to documented evidence; flag any score with no supporting basis.",
    "Cross-check the assessment's residual ratings against the last 12 months of SAR, alert and loss data and confirm no segment with concentrated risk is rated below appetite.",
    "Pick two material changes from the year (new product, new market) and confirm an event-driven reassessment was triggered and completed within SLA.",
    "Verify every above-appetite residual risk has a dated, owned remediation action and check on-time closure against the tracker.",
  ],
  reviewCadence:
    "Full reassessment at least annually and on material change; methodology reviewed annually; remediation actions tracked monthly until closed.",
  governance: [
    "Board approves the financial crime risk appetite that the assessment is measured against and reviews the aggregate assessment at least annually.",
    "MLRO owns the methodology and signs off the firm-wide assessment before it goes to the Financial Crime Risk Committee.",
    "Version history, scoring rationale and supporting evidence retained for at least five years as the audit trail for control calibration.",
    "Independent assurance periodically validates that the assessment genuinely drives downstream control design.",
  ],
  whatGoodLooksLike: [
    "The assessment is demonstrably the source the firm points to when justifying why each control is calibrated the way it is.",
    "Inherent-risk scores are evidenced, not asserted, and residual risk reflects independently tested control effectiveness.",
    "Every above-appetite residual risk has a named owner and a date, and the board sees closure progress.",
    "A material change reliably triggers a reassessment within weeks, not at the next annual cycle.",
  ],
  strongVsWeak: {
    strong:
      "An EMI scores inherent risk across customer, product, channel and geography on a documented scale, overlays independently tested control effectiveness to derive residual risk, finds agency-banking residual risk above appetite, raises a dated remediation plan owned by the product head, and reports closure to the board; when it launches crypto rails three months later it reassesses within 30 days.",
    weak:
      "A bank writes a generic risk assessment once, rates everything 'medium', never reconciles it against where SARs and losses actually arise, leaves it unchanged when it enters a new high-risk market, and cannot show how any control's calibration links back to it.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.18 risk assessment",
      title: "The Money Laundering Regulations 2017, reg.18: risk assessment by relevant persons",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FATF",
      reference: "R.1",
      title: "FATF Recommendation 1: Assessing risks and applying a risk-based approach",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Financial crime systems and controls",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 2",
      title: "JMLSG Guidance, Part I, Chapter 2: Risk-based approach and governance",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
