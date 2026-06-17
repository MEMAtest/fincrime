import type { Metadata } from "next";
import KycMatrixClient from "./KycMatrixClient";

export const metadata: Metadata = {
  title: "KYC / CDD Requirements Matrix",
  description:
    "Build a tailored view of applicable KYC and CDD requirements by entity type, jurisdiction and risk context. Every requirement is mapped to its primary-source regulatory reference. UK, US, EU, Germany, France, Singapore, Hong Kong and the FATF baseline.",
};

export default async function KycRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string | string[]; jurisdiction?: string | string[]; risk?: string | string[] }>;
}) {
  const sp = await searchParams;
  // Accept comma-separated lists or repeated params; normalise to a comma string.
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v.join(",") : v);
  return (
    <KycMatrixClient
      entity={pick(sp.entity) ?? "corporate"}
      jurisdiction={pick(sp.jurisdiction) ?? "uk"}
      risk={pick(sp.risk) ?? "medium"}
    />
  );
}
