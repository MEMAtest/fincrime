import type { Control } from "./types";

export const control37: Control = {
  id: 37,
  slug: "three-lines-accountability",
  name: "Three Lines of Defence & Accountability",
  category: "governance_reporting",
  controlType: "preventive",
  plainSummary:
    "A clear split of who owns risk, who oversees it, and who independently checks it, with named senior people accountable, so nothing falls through the gaps.",
  objective:
    "Establish and maintain a clear, documented operating model in which the first line owns and manages financial crime risk, the second line sets policy and provides independent oversight and challenge, and the third line provides independent assurance, with individual senior accountability allocated, in line with reg.21 of the MLR 2017, FATF Recommendation 18 and the FCA's senior management regime.",
  plainObjective: "To keep a clear, written setup where the first line runs the controls, the second line oversees and challenges, the third line independently checks, and named senior people are accountable.",
  plainHowItWorks: "It assigns every control a named first-line owner, an independent second line to set standards and challenge, and a third line to assure, with no one holding conflicting roles and senior accountability formally allocated.",
  plainWhyThreshold: "Rules demand a nominated officer and clear individual accountability, so every control needs a named owner and no self-reviewing function, with reviews yearly and whenever the firm reorganises.",
  riskThemes: [
    "money_laundering",
    "terrorist_financing",
    "sanctions_evasion",
    "fraud",
    "bribery_corruption",
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
  typologySlugs: [],
  enforcementRefs: [{ firm: "Barclays Bank plc", year: 2025 }],
  dataInputs: [
    "Documented roles, responsibilities and reporting lines for each line of defence",
    "Senior management responsibilities map / statements of responsibility",
    "MLRO and nominated officer appointment records and board approval",
    "Policy ownership and approval register (who owns, who approves, version)",
    "Independence indicators (reporting lines, remuneration, conflicts) for second and third line",
    "Committee terms of reference and quorum/attendance records",
    "Control ownership matrix mapping each control to a first-line owner and second-line overseer",
  ],
  ruleLogic:
    "Define, document and assign responsibilities so that every financial crime control has a named first-line owner who runs it, a second-line function that sets the standard and independently challenges, and a third line that independently assures, with no individual occupying conflicting roles across the lines. Allocate individual senior accountability (e.g. the MLRO and the senior manager responsible for financial crime) with board-approved appointments. The model is preventive: clear ownership and independence stop gaps and conflicts of interest that let risk go unmanaged. Reporting lines for the second line preserve independence from the revenue-generating first line, including for remuneration and escalation.",
  defaultThreshold:
    "Every in-scope financial crime control mapped to a named first-line owner and a second-line overseer; MLRO and the accountable senior manager formally appointed and board-approved; second and third line independent of the first line they oversee and assure; responsibilities reviewed at least annually and on any reorganisation.",
  thresholdRationale:
    "The MLR requires a nominated officer and proportionate management arrangements, and the FCA's senior management regime requires clear individual accountability; an unmapped control or a self-reviewing function is the structural weakness that lets risk go unowned. Annual review with reorganisation triggers keeps the model current as the firm changes shape. Barclays 2025 reflected a failure to adequately manage financial crime risk on a relationship, the kind of gap that clear ownership and independent second-line challenge are designed to prevent; allocating named accountability removes the 'everyone assumed someone else owned it' failure mode.",
  lookbackWindow:
    "Reviewed at least annually and on any reorganisation, change of accountable individual or material change in business model.",
  tuningNotes:
    "The model is calibrated by testing for genuine independence and absence of gaps, not by counting policies. Check that the second line does not also own first-line controls it is meant to challenge, and that third-line assurance does not report to the function it audits. Where a small firm cannot fully staff three lines, document the proportionate arrangement and the compensating independence (e.g. outsourced internal audit) rather than collapsing the lines silently. Re-test after every reorganisation: restructures are where control ownership quietly disappears. Watch for accountability that is allocated on paper but where the individual lacks the authority or resources to discharge it.",
  firstLineOwner: "Business unit and operations heads (own and run the controls)",
  secondLineOwner: "MLRO / Head of Financial Crime Compliance (independent oversight and challenge)",
  suggestedSystems: [
    "Responsibilities map / accountability register tooling",
    "Policy and control ownership register with version control",
    "GRC platform mapping controls to owners and overseers",
    "Committee governance platform with terms of reference and attendance tracking",
  ],
  escalation:
    "An unowned control, a role conflict across lines, or a vacant accountable position is escalated to the Financial Crime Risk Committee and, where material, the board, with a remediation owner and date. Disagreements between first and second line that cannot be resolved are escalated through the committee structure so independent challenge is not overridden quietly.",
  sla: "Newly identified ownership gaps assigned a named owner within 10 business days; vacant MLRO/accountable-manager roles covered immediately by an interim and permanently within the firm's recruitment SLA.",
  metrics: [
    {
      name: "Control ownership coverage",
      target: "100%",
      description: "In-scope financial crime controls mapped to a named first-line owner and second-line overseer.",
    },
    {
      name: "Independence integrity",
      target: "0 conflicts",
      description: "Functions reviewing or assuring controls they also own, across the three lines.",
    },
    {
      name: "Accountability currency",
      target: "100%",
      description: "Senior accountabilities allocated, accepted and re-confirmed after each reorganisation.",
    },
    {
      name: "Escalation usage",
      target: "Used and logged",
      description: "Unresolved first/second-line disagreements escalated rather than overridden informally.",
    },
  ],
  testPlan: [
    "Sample 15 financial crime controls and confirm each has a named first-line owner and a distinct second-line overseer in the ownership matrix.",
    "Trace the second and third line reporting lines and confirm neither assures or challenges a control it also owns.",
    "Confirm the MLRO and accountable senior manager appointments are documented, board-approved and current after the most recent reorganisation.",
    "Pick a recent restructure and verify control ownership was re-mapped, with no control left orphaned.",
  ],
  reviewCadence:
    "Operating model and responsibilities reviewed at least annually and on any reorganisation or change of accountable individual.",
  governance: [
    "Board approves the financial crime operating model and the appointment of the MLRO and accountable senior manager.",
    "Individual statements of responsibility signed and retained, re-confirmed after reorganisations.",
    "Second-line independence (reporting line, remuneration, escalation rights) protected in terms of reference and evidenced.",
    "Ownership matrix and accountability records retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Every control has a name against it, and that person has the authority and resources to actually run it.",
    "The second line can challenge the first line without that challenge being overridden by revenue pressure.",
    "After any reorganisation, control ownership is re-mapped before the old structure disappears, so nothing is orphaned.",
    "Senior accountability is real: the named individual understands and accepts what they are answerable for.",
  ],
  strongVsWeak: {
    strong:
      "A wealth manager maps every financial crime control to a first-line owner and an independent second-line overseer, gives the MLRO a reporting line to the board independent of sales, re-maps ownership the week a business unit is merged, and records the senior manager's accepted accountability; when first and second line disagree on a client, it goes to committee, not to whoever shouts loudest.",
    weak:
      "A firm calls its compliance officer 'the three lines', lets the same person write, run and assure the same controls, never updates ownership after a restructure so several controls are orphaned, and allocates accountability on paper to a director who has neither the authority nor the resources to discharge it.",
  },
  sources: [
    {
      org: "FATF",
      reference: "R.18",
      title: "FATF Recommendation 18: Internal controls and the compliance function",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
    {
      org: "MLR",
      reference: "reg.21 internal controls",
      title: "The Money Laundering Regulations 2017, reg.21: internal controls and nominated officer",
      url: "https://www.legislation.gov.uk/uksi/2017/692/contents",
    },
    {
      org: "FCA",
      reference: "FCA FCG 2",
      title: "FCA Financial Crime Guide, Chapter 2: Governance, roles and responsibilities",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/2/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 2",
      title: "JMLSG Guidance, Part I, Chapter 2: Senior management responsibility and the MLRO",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
  ],
};
