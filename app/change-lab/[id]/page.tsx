import ChangeJourneyClient from "./ChangeJourneyClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Server component so the dynamic [id] segment is awaited per the Next 16 pattern used across this repo, then handed to the client journey shell as a plain prop. */
export default async function ControlChangeDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ChangeJourneyClient changeId={id} />;
}
