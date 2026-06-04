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
  Workflow,
  Database,
  FileWarning,
  ClipboardCheck,
  Boxes,
  BadgeCheck,
  Lock,
  Scale,
  MessageSquare,
  Gauge,
  ShieldOff,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FinCrimeLogo from "@/components/brand/FinCrimeLogo";
import { DeferredRender } from "@/components/performance/DeferredRender";
import { StageMetric, StageList } from "@/components/visuals/StageOverlay";
import { allTypologies } from "@/data/typologies";
import { allPartnerFlows } from "@/data/partner-flows";

const TYPOLOGY_COUNT = allTypologies.length;
const FLOW_COUNT = allPartnerFlows.length;
const RISK_THEME_COUNT = 7; // RiskTheme union
const FRAMEWORK_COUNT = 4; // FATF · Wolfsberg · FCA · JMLSG

// Heavy WebGL scenes — client-only, lazily mounted
const ControlEcosystem3D = dynamic(
  () => import("@/components/visuals/ControlEcosystem3D"),
  { ssr: false }
);
const TypologyWeb3D = dynamic(
  () => import("@/components/visuals/TypologyWeb3D"),
  { ssr: false }
);
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

const FEATURE_TILES = [
  {
    icon: ScanSearch,
    title: "Typology mapping",
    text: `Match ${TYPOLOGY_COUNT} FATF & Wolfsberg-sourced typologies to your firm, product and risk profile.`,
  },
  {
    icon: Workflow,
    title: "Detection logic",
    text: "Rules, thresholds and scenarios — with the data each one needs to actually fire.",
  },
  {
    icon: Database,
    title: "Data requirements",
    text: "Know exactly which data each control depends on before you start building.",
  },
  {
    icon: Boxes,
    title: "Control ownership",
    text: "A RACI across you and your partners, with control gaps flagged automatically.",
  },
  {
    icon: FileWarning,
    title: "Enforcement-mapped",
    text: "Every control linked to the real FCA cases it would have prevented.",
  },
  {
    icon: ClipboardCheck,
    title: "Governance packs",
    text: "Pre-launch conditions, checklists and committee-ready output you can export.",
  },
];

const USE_CASES = [
  "EMIs",
  "Payment Institutions",
  "Banks",
  "MSBs",
  "Crypto / VASPs",
  "Neobanks",
  "Wealth Managers",
  "Insurance",
];

const TRUST_POINTS = [
  { icon: Scale, text: "Deterministic scoring" },
  { icon: Lock, text: "No black-box AI decisions" },
  { icon: BadgeCheck, text: "Source-cited: FATF · Wolfsberg · FCA · JMLSG" },
];

const SOLUTIONS = [
  { icon: Sparkles, title: "AI in Research", text: "Profile a firm and get its likely financial-crime risk themes — then jump into TypologyIQ pre-filled.", href: "/firm-research" },
  { icon: Search, title: "TypologyIQ", text: "Map AML typologies to a tailored control framework, scored deterministically.", href: "/typology-iq" },
  { icon: GitBranch, title: "PartnerControlMap", text: "Define partner payment flows → RACI, control gaps and a governance pack.", href: "/partner-control-map" },
  { icon: ShieldOff, title: "Screening Control Designer", text: "Design sanctions, PEP, adverse-media and payment screening controls.", href: "/screening-control-designer" },
  { icon: Gauge, title: "Controls Maturity", text: "Assess a control area against a 5-level model and get a remediation roadmap.", href: "/controls-maturity" },
  { icon: Library, title: "Controls Library", text: "Browse controls by risk theme and firm type, mapped to real enforcement.", href: "/controls" },
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
                    className="btn-brand inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-base font-semibold"
                  >
                    Start free <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/controls"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-base font-semibold border border-surface-border bg-surface hover:bg-surface-hover text-foreground transition-colors"
                  >
                    <Library className="h-5 w-5" />
                    Explore controls
                  </Link>
                </div>

                <a
                  href="https://memaconsultants.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-text-muted hover:text-emerald-400 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Designing a complex programme? Talk to a MEMA expert
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* Right: 3D ecosystem with honest metric overlays */}
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
                <StageMetric
                  className="top-4 left-4"
                  label="AML typologies"
                  value={String(TYPOLOGY_COUNT)}
                />
                <StageMetric
                  className="top-4 right-4"
                  label="Frameworks"
                  value={String(FRAMEWORK_COUNT)}
                  sub="FATF · Wolfsberg · FCA · JMLSG"
                />
                <StageMetric
                  className="bottom-4 left-4"
                  label="Partner flows"
                  value={String(FLOW_COUNT)}
                />
                <StageMetric
                  className="bottom-4 right-4"
                  label="Risk themes"
                  value={String(RISK_THEME_COUNT)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Control Cockpit — connective KPI strip (real counts) */}
        <section className="pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="stage-panel rounded-2xl px-6 py-6 sm:px-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
                <div className="lg:border-r lg:border-white/10 lg:pr-10">
                  <p className="text-xs uppercase tracking-wider text-emerald-400/80">
                    Control Cockpit
                  </p>
                  <p className="text-lg font-semibold text-white leading-tight mt-1">
                    Everything aligned.
                    <br className="hidden sm:block" /> Always in control.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 flex-1">
                  {[
                    { icon: ScanSearch, value: TYPOLOGY_COUNT, label: "AML typologies" },
                    { icon: GitBranch, value: FLOW_COUNT, label: "Partner flow types" },
                    { icon: Network, value: RISK_THEME_COUNT, label: "Risk themes" },
                    { icon: BookOpen, value: FRAMEWORK_COUNT, label: "Frameworks" },
                  ].map((k) => (
                    <div key={k.label} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                        <k.icon className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white leading-none">
                          {k.value}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {k.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem-first */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
              The problem
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Generic AML tooling wasn&apos;t built for{" "}
              <span className="gradient-text">how financial crime moves</span>
            </h2>
            <p className="mt-6 text-lg text-text-muted">
              Off-the-shelf control libraries hand you a flat checklist. They
              don&apos;t map to your firm type, they ignore how money actually
              flows through your partners, and they can&apos;t show you which
              controls would have stopped a real enforcement case. So teams
              over-build in some places, leave gaps in others, and can&apos;t
              evidence why. FinCrime Control Lab starts from the typology and
              works back to the exact controls you need — and no more.
            </p>
          </div>
        </section>

        {/* Capability tiles */}
        <section className="pb-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Everything you need to{" "}
                <span className="gradient-text">design controls</span>
              </h2>
              <p className="mt-4 text-text-muted">
                From the first typology match to a committee-ready governance
                pack — in one place, deterministically scored.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURE_TILES.map((t) => (
                <div key={t.title} className="tile p-6">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                    <t.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {t.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {t.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature sections with prominent 3D */}
        <section className="pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 sm:space-y-32">
            {/* TypologyIQ → RiskGauge */}
            <FeatureRow
              pill="Typology → control mapping"
              pillClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              icon={Search}
              title="TypologyIQ"
              description="Select your firm type, product, and risk profile to receive a tailored control framework — detection logic, data requirements, investigation workflows, and governance checklists, scored deterministically."
              bullets={[
                `${TYPOLOGY_COUNT} AML typologies, FATF-sourced`,
                "Weighted risk-theme scoring",
                "6-card control output",
              ]}
              ctaHref="/typology-iq"
              ctaLabel="Start assessment"
              visual={<TypologyWeb3D />}
              overlay={
                <>
                  <StageList
                    className="top-4 left-4"
                    title="Top typologies"
                    items={[
                      { label: "Trade-based ML" },
                      { label: "Shell-company abuse", dotClass: "bg-teal-400" },
                      { label: "Structuring / smurfing", dotClass: "bg-blue-400" },
                    ]}
                  />
                  <StageList
                    className="bottom-4 right-4"
                    title="Frameworks"
                    items={[
                      { label: "FATF" },
                      { label: "Wolfsberg", dotClass: "bg-teal-400" },
                      { label: "FCA", dotClass: "bg-blue-400" },
                      { label: "JMLSG", dotClass: "bg-amber-400" },
                    ]}
                  />
                </>
              }
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
                `${FLOW_COUNT} partner flow types`,
                "RACI + control-gap analysis",
                "Pre-launch governance pack",
              ]}
              ctaHref="/partner-control-map"
              ctaLabel="Map a partner flow"
              visual={<PartnerFlow3D />}
              overlay={
                <>
                  <StageMetric
                    className="top-4 left-4"
                    label="Flow types"
                    value={String(FLOW_COUNT)}
                  />
                  <StageMetric
                    className="top-4 right-4"
                    label="Output"
                    value="RACI"
                    sub="+ control gaps"
                  />
                  <StageMetric
                    className="bottom-4 left-4"
                    label="Aligned to"
                    value="Wolfsberg"
                  />
                </>
              }
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

        {/* Solutions — all tools */}
        <section className="pt-20 sm:pt-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-4 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                The toolkit
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Five tools, <span className="gradient-text">one control lab</span>
              </h2>
              <p className="mt-4 text-text-muted">
                Free, deterministic, and grounded in real enforcement and authoritative frameworks.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SOLUTIONS.map((s) => (
                <Link key={s.href} href={s.href} className="group tile p-6 flex flex-col">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                    <s.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed flex-1">{s.text}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-500 group-hover:gap-2.5 transition-all">
                    Open <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Use-case self-identify */}
        <section className="py-20 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for your firm type
            </h2>
            <p className="mt-4 text-text-muted">
              Controls are filtered and weighted to how each business model is
              actually exposed. Find yours:
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {USE_CASES.map((u) => (
                <Link
                  key={u}
                  href="/controls"
                  className="tile px-5 py-2.5 text-sm font-medium text-foreground hover:text-emerald-400"
                >
                  {u}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Firm Research quick-start card */}
        <section className="pb-20 sm:pb-24">
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

            {/* Trust block */}
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

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {TRUST_POINTS.map((t) => (
                  <div
                    key={t.text}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-surface-border text-sm text-foreground"
                  >
                    <t.icon className="h-4 w-4 text-emerald-400" />
                    {t.text}
                  </div>
                ))}
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
  overlay,
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
  overlay?: React.ReactNode;
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

      {/* 3D visual + labelled overlays */}
      <div className={`relative ${reverse ? "lg:order-1" : ""}`}>
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
        {overlay}
      </div>
    </div>
  );
}
