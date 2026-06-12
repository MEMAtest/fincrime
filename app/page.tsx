"use client";

import Link from "next/link";
import {
  ArrowRight, ScanSearch, Activity, Database, Network, FileCheck,
  ClipboardCheck, Sparkles, Search, GitBranch, EyeOff, Gauge, Library,
  Check, ArrowUpRight, MessageSquare,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Instrument from "@/components/field/Instrument";
import { allTypologies } from "@/data/typologies";
import { allPartnerFlows } from "@/data/partner-flows";

const TYPOLOGY_COUNT = allTypologies.length;
const FLOW_COUNT = allPartnerFlows.length;
const RISK_THEME_COUNT = 7;
const FRAMEWORK_COUNT = 4;

const Brackets = () => (
  <>
    <span className="bk tl" /><span className="bk tr" /><span className="bk bl" /><span className="bk br" />
  </>
);

type CellDef = { code: string; icon: typeof ScanSearch; title: string; text: string; href: string };

const CAPABILITIES: CellDef[] = [
  { code: "F-01", icon: ScanSearch, title: "Typology mapping", text: `Match ${TYPOLOGY_COUNT} FATF & Wolfsberg-sourced typologies to your firm, product and risk profile.`, href: "/typology-iq" },
  { code: "F-02", icon: Activity, title: "Detection logic", text: "Rules, thresholds and scenarios — with the data each one needs to actually fire.", href: "/typology-iq" },
  { code: "F-03", icon: Database, title: "Data requirements", text: "Know exactly which data each control depends on before you start building.", href: "/typology-iq" },
  { code: "F-04", icon: Network, title: "Control ownership", text: "A RACI across you and your partners, with control gaps flagged automatically.", href: "/partner-control-map" },
  { code: "F-05", icon: FileCheck, title: "Enforcement-mapped", text: "Every control linked to the real FCA cases it would have prevented.", href: "/controls" },
  { code: "F-06", icon: ClipboardCheck, title: "Governance packs", text: "Pre-launch conditions, checklists and committee-ready output you can export.", href: "/controls" },
];

const TOOLKIT: CellDef[] = [
  { code: "T-01", icon: Sparkles, title: "AI in Research", text: "Profile a firm and get its likely financial-crime risk themes — then jump into TypologyIQ pre-filled.", href: "/firm-research" },
  { code: "T-02", icon: Search, title: "TypologyIQ", text: "Map AML typologies to a tailored control framework, scored deterministically.", href: "/typology-iq" },
  { code: "T-03", icon: GitBranch, title: "PartnerControlMap", text: "Define partner payment flows → RACI, control gaps and a governance pack.", href: "/partner-control-map" },
  { code: "T-04", icon: EyeOff, title: "Screening Control Designer", text: "Design sanctions, PEP, adverse-media and payment screening controls.", href: "/screening-control-designer" },
  { code: "T-05", icon: Gauge, title: "Controls Maturity", text: "Assess a control area against a 5-level model and get a remediation roadmap.", href: "/controls-maturity" },
  { code: "T-06", icon: Library, title: "Controls Library", text: "Browse controls by risk theme and firm type, mapped to real enforcement.", href: "/controls" },
];

function Cell({ c }: { c: CellDef }) {
  const Icon = c.icon;
  return (
    <Link className="cell bracket" href={c.href}>
      <Brackets />
      <span className="ci">{c.code}</span>
      <span className="cico"><Icon /></span>
      <h3>{c.title}</h3>
      <p>{c.text}</p>
      <span className="open">Open <ArrowRight size={15} /></span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="top">
        {/* ============ HERO ============ */}
        <section className="hero wrap">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="tech"><span className="ix">◇</span> FREE FINCRIME DESIGN TOOLS <span className="bar" /></span>
              <h1>Design financial crime controls <span className="accent">with confidence</span></h1>
              <p className="lede">
                Map AML typologies to detection controls, define partner control
                ownership, and browse a controls library mapped to real enforcement
                actions — built on authoritative frameworks.
              </p>
              <div className="hero-rail">
                <div className="rail-row"><span className="node" /><span className="rl"><b>AML typology → detection control</b> mapping</span></div>
                <div className="rail-row"><span className="node" /><span className="rl"><b>Partner payment-flow</b> control ownership</span></div>
                <div className="rail-row"><span className="node" /><span className="rl"><b>FATF, Wolfsberg &amp; FCA</b>-aligned frameworks</span></div>
              </div>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/firm-research">Start free <span className="arrow"><ArrowRight /></span></Link>
                <Link className="btn btn-ghost" href="/controls"><Library /> Explore controls</Link>
              </div>
              <div className="hero-note">
                <MessageSquare size={16} style={{ color: "var(--muted-2)" }} />
                Designing a complex programme? <a href="https://memaconsultants.com" target="_blank" rel="noopener noreferrer">Talk to a MEMA expert →</a>
              </div>
            </div>

            <div className="hero-instrument bracket">
              <Brackets />
              <Instrument variant="lattice" />
              <div className="readout r-tl"><span className="rk">AML Typologies</span><span className="rv">{TYPOLOGY_COUNT}</span><span className="pin" /></div>
              <div className="readout r-tr">
                <span className="rk">Frameworks</span><span className="rv">{FRAMEWORK_COUNT}</span>
                <div className="chips"><span className="chip">FATF</span><span className="chip">Wolfsberg</span><span className="chip">FCA</span><span className="chip">JMLSG</span></div>
                <span className="pin" />
              </div>
              <div className="readout r-bl"><span className="rk">Partner Flows</span><span className="rv">{FLOW_COUNT}</span><span className="pin" /></div>
              <div className="readout r-br"><span className="rk">Risk Themes</span><span className="rv">{RISK_THEME_COUNT}</span><span className="pin" /></div>
            </div>
          </div>
        </section>

        {/* ============ COCKPIT READBAR ============ */}
        <section className="wrap" style={{ paddingBottom: "clamp(40px,7vw,80px)" }}>
          <div className="readbar">
            <div className="lede">
              <span className="tech"><span className="ix">{"//"}</span> CONTROL COCKPIT</span>
              <b>Everything aligned.<br />Always in control.</b>
            </div>
            <div className="stat"><div className="n">{TYPOLOGY_COUNT}</div><div className="l">AML typologies</div></div>
            <div className="stat"><div className="n">{FLOW_COUNT}</div><div className="l">Partner flow types</div></div>
            <div className="stat"><div className="n">{RISK_THEME_COUNT}</div><div className="l">Risk themes</div></div>
            <div className="stat"><div className="n">{FRAMEWORK_COUNT}</div><div className="l">Frameworks</div></div>
          </div>
        </section>

        {/* ============ PROBLEM ============ */}
        <section className="section wrap" style={{ paddingTop: "clamp(40px,6vw,80px)" }}>
          <div className="marker amber"><span className="tech"><span className="ix">01</span> THE PROBLEM</span><span className="rule" /></div>
          <div className="section-head">
            <h2>Generic AML tooling wasn&apos;t built for <span className="accent">how financial crime moves</span></h2>
            <p className="sub">
              Off-the-shelf control libraries hand you a flat checklist. They don&apos;t
              map to your firm type, they ignore how money actually flows through your
              partners, and they can&apos;t show you which controls would have stopped a
              real enforcement case. So teams over-build in some places, leave gaps in
              others, and can&apos;t evidence why. FinCrime Control Lab starts from the
              typology and works back to the exact controls you need — and no more.
            </p>
          </div>
        </section>

        {/* ============ CAPABILITIES ============ */}
        <section className="section wrap" id="controls" style={{ paddingTop: 0 }}>
          <div className="marker"><span className="tech"><span className="ix">02</span> CAPABILITIES</span><span className="rule" /></div>
          <div className="section-head">
            <h2>Everything you need to <span className="accent">design controls</span></h2>
            <p className="sub">From the first typology match to a committee-ready governance pack — in one place, deterministically scored.</p>
          </div>
          <div className="feature-grid">
            {CAPABILITIES.map((c) => <Cell key={c.code} c={c} />)}
          </div>
        </section>

        {/* ============ TYPOLOGYIQ ============ */}
        <section className="tool-section wrap" id="typologyiq">
          <div className="marker"><span className="tech"><span className="ix">03</span> TYPOLOGY → CONTROL MAPPING</span><span className="rule" /></div>
          <div className="toolrow">
            <div className="tool-copy">
              <div className="tool-title"><span className="tico"><Search /></span><h3>TypologyIQ</h3></div>
              <p className="desc">Select your firm type, product, and risk profile to receive a tailored control framework — detection logic, data requirements, investigation workflows, and governance checklists, scored deterministically.</p>
              <div className="checks">
                <div className="check"><span className="ck"><Check /></span>{TYPOLOGY_COUNT} AML typologies, FATF-sourced</div>
                <div className="check"><span className="ck"><Check /></span>Weighted risk-theme scoring</div>
                <div className="check"><span className="ck"><Check /></span>6-card control output</div>
              </div>
              <Link className="btn btn-primary" href="/typology-iq">Start assessment <span className="arrow"><ArrowRight /></span></Link>
            </div>
            <div className="tool-scene bracket">
              <Brackets />
              <Instrument variant="constellation" />
              <div className="readout r-tl"><span className="rk">Top typologies</span><span className="rv">3<small>matched</small></span><span className="pin" /></div>
              <div className="readout r-br"><span className="rk">Frameworks</span><div className="chips"><span className="chip">FATF</span><span className="chip">Wolfsberg</span><span className="chip">FCA</span></div><span className="pin" /></div>
            </div>
          </div>
        </section>

        {/* ============ PARTNERCONTROLMAP ============ */}
        <section className="tool-section wrap" id="partnercontrolmap">
          <div className="marker"><span className="tech"><span className="ix">04</span> PARTNER OVERSIGHT</span><span className="rule" /></div>
          <div className="toolrow rev">
            <div className="tool-copy">
              <div className="tool-title"><span className="tico"><ArrowUpRight /></span><h3>PartnerControlMap</h3></div>
              <p className="desc">Map every partner payment flow, assign control ownership across you and your partners, and surface the gaps — delivered as a RACI matrix with a committee-ready governance pack.</p>
              <div className="checks">
                <div className="check"><span className="ck"><Check /></span>{FLOW_COUNT} partner payment-flow types</div>
                <div className="check"><span className="ck"><Check /></span>RACI ownership matrix</div>
                <div className="check"><span className="ck"><Check /></span>Automatic control-gap detection</div>
              </div>
              <Link className="btn btn-primary" href="/partner-control-map">Map partner flows <span className="arrow"><ArrowRight /></span></Link>
            </div>
            <div className="tool-scene bracket">
              <Brackets />
              <Instrument variant="flows" />
              <div className="readout r-tl"><span className="rk">Flow types</span><span className="rv">{FLOW_COUNT}</span><span className="pin" /></div>
              <div className="readout r-br"><span className="rk">Output</span><span className="rv">RACI<small>+ gaps</small></span><span className="pin" /></div>
            </div>
          </div>
        </section>

        {/* ============ CONTROLS REFERENCE LIBRARY ============ */}
        <section className="tool-section wrap" id="resources">
          <div className="marker amber"><span className="tech"><span className="ix">05</span> ENFORCEMENT-MAPPED LIBRARY</span><span className="rule" /></div>
          <div className="toolrow">
            <div className="tool-copy">
              <div className="tool-title"><span className="tico"><Library /></span><h3>Controls Reference Library</h3></div>
              <p className="desc">Browse the FinCrime controls your firm needs — grouped by risk theme, filtered by firm type, and mapped to real FCA enforcement actions so you can see exactly which controls would have prevented them.</p>
              <div className="checks">
                <div className="check"><span className="ck"><Check /></span>Grouped by risk theme</div>
                <div className="check"><span className="ck"><Check /></span>Filtered by firm type</div>
                <div className="check"><span className="ck"><Check /></span>Mapped to real enforcement actions</div>
              </div>
              <Link className="btn btn-primary" href="/controls">Explore controls <span className="arrow"><ArrowRight /></span></Link>
            </div>
            <div className="tool-scene bracket">
              <Brackets />
              <Instrument variant="monolith" />
              <div className="readout r-tr"><span className="rk">Risk themes</span><span className="rv">{RISK_THEME_COUNT}</span><span className="pin" /></div>
              <div className="readout r-bl"><span className="rk">Mapped cases</span><span className="rv">FCA<small>live</small></span><span className="pin" /></div>
            </div>
          </div>
        </section>

        {/* ============ TOOLKIT ============ */}
        <section className="section wrap" id="toolkit">
          <div className="marker"><span className="tech"><span className="ix">06</span> THE TOOLKIT</span><span className="rule" /></div>
          <div className="section-head">
            <h2>Six tools, <span className="accent">one control lab</span></h2>
            <p className="sub">Free, deterministic, and grounded in real enforcement and authoritative frameworks.</p>
          </div>
          <div className="toolkit-grid">
            {TOOLKIT.map((c) => <Cell key={c.code} c={c} />)}
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="section wrap" id="cta" style={{ paddingTop: 0 }}>
          <div className="cta-band bracket">
            <Brackets />
            <Instrument variant="cta" />
            <span className="tech"><span className="ix">◇</span> FREE FINCRIME DESIGN TOOLS</span>
            <h2>Start from the typology.<br />Work back to the <span className="accent">exact controls</span>.</h2>
            <p>Free, deterministic, and grounded in real enforcement. Design a control programme you can defend in front of any committee.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Link className="btn btn-primary" href="/firm-research">Start free <span className="arrow"><ArrowRight /></span></Link>
              <a className="btn btn-ghost" href="https://memaconsultants.com" target="_blank" rel="noopener noreferrer">Talk to a MEMA expert</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
