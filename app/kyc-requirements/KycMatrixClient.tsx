"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, ArrowRight, Scale, AlertTriangle, ShieldCheck, Info, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SourceBadge from "@/components/shared/SourceBadge";
import { listProfiles } from "@/data/kyc";
import type { Jurisdiction, RiskLevel, CddItem, EntityType } from "@/data/kyc/types";
import {
  JURISDICTION_ORDER,
  JURISDICTION_LABEL,
  JURISDICTION_REGULATOR,
  ENTITY_LABEL,
  SECTION_TITLE,
} from "@/data/kyc/types";

type RiskFilter = "all" | RiskLevel;

const RISK_FILTERS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "All risks" },
  { value: "low", label: "Lower" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Higher" },
];

const RISK_STYLE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-risk-high/10 text-risk-high",
  varies: "bg-white/10 text-text-muted",
};

const RISK_TAG: Record<string, string> = { low: "Lower risk", medium: "Medium risk", high: "Higher risk", varies: "Risk varies" };

function visible(item: CddItem, risk: RiskFilter): boolean {
  return risk === "all" || item.appliesAtRisk.includes(risk);
}

export default function KycMatrixClient({
  initialJurisdiction,
  initialRisk,
}: {
  initialJurisdiction: string;
  initialRisk: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const jurisdiction: Jurisdiction = (JURISDICTION_ORDER as string[]).includes(initialJurisdiction)
    ? (initialJurisdiction as Jurisdiction)
    : "uk";
  const risk: RiskFilter = (["all", "low", "medium", "high"] as string[]).includes(initialRisk)
    ? (initialRisk as RiskFilter)
    : "all";

  const navigate = (next: { jurisdiction: Jurisdiction; risk: RiskFilter }) => {
    const params = new URLSearchParams();
    if (next.jurisdiction !== "uk") params.set("jurisdiction", next.jurisdiction);
    if (next.risk !== "all") params.set("risk", next.risk);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [expanded, setExpanded] = useState<Set<EntityType>>(new Set());
  const toggle = (e: EntityType) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(e)) n.delete(e);
      else n.add(e);
      return n;
    });

  const profiles = listProfiles(jurisdiction);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              KYC / CDD Requirements <span className="gradient-text">Matrix</span>
            </h1>
            <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
              By entity type and jurisdiction: the CDD information you must collect, what the rules say,
              and the EDD triggers. Every requirement is mapped to its primary-source regulatory reference.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/kyc-requirements/picker"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Guided picker
              </Link>
            </div>
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Jurisdiction filter */}
            <div role="group" aria-label="Jurisdiction" className="flex flex-wrap gap-2 mb-4 justify-center">
              {JURISDICTION_ORDER.map((j) => (
                <button
                  key={j}
                  onClick={() => navigate({ jurisdiction: j, risk })}
                  aria-pressed={jurisdiction === j}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    jurisdiction === j
                      ? "bg-accent text-white"
                      : "bg-white/5 text-text-muted hover:bg-white/10 border border-surface-border"
                  }`}
                >
                  {JURISDICTION_LABEL[j]}
                </button>
              ))}
            </div>

            {/* Risk filter */}
            <div role="group" aria-label="Risk level" className="flex flex-wrap gap-2 mb-6 justify-center">
              {RISK_FILTERS.map((rf) => (
                <button
                  key={rf.value}
                  onClick={() => navigate({ jurisdiction, risk: rf.value })}
                  aria-pressed={risk === rf.value}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    risk === rf.value
                      ? "bg-foreground text-background"
                      : "bg-white/5 text-text-muted hover:bg-white/10 border border-surface-border"
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            {/* Context banner */}
            <div className="glass-card rounded-xl px-5 py-4 mb-8 flex flex-wrap items-center gap-3">
              <Info className="h-5 w-5 text-accent shrink-0" />
              <p className="text-sm text-text-muted">
                Showing <span className="font-semibold text-foreground">{JURISDICTION_LABEL[jurisdiction]}</span>{" "}
                ({JURISDICTION_REGULATOR[jurisdiction]}). Reference summary only, not legal advice; always verify
                against the cited primary source.
              </p>
            </div>

            {/* Entity-type accordions */}
            <div className="space-y-4">
              {profiles.map(({ profile, fallback }) => {
                const e = profile.entityType;
                const isOpen = expanded.has(e);
                const sections = profile.sections
                  .map((s) => ({ ...s, items: s.items.filter((i) => visible(i, risk)) }))
                  .filter((s) => s.items.length > 0);

                return (
                  <div key={e} className="glass-card rounded-2xl overflow-hidden">
                    <button
                      onClick={() => toggle(e)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-base font-semibold text-foreground">{ENTITY_LABEL[e]}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${RISK_STYLE[profile.inherentRisk]}`}>
                          {RISK_TAG[profile.inherentRisk]}
                        </span>
                        <span className="text-xs text-text-muted">{profile.regulatoryBasis.map((s) => s.reference).join(" · ")}</span>
                        {profile.status === "incoming" && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Incoming</span>
                        )}
                        {fallback && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted font-medium">
                            FATF baseline
                          </span>
                        )}
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-text-muted shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 space-y-6">
                        {/* Key facts */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-surface-border p-3">
                            <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                              <Scale className="h-3.5 w-3.5 text-accent" /> Beneficial ownership
                            </p>
                            <p className="text-sm text-text-muted">{profile.boThreshold}</p>
                          </div>
                          <div className="rounded-xl border border-surface-border p-3">
                            <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Simplified DD
                            </p>
                            <p className="text-sm text-text-muted">{profile.sddEligibility}</p>
                          </div>
                        </div>
                        {profile.exemptionNote && (
                          <p className="text-sm text-text-muted rounded-xl bg-accent/5 border border-accent/20 p-3">
                            {profile.exemptionNote}
                          </p>
                        )}

                        {/* Requirement sections */}
                        {sections.map((s) => (
                          <div key={s.key}>
                            <h3 className="text-sm font-semibold text-foreground mb-2">{SECTION_TITLE[s.key]}</h3>
                            <ul className="space-y-2">
                              {s.items.map((item, i) => (
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
                          </div>
                        ))}

                        {/* EDD triggers */}
                        {profile.eddTriggers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 text-risk-high" /> Enhanced due diligence triggers
                            </h3>
                            <ul className="space-y-2">
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
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Link
                            href={`/kyc-requirements/results?entity=${e}&jurisdiction=${jurisdiction}${risk !== "all" ? `&risk=${risk}` : ""}`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
                          >
                            Open full view + export
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
