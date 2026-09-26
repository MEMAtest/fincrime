import type { Metadata } from "next";
import DrafterUnlockClient from "@/components/drafter/DrafterUnlockClient";

export const metadata: Metadata = { title: "Access", robots: { index: false, follow: false } };

/** The only drafter page reachable without the access cookie: it asks for the access key. */
export default function DrafterUnlockPage() {
  return <DrafterUnlockClient />;
}
