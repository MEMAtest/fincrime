import type { Control } from "./types";

export const control05: Control = {
  id: 5,
  slug: "source-of-funds-checks",
  name: "Source of Funds Verification",
  category: "customer_due_diligence",
  controlType: "preventive",
  plainSummary:
    "For a specific large or unusual deposit, establish and evidence where that exact money came from before it is used.",
  objective:
    "Establish and, on a risk-sensitive basis, verify the origin of the specific funds involved in a transaction or relationship under reg.28 and (for higher-risk and PEP relationships) reg.33 and reg.35, so the firm is satisfied the funds are not the proceeds of crime before they are deployed.",
  riskThemes: ["money_laundering", "tax_evasion", "bribery_corruption"],
  applicableFirmTypes: [
    "bank",
    "wealth_manager",
    "msb",
    "emi",
    "pi",
    "crypto",
    "insurance",
  ],
  typologySlugs: [
    "third-party-round-tripping",
    "real-estate-high-value-goods-integration",
    "single-premium-policy-laundering",
  ],
  enforcementRefs: [
    { firm: "EFG Private Bank", year: 2013 },
    { firm: "Ghana International Bank Plc", year: 2022 },
  ],
  dataInputs: [
    "Transaction amount, currency and value date",
    "Originating account, bank and account holder name",
    "Stated source of the specific funds (sale, salary, loan, gift, business income)",
    "Documentary evidence (sale contract, payslip, loan agreement, audited accounts)",
    "Third-party-payer indicators and relationship to the customer",
    "Originating jurisdiction and any high-risk-corridor flag",
    "Customer expected-activity profile for comparison",
    "Prior source-of-funds evidence on file",
  ],
  ruleLogic:
    "When a deposit or transaction exceeds a value/risk trigger, require the customer to state the source of those specific funds and provide corroborating evidence proportionate to risk. Verify that the evidence is consistent (amount, payer and date match the inflow) and that the payer matches the customer or an explained third party. Where funds arrive from an unexpected third party, an unexplained jurisdiction, or in a pattern inconsistent with the customer profile, hold the funds from onward use and investigate. Do not allow withdrawal, investment or onward transfer until source of funds is satisfactorily established for the trigger amount.",
  defaultThreshold:
    "Verify source of funds for any single inflow >= GBP 10,000 (or local equivalent) or aggregated inflows >= GBP 10,000 in 30 days; lower to GBP 0 (verify all) for high-risk and PEP relationships; always verify where the payer differs from the customer or the funds originate in a high-risk third country (reg.33).",
  thresholdRationale:
    "A GBP 10,000 trigger aligns with the long-standing significant-transaction reporting benchmark and catches material inflows without burdening routine low-value activity; for higher-risk and PEP customers reg.33/35 require enhanced scrutiny, so the trigger drops to zero. Third-party payers and high-risk-country origins are independent red flags regardless of amount. EFG Private Bank and Ghana International Bank were both penalised for accepting large customer funds without adequately establishing or challenging their origin, so the trigger must bite on exactly that scenario.",
  lookbackWindow:
    "Per-transaction at the trigger point, with 30-day aggregation to defeat structuring; evidence retained for the relationship plus 5 years.",
  tuningNotes:
    "Most inflows below the trigger need no friction; concentrate documentary effort on large, third-party or cross-border deposits. Beware structuring just under the threshold, which is why aggregation matters. Match the depth of evidence to risk: a payslip may suffice for salaried funds, but proceeds of a property sale or a 'gift' from a third party need contract and counterparty corroboration. Track how often source of funds is accepted on a bare assertion with no document, as that is the most common control weakness regulators cite.",
  firstLineOwner: "Relationship Management / Onboarding with KYC Operations",
  secondLineOwner: "MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Payment / core banking system flagging inflows at the trigger and aggregating over 30 days",
    "Document capture and verification workflow for SoF evidence",
    "Sanctions and adverse-media screening on the originating payer",
    "Transaction monitoring to detect structuring around the threshold",
    "Case management with funds-hold capability until SoF is cleared",
  ],
  escalation:
    "Funds that cannot be satisfactorily evidenced, or that arrive from an unexpected third party or high-risk origin, are held from onward use and escalated to the MLRO. Where there is knowledge or suspicion of money laundering, a SAR is considered and the funds are not returned or moved without regard to tipping-off and the consent regime.",
  sla: "Source-of-funds requests issued at the trigger point; standard cases resolved within 3 business days; funds remain restricted from onward use until cleared.",
  metrics: [
    { name: "SoF evidence rate", target: ">=98%", description: "Trigger-breaching inflows with documentary source-of-funds evidence on file (not bare assertion)" },
    { name: "Third-party payer challenge rate", target: "100%", description: "Inflows from a payer other than the customer that were investigated and explained" },
    { name: "Structuring detection", target: "Monitored", description: "Aggregated sub-threshold inflows detected and reviewed for deliberate structuring" },
    { name: "Funds-hold leakage", target: "0", description: "Trigger inflows used onward before source of funds was cleared" },
  ],
  testPlan: [
    "Post a GBP 25,000 test inflow and confirm an SoF request is raised and the funds are restricted from withdrawal until evidence is accepted.",
    "Post five GBP 2,500 inflows over 20 days from the same payer and confirm the 30-day aggregation triggers an SoF review for structuring.",
    "Submit an inflow where the payer name differs from the customer and confirm it is held and challenged regardless of amount.",
    "Sample 20 cleared SoF cases and confirm each has corroborating documentation that matches the amount, payer and date, not just a customer statement.",
  ],
  reviewCadence:
    "Trigger amounts and evidence standards reviewed semi-annually; high-risk and PEP source-of-funds standards reviewed annually or on regulatory change.",
  governance: [
    "MLRO approves the SoF trigger amounts, aggregation logic and acceptable evidence per source type.",
    "Funds-hold release requires a documented analyst conclusion that the source is established.",
    "SoF evidence and the verification rationale retained for the relationship plus 5 years.",
    "Volume of bare-assertion acceptances and third-party-payer cases reported to the financial crime committee quarterly.",
  ],
  whatGoodLooksLike: [
    "Large and unusual deposits cannot be used until their specific origin is evidenced and consistent.",
    "Aggregation defeats structuring just under the trigger, not just single large transfers.",
    "Third-party payers are always explained and corroborated, never silently accepted.",
    "Evidence depth scales with risk, and bare unsupported assertions are not accepted as proof.",
  ],
  strongVsWeak: {
    strong:
      "A wealth manager receiving a GBP 250,000 deposit obtains the property sale contract and completion statement, confirms the conveyancer is the payer and the amount and date match, screens the payer, and only then releases the funds for investment, all logged against the inflow.",
    weak:
      "A private bank accepts a GBP 250,000 inflow from an unrelated offshore company on the customer's verbal explanation of 'business proceeds', files no document, runs no payer check, and lets the customer invest it the same day.",
  },
  sources: [
    { org: "MLR", reference: "reg.33 EDD", title: "The Money Laundering Regulations 2017", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/33" },
    { org: "FATF", reference: "R.10 Customer due diligence", title: "FATF Recommendations", url: "https://www.fatf-gafi.org/en/recommendations.html" },
    { org: "JMLSG", reference: "Part I, Chapter 5", title: "Customer due diligence", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
    { org: "FCA", reference: "FCA Financial Crime Guide", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },
  ],
};
