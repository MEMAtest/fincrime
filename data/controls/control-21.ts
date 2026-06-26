import type { Control } from "./types";

export const control21: Control = {
  id: 21,
  slug: "adverse-media-screening",
  name: "Adverse Media Screening",
  category: "screening",
  controlType: "detective",
  plainSummary:
    "Searches news and public sources for negative stories about a customer (fraud, corruption, crime) so the firm spots risk that lists alone miss.",
  objective:
    "Detect credible negative news linking a customer, beneficial owner or connected party to financial crime, corruption, sanctions or serious criminality, so the firm can reassess risk, apply enhanced due diligence and decide whether to continue the relationship or report.",
  riskThemes: ["money_laundering", "bribery_corruption", "fraud", "sanctions_evasion"],
  applicableFirmTypes: ["bank", "wealth_manager", "emi", "pi", "neobank", "crypto", "insurance", "msb"],
  typologySlugs: ["pep-grand-corruption-proceeds", "romance-investment-scams", "front-company-bo-obfuscation"],
  enforcementRefs: [{ firm: "Credit Suisse International, Credit Suisse Securities (Europe) Ltd, and Credit Suisse AG", year: 2021 }],
  dataInputs: [
    "Customer name, date of birth, nationality and key identifiers at onboarding",
    "Beneficial owner, director and connected-party identities for entity customers",
    "Structured and categorised adverse media feed from a commercial provider, mapped to risk categories (financial crime, corruption, fraud, organised crime, terrorism)",
    "Source quality and recency metadata to weight credibility",
    "Existing customer risk rating and relationship context for relevance assessment",
  ],
  ruleLogic:
    "Screen customers and connected parties against a categorised adverse media database at onboarding and on a risk-based ongoing basis. Match by name plus secondary identifiers, then filter and rank hits by risk category, source credibility and recency. Material, on-point hits (financial crime, corruption, sanctions nexus) generate an alert for analyst review, which can lead to EDD, risk re-rating, relationship exit or a SAR. Low-relevance or stale hits are dispositioned with a documented rationale.",
  defaultThreshold:
    "Fuzzy name match >= 85% combined with a financial-crime-relevant category and a credible source auto-routes to review; lower-relevance categories or weak sources are batched for risk-based triage.",
  thresholdRationale:
    "Adverse media is inherently noisy, so the threshold combines a name-match floor with category and source-credibility filters rather than name score alone; this raises precision so analysts review material risk rather than tabloid noise. The match floor stays at 85% to avoid missing genuine subjects whose names are reported with variant spellings, while category filtering does the heavy lifting on relevance.",
  lookbackWindow:
    "At onboarding, then risk-based: higher-risk customers continuously or monthly, standard-risk at periodic review or on trigger events; provider feeds surface new articles as they are published.",
  tuningNotes:
    "Raw adverse media generates very high false-positive volumes (often well above 90%) driven by name collisions, irrelevant categories and duplicate syndicated articles. Tune by enabling category exclusions, source whitelists/blacklists, de-duplication and secondary-identifier matching, and by setting differentiated screening frequency by customer risk band so analyst effort follows risk. Document why each category is in or out of scope so coverage is defensible; do not switch off financial-crime categories to manage volume.",
  firstLineOwner: "Screening Operations / EDD analysts",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: ["ComplyAdvantage", "Dow Jones Risk & Compliance", "LexisNexis WorldCompliance", "RDC / Moody's", "Quantifind / NLP-based media tooling"],
  escalation:
    "A confirmed, material adverse media finding is escalated to the EDD team and MLRO for a risk re-rating and relationship decision; where it gives rise to knowledge or suspicion of money laundering, a SAR is filed and the customer is not tipped off.",
  sla: "Material adverse media alerts reviewed within 3 working days; confirmed high-risk findings escalated to the MLRO within 1 working day of confirmation.",
  metrics: [
    { name: "Adverse media coverage", target: "100% at onboarding", description: "Customers and connected parties screened for adverse media before activation." },
    { name: "Material-hit review SLA", target: ">= 95% within SLA", description: "Material adverse media alerts dispositioned within the response target." },
    { name: "Risk re-rating action rate", target: "Tracked / trended", description: "Confirmed adverse findings that result in a documented risk re-rating or exit." },
    { name: "False-positive ratio", target: "Trended down via tuning", description: "Proportion of adverse media alerts cleared as not relevant, monitored for tuning." },
  ],
  testPlan: [
    "Inject synthetic customers matching subjects of recent financial-crime news in the feed and confirm material hits route to review.",
    "Inject negative controls (same name, irrelevant category such as sports) and confirm they are filtered or correctly cleared.",
    "Sample 25 cleared adverse media alerts and confirm each disposition records why the hit was not relevant.",
    "Trigger an ongoing rescreen for a higher-risk customer and confirm a newly published adverse article is surfaced within the expected frequency.",
  ],
  reviewCadence: "Category scope, source weighting and screening frequencies reviewed annually; alert quality and disposition rationale sampled quarterly.",
  governance: [
    "MLRO approves the adverse media categories in scope, source-credibility rules and risk-based screening frequencies.",
    "Disposition rationales for cleared material hits are documented and retained.",
    "Financial Crime Committee receives adverse media MI (volumes, escalations, exits) at least quarterly.",
    "Adverse media findings, decisions and any SAR references are retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Screening covers beneficial owners and connected parties, not just the named customer.",
    "Hits are filtered by risk category and source credibility so analysts review genuine financial-crime risk, not noise.",
    "Material findings translate into a documented risk re-rating, EDD or exit decision rather than being cleared and forgotten.",
    "Higher-risk customers are screened more frequently than standard-risk, evidencing a risk-based approach.",
  ],
  strongVsWeak: {
    strong:
      "A bank screens a corporate's beneficial owner, surfaces a credible investigative report linking him to a bribery scheme, escalates to EDD, re-rates the relationship to high risk, files a SAR and records the decision trail.",
    weak:
      "A firm runs a one-off internet search at onboarding, clears a genuine corruption hit because an analyst could not tell it apart from an unrelated namesake, keeps no rationale, and never rescreens the customer again.",
  },
  sources: [
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "JMLSG Guidance Part I, Chapter 5: Enhanced due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA FCG 7", title: "FCG 7 Financial sanctions and wider financial crime systems and controls", url: "https://www.handbook.fca.org.uk/handbook/FCG/7/" },
    { org: "FATF", reference: "R.6", title: "Recommendation 6: Targeted financial sanctions related to terrorism and terrorist financing", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "MLR", reference: "reg.33 EDD / correspondent", title: "Money Laundering Regulations 2017 reg.33: enhanced customer due diligence", url: "https://www.legislation.gov.uk/uksi/2017/692/contents" },
  ],
};
