import { redirect } from "next/navigation";

// The rich single-scenario Matrix now lives at /kyc-requirements. Keep old
// /results links working by redirecting with the same selection.
export default async function KycResultsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string | string[]; jurisdiction?: string | string[]; risk?: string | string[] }>;
}) {
  const sp = await searchParams;
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const params = new URLSearchParams();
  if (pick(sp.entity)) params.set("entity", pick(sp.entity)!);
  if (pick(sp.jurisdiction)) params.set("jurisdiction", pick(sp.jurisdiction)!);
  if (pick(sp.risk)) params.set("risk", pick(sp.risk)!);
  const qs = params.toString();
  redirect(qs ? `/kyc-requirements?${qs}` : "/kyc-requirements");
}
