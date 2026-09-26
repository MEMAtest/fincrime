import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterPraDraftClient from "@/components/drafter/DrafterPraDraftClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DrafterPraPage({ params }: PageProps) {
  await requireDrafterActorPage();
  const { id } = await params;
  return <DrafterPraDraftClient praId={id} />;
}
