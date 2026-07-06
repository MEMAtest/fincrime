import type { Control } from "./types";

export const control27: Control = {
  id: 27,
  slug: "trigger-based-review",
  name: "Trigger-Based (Event-Driven) Review",
  category: "ongoing_monitoring",
  controlType: "detective",
  plainSummary:
    "When something material changes about a customer, the firm reviews them straight away instead of waiting for the next scheduled review.",
  objective:
    "Detect material changes in a customer's circumstances, behaviour or risk indicators and force an immediate, out-of-cycle CDD review so the customer's risk rating and controls stay current between periodic reviews.",
  plainObjective: "Catches important changes in a customer's situation or behaviour and forces an immediate review, so their risk rating stays current instead of waiting for the next scheduled check.",
  plainHowItWorks: "It keeps a list of defined trigger events, and whenever a data feed reports one for a customer, it opens a tagged review and routes the most serious triggers straight to enhanced review.",
  plainWhyThreshold: "Scheduled reviews can leave a customer unwatched for years, so triggers close that gap, and sanctions or SAR events are handled the same day because they carry legal deadlines.",
  riskThemes: ["money_laundering", "fraud", "terrorist_financing", "sanctions_evasion"],
  applicableFirmTypes: ["bank", "emi", "msb", "neobank", "wealth_manager", "pi", "crypto"],
  typologySlugs: ["behavioural-change-indicators", "unusual-business-vs-declared-profile"],
  enforcementRefs: [{ firm: "Commerzbank AG", year: 2020 }],
  dataInputs: [
    "Real-time and batch event feeds (transaction monitoring alerts, SAR filings)",
    "Screening hits (new PEP, sanctions or adverse-media match)",
    "Customer profile changes (address, beneficial ownership, name, country)",
    "Account behaviour deltas (new high-risk corridor, new counterparty type, dormancy reactivation)",
    "External signals (insolvency, regulatory action, negative news)",
    "Current customer risk rating and last-review date",
  ],
  ruleLogic:
    "Maintain a catalogue of defined trigger events. When any feed reports a trigger for a customer, open an event-driven review case tagged with the trigger type, regardless of when the periodic review is next due. The case requires the analyst to assess the change against the existing profile, decide whether to keep, raise or exit the rating, and document the rationale. High-severity triggers (sanctions match, SAR, undisclosed beneficial owner) auto-route to enhanced review and reset the periodic-review clock.",
  defaultThreshold:
    "Any catalogued trigger opens a review within 1 business day; high-severity triggers (sanctions/PEP confirmed match, SAR filed, change of control, new high-risk corridor exceeding GBP 10,000 in 30 days) escalate to enhanced review the same day.",
  thresholdRationale:
    "Periodic reviews alone leave a customer unmonitored for up to three years, which is exactly how stale CDD allows risk to build undetected; event triggers close that gap. The GBP 10,000 / 30-day corridor figure mirrors common enhanced-monitoring thresholds and the cash-equivalent reporting line, and same-day handling of sanctions and SAR triggers reflects that these carry legal and reporting deadlines.",
  lookbackWindow:
    "Each trigger evaluated against the customer's activity and profile since the last completed review; behavioural triggers assess a rolling 90-day window.",
  tuningNotes:
    "Expect the largest trigger volumes from transaction-monitoring alerts and profile changes; calibrate by retiring low-yield triggers that almost never change a rating and by raising corridor or value thresholds that fire on benign customers. Do not suppress sanctions, SAR or change-of-control triggers regardless of volume. Track the conversion rate from trigger to rating change to spot triggers that are pure noise.",
  firstLineOwner: "Financial Crime Operations / KYC Refresh team",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Event-streaming / case-orchestration layer routing triggers to CLM",
    "Transaction monitoring system (alert feed)",
    "Screening and adverse-media platform",
    "Customer risk-rating engine",
  ],
  escalation:
    "High-severity triggers route same-day to the MLRO; confirmed sanctions or undisclosed beneficial-ownership triggers move to the restriction/exit workflow and a SAR is considered. Aged event-driven cases unworked beyond their SLA appear in weekly financial crime MI.",
  sla: "Standard event-driven review completed within 5 business days; high-severity triggers actioned same business day.",
  metrics: [
    {
      name: "Trigger-to-review timeliness",
      target: ">= 95% of triggers opened as a case within 1 business day",
      description: "Share of trigger events that generate a review case inside the SLA window.",
    },
    {
      name: "Enhanced-review escalation rate",
      target: "Tracked per trigger type",
      description: "Proportion of triggers that escalate to enhanced review or change the risk rating.",
    },
    {
      name: "High-severity same-day action rate",
      target: "100%",
      description: "Sanctions, SAR and change-of-control triggers actioned on the day they arise.",
    },
  ],
  testPlan: [
    "Fire each catalogued trigger type via test data and confirm a tagged review case opens within the SLA and routes to the correct severity queue.",
    "Confirm a sanctions-match trigger auto-escalates to enhanced review and resets the periodic-review date.",
    "Verify a benign profile change (e.g. email update) does not, on its own, open a full review, to confirm the catalogue is targeted.",
    "Reconcile trigger feed volumes against opened cases to prove no triggers are dropped between source system and case manager.",
  ],
  reviewCadence: "Trigger catalogue and thresholds reviewed quarterly; trigger-to-action MI reviewed monthly.",
  governance: [
    "MLRO approves the trigger catalogue and the severity classification of each trigger.",
    "Monthly MI on trigger volumes, timeliness and escalation outcomes to the Financial Crime Committee.",
    "Audit trail of each trigger, the analyst rationale and the resulting rating decision retained for five years.",
    "Quarterly QA sample of closed event-driven reviews for decision quality.",
  ],
  whatGoodLooksLike: [
    "A documented, risk-ranked catalogue of triggers that is wired to live data feeds, not a manual watchlist.",
    "Sanctions and SAR triggers are actioned the same day with no queueing delay.",
    "Trigger handling resets the periodic-review clock so the two controls reinforce rather than duplicate each other.",
    "Low-yield triggers are pruned over time using conversion data, keeping analyst attention on signals that matter.",
  ],
  strongVsWeak: {
    strong:
      "A retail customer suddenly starts sending GBP 14,000 across a high-risk corridor; the corridor trigger fires the same day, an event-driven review opens, the analyst finds the declared profile was salaried domestic spending, raises the rating to high, refers to investigations and a SAR is filed within 48 hours.",
    weak:
      "The same corridor activity is only noticed at the customer's next scheduled review two years later, by which point the funds are long gone and the firm cannot evidence why it took no action when the behaviour changed.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.28(11) ongoing monitoring",
      title: "The Money Laundering Regulations 2017",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Ongoing Monitoring and Trigger Events",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FATF",
      reference: "Recommendation 10",
      title: "FATF Recommendations - Ongoing Due Diligence",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
  ],
};
