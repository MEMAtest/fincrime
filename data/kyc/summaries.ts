import type { Jurisdiction } from "./types";

/**
 * Professional, plain-English summary of each jurisdiction's AML/CDD regime:
 * the primary law, the regulator, and the areas it covers. Powers the Matrix
 * "mini summary" panel ("this is the source, this is the regulator, it covers
 * the following").
 */

export interface JurisdictionSummary {
  regulator: string;
  primaryLaw: string;
  covers: string[];
}

const COMMON_COVERS = [
  "Customer identification & verification",
  "Beneficial ownership & control",
  "Purpose & nature of the relationship",
  "Ongoing monitoring",
  "Enhanced due diligence (PEPs, high-risk countries)",
];

export const JURISDICTION_SUMMARY: Record<Jurisdiction, JurisdictionSummary> = {
  global: {
    regulator: "FATF (global standard-setter)",
    primaryLaw: "FATF Recommendations (R.10, R.12, R.22, R.24/25)",
    covers: ["Risk-based customer due diligence", "Beneficial ownership transparency", "PEPs & correspondent banking", "Ongoing monitoring", "Reporting of suspicious transactions"],
  },
  uk: {
    regulator: "Financial Conduct Authority (FCA)",
    primaryLaw: "Money Laundering Regulations 2017 (MLR), with JMLSG guidance",
    covers: [...COMMON_COVERS, "Suspicious activity reporting (NCA)"],
  },
  us: {
    regulator: "FinCEN & the federal banking regulators",
    primaryLaw: "Bank Secrecy Act + 31 CFR (CIP 1020.220; CDD Rule 1010.230)",
    covers: ["Customer Identification Program (CIP)", "Beneficial ownership (25% + control prong)", "Customer risk profile & ongoing monitoring", "Correspondent & private-banking EDD", "SAR filing"],
  },
  eu: {
    regulator: "National competent authorities (EU AMLA, Frankfurt, supervising from 2028)",
    primaryLaw: "AMLD5 (Dir. 2015/849); AMLR (Reg. 2024/1624) from 2027",
    covers: [...COMMON_COVERS, "Simplified vs enhanced due diligence (Annex II/III)"],
  },
  de: {
    regulator: "BaFin (Bundesanstalt für Finanzdienstleistungsaufsicht)",
    primaryLaw: "Geldwäschegesetz (GwG)",
    covers: [...COMMON_COVERS, "Transparenzregister (beneficial-owner register)"],
  },
  fr: {
    regulator: "ACPR (Banque de France) & AMF; Tracfin (FIU)",
    primaryLaw: "Code monétaire et financier (LCB-FT, L.561-x / R.561-x)",
    covers: [...COMMON_COVERS, "Registre des bénéficiaires effectifs (RBE)"],
  },
  sg: {
    regulator: "Monetary Authority of Singapore (MAS)",
    primaryLaw: "MAS Notice 626 (banks); CDSA",
    covers: [...COMMON_COVERS, "Suspicious transaction reporting (STRO)"],
  },
  hk: {
    regulator: "HKMA & SFC",
    primaryLaw: "AMLO (Cap. 615), Schedule 2; HKMA/SFC AML Guidelines",
    covers: [...COMMON_COVERS, "Suspicious transaction reporting (JFIU)"],
  },
};
