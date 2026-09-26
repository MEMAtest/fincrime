import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterLibraryClient from "@/components/drafter/DrafterLibraryClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterLibraryPage() {
  await requireDrafterActorPage();
  return <DrafterLibraryClient />;
}
