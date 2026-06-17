"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList, Scale, AlertTriangle, BookOpen, Search } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SourceBadge from "@/components/shared/SourceBadge";
import ResultTabs from "@/components/results/ResultTabs";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { getCddProfile } from "@/data/kyc";
import type { CddItem, EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import {
  ENTITY_LABEL,
  JURISDICTION_LABEL,
  JURISDICTION_REGULATOR,
  SECTION_TITLE,
  ENTITY_ORDER,
  JURISDICTION_ORDER,
} from "@/data/kyc/types";

type RiskFilter = "all" | RiskLevel;
const RISK_STYLE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-risk-high/10 text-risk-high",
  varies: "bg-white/10 text-text-muted",
};

function ItemList({ items }: { items: CddItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-text-muted border-l-2 border-accent/30 pl-3">
          <span>
            {item.text}
            {item.threshold ? <span className="text-foreground"> ({item.threshold})</span> : null}
            {item.conditional ? <span className="italic text-text-muted/80"> {item.conditional}</span> : null}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {item.sources.map((src, j) => (
              <SourceBadge key={j} source={src.org} reference={src.reference} url={src.url} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function KycResultsClient({
  entity,
  jurisdiction,
  risk,
}: {
  entity: string;
  jurisdiction: string;
  risk: string;
}) {
  const validEntity = (ENTITY_ORDER as string[]).includes(entity) ? (entity as EntityType) : null;
  const validJurisdiction: Jurisdiction = (JURISDICTION_ORDER as string[]).includes(jurisdiction)
    ? (jurisdiction as Jurisdiction)
    : "uk";
  const riskFilter: RiskFilter = (["all", "low", "medium", "high"] as string[]).includes(risk)
    ? (risk as RiskFilter)
    : "all";

  const lookup = validEntity ? getCddProfile(validEntity, validJurisdiction) : null;

  if (!validEntity || !lookup) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-24 text-center">
            <h1 className="text-2xl font-bold mb-3">Requirement set not found</h1>
            <p className="text-text-muted mb-6">That entity type / jurisdiction combination is not yet in the matrix.</p>
            <Link href="/kyc-requirements" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm">
              Back to the matrix
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const { profile, fallback } = lookup;
  const show = (item: CddItem) => riskFilter === "all" || item.appliesAtRisk.includes(riskFilter);
  const sections = profile.sections
    .map((s) => ({ ...s, items: s.items.filter(show) }))
    .filter((s) => s.items.length > 0);
  const boSection = sections.find((s) => s.key === "beneficial_ownership");
  const screeningSection = sections.find((s) => s.key === "screening");
  const otherSections = sections.filter((s) => s.key !== "beneficial_ownership");

  // Unique sources across the profile for the "Rules & Sources" tab.
  const allSources = [
    ...profile.regulatoryBasis,
    ...profile.sections.flatMap((s) => s.items.flatMap((i) => i.sources)),
    ...profile.eddTriggers.flatMap((t) => t.sources),
  ];
  const uniqueSources = Array.from(new Map(allSources.map((s) => [`${s.org}|${s.reference}`, s])).values());

  const tabs = [
    {
      id: "cdd",
      label: "CDD Requirements",
      icon: ClipboardList,
      content: (
        <div className="space-y-6">
          {otherSections.map((s) => (
            <div key={s.key}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{SECTION_TITLE[s.key]}</h3>
              <ItemList items={s.items} />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "bo",
      label: "Beneficial Ownership",
      icon: Scale,
      content: (
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-border p-4">
            <p className="text-xs font-medium text-foreground mb-1">Threshold</p>
            <p className="text-sm text-text-muted">{profile.boThreshold}</p>
          </div>
          {profile.exemptionNote && (
            <p className="text-sm text-text-muted rounded-xl bg-accent/5 border border-accent/20 p-3">{profile.exemptionNote}</p>
          )}
          {boSection ? <ItemList items={boSection.items} /> : <p className="text-sm text-text-muted">No additional beneficial-ownership items at this risk level.</p>}
        </div>
      ),
    },
    {
      id: "screening",
      label: "Screening",
      icon: Search,
      content: screeningSection ? <ItemList items={screeningSection.items} /> : <p className="text-sm text-text-muted">Standard sanctions, PEP and adverse-media screening.</p>,
    },
    {
      id: "edd",
      label: "EDD Triggers",
      icon: AlertTriangle,
      content: (
        <ul className="space-y-3">
          {profile.eddTriggers.map((t, i) => (
            <li key={i} className="text-sm text-text-muted border-l-2 border-risk-high/30 pl-3">
              <span className="text-foreground font-medium">{t.trigger}:</span> {t.action}
              <span className="mt-1 flex flex-wrap gap-1.5">
                {t.sources.map((src, j) => (
                  <SourceBadge key={j} source={src.org} reference={src.reference} url={src.url} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "sources",
      label: "Rules & Sources",
      icon: BookOpen,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">Overarching basis: {profile.regulatoryBasis.map((s) => s.title).join("; ")}.</p>
          <div className="flex flex-wrap gap-2">
            {uniqueSources.map((src, i) => (
              <SourceBadge key={i} source={src.org} reference={src.reference} url={src.url} />
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <Link href="/kyc-requirements" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to matrix
            </Link>
            <PDFExportButton module="kyc_requirements" assessmentData={{ entity: validEntity, jurisdiction: validJurisdiction, risk: riskFilter }} />
          </div>

          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-text-muted mb-1">
              {JURISDICTION_LABEL[validJurisdiction]} · {JURISDICTION_REGULATOR[validJurisdiction]}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{ENTITY_LABEL[validEntity]}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_STYLE[profile.inherentRisk]}`}>
                {profile.inherentRisk === "varies" ? "Risk varies" : `${profile.inherentRisk[0].toUpperCase()}${profile.inherentRisk.slice(1)} inherent risk`}
              </span>
              {profile.status === "incoming" && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Incoming</span>}
              {fallback && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-text-muted font-medium">FATF baseline shown</span>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            <div className="rounded-xl border border-surface-border p-4">
              <p className="text-xs font-medium text-foreground mb-1">Beneficial ownership</p>
              <p className="text-sm text-text-muted">{profile.boThreshold}</p>
            </div>
            <div className="rounded-xl border border-surface-border p-4">
              <p className="text-xs font-medium text-foreground mb-1">Simplified due diligence</p>
              <p className="text-sm text-text-muted">{profile.sddEligibility}</p>
            </div>
          </div>

          <ResultTabs tabs={tabs} />

          <p className="mt-10 text-xs text-text-muted border-t border-surface-border pt-4">
            Reference summary only, not legal advice. Always verify against the cited primary source. Citations reflect the
            position captured in our jurisdiction research; incoming changes (e.g. EU AMLR from 2027) are tagged.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
