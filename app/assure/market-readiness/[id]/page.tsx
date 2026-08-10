import ReadinessJourneyClient from "./ReadinessJourneyClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Server component so the dynamic [id] segment is awaited per the Next 16 pattern used across this repo, then handed to the client journey shell as a plain prop. */
export default async function ReadinessDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ReadinessJourneyClient assessmentId={id} />;
}
