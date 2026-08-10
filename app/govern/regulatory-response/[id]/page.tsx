import RegResponseJourneyClient from "./RegResponseJourneyClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ incidentId?: string | string[] }>;
}

function firstString(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Server component so the dynamic [id] segment and the ?incidentId= bridge
 * param (carried from the "log a request" form after the incident closure
 * bridge - see components/incidents/StepClosure.tsx) are both read at
 * request time, per the Next 16 pattern used across this repo, then handed
 * to the client journey shell as plain props.
 */
export default async function RegResponseDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;
  return <RegResponseJourneyClient requestId={id} bridgedIncidentId={firstString(search.incidentId)} />;
}
