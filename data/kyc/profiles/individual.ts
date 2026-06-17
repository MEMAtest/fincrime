import type { CddProfile } from "../types";
import { SRC, cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/**
 * Individual (natural person). The customer is their own beneficial owner, so
 * there is no BO identification or ownership/control analysis.
 */

const screeningEdd = (pepSrc: typeof SRC[keyof typeof SRC], hrcSrc: typeof SRC[keyof typeof SRC], complexSrc: typeof SRC[keyof typeof SRC]) => [
  edd("Customer is a Politically Exposed Person (PEP), family member or close associate", "Senior-management approval, establish source of wealth and source of funds, enhanced ongoing monitoring", [pepSrc]),
  edd("Customer connected to a high-risk third country", "Additional information on the customer and source of funds; enhanced monitoring", [hrcSrc]),
  edd("Complex, unusually large or unusual-pattern transactions", "Examine background and purpose; document findings", [complexSrc]),
];

export const individual: CddProfile[] = [
  {
    entityType: "individual",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "Permitted where the relationship is assessed as lower risk (FATF R.10 risk-based approach).",
    sections: [
      sec("identity", [
        it("Full name", cite("fatf_r10", "fatf_in10")),
        it("Date of birth", cite("fatf_in10")),
        it("Residential address", cite("fatf_in10")),
        it("Nationality", cite("fatf_in10")),
        it("Verify identity using reliable, independent source documents, data or information", cite("fatf_r10", "fatf_in10")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the business relationship", cite("fatf_r10")),
        it("Source of funds / source of wealth", cite("fatf_r10"), { risk: HI }),
        it("Ongoing monitoring of the relationship and transactions", cite("fatf_r10")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening of the customer", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: screeningEdd(SRC.fatf_r12, SRC.fatf_r10, SRC.fatf_r10),
    notes: "FATF baseline; national law adds specific data fields and verification methods.",
  },
  {
    entityType: "individual",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_indiv"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "SDD available where the customer/relationship is lower risk (MLR reg. 37); not where on a restricted industry list.",
    sections: [
      sec("identity", [
        it("Full name (including any aliases)", cite("mlr_r28", "jmlsg_indiv")),
        it("Residential address", cite("mlr_r28", "jmlsg_indiv")),
        it("Date of birth", cite("mlr_r28", "jmlsg_indiv")),
        it("Place of birth and nationality", cite("jmlsg_indiv")),
        it("Occupation (with reference to restricted-industry risk appetite)", cite("jmlsg_indiv")),
        it("Verify identity: certified proof of ID + proof of address", cite("mlr_r28", "jmlsg_indiv")),
      ]),
      sec("nature_purpose", [
        it("Nature and purpose of the relationship; expected account activity", cite("mlr_r28")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
        it("How the client was sourced", cite("jmlsg_indiv")),
      ]),
      sec("screening", [
        it("PEP, sanctions and adverse-media screening of the customer and authorised contacts (including aliases)", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("Customer or a connected party is a PEP, family member or known close associate", "Senior-management approval; establish source of wealth and funds; enhanced ongoing monitoring", cite("mlr_r35")),
      edd("Customer connected to a high-risk third country", "Apply the EDD measures in MLR reg. 33", cite("mlr_r33")),
      edd("Complex/unusually large transactions with no apparent economic purpose", "Examine background and purpose; document findings", cite("mlr_r33", "fca_fcg")),
    ],
  },
  {
    entityType: "individual",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "No formal SDD tier; risk-based scrutiny applies (BSA).",
    sections: [
      sec("identity", [
        it("Name", cite("us_cip_banks")),
        it("Date of birth", cite("us_cip_banks")),
        it("Address (residential or business street address)", cite("us_cip_banks")),
        it("Identification number: TIN for a US person; passport/alien-ID number + country for a non-US person", cite("us_cip_banks")),
        it("Verify identity via documentary or non-documentary methods within a reasonable time", cite("us_cip_banks")),
      ]),
      sec("nature_purpose", [
        it("Understand the nature and purpose of the relationship to form a customer risk profile", cite("us_cdd")),
        it("Ongoing monitoring to identify and report suspicious transactions", cite("us_cdd")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening; risk-based PEP screening", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Senior foreign political figure (private banking account)", "Enhanced scrutiny for proceeds of foreign corruption; ascertain source of funds", cite("us_private_bank")),
      edd("Foreign PEP (risk-based, per examiner expectation)", "Risk-based enhanced due diligence", cite("us_ffiec_pep")),
      edd("Customer in a high-risk geography / subject to special measures", "Enhanced scrutiny; potential 311 special measures", cite("us_ffiec_pep")),
    ],
    notes: "The US has no single statutory PEP definition; PEP EDD is an examiner expectation (FFIEC), with a specific regime for private banking (1010.620).",
  },
  {
    entityType: "individual",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "SDD where lower risk per AMLD5 Annex II (Arts. 15-17).",
    sections: [
      sec("identity", [
        it("Full name", cite("eu_amld_13")),
        it("Place of birth (at least country) and date of birth", cite("eu_amlr_22")),
        it("All nationalities", cite("eu_amlr_22")),
        it("Residential address", cite("eu_amlr_22")),
        it("Verify identity against reliable, independent sources", cite("eu_amld_13")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the relationship", cite("eu_amld_13")),
        it("Ongoing monitoring and keeping documents up to date", cite("eu_amld_13")),
      ]),
      sec("screening", [
        it("Establish whether the customer is a PEP; sanctions screening", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Customer is a PEP, family member or close associate", "Senior-management approval; source of wealth/funds; enhanced monitoring", cite("eu_amld_pep")),
      edd("High-risk third country (Annex III / Commission list)", "Enhanced measures per Art. 18a", cite("eu_amld_edd")),
      edd("Complex/unusually large transactions (Annex III)", "Examine background and purpose", cite("eu_amld_edd")),
    ],
    notes: "AMLR (Reg. 2024/1624) harmonises these data fields from 10 Jul 2027.",
  },
  {
    entityType: "individual",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_11"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "Simplified DD where low risk per GwG §14 (Anlage 1 factors).",
    sections: [
      sec("identity", [
        it("First and last name (Vorname, Nachname)", cite("de_gwg_11")),
        it("Place of birth (Geburtsort)", cite("de_gwg_11")),
        it("Date of birth (Geburtsdatum)", cite("de_gwg_11")),
        it("Nationality (Staatsangehörigkeit)", cite("de_gwg_11")),
        it("Residential address", cite("de_gwg_11")),
        it("Verify via valid photo ID or eID; record document type, number and issuer", cite("de_gwg_12")),
      ]),
      sec("nature_purpose", [
        it("Purpose and nature of the business relationship; ongoing monitoring", cite("de_gwg_10")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of the customer", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("Customer/BO is a PEP, family member or close associate (§15(3) Nr.1)", "Senior-management approval; origin of assets; enhanced monitoring", cite("de_gwg_15")),
      edd("High-risk third country (§15(3) Nr.2)", "Additional information; senior-management approval; enhanced monitoring", cite("de_gwg_15")),
      edd("Complex/unusual/large transactions (§15(3) Nr.3)", "Background investigation; examine purpose", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "individual",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_l5615", "fr_r5615"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "Vigilance allégée where low risk (CMF R.561-15/-16); rare for private individuals.",
    sections: [
      sec("identity", [
        it("Surname (nom) and given names (prénoms)", cite("fr_r5615")),
        it("Date of birth", cite("fr_r5615")),
        it("Place of birth", cite("fr_r5615")),
        it("Verify via valid photo-ID document or eIDAS-certified eID", cite("fr_r5651")),
      ]),
      sec("nature_purpose", [
        it("Object and nature of the business relationship", cite("fr_l5615_1")),
        it("Constant vigilance / ongoing monitoring", cite("fr_l5616")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of the customer", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Customer or BO is a PEP (R.561-18 categories)", "Senior-management approval; source of wealth and funds; enhanced monitoring", cite("fr_l56110")),
      edd("High-risk third country", "Enhanced vigilance per L.561-10", cite("fr_l56110")),
      edd("Complex/unusually large transactions", "Enquire as to origin/destination of funds and purpose; document", cite("fr_l561102")),
    ],
  },
  {
    entityType: "individual",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "SDD where low risk (Notice 626 §7); generally a baseline for individuals.",
    sections: [
      sec("identity", [
        it("Full name (including any aliases)", cite("sg_n626_6")),
        it("Unique identification number (NRIC / passport)", cite("sg_n626_6")),
        it("Residential address", cite("sg_n626_6")),
        it("Date of birth", cite("sg_n626_6")),
        it("Nationality", cite("sg_n626_6")),
        it("Place of birth", cite("sg_n626_6"), { conditional: "where applicable" }),
        it("Verify via reliable, independent documents (NRIC/passport); additional measures for non-face-to-face", cite("sg_n626_6")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the relationship; ongoing due diligence", cite("sg_n626_6")),
      ]),
      sec("screening", [
        it("Screen the customer against ML/TF lists and sanctions sources", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("Foreign or international-organisation PEP (or higher-risk domestic PEP)", "Senior-management approval; establish source of wealth and funds; enhanced monitoring", cite("sg_n626_edd")),
      edd("Customer/BO from a country subject to FATF counter-measures", "EDD; SDD not permitted", cite("sg_n626_edd")),
      edd("Complex, unusually large transactions with no apparent purpose", "Examine background and purpose", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "individual",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_hkma_gl"),
    boThreshold: "n/a (the individual is the beneficial owner)",
    sddEligibility: "SDD where low risk (AMLO Sch. 2 s.4).",
    sections: [
      sec("identity", [
        it("Full name", cite("hk_amlo_s2", "hk_hkma_gl")),
        it("Date of birth", cite("hk_hkma_gl")),
        it("Nationality", cite("hk_hkma_gl")),
        it("Unique identification number and document type (HKID / passport)", cite("hk_hkma_gl")),
        it("Residential address", cite("hk_hkma_gl")),
        it("Verify identity from reliable, independent source documents/data", cite("hk_amlo_s2")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the relationship; ongoing monitoring", cite("hk_amlo_s2", "hk_amlo_s5")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening of the customer", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("Non-Hong Kong PEP (mandatory); HK / international-organisation PEP (risk-based)", "Senior-management approval; source of wealth and funds; enhanced monitoring", cite("hk_amlo_s5", "hk_hkma_gl")),
      edd("Customer connected to a high-risk jurisdiction (FATF lists)", "EDD; consider limiting the relationship", cite("hk_hkma_gl")),
      edd("Non-face-to-face onboarding", "Apply additional measures to mitigate the higher risk", cite("hk_amlo_s5")),
    ],
  },
];
