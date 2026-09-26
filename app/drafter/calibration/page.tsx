import type { Metadata } from "next";
import { requireDrafterActorPage } from "@/lib/drafter/access";
import DrafterCalibrationClient from "@/components/drafter/DrafterCalibrationClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DrafterCalibrationPage() {
  await requireDrafterActorPage();
  return <DrafterCalibrationClient />;
}
