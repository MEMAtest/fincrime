import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterDocumentsClient from "@/components/drafter/DrafterDocumentsClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterDocumentsPage() {
  await requireDrafterActorPage();
  return <DrafterDocumentsClient />;
}
