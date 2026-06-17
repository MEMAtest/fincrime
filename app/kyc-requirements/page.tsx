import type { Metadata } from "next";
import KycMatrixClient from "./KycMatrixClient";

export const metadata: Metadata = {
  title: "KYC / CDD Requirements Matrix",
  description:
    "By entity type and jurisdiction: the CDD information you must collect, what the rules say (cited to the primary source), and the EDD triggers. UK, US, EU, Germany, France, Singapore, Hong Kong and the FATF baseline.",
};

export default async function KycRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ jurisdiction?: string | string[]; risk?: string | string[] }>;
}) {
  const sp = await searchParams;
  const j = Array.isArray(sp.jurisdiction) ? sp.jurisdiction[0] : sp.jurisdiction;
  const r = Array.isArray(sp.risk) ? sp.risk[0] : sp.risk;
  return <KycMatrixClient initialJurisdiction={j ?? "uk"} initialRisk={r ?? "all"} />;
}
