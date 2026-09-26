import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterPrasListClient from "@/components/drafter/DrafterPrasListClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterPrasPage() {
  await requireDrafterActorPage();
  return <DrafterPrasListClient />;
}
