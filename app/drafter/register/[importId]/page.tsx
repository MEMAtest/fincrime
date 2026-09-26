import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterRegisterDetailClient from "@/components/drafter/DrafterRegisterDetailClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ importId: string }>;
}

export default async function DrafterRegisterDetailPage({ params }: PageProps) {
  await requireDrafterActorPage();
  const { importId } = await params;
  return <DrafterRegisterDetailClient importId={importId} />;
}
