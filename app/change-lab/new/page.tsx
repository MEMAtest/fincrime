import NewChangeClient from "./NewChangeClient";

interface PageProps {
  searchParams: Promise<{ controlId?: string | string[] }>;
}

/**
 * Server component so the ?controlId= deep link (carried from the PRA
 * control-mapping step's "Propose a change" bridge) is read at request time
 * rather than inside a "use client" + useSearchParams()-under-Suspense
 * boundary, which has prerendered empty in production elsewhere in this
 * repo (see app/assess/product-risk/new/page.tsx for the same pattern).
 */
export default async function NewControlChangePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.controlId) ? params.controlId[0] : params.controlId;
  const preselectedControlId = typeof raw === "string" && raw.trim() ? raw.trim() : null;

  return <NewChangeClient preselectedControlId={preselectedControlId} />;
}
