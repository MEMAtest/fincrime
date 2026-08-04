import { splitCsv } from "@/lib/list-params";
import NewAssessmentClient from "./NewAssessmentClient";

interface PageProps {
  searchParams: Promise<{ typologies?: string | string[] }>;
}

/**
 * Server component so the ?typologies= deep link (carried from TypologyIQ,
 * per the bridge in the plan) is read at request time rather than inside a
 * "use client" + useSearchParams()-under-Suspense boundary, which has
 * prerendered empty in production elsewhere in this repo.
 */
export default async function NewProductRiskAssessmentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.typologies) ? params.typologies.join(",") : params.typologies;
  const typologySlugs = splitCsv(raw);

  return <NewAssessmentClient typologySlugs={typologySlugs} />;
}
