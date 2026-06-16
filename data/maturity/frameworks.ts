import type { MaturityFramework } from "./types";
import type { Source } from "../typologies/types";

const JMLSG: Source = { org: "JMLSG", reference: "Current Guidance", title: "JMLSG Guidance", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" };
const FCG: Source = { org: "FCA", reference: "FCG", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" };

export const maturityFrameworks: MaturityFramework[] = [
  {
    id: 1,
    slug: "governance-oversight",
    title: "Governance & Oversight Maturity",
    area: "governance",
    description: "Board and senior-management ownership of financial-crime risk: the MLRO role, risk appetite, MI and the three lines of defence.",
    riskThemes: ["money_laundering"],
    levels: [
      { level: "initial", descriptor: "No clear ownership; financial-crime risk handled ad hoc with little board visibility." },
      { level: "developing", descriptor: "MLRO appointed and basic policies exist, but MI is limited and oversight is reactive." },
      { level: "defined", descriptor: "Documented governance, risk appetite and a financial-crime committee with regular MI." },
      { level: "managed", descriptor: "Board-level MI drives decisions; 2LOD challenges 1LOD; actions are tracked to closure." },
      { level: "optimised", descriptor: "Forward-looking oversight; risk appetite tested against scenarios; continuous improvement evidenced." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Appoint an accountable MLRO and define financial-crime roles across the three lines.", owner: "Board" },
      { fromLevel: "developing", action: "Establish a financial-crime committee, a written risk appetite and a regular MI pack.", owner: "MLRO" },
      { fromLevel: "defined", action: "Introduce independent 2LOD challenge and track remediation actions to closure.", owner: "2LOD" },
      { fromLevel: "managed", action: "Scenario-test the risk appetite and embed a continuous-improvement cycle.", owner: "Board" },
    ],
    metrics: [
      { name: "MI cadence", target: "≥ quarterly to board", description: "Frequency of financial-crime MI reaching the board" },
      { name: "Action closure", target: "Within due dates", description: "Oversight actions closed on time" },
    ],
    governanceChecklist: [
      { id: "GOV-G1", item: "Documented financial-crime risk appetite approved by the board", frequency: "Annually", owner: "Board" },
      { id: "GOV-G2", item: "Three-lines-of-defence roles documented and operating", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [FCG, JMLSG],
  },
  {
    id: 2,
    slug: "cdd-kyc",
    title: "CDD / KYC Maturity",
    area: "cdd_kyc",
    description: "Customer due diligence across onboarding, risk rating, EDD and periodic review, proportionate and risk-based.",
    riskThemes: ["money_laundering"],
    levels: [
      { level: "initial", descriptor: "Inconsistent CDD; identity collected but little risk rating or EDD." },
      { level: "developing", descriptor: "Standard CDD at onboarding with a basic risk model; EDD applied unevenly." },
      { level: "defined", descriptor: "Documented risk-based CDD/EDD with a customer risk-rating model and review cycles." },
      { level: "managed", descriptor: "Risk model validated; EDD and source-of-wealth evidenced; periodic reviews on time." },
      { level: "optimised", descriptor: "Dynamic risk rating from behaviour and data; perpetual KYC with event-driven reviews." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Define a documented risk-based CDD standard and a customer risk-rating model.", owner: "Compliance" },
      { fromLevel: "developing", action: "Apply consistent EDD triggers and evidence source-of-wealth for higher-risk customers.", owner: "1LOD" },
      { fromLevel: "defined", action: "Independently validate the risk model and enforce periodic-review SLAs.", owner: "2LOD" },
      { fromLevel: "managed", action: "Move to perpetual KYC with event-driven reviews from monitoring signals.", owner: "Compliance" },
    ],
    metrics: [
      { name: "Periodic review timeliness", target: "Per risk rating", description: "Reviews completed within due dates" },
      { name: "EDD completion", target: "100% before activation", description: "Higher-risk customers with completed EDD" },
    ],
    governanceChecklist: [
      { id: "GOV-C1", item: "Customer risk-rating methodology documented and validated", frequency: "Annually", owner: "Compliance" },
      { id: "GOV-C2", item: "EDD and source-of-wealth standards evidenced", frequency: "Per relationship", owner: "MLRO" },
    ],
    sources: [JMLSG, FCG],
  },
  {
    id: 3,
    slug: "transaction-monitoring",
    title: "Transaction Monitoring Maturity",
    area: "transaction_monitoring",
    description: "Detection scenarios, thresholds, coverage assurance, alert handling and tuning across the customer base.",
    riskThemes: ["money_laundering", "fraud"],
    levels: [
      { level: "initial", descriptor: "Manual or minimal monitoring; coverage and rationale undocumented." },
      { level: "developing", descriptor: "Some automated rules but limited coverage and no tuning cycle." },
      { level: "defined", descriptor: "Documented scenarios mapped to risks, with coverage assurance and an alert workflow." },
      { level: "managed", descriptor: "Regular tuning and gap analysis; data-quality assured; SLAs met on alert handling." },
      { level: "optimised", descriptor: "Risk-based, continuously tuned models with independent validation and feedback loops." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Map monitoring scenarios to your risk assessment and document coverage.", owner: "Compliance" },
      { fromLevel: "developing", action: "Establish end-to-end coverage assurance and a documented alert workflow.", owner: "1LOD" },
      { fromLevel: "defined", action: "Introduce periodic scenario tuning, gap analysis and data-quality controls.", owner: "MLRO" },
      { fromLevel: "managed", action: "Add independent model validation and a tuning feedback loop from SAR outcomes.", owner: "2LOD" },
    ],
    metrics: [
      { name: "Monitoring coverage", target: "100% of in-scope accounts", description: "Accounts covered by monitoring" },
      { name: "Alert SLA adherence", target: "Within SLA", description: "Alerts dispositioned on time" },
    ],
    governanceChecklist: [
      { id: "GOV-T1", item: "Scenario-to-risk mapping documented", frequency: "Annually", owner: "Compliance" },
      { id: "GOV-T2", item: "Coverage reconciliation evidenced (no excluded accounts)", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [JMLSG, FCG],
  },
  {
    id: 4,
    slug: "sanctions-screening-maturity",
    title: "Sanctions & Screening Maturity",
    area: "screening",
    description: "Screening systems, calibration, list management, coverage assurance and escalation across customers and payments.",
    riskThemes: ["sanctions_evasion", "money_laundering"],
    levels: [
      { level: "initial", descriptor: "Limited or manual screening; list updates and coverage not assured." },
      { level: "developing", descriptor: "Automated screening at onboarding but no rescreening or calibration discipline." },
      { level: "defined", descriptor: "Documented screening with calibrated matching, list management and coverage checks." },
      { level: "managed", descriptor: "Rescreening on list changes; calibration validated; payment screening field coverage assured." },
      { level: "optimised", descriptor: "Continuously validated screening with low-latency interdiction and tuning feedback." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Implement automated screening against the consolidated list with daily updates.", owner: "Compliance" },
      { fromLevel: "developing", action: "Add list-change rescreening and document fuzzy-match calibration.", owner: "1LOD" },
      { fromLevel: "defined", action: "Validate calibration independently and prove screening coverage by reconciliation.", owner: "2LOD" },
      { fromLevel: "managed", action: "Assure payment-message field coverage and add a tuning feedback loop.", owner: "MLRO" },
    ],
    metrics: [
      { name: "Screening coverage", target: "100%", description: "Records/payments screened vs total in scope" },
      { name: "List-update latency", target: "< 24h", description: "Time from list publication to rescreen" },
    ],
    governanceChecklist: [
      { id: "GOV-S1", item: "Independent calibration validation", frequency: "Annually + after changes", owner: "2LOD" },
      { id: "GOV-S2", item: "List-source and coverage assurance", frequency: "Ongoing", owner: "MLRO" },
    ],
    sources: [
      { org: "OFSI", reference: "Financial sanctions guidance", title: "OFSI", url: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },
      JMLSG,
    ],
  },
  {
    id: 5,
    slug: "sar-reporting",
    title: "SAR / Regulatory Reporting Maturity",
    area: "reporting",
    description: "Internal escalation, SAR decision-making, quality and timeliness, and management information on reporting.",
    riskThemes: ["money_laundering"],
    levels: [
      { level: "initial", descriptor: "Ad hoc internal reporting; SAR decisions undocumented and inconsistent." },
      { level: "developing", descriptor: "Internal SAR process exists but quality and timeliness vary; limited MI." },
      { level: "defined", descriptor: "Documented escalation and SAR workflow with quality standards and SLAs." },
      { level: "managed", descriptor: "Tracked timeliness and quality; MLRO MI on volumes, outcomes and DAML where relevant." },
      { level: "optimised", descriptor: "Feedback from SAR outcomes informs monitoring; benchmarking of quality and timeliness." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Document the internal escalation and SAR decision process with clear ownership.", owner: "MLRO" },
      { fromLevel: "developing", action: "Set SAR quality standards and timeliness SLAs; introduce MI.", owner: "Compliance" },
      { fromLevel: "defined", action: "Track timeliness/quality metrics and report to senior management.", owner: "MLRO" },
      { fromLevel: "managed", action: "Feed SAR outcomes back into monitoring scenario tuning.", owner: "2LOD" },
    ],
    metrics: [
      { name: "Internal-to-SAR timeliness", target: "Within SLA", description: "Time from internal report to SAR decision" },
      { name: "SAR quality", target: "QA-sampled", description: "SARs meeting the documented quality standard" },
    ],
    governanceChecklist: [
      { id: "GOV-R1", item: "Documented SAR decision and escalation process", frequency: "Annually", owner: "MLRO" },
      { id: "GOV-R2", item: "MI on SAR volumes, timeliness and outcomes", frequency: "Quarterly", owner: "MLRO" },
    ],
    sources: [JMLSG, FCG],
  },
  {
    id: 6,
    slug: "training-culture",
    title: "Training & Culture Maturity",
    area: "training",
    description: "Financial-crime training coverage, role-relevance, effectiveness testing and the wider compliance culture.",
    riskThemes: ["money_laundering"],
    levels: [
      { level: "initial", descriptor: "Generic, infrequent training; completion not tracked." },
      { level: "developing", descriptor: "Annual training with completion tracking but little role-tailoring." },
      { level: "defined", descriptor: "Role-relevant training with completion SLAs and basic effectiveness checks." },
      { level: "managed", descriptor: "Effectiveness tested (e.g. assessments); tailored content for high-risk roles." },
      { level: "optimised", descriptor: "Culture measured; training adapts to emerging risks and incident learning." },
    ],
    remediation: [
      { fromLevel: "initial", action: "Roll out role-aware annual training with tracked completion.", owner: "Compliance" },
      { fromLevel: "developing", action: "Tailor content to high-risk roles and add completion SLAs.", owner: "MLRO" },
      { fromLevel: "defined", action: "Introduce effectiveness testing and remedial training pathways.", owner: "Compliance" },
      { fromLevel: "managed", action: "Measure culture indicators and adapt training to emerging risks.", owner: "Board" },
    ],
    metrics: [
      { name: "Training completion", target: "100% within SLA", description: "In-scope staff completing required training" },
      { name: "Effectiveness", target: "Assessed", description: "Post-training assessment pass rates" },
    ],
    governanceChecklist: [
      { id: "GOV-Tr1", item: "Role-based training matrix maintained", frequency: "Annually", owner: "Compliance" },
      { id: "GOV-Tr2", item: "Training effectiveness measured and reported", frequency: "Annually", owner: "MLRO" },
    ],
    sources: [JMLSG, FCG],
  },
];
