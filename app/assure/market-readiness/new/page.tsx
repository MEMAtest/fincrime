import NewReadinessClient from "./NewReadinessClient";

interface PageProps {
  searchParams: Promise<{
    productId?: string | string[];
    entityType?: string | string[];
    jurisdiction?: string | string[];
  }>;
}

function firstString(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Server component so the ?productId=/?entityType=/?jurisdiction= deep links
 * (carried from a PRA product and from the KYC Matrix "Turn this into a
 * readiness assessment" bridge respectively) are read at request time rather
 * than inside a "use client" + useSearchParams()-under-Suspense boundary,
 * which has prerendered empty in production elsewhere in this repo (see
 * app/assure/incidents/new/page.tsx for the same pattern).
 */
export default async function NewReadinessPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <NewReadinessClient
      preselectedProductId={firstString(params.productId)}
      preselectedEntityType={firstString(params.entityType)}
      preselectedJurisdiction={firstString(params.jurisdiction)}
    />
  );
}
