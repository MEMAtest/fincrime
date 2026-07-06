import type { Control } from "./types";

export const control26: Control = {
  id: 26,
  slug: "ongoing-cdd-periodic-review",
  name: "Ongoing CDD & Periodic Review",
  category: "ongoing_monitoring",
  controlType: "preventive",
  plainSummary:
    "Every customer's identity and risk information is refreshed on a fixed schedule so the firm never relies on stale onboarding data.",
  objective:
    "Ensure customer due diligence data, beneficial ownership, expected activity and risk rating remain accurate and complete throughout the relationship, in line with the requirement to keep CDD documents, data and information up to date.",
  plainObjective: "Keeps each customer's identity, ownership, expected activity and risk rating accurate and complete for the whole relationship, so the firm never leans on outdated onboarding records.",
  plainHowItWorks: "It sets each customer's next review date from their risk level, opens a review case shortly before that date, and blocks closing it until someone records a documented outcome.",
  plainWhyThreshold: "Higher-risk customers change faster, so they get refreshed more often, and opening the case early gives staff time to gather documents before it falls overdue.",
  riskThemes: ["money_laundering", "terrorist_financing", "sanctions_evasion"],
  applicableFirmTypes: ["bank", "emi", "msb", "wealth_manager", "neobank", "pi", "insurance"],
  typologySlugs: ["unusual-business-vs-declared-profile", "behavioural-change-indicators"],
  enforcementRefs: [{ firm: "Commerzbank AG", year: 2020 }],
  dataInputs: [
    "Customer risk rating and last-review date",
    "Onboarding KYC record (ID, address, beneficial ownership, expected activity)",
    "Source-of-funds and source-of-wealth declarations",
    "Document expiry dates (passports, registration certificates)",
    "Screening match history and PEP/sanctions status",
    "Actual transaction profile for the period since last review",
  ],
  ruleLogic:
    "For each customer, compute next_review_due = last_review_date + cadence_for(risk_rating). When the system date reaches (next_review_due - 30 days) a review case is opened and routed to the first line. The review compares declared profile against observed activity, re-verifies beneficial ownership and expired documents, and confirms or changes the risk rating. A review cannot be closed without a documented outcome. Cases not closed by next_review_due are flagged overdue and aged.",
  defaultThreshold:
    "Periodic review cadence: high risk every 12 months, medium risk every 24 months, low risk every 36 months; review case opens 30 days before due date.",
  thresholdRationale:
    "Risk-based cadence is expected under MLR reg.28(11) and JMLSG: higher-risk relationships change faster and warrant closer scrutiny, so annual refresh is standard for high risk while low-risk retail can run on a longer cycle. The 30-day lead time gives the first line a working window to gather documents before the review falls overdue, preventing the backlog that turns into systemic overdue-CDD failures.",
  lookbackWindow:
    "Reviews the full period since the previous completed review (12 to 36 months depending on risk rating).",
  tuningNotes:
    "Expected case volume equals roughly (high-risk population) + (medium-risk population / 2) + (low-risk population / 3) per year. If reviews are completing in under 15 minutes on average the scope is too shallow; if the overdue queue exceeds 5 percent of the book the cadence or staffing needs adjustment, not the threshold. Tune by sampling closed reviews for quality before relaxing any cadence.",
  firstLineOwner: "KYC / Client Lifecycle Management team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "KYC/CLM case management platform (e.g. Fenergo, Encompass)",
    "Customer risk-rating engine",
    "Document management / e-ID verification provider",
    "Screening platform for refreshed PEP/sanctions checks",
  ],
  escalation:
    "Reviews that cannot confirm beneficial ownership, source of funds, or that reveal activity materially inconsistent with the declared profile are escalated to the MLRO; reviews overdue beyond 90 days are escalated to the Head of Financial Crime and reported in the monthly MI pack.",
  sla: "Standard review completed within 30 days of the case opening; high-risk reviews within 20 days.",
  metrics: [
    {
      name: "Periodic review completion rate",
      target: ">= 98% completed on or before due date",
      description: "Share of due reviews closed with a documented outcome before the next_review_due date.",
    },
    {
      name: "Overdue CDD population",
      target: "< 2% of total active customers",
      description: "Customers whose review is past due and not yet completed, measured monthly.",
    },
    {
      name: "Risk-rating change rate at review",
      target: "Tracked and explained (no fixed target)",
      description: "Proportion of reviews that change the customer risk rating, a proxy for whether reviews add value.",
    },
  ],
  testPlan: [
    "Seed test customers at each risk rating with last_review_date set so reviews are due, due-soon and overdue; confirm cases open at due minus 30 days and age correctly.",
    "Attempt to close a review without a documented outcome and confirm the system blocks closure.",
    "Inject a customer whose actual transactions are 5x the declared expected activity and confirm the review forces a risk-rating reassessment and SAR consideration.",
    "Reconcile the count of customers with a past-due next_review_due against the overdue MI figure to confirm no customers are silently missing from the review schedule.",
  ],
  reviewCadence: "Control design and cadence reviewed annually; overdue MI reviewed monthly by the MLRO.",
  governance: [
    "MLRO signs off the risk-based review cadence and any changes to it.",
    "Monthly MI to the Financial Crime Committee on completion rate and overdue population.",
    "Completed reviews and rating decisions retained for at least five years after the review.",
    "Independent quality assurance sampling of closed reviews each quarter.",
  ],
  whatGoodLooksLike: [
    "Every active customer has a scheduled next-review date and none are silently excluded.",
    "Overdue CDD is a small, ageing-managed queue rather than a growing backlog.",
    "Reviews demonstrably compare declared profile to observed activity and change ratings when warranted.",
    "Document expiry and beneficial-ownership refresh are part of the same review, not separate manual chases.",
  ],
  strongVsWeak: {
    strong:
      "A corporate customer rated high risk is reviewed at 12 months: the analyst finds the trading address changed, re-verifies two new beneficial owners, notes turnover is double the declared expected activity, raises the rating and refers for enhanced monitoring, all recorded with evidence and signed off within 18 days.",
    weak:
      "The same customer was onboarded in 2018 and never reviewed because the review schedule only covered accounts opened after the new system went live; the stale 2018 profile is still treated as current and the new beneficial owners are unknown to the firm.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.28(11) ongoing monitoring",
      title: "The Money Laundering Regulations 2017",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FATF",
      reference: "Recommendation 10",
      title: "FATF Recommendations - Customer Due Diligence and Ongoing Monitoring",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Ongoing Monitoring and Review",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
  ],
};
