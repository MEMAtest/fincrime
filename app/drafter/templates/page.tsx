import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterTemplatesClient from "@/components/drafter/DrafterTemplatesClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterTemplatesPage() {
  await requireDrafterActorPage();
  return <DrafterTemplatesClient />;
}
