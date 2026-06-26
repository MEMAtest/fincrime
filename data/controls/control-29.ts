import type { Control } from "./types";

export const control29: Control = {
  id: 29,
  slug: "onboarding-fraud-identity-controls",
  name: "Onboarding Fraud & Identity Controls",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "At sign-up the firm checks the applicant is a real, unique person using their genuine identity and device, blocking fake, stolen and bulk-created accounts before they open.",
  objective:
    "Verify identity, detect synthetic and stolen identities, and prevent bulk or coordinated account creation at onboarding, so that fraudulent and mule accounts are stopped before they enter the customer base.",
  riskThemes: ["fraud", "money_laundering", "terrorist_financing"],
  applicableFirmTypes: ["emi", "neobank", "bank", "msb", "crypto", "pi"],
  typologySlugs: ["money-mule-herding-recruitment", "account-takeover-fraud", "mule-account-activity"],
  enforcementRefs: [{ firm: "Metro Bank plc", year: 2024 }],
  dataInputs: [
    "Identity document and biometric/liveness check results",
    "Electronic identity verification and database matches",
    "Device fingerprint, IP, geolocation and emulator/VPN signals",
    "Email and phone risk intelligence (age, disposability, reuse)",
    "Application velocity and shared-attribute clustering (device, address, payment instrument)",
    "Synthetic-identity indicators (mismatched name/DOB/SSN-equivalent, thin or fabricated history)",
  ],
  ruleLogic:
    "Each application is scored across identity-verification strength, document/liveness integrity, device and network risk, contactability risk and velocity/clustering. Applications failing identity verification or liveness are declined. Applications passing verification but exhibiting fraud-ring signals (shared device or instrument across many applications, disposable contact details, emulator/VPN, fabricated identity markers) are routed to manual review or step-up verification before approval. Every approved account is created with a monitoring profile attached, with no path to live without one.",
  defaultThreshold:
    "Decline on failed identity verification or failed liveness; route to manual review when the fraud score is in the top 5 percent or when 3 or more applications in 24 hours share a device fingerprint, residential address or funding instrument.",
  thresholdRationale:
    "Liveness and identity-verification failures are hard stops because they indicate a fake or stolen identity. The shared-attribute threshold (3 in 24 hours) targets bulk mule-account creation while tolerating legitimate shared-household or shared-device cases; the top-5-percent score band keeps manual-review volume affordable while catching the riskiest tail. These are starting points to calibrate against confirmed-fraud feedback.",
  lookbackWindow:
    "Velocity and clustering evaluated over a rolling 24 hours, with a rolling 30-day view for slower-burn fraud rings.",
  tuningNotes:
    "Tune against confirmed first-party and third-party fraud outcomes, not just decline counts. Watch the false-decline rate, since over-tight liveness or document checks reject genuine customers; watch the manual-review queue, since too low a clustering threshold floods it with shared-household noise. Feed confirmed mule and synthetic-identity cases back to retrain device and velocity rules monthly.",
  firstLineOwner: "Onboarding / Fraud Operations team",
  secondLineOwner: "MLRO / Financial Crime Compliance and Fraud Risk",
  suggestedSystems: [
    "Document verification and liveness/biometric provider (e.g. Onfido, Jumio)",
    "Electronic ID verification and credit-bureau match service",
    "Device intelligence and fraud-scoring platform (e.g. SEON, Sift)",
    "Email/phone risk intelligence service",
  ],
  escalation:
    "Confirmed synthetic identities, stolen-identity use and detected mule rings are escalated to the MLRO and Fraud Risk, the application is declined, linked applications are reviewed, and a SAR is considered where money-laundering or mule activity is suspected.",
  sla: "Automated decisions at application; manual-review applications cleared or declined within 1 business day.",
  metrics: [
    {
      name: "First-90-day fraud/mule rate",
      target: "Downward trend; < 0.3% of new accounts",
      description: "Accounts confirmed fraudulent or mule within 90 days of opening, the key measure of onboarding leakage.",
    },
    {
      name: "False-decline rate",
      target: "< 3% of declined applications later confirmed genuine",
      description: "Genuine customers wrongly rejected by identity or fraud checks.",
    },
    {
      name: "Monitoring-profile coverage at creation",
      target: "100% of approved accounts",
      description: "Approved accounts that enter live monitoring with no manual gap.",
    },
  ],
  testPlan: [
    "Submit applications with failed liveness and tampered documents and confirm they are auto-declined.",
    "Create a synthetic burst of applications sharing one device fingerprint and one funding card and confirm the cluster is detected and held for review.",
    "Onboard a clean genuine applicant and confirm approval with no false friction and an attached monitoring profile from day one.",
    "Reconcile approved accounts against the monitoring system to prove every new account is enrolled in monitoring with zero un-enrolled accounts.",
  ],
  reviewCadence: "Rules and thresholds reviewed monthly against fraud outcomes; control design reviewed annually.",
  governance: [
    "Fraud Risk and the MLRO approve identity-verification standards and decline/review thresholds.",
    "Monthly MI on fraud rate, false declines and review-queue volumes to the Financial Crime Committee.",
    "Confirmed-fraud feedback loop documented and used to retrain device and velocity rules.",
    "Evidence of identity verification and onboarding decisions retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Liveness and document integrity are hard gates, not optional steps.",
    "Bulk account creation is caught by shared-attribute clustering, not just per-application checks.",
    "Every approved account is monitored from the moment it opens, with no orphaned accounts.",
    "Decisions are tuned with real confirmed-fraud feedback rather than left static.",
  ],
  strongVsWeak: {
    strong:
      "A mule recruiter submits twelve applications from one emulator and one prepaid card over an afternoon; clustering flags the shared device and instrument, all twelve are held, manual review confirms a recruitment ring, the applications are declined and a SAR is filed.",
    weak:
      "The same twelve accounts open because each application passed identity verification in isolation and nobody checked cross-application links, then they are activated as mules and only discovered weeks later when receiving-bank reports come in, with several never having been enrolled in transaction monitoring at all.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.27 CDD",
      title: "The Money Laundering Regulations 2017",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Customer Due Diligence and Verification",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
    {
      org: "FATF",
      reference: "Recommendation 10",
      title: "FATF Recommendations - Customer Due Diligence",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
  ],
};
