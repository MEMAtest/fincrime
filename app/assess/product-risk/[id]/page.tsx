import { splitCsv } from "@/lib/list-params";
import AssessmentJourneyClient from "./AssessmentJourneyClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ typologies?: string | string[] }>;
}

/**
 * Server component: Next 16 route params and searchParams are both Promises
 * here, and reading a query param (?typologies=) inside a "use client" page
 * under Suspense has prerendered empty in production elsewhere in this repo,
 * so both are awaited here and passed down as plain props instead.
 */
export default async function ProductRiskAssessmentPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const raw = Array.isArray(sp.typologies) ? sp.typologies.join(",") : sp.typologies;
  const preselectedTypologySlugs = splitCsv(raw);

  return <AssessmentJourneyClient assessmentId={id} preselectedTypologySlugs={preselectedTypologySlugs} />;
}
