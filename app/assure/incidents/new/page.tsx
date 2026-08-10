import NewIncidentClient from "./NewIncidentClient";

interface PageProps {
  searchParams: Promise<{
    controlId?: string | string[];
    testId?: string | string[];
    changeId?: string | string[];
    enforcementRef?: string | string[];
  }>;
}

function firstString(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Server component so the ?controlId=/?testId=/?changeId=/?enforcementRef=
 * deep links (carried from the failed-control bridge, the failed-test
 * bridge, a change-lab bridge, and the enforcement case bridge respectively)
 * are read at request time rather than inside a "use client" +
 * useSearchParams()-under-Suspense boundary, which has prerendered empty in
 * production elsewhere in this repo (see app/assure/control-testing/new/page.tsx
 * for the same pattern). After creation, the client creates the
 * corresponding incident_links row for whichever param was supplied.
 */
export default async function NewIncidentPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <NewIncidentClient
      preselectedControlId={firstString(params.controlId)}
      preselectedTestId={firstString(params.testId)}
      preselectedChangeId={firstString(params.changeId)}
      preselectedEnforcementRef={firstString(params.enforcementRef)}
    />
  );
}
