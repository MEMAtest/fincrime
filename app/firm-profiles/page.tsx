import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FirmProfileClient from "./FirmProfileClient";
import { FIRM_TYPE_ORDER } from "@/data/firm-profiles";
import type { FirmType } from "@/data/typologies/types";

export const metadata: Metadata = {
  title: "Firm Profiles: financial crime risk by business model",
  description:
    "See how each financial firm archetype (neobank, EMI, payment institution, bank, MSB, crypto, wealth manager, insurer) generates financial crime risk: its services, ranked inherent risks, applicable AML typologies and real FCA enforcement.",
};

export default async function FirmProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const initialType: FirmType = (FIRM_TYPE_ORDER as string[]).includes(raw ?? "")
    ? (raw as FirmType)
    : FIRM_TYPE_ORDER[0];

  return (
    <>
      <Header />
      <main className="flex-1">
        <FirmProfileClient initialType={initialType} />
      </main>
      <Footer />
    </>
  );
}
