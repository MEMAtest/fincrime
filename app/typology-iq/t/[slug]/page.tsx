import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { allTypologies, getTypologyBySlug } from "@/data/typologies";
import TypologyDetailClient from "./TypologyDetailClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return allTypologies.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getTypologyBySlug(slug);
  if (!t) return { title: "Typology not found" };
  return {
    title: `${t.title}: AML typology, red flags and controls`,
    description: t.description.slice(0, 160),
  };
}

export default async function TypologyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const typology = getTypologyBySlug(slug);
  if (!typology) notFound();
  return (
    <>
      <Header />
      <main className="flex-1">
        <TypologyDetailClient typology={typology} />
      </main>
      <Footer />
    </>
  );
}
