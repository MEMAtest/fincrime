import type { Source } from "../typologies/types";

/**
 * Citation library for the KYC/CDD matrix. Every entry is a real, published
 * primary-source provision taken from the jurisdiction research briefs. Profiles
 * reference these so item-level citations stay precise and consistent.
 *
 * Do not invent references. Add a new entry here (with a real URL) before citing it.
 */
export const SRC = {
  /* ── FATF (global baseline) ──────────────────────── */
  fatf_r10: { org: "FATF", reference: "Recommendation 10", title: "Customer Due Diligence", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r12: { org: "FATF", reference: "Recommendation 12", title: "Politically Exposed Persons", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r13: { org: "FATF", reference: "Recommendation 13", title: "Correspondent Banking", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r16: { org: "FATF", reference: "Recommendation 16", title: "Wire Transfers", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r22: { org: "FATF", reference: "Recommendation 22", title: "DNFBPs: Customer Due Diligence", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r24: { org: "FATF", reference: "Recommendation 24", title: "Transparency / BO of Legal Persons", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_r25: { org: "FATF", reference: "Recommendation 25", title: "Transparency / BO of Legal Arrangements", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },
  fatf_in10: { org: "FATF", reference: "Interpretive Note to R.10", title: "CDD Identification & Verification", url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html" },

  /* ── UK (MLR 2017 / JMLSG / FCA) ─────────────────── */
  mlr_r27: { org: "MLR", reference: "reg. 27", title: "Customer due diligence (when applied)", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/27" },
  mlr_r28: { org: "MLR", reference: "reg. 28", title: "CDD measures (identify & verify)", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/28" },
  mlr_r33: { org: "MLR", reference: "reg. 33", title: "Enhanced due diligence", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/33" },
  mlr_r35: { org: "MLR", reference: "reg. 35", title: "PEPs", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/35" },
  mlr_r37: { org: "MLR", reference: "reg. 37", title: "Simplified due diligence", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/37" },
  jmlsg_indiv: { org: "JMLSG", reference: "Part I 5.3.71-91", title: "Verification of individuals", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  jmlsg_regulated: { org: "JMLSG", reference: "Part I 5.3.133", title: "Regulated / credit & financial institutions", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  jmlsg_corp: { org: "JMLSG", reference: "Part I 5.3.143", title: "Private companies / partnerships / trusts", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  jmlsg_listed: { org: "JMLSG", reference: "Part I 5.3.156", title: "Listed / public companies", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  jmlsg_gov: { org: "JMLSG", reference: "Part I 5.3.192", title: "Public sector / government bodies", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  jmlsg_funds: { org: "JMLSG", reference: "Part II 20", title: "Asset management & investment funds", url: "https://www.jmlsg.org.uk/guidance/current-guidance/" },
  fca_fcg: { org: "FCA", reference: "FCG", title: "Financial Crime Guide", url: "https://www.handbook.fca.org.uk/handbook/FCG/" },

  /* ── United States (BSA / 31 CFR) ────────────────── */
  us_cip_banks: { org: "FinCEN", reference: "31 CFR 1020.220", title: "Customer Identification Program (banks)", url: "https://www.law.cornell.edu/cfr/text/31/1020.220" },
  us_cdd: { org: "FinCEN", reference: "31 CFR 1010.230", title: "Beneficial ownership / CDD Rule", url: "https://www.law.cornell.edu/cfr/text/31/1010.230" },
  us_cdd_d: { org: "FinCEN", reference: "31 CFR 1010.230(d)", title: "Beneficial owner (25% ownership + control prong)", url: "https://www.law.cornell.edu/cfr/text/31/1010.230" },
  us_cdd_e: { org: "FinCEN", reference: "31 CFR 1010.230(e)", title: "Excluded legal entity customers", url: "https://www.law.cornell.edu/cfr/text/31/1010.230" },
  us_corresp: { org: "FinCEN", reference: "31 CFR 1010.610", title: "Correspondent accounts EDD", url: "https://www.law.cornell.edu/cfr/text/31/1010.610" },
  us_private_bank: { org: "FinCEN", reference: "31 CFR 1010.620", title: "Private banking accounts EDD", url: "https://www.law.cornell.edu/cfr/text/31/1010.620" },
  us_ffiec_pep: { org: "FinCEN", reference: "FFIEC BSA/AML Manual", title: "PEPs (senior foreign political figures)", url: "https://bsaaml.ffiec.gov/manual" },
  us_cta: { org: "FinCEN", reference: "31 CFR 1010.380", title: "CTA beneficial-ownership reporting (company-level)", url: "https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-C" },

  /* ── European Union (AMLD5 / AMLR) ───────────────── */
  eu_amld_13: { org: "EU", reference: "AMLD5 Art. 13", title: "Customer due diligence measures", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  eu_amld_bo: { org: "EU", reference: "AMLD5 Art. 3(6)", title: "Beneficial owner (25% threshold)", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  eu_amld_sdd: { org: "EU", reference: "AMLD5 Arts. 15-17", title: "Simplified due diligence", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  eu_amld_edd: { org: "EU", reference: "AMLD5 Arts. 18-18a", title: "Enhanced due diligence / high-risk third countries", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  eu_amld_pep: { org: "EU", reference: "AMLD5 Arts. 20-23", title: "Politically exposed persons", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  eu_amlr_22: { org: "EU", reference: "AMLR Art. 22", title: "CDD data (AMLR, from 10 Jul 2027)", url: "https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng" },
  eu_amlr_bo: { org: "EU", reference: "AMLR Arts. 51-54", title: "Beneficial owner (AMLR, from 2027)", url: "https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng" },
  eu_amlr_arr: { org: "EU", reference: "AMLR Arts. 55-60", title: "BO of trusts, foundations & arrangements (AMLR)", url: "https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng" },

  /* ── Germany (GwG) ───────────────────────────────── */
  de_gwg_10: { org: "BaFin", reference: "GwG §10", title: "General due diligence obligations", url: "https://www.gesetze-im-internet.de/gwg_2017/__10.html" },
  de_gwg_11: { org: "BaFin", reference: "GwG §11", title: "Identification data (persons & entities)", url: "https://www.gesetze-im-internet.de/gwg_2017/__11.html" },
  de_gwg_12: { org: "BaFin", reference: "GwG §12", title: "Verification methods", url: "https://www.gesetze-im-internet.de/gwg_2017/__12.html" },
  de_gwg_3: { org: "BaFin", reference: "GwG §3", title: "Beneficial owner (25%; fictitious BO fallback)", url: "https://www.gesetze-im-internet.de/gwg_2017/__3.html" },
  de_gwg_14: { org: "BaFin", reference: "GwG §14", title: "Simplified due diligence", url: "https://www.gesetze-im-internet.de/gwg_2017/__14.html" },
  de_gwg_15: { org: "BaFin", reference: "GwG §15", title: "Enhanced due diligence (PEPs, high-risk, correspondent)", url: "https://www.gesetze-im-internet.de/gwg_2017/__15.html" },
  de_gwg_20: { org: "BaFin", reference: "GwG §§19-20", title: "Transparenzregister (BO register)", url: "https://www.gesetze-im-internet.de/gwg_2017/__20.html" },

  /* ── France (CMF) ────────────────────────────────── */
  fr_l5615: { org: "ACPR", reference: "CMF L.561-5", title: "Identify & verify client and beneficial owner", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  fr_l5615_1: { org: "ACPR", reference: "CMF L.561-5-1", title: "Purpose & nature of the relationship", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  fr_l5616: { org: "ACPR", reference: "CMF L.561-6", title: "Ongoing monitoring (vigilance constante)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  fr_r5615: { org: "ACPR", reference: "CMF R.561-5", title: "Identification data (natural & legal persons)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000021019145/" },
  fr_r5651: { org: "ACPR", reference: "CMF R.561-5-1", title: "Verification methods", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000021019145/" },
  fr_r5611: { org: "ACPR", reference: "CMF R.561-1", title: "Beneficial owner of companies (>25%)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824564" },
  fr_r5612: { org: "ACPR", reference: "CMF R.561-2", title: "Beneficial owner of collective investment schemes", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824571" },
  fr_r5613: { org: "ACPR", reference: "CMF R.561-3", title: "BO of associations/foundations (deemed directors)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824577" },
  fr_r56130: { org: "ACPR", reference: "CMF R.561-3-0", title: "BO of trusts / fiducie", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000021019133/" },
  fr_l56110: { org: "ACPR", reference: "CMF L.561-10", title: "Enhanced vigilance (PEPs, high-risk countries)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  fr_l561102: { org: "ACPR", reference: "CMF L.561-10-2", title: "Heightened scrutiny of complex/unusual transactions", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000020179278/" },
  fr_r56115: { org: "ACPR", reference: "CMF R.561-15", title: "Simplified vigilance (low-risk clients)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000021019145/" },
  fr_rbe: { org: "ACPR", reference: "CMF R.561-55+", title: "Registre des bénéficiaires effectifs (RBE)", url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000034921546/" },
  fr_amf_doc: { org: "AMF", reference: "DOC-2019-16", title: "Client & beneficial-owner identification (asset managers)", url: "https://www.amf-france.org/" },

  /* ── Singapore (MAS Notice 626 / CDSA) ───────────── */
  sg_n626_6: { org: "MAS", reference: "Notice 626 §6", title: "CDD measures & identification data", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  sg_n626_bo: { org: "MAS", reference: "Notice 626 §6.19-6.20", title: "Beneficial owner (25% cascading)", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  sg_n626_trust: { org: "MAS", reference: "Notice 626 §6.21", title: "Trust relevant parties", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  sg_n626_sdd: { org: "MAS", reference: "Notice 626 §7", title: "Simplified due diligence (Appendix 2)", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  sg_n626_edd: { org: "MAS", reference: "Notice 626 §8", title: "Enhanced CDD & PEPs", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
  sg_cdsa: { org: "MAS", reference: "CDSA s.39", title: "Suspicious transaction reporting", url: "https://sso.agc.gov.sg/Act/CDTOSCCBA1992" },

  /* ── Hong Kong (AMLO Sch. 2 / HKMA & SFC) ────────── */
  hk_amlo_s2: { org: "HKMA", reference: "AMLO Sch. 2 s.2", title: "CDD measures", url: "https://www.elegislation.gov.hk/hk/cap615" },
  hk_amlo_s3: { org: "HKMA", reference: "AMLO Sch. 2 s.3", title: "Timing of CDD", url: "https://www.elegislation.gov.hk/hk/cap615" },
  hk_amlo_s4: { org: "HKMA", reference: "AMLO Sch. 2 s.4", title: "Simplified due diligence", url: "https://www.elegislation.gov.hk/hk/cap615" },
  hk_amlo_s5: { org: "HKMA", reference: "AMLO Sch. 2 s.5", title: "Ongoing monitoring, PEPs & special situations", url: "https://www.elegislation.gov.hk/hk/cap615" },
  hk_amlo_bo: { org: "HKMA", reference: "AMLO Sch. 2 s.1", title: "Beneficial owner definition (>25%)", url: "https://www.elegislation.gov.hk/hk/cap615" },
  hk_hkma_gl: { org: "HKMA", reference: "HKMA AML/CFT Guideline ch.4", title: "CDD guidance for authorised institutions", url: "https://www.hkma.gov.hk/eng/key-functions/banking/anti-money-laundering-and-counter-financing-of-terrorism/" },
  hk_sfc_gl: { org: "SFC", reference: "SFC AML/CFT Guideline", title: "CDD guidance for licensed corporations", url: "https://www.sfc.hk/en/Rules-and-standards/Anti-money-laundering-and-counter-financing-of-terrorism" },

  /* ── Ongoing monitoring (per jurisdiction) ───────── */
  uk_mlr_ongoing: { org: "MLR", reference: "reg. 28(11)", title: "Ongoing monitoring of the business relationship", url: "https://www.legislation.gov.uk/uksi/2017/692/regulation/28" },
  us_cdd_ongoing: { org: "FinCEN", reference: "31 CFR 1010.230(a)(5)", title: "Ongoing monitoring (CDD Rule pillar)", url: "https://www.law.cornell.edu/cfr/text/31/1010.230" },
  eu_amld_ongoing: { org: "EU", reference: "AMLD5 Art. 13(1)(d)", title: "Ongoing monitoring of the business relationship", url: "https://eur-lex.europa.eu/eli/dir/2015/849/oj/eng" },
  de_gwg_ongoing: { org: "BaFin", reference: "GwG §10(1) Nr.5", title: "Continuous monitoring (Allgemeine Sorgfaltspflichten)", url: "https://www.gesetze-im-internet.de/gwg_2017/__10.html" },
  sg_n626_ongoing: { org: "MAS", reference: "Notice 626 §11", title: "Ongoing monitoring of transactions and customers", url: "https://www.mas.gov.sg/regulation/notices/notice-626" },
} as const satisfies Record<string, Source>;

export type SourceKey = keyof typeof SRC;

/** Convenience: build a Source[] from one or more SRC keys. */
export function cite(...keys: SourceKey[]): Source[] {
  return keys.map((k) => SRC[k]);
}
