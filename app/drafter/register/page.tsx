import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterRegisterListClient from "@/components/drafter/DrafterRegisterListClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterRegisterListPage() {
  await requireDrafterActorPage();
  return <DrafterRegisterListClient />;
}
