import type { MetadataRoute } from "next";
import { allTypologies } from "@/data/typologies";
import { enforcementCaseSlugs } from "@/lib/enforcement/case-slug";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://fincrime.memaconsultants.com";
  const now = new Date();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  });

  const typologyPages = allTypologies.map((t) => page(`/typology-iq/t/${t.slug}`, 0.7));
  const enforcementPages = enforcementCaseSlugs.map((slug) => page(`/enforcement/${slug}`, 0.7));

  return [
    page("", 1),
    page("/control-builder", 0.9),
    page("/enforcement", 0.9),
    page("/typology-iq", 0.9),
    page("/typology-iq/list", 0.8),
    page("/firm-profiles", 0.9),
    page("/partner-control-map", 0.9),
    page("/controls", 0.9),
    page("/kyc-requirements", 0.9),
    page("/screening-control-designer", 0.8),
    page("/controls-maturity", 0.8),
    page("/firm-research", 0.8),
    page("/glossary", 0.7),
    page("/methodology", 0.7),
    ...typologyPages,
    ...enforcementPages,
  ];
}
