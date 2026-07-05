import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2, ScanSearch, Wrench, ShieldCheck, ArrowRight, Landmark, Briefcase,
  Rocket, GraduationCap, type LucideIcon,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { STAGES, PERSONAS } from "@/data/workflow";

export const metadata: Metadata = {
  title: "Start here: design and defend your financial crime programme",
  description:
    "One workflow, four stages: profile your firm, see your risks and real enforcement, build your controls, then govern and export a committee-ready pack. Pick the path that fits you.",
};

const TOOL_LABEL: Record<string, string> = {
  "/firm-research": "AI in Research",
  "/firm-profiles": "Firm Profiles",
  "/typology-iq": "TypologyIQ",
  "/enforcement": "Enforcement",
  "/control-builder": "Control Builder",
  "/controls": "Controls Library",
  "/screening-control-designer": "Screening Designer",
  "/kyc-requirements": "KYC Matrix",
  "/partner-control-map": "PartnerControlMap",
  "/controls-maturity": "Controls Maturity",
};

const STAGE_ICON: Record<string, LucideIcon> = {
  profile: Building2,
  risks: ScanSearch,
  build: Wrench,
  govern: ShieldCheck,
};

const PERSONA_ICON: Record<string, LucideIcon> = {
  mlro: Landmark,
  consultant: Briefcase,
  fintech: Rocket,
  interview: GraduationCap,
};

export default function StartPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Intro */}
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-wider text-accent font-medium mb-2">Start here</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-text mb-3">
            Design and defend your financial crime programme
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto leading-relaxed">
            One workflow, four stages. Profile your firm, see the risks and real enforcement that apply, build
            your controls, then govern and export a committee-ready pack. Everything is free, deterministic and
            cited. Your assessment work stays in your browser; we only store the contact details you give us
            when you request an export.
          </p>
        </div>

        {/* The 4-stage journey */}
        <section className="mb-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s) => {
              const Icon = STAGE_ICON[s.id];
              return (
                <div key={s.id} className="glass-card rounded-2xl p-5 flex flex-col h-full">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">Stage {s.n}</span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{s.label}</h2>
                  <p className="text-xs text-text-muted leading-relaxed mt-1 flex-1">{s.blurb}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.routes.map((r) => (
                      <Link
                        key={r}
                        href={r}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-surface-border bg-white/[0.03] text-text-muted hover:text-accent hover:border-accent/40 transition-colors"
                      >
                        {TOOL_LABEL[r] ?? r}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Persona presets */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Pick the path that fits you</h2>
            <p className="text-text-muted text-sm mt-1">Each route runs through the same four stages, framed for how you work.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const Icon = PERSONA_ICON[p.id];
              const stages = p.pathStageIds
                .map((id) => STAGES.find((s) => s.id === id))
                .filter((s): s is (typeof STAGES)[number] => Boolean(s));
              return (
                <div key={p.id} className="glass-card rounded-2xl p-6 flex flex-col h-full">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-semibold text-foreground leading-tight pt-1">{p.label}</h3>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed flex-1">{p.blurb}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {stages.map((s, i) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{s.short}</span>
                        {i < stages.length - 1 && <ArrowRight className="h-3 w-3 text-text-muted" />}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    <Link
                      href={p.entryHref}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
                    >
                      {p.ctaLabel} <ArrowRight className="h-4 w-4" />
                    </Link>
                    {p.memaAngle && (
                      <a
                        href="https://memaconsultants.com"
                        className="text-xs text-text-muted hover:text-accent transition-colors"
                      >
                        Or have MEMA do it
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-12 text-center text-xs text-text-muted">
          Prefer to browse? See the{" "}
          <Link href="/" className="text-accent hover:underline">full toolkit</Link> or jump straight to{" "}
          <Link href="/enforcement" className="text-accent hover:underline">real enforcement cases</Link>.
        </p>
      </main>
      <Footer />
    </>
  );
}
