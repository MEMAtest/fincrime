import NewRegResponseClient from "./NewRegResponseClient";

interface PageProps {
  searchParams: Promise<{ incidentId?: string | string[] }>;
}

function firstString(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Server component so the ?incidentId= deep link (carried from a reportable
 * incident's closure step - see components/incidents/StepClosure.tsx) is
 * read at request time rather than inside a "use client" +
 * useSearchParams()-under-Suspense boundary, which has prerendered empty in
 * production elsewhere in this repo (see app/assure/incidents/new/page.tsx
 * for the same pattern). The incident id is carried through creation and
 * offered as a one-click substantiation link on the first question in step 4
 * of the journey (there is no question to link it to before one exists).
 */
export default async function NewRegResponsePage({ searchParams }: PageProps) {
  const params = await searchParams;

  return <NewRegResponseClient preselectedIncidentId={firstString(params.incidentId)} />;
}
