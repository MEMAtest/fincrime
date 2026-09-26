import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterSettingsClient from "@/components/drafter/DrafterSettingsClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterSettingsPage() {
  await requireDrafterActorPage();
  return <DrafterSettingsClient />;
}
