"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Shield,
  Search,
  GitBranch,
  ArrowRight,
  BookOpen,
  Users,
  Sparkles,
  Library,
  Network,
  ShieldCheck,
  ScanSearch,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FinCrimeLogo from "@/components/brand/FinCrimeLogo";
import { DeferredRender } from "@/components/performance/DeferredRender";

// Client-only overlay (framer-motion); avoids SSR/hydration of animated state
const DetectionCoverageCard = dynamic(
  () => import("@/components/visuals/DetectionCoverageCard"),
  { ssr: false }
);

// Heavy WebGL scenes — client-only, lazily mounted
const ControlEcosystem3D = dynamic(
  () => import("@/components/visuals/ControlEcosystem3D"),
  { ssr: false }
);
const RiskGauge3D = dynamic(() => import("@/components/visuals/RiskGauge3D"), {
  ssr: false,
});
const PartnerFlow3D = dynamic(
  () => import("@/components/visuals/PartnerFlow3D"),
  { ssr: false }
);
const ControlsPack3D = dynamic(
  () => import("@/components/visuals/ControlsPack3D"),
  { ssr: false }
);

const HERO_BULLETS = [
  { icon: ScanSearch, text: "AML typology → detection control mapping" },
  { icon: ShieldCheck, text: "Partner payment-flow control ownership" },
  { icon: Network, text: "FATF, Wolfsberg & FCA-aligned frameworks" },
];

const StagePanelFallback = () => (
  <div
    aria-hidden="true"
    className="stage-panel rounded-3xl w-full h-full grid place-items-center"
  >
    <div className="logo-pulse">
      <FinCrimeLogo variant="icon" size="lg" animated={false} />
    </div>
  </div>
);

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-20 sm:pb-28">
          {/* Ambient glow orbs */}
          <div className="glow-blob top-[-6rem] right-[10%] w-96 h-96 bg-emerald-500/15" />
          <div className="glow-blob bottom-[-4rem] left-[5%] w-80 h-80 bg-blue-500/10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: copy */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    Free FinCrime Design Tools
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                  Design financial crime controls{" "}
                  <span className="gradient-text">with confidence</span>
                </h1>

                <p className="mt-6 text-lg text-text-muted max-w-xl">
                  Map AML typologies to detection controls, define partner
                  control ownership, and browse a controls library mapped to
                  real enforcement actions — built on authoritative frameworks.
                </p>

                <div className="mt-8 space-y-4">
                  {HERO_BULLETS.map((b) => (
                    <div key={b.text} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <b.icon className="h-5 w-5 text-emerald-400" />
                      </div>
                      <span className="text-foreground font-medium">
                        {b.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/firm-research"
                    className="btn-brand inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-base font-semibold"
                  >
                    Start free <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/controls"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-base font-semibold border border-surface-border bg-surface hover:bg-surface-hover text-foreground transition-colors"
                  >
                    <Library className="h-5 w-5" />
                    Explore controls
                  </Link>
                </div>
              </div>

              {/* Right: 3D ecosystem */}
              <div className="relative h-[420px] sm:h-[520px]">
                <DeferredRender
                  mode="idle"
                  idleTimeoutMs={1400}
                  className="absolute inset-0"
                  fallback={<StagePanelFallback />}
                >
                  <div
                    aria-hidden="true"
                    className="stage-panel rounded-3xl w-full h-full"
                  >
                    <ControlEcosystem3D />
                  </div>
                </DeferredRender>
                <DetectionCoverageCard />
              </div>
            </div>
          </div>
        </section>

        {/* Feature sections with prominent 3D */}
        <section className="pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 sm:space-y-32">
            {/* TypologyIQ → RiskGauge */}
            <FeatureRow
              pill="Typology → control mapping"
              pillClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              icon={Search}
              title="TypologyIQ"
              description="Select your firm type, product, and risk profile to receive a tailored control framework — detection logic, data requirements, investigation workflows, and governance checklists, scored deterministically."
              bullets={[
                "10 AML typologies, FATF-sourced",
                "Weighted risk-theme scoring",
                "6-card control output",
              ]}
              ctaHref="/typology-iq"
              ctaLabel="Start assessment"
              visual={<RiskGauge3D />}
            />

            {/* PartnerControlMap → PartnerFlow */}
            <FeatureRow
              reverse
              pill="Partner oversight"
              pillClass="bg-blue-500/15 text-blue-400 border border-blue-500/30"
              icon={GitBranch}
              title="PartnerControlMap"
              description="Define partner payment flows to generate a RACI matrix, identify control gaps, map data dependencies, and produce pre-launch conditions and governance packs aligned to Wolfsberg standards."
              bullets={[
                "5 partner flow types",
                "RACI + control-gap analysis",
                "Pre-launch governance pack",
              ]}
              ctaHref="/partner-control-map"
              ctaLabel="Map a partner flow"
              visual={<PartnerFlow3D />}
            />

            {/* Controls Library → ControlsPack */}
            <FeatureRow
              pill="Enforcement-mapped library"
              pillClass="bg-amber-500/15 text-amber-400 border border-amber-500/30"
              icon={Library}
              title="Controls Reference Library"
              description="Browse the FinCrime controls your firm needs — grouped by risk theme, filtered by firm type, and mapped to real FCA enforcement actions so you can see exactly which controls would have prevented them."
              bullets={[
                "Grouped by risk theme",
                "Filtered by firm type",
                "Mapped to real enforcement actions",
              ]}
              ctaHref="/controls"
              ctaLabel="Explore controls"
              visual={<ControlsPack3D />}
            />
          </div>
        </section>

        {/* Firm Research quick-start card */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/firm-research" className="group block">
              <div className="glass-card rounded-2xl p-8 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Not sure where to start? Profile a firm.
                    </h3>
                    <p className="text-text-muted text-sm leading-relaxed">
                      Enter a firm name or a few details about the business model
                      and we&apos;ll suggest the most likely financial crime risk
                      themes — then route you into TypologyIQ with answers
                      pre-filled.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium group-hover:gap-3 transition-all shrink-0">
                    <span>Profile a firm</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Framework attribution */}
            <div className="mt-16 text-center">
              <p className="text-xs text-text-muted mb-4 uppercase tracking-wider">
                Built on authoritative frameworks
              </p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-text-muted">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">FATF Recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Wolfsberg Standards</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">FCA Guidance</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function FeatureRow({
  reverse = false,
  pill,
  pillClass,
  icon: Icon,
  title,
  description,
  bullets,
  ctaHref,
  ctaLabel,
  visual,
}: {
  reverse?: boolean;
  pill: string;
  pillClass: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  bullets: string[];
  ctaHref: string;
  ctaLabel: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* Copy */}
      <div className={reverse ? "lg:order-2" : ""}>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-4 ${pillClass}`}
        >
          {pill}
        </span>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Icon className="h-5 w-5 text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            {title}
          </h2>
        </div>
        <p className="text-text-muted leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3 mb-8">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="text-sm">{b}</span>
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className="btn-brand inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 3D visual */}
      <div className={reverse ? "lg:order-1" : ""}>
        <DeferredRender
          mode="visible"
          rootMargin="300px"
          className="block h-[340px] sm:h-[420px]"
          fallback={<StagePanelFallback />}
        >
          <div
            aria-hidden="true"
            className="stage-panel rounded-3xl w-full h-full"
          >
            {visual}
          </div>
        </DeferredRender>
      </div>
    </div>
  );
}
