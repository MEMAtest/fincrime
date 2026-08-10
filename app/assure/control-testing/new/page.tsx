import NewTestClient from "./NewTestClient";

interface PageProps {
  searchParams: Promise<{ controlId?: string | string[] }>;
}

/**
 * Server component so the ?controlId= deep link (carried from the Change Lab's
 * "Test this control" bridge, and usable directly from anywhere else) is read
 * at request time rather than inside a "use client" + useSearchParams()-under-
 * Suspense boundary, which has prerendered empty in production elsewhere in
 * this repo (see app/change-lab/new/page.tsx for the same pattern).
 */
export default async function NewControlTestPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.controlId) ? params.controlId[0] : params.controlId;
  const preselectedControlId = typeof raw === "string" && raw.trim() ? raw.trim() : null;

  return <NewTestClient preselectedControlId={preselectedControlId} />;
}
