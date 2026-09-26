import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterReviewerClient from "@/components/drafter/DrafterReviewerClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterReviewerPage() {
  await requireDrafterActorPage();
  return <DrafterReviewerClient />;
}
