import type { Metadata } from "next";
import KycResultsClient from "./KycResultsClient";

export const metadata: Metadata = {
  title: "KYC / CDD Requirements",
};

export default async function KycResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string | string[]; jurisdiction?: string | string[]; risk?: string | string[] }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  return (
    <KycResultsClient
      entity={pick(sp.entity) ?? ""}
      jurisdiction={pick(sp.jurisdiction) ?? "uk"}
      risk={pick(sp.risk) ?? "all"}
    />
  );
}
