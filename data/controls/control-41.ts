import type { Control } from "./types";

export const control41: Control = {
  id: 41,
  slug: "outsourcing-third-party-oversight",
  name: "Outsourcing & Third-Party Oversight",
  category: "governance_reporting",
  controlType: "preventive",
  plainSummary:
    "When financial crime work is outsourced or done by a partner, the firm still owns the risk, so it must check, oversee and be able to evidence the provider is doing the job.",
  objective:
    "Ensure that where financial crime activities are outsourced or delivered through third parties, the firm retains accountability, performs due diligence before engagement, defines control responsibilities and SLAs, and oversees performance on an ongoing basis, so that outsourcing never weakens the firm's controls, in line with reg.21 of the MLR 2017, FATF Recommendation 18 and FCA outsourcing expectations.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
    "bribery_corruption",
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
  typologySlugs: [],
  enforcementRefs: [{ firm: "Equifax Limited", year: 2023 }],
  dataInputs: [
    "Inventory of outsourced and third-party financial crime activities (e.g. KYC, screening, monitoring, agents)",
    "Pre-engagement due diligence on each provider (competence, controls, financial crime exposure, sub-outsourcing)",
    "Contractual control responsibilities, SLAs, audit and data-access rights",
    "Provider performance MI (quality, timeliness, error and escalation rates)",
    "Right-to-audit / assurance results and SOC-type reports where available",
    "Sub-outsourcing (fourth-party) chain and its controls",
    "Service continuity, exit and step-in plans",
  ],
  ruleLogic:
    "Maintain a register of every outsourced or third-party-delivered financial crime activity. Before engagement, perform risk-based due diligence on the provider's competence, controls and own financial crime exposure, including any sub-outsourcing. Contractually pin down who owns which control, the SLAs, the firm's audit and data-access rights, and incident-notification duties. After engagement, oversee performance with regular MI and periodic assurance, treating provider weaknesses as the firm's own. Accountability for the outcome remains with the firm and cannot be contracted away. The control is preventive: robust selection and ongoing oversight stop a provider's weak controls becoming the firm's blind spot.",
  defaultThreshold:
    "100% of outsourced financial crime activities recorded in the register with completed pre-engagement due diligence; SLAs, audit rights and incident-notification clauses contractually in place; provider performance reviewed at least quarterly and assurance performed at a risk-based cadence; material providers re-assessed annually and on any sub-outsourcing change.",
  thresholdRationale:
    "reg.21 and FCA guidance are clear that outsourcing does not transfer regulatory responsibility; the firm must therefore have due diligence, contractual control rights and ongoing oversight, or it is flying blind. A complete register with quarterly performance review and risk-based assurance is the baseline that lets the firm evidence retained control. Equifax 2023 turned on failures to adequately manage and monitor an outsourced arrangement, which is precisely the gap this control closes: due diligence, contractual oversight rights and active monitoring of the provider rather than assuming the contract alone is enough.",
  lookbackWindow:
    "Performance reviewed at least quarterly; material providers re-assessed annually and on any material change (sub-outsourcing, ownership, incident, scope change).",
  tuningNotes:
    "Calibrate oversight intensity to the criticality and risk of the outsourced activity: a provider running core KYC or screening warrants deeper assurance and tighter SLAs than a low-risk support task. Do not let a clean contract substitute for evidence; oversight means seeing actual performance MI and exercising audit rights, not filing the SLA and forgetting it. Map the sub-outsourcing chain, because risk often hides one tier down in a fourth party the firm never assessed. Test exit and step-in plans so concentration on a single provider is not an unmanaged continuity risk. Re-diligence promptly when a provider's ownership, controls or sub-processors change.",
  firstLineOwner: "Outsourcing / vendor relationship owner in the business",
  secondLineOwner: "MLRO / Financial Crime Compliance and Procurement risk (oversight and standards)",
  suggestedSystems: [
    "Third-party / vendor risk management (TPRM) platform with due-diligence workflow",
    "Outsourcing register linked to the firm-wide risk assessment",
    "Provider performance and SLA-monitoring dashboard",
    "Contract repository with audit-rights and incident-notification clauses tracked",
  ],
  escalation:
    "Provider performance breaching SLA, a failed assurance review, or an undisclosed sub-outsourcing change is escalated by the relationship owner to the MLRO and the Financial Crime Risk Committee, with a remediation plan and, where needed, step-in or exit. A provider control failure that exposes the firm to financial crime risk is escalated as an incident and, if reportable, to the regulator. Engaging a provider without completed due diligence is prohibited and escalated.",
  sla: "Pre-engagement due diligence completed before go-live; performance MI reviewed at least quarterly; identified provider control gaps remediated to an agreed dated plan; material changes re-diligenced within an agreed period.",
  metrics: [
    {
      name: "Register completeness",
      target: "100%",
      description: "Outsourced financial crime activities recorded with completed due diligence and contractual control rights.",
    },
    {
      name: "Oversight cadence adherence",
      target: "100%",
      description: "Material providers reviewed at the required performance and assurance cadence.",
    },
    {
      name: "Provider SLA performance",
      target: "Within agreed SLA",
      description: "Outsourced control activities (e.g. KYC turnaround, screening quality) meeting contracted standards.",
    },
    {
      name: "Audit-right exercise",
      target: "Exercised on material providers",
      description: "Firm actively uses its audit/assurance rights rather than relying on the contract alone.",
    },
  ],
  testPlan: [
    "Cross-check the outsourcing register against actual third-party arrangements and confirm every financial crime activity is recorded with completed due diligence.",
    "Take a material provider and confirm SLAs, audit rights and incident-notification clauses are contractually present and that performance MI is being reviewed quarterly.",
    "Exercise or evidence an exercised audit/assurance right on a material provider and confirm findings were remediated to a dated plan.",
    "Trace the sub-outsourcing chain for one provider and confirm any fourth party handling in-scope work was assessed.",
  ],
  reviewCadence:
    "Provider performance reviewed at least quarterly; material providers re-assessed annually and on material change; the outsourcing control framework reviewed annually.",
  governance: [
    "MLRO and the Financial Crime Risk Committee approve outsourcing of material financial crime activities and review provider oversight MI.",
    "Accountability for outsourced outcomes remains with the firm and is documented as non-transferable.",
    "Due diligence, contracts, assurance results and performance MI retained for at least five years.",
    "Exit and step-in plans documented and periodically tested for material providers.",
  ],
  whatGoodLooksLike: [
    "Every outsourced financial crime activity is on a register, with due diligence done before, not after, go-live.",
    "The firm sees real performance MI and exercises its audit rights, rather than trusting the contract on its own.",
    "The sub-outsourcing chain is mapped, so risk hiding one tier down in a fourth party is not a blind spot.",
    "Everyone understands the firm still owns the outcome; outsourcing the task never outsources the accountability.",
  ],
  strongVsWeak: {
    strong:
      "A crypto firm outsources KYC to a vendor, completes competence and controls due diligence before go-live, contracts audit rights, SLAs and incident notification, reviews quality and turnaround MI quarterly, exercises its audit right and forces remediation of a screening gap, maps and assesses the vendor's sub-processor, and keeps a tested exit plan.",
    weak:
      "A firm hands its monitoring to a third party, files the contract and assumes the job is done, never asks for performance MI, never exercises its audit right, has no idea the provider sub-outsourced screening to an unassessed fourth party, and only learns the controls were failing when the regulator points to the unmonitored outsourced arrangement.",
  },
  sources: [
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: internal controls and outsourcing responsibility",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FATF",
      reference: "R.18",
      title: "FATF Recommendation 18: Internal controls and reliance on third parties",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Systems, controls and outsourcing oversight",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Statement on Effectiveness",
      title: "Wolfsberg Group Statement on Demonstrating Effectiveness of financial crime programmes",
      url: "https://www.wolfsberg-principles.com/",
    },
  ],
};
