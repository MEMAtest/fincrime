import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterHomeClient from "@/components/drafter/DrafterHomeClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Private module home. See docs/pra-drafter/BUILD-DECISIONS.md "Private" - 404s for anyone not allowlisted. */
export default async function DrafterHomePage() {
  await requireDrafterActorPage();
  return <DrafterHomeClient />;
}
