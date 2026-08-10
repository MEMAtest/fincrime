import type { Metadata } from "next";
import ToolFrame from "@/components/layout/ToolFrame";
import SourceBadge from "@/components/shared/SourceBadge";
import { FRAMEWORK_SOURCES } from "@/data/sources";
import { enforcementBenchmarks, totalEnforcementCases } from "@/lib/enforcement/select";
import { MATURITY_POINTS, MATURITY_LABEL, MATURITY_ORDER, type MaturityLevel } from "@/data/maturity/types";
import { DEFAULT_APPETITE_THRESHOLDS, MITIGATION_FACTORS, RESIDUAL_FLOOR } from "@/data/scoring/residual-risk";
import { PARTNER_RISK_THRESHOLDS } from "@/data/scoring/risk-matrix";
import { DEFAULT_HOURLY_COST_GBP, HOURS_PER_FTE_MONTH } from "@/data/scoring/operational-load";
import { WEIGHTS as TYPOLOGY_WEIGHTS } from "@/data/scoring/typology-scoring";
import { WEIGHTS as SCREENING_WEIGHTS } from "@/data/scoring/screening-scoring";
import {
  TEST_EFFECTIVENESS_THRESHOLDS,
  CADENCE_RULES,
  DEFAULT_CADENCE_MONTHS,
} from "@/data/scoring/test-effectiveness";
import type { SourceOrg } from "@/data/typologies/types";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How FinCrime Control Lab actually scores: typology and screening matching weights, residual risk mitigation, appetite thresholds, operational load, control test effectiveness, a bounded role for AI, and the audit trail behind every decision.",
};

const MATURITY_LEVELS = (Object.keys(MATURITY_ORDER) as MaturityLevel[]).sort(
  (a, b) => MATURITY_ORDER[a] - MATURITY_ORDER[b]
);

const TYPOLOGY_WEIGHT_TOTAL =
  TYPOLOGY_WEIGHTS.firmType + TYPOLOGY_WEIGHTS.product + TYPOLOGY_WEIGHTS.customerType + TYPOLOGY_WEIGHTS.riskTheme;
const SCREENING_WEIGHT_TOTAL = SCREENING_WEIGHTS.category + SCREENING_WEIGHTS.firmType + SCREENING_WEIGHTS.trigger;

/** Recognised cadence words, de-duplicated by interval so "annually" and "yearly" (both 12 months) don't render as two separate entries. */
const CADENCE_WORDS_BY_INTERVAL = (() => {
  const seen = new Map<string, string>();
  for (const rule of CADENCE_RULES) {
    const key = `${rule.kind}:${rule.amount}`;
    if (!seen.has(key)) seen.set(key, rule.label);
  }
  return [...seen.values()];
})();

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 text-sm text-text-muted leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Weights({ rows }: { rows: { label: string; points: number }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {rows.map((r) => (
        <div key={r.label} className="glass-card rounded-lg px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wider text-text-muted">{r.label}</dt>
          <dd className="text-xl font-bold text-foreground tabular-nums mt-0.5">{r.points}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MethodologyPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="gradient-text">Methodology</span>
          </h1>
          <p className="mt-3 text-text-muted max-w-2xl">
            How the lab produces its results, what drives real decisions in your workspace, and where the
            limits are. Every weight, factor, threshold, band and default value below is imported directly from
            the module that computes it, not retyped, so this page cannot quietly drift from what the product
            does. Worked examples (e.g. a residual score of 45) are illustrative narrative, not module output.
          </p>

          <Section title="Typology matching (no AI)">
            <p>
              TypologyIQ scores every typology against your selections on four dimensions. Each dimension awards
              its full weight when any of your selections applies to that typology; there is no partial credit
              and no dilution for broadening your selection.
            </p>
            <Weights
              rows={[
                { label: "Firm type", points: TYPOLOGY_WEIGHTS.firmType },
                { label: "Product", points: TYPOLOGY_WEIGHTS.product },
                { label: "Customer", points: TYPOLOGY_WEIGHTS.customerType },
                { label: "Risk theme", points: TYPOLOGY_WEIGHTS.riskTheme },
              ]}
            />
            <p>
              The four weights sum to {TYPOLOGY_WEIGHT_TOTAL}. The &quot;Why this matched&quot; panel on a result
              shows exactly which of your selections contributed which points.
            </p>
          </Section>

          <Section title="Screening control matching (no AI)">
            <p>
              The Screening Designer matches your inputs to a screening control the same deterministic way, on
              three dimensions that sum to {SCREENING_WEIGHT_TOTAL}:
            </p>
            <Weights
              rows={[
                { label: "Category", points: SCREENING_WEIGHTS.category },
                { label: "Firm type", points: SCREENING_WEIGHTS.firmType },
                { label: "Trigger", points: SCREENING_WEIGHTS.trigger },
              ]}
            />
          </Section>

          <Section title="Controls Maturity">
            <p>
              Each control area is scored against a five-level maturity framework, from initial to optimised.
              Every level carries a fixed points value used to size the gap between where you are and where you
              are targeting, and to order the remediation actions that close it:
            </p>
            <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
              {MATURITY_LEVELS.map((level) => (
                <div key={level} className="glass-card rounded-lg px-2 py-2.5">
                  <dt className="text-[10px] uppercase tracking-wider text-text-muted">{MATURITY_LABEL[level]}</dt>
                  <dd className="text-lg font-bold text-foreground tabular-nums mt-0.5">{MATURITY_POINTS[level]}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Residual risk: how a control earns mitigation credit">
            <p>
              Once a workspace has real controls with a coverage (full, partial or gap) and an effectiveness
              rating (strong, adequate, weak or not assessed), residual risk is inherent risk after crediting
              those controls, on a fixed factor table:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-text-muted">
                    <th className="text-left py-1.5 pr-3 font-medium">Coverage</th>
                    <th className="text-right py-1.5 px-3 font-medium">Strong</th>
                    <th className="text-right py-1.5 px-3 font-medium">Adequate</th>
                    <th className="text-right py-1.5 px-3 font-medium">Weak</th>
                    <th className="text-right py-1.5 pl-3 font-medium">Not assessed</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  <tr className="border-b border-surface-border/60">
                    <td className="py-1.5 pr-3">Full</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.full.strong.toFixed(2)}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.full.adequate.toFixed(2)}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.full.weak.toFixed(2)}</td>
                    <td className="text-right py-1.5 pl-3 tabular-nums">{MITIGATION_FACTORS.full.not_assessed}</td>
                  </tr>
                  <tr className="border-b border-surface-border/60">
                    <td className="py-1.5 pr-3">Partial</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.partial.strong.toFixed(2)}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.partial.adequate.toFixed(2)}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.partial.weak.toFixed(2)}</td>
                    <td className="text-right py-1.5 pl-3 tabular-nums">{MITIGATION_FACTORS.partial.not_assessed}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">Gap</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.gap.strong}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.gap.adequate}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{MITIGATION_FACTORS.gap.weak}</td>
                    <td className="text-right py-1.5 pl-3 tabular-nums">{MITIGATION_FACTORS.gap.not_assessed}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Each cell is the fraction of inherent risk that control removes on its own. Full coverage at
              strong effectiveness is the single best a control can do ({MITIGATION_FACTORS.full.strong.toFixed(2)}),
              never full elimination by itself. A control that is reference-only, marked as a gap, or has never
              been tested (&quot;not assessed&quot;) earns zero mitigation credit, no matter how much of the risk
              it claims to cover on paper: you cannot be credited for a control you have not actually proven.
            </p>
            <p>
              Multiple controls compound with diminishing returns rather than adding up. Each control removes
              its share of whatever risk is still standing after the controls before it, not a share of the
              original inherent score, so a second and third control still help even after a strong first one,
              but the combined set can never reach zero. Once at least one control earns any mitigation credit,
              residual risk is floored at {RESIDUAL_FLOOR} rather than driven all the way down; a risk with no
              controls, or only gap or untested ones, keeps its raw inherent value exactly. The floor is itself
              capped by the inherent score (it can never lift a residual score above what the risk started at),
              so a very low inherent risk with a floored control is never artificially inflated past its own
              inherent value.
            </p>
          </Section>

          <Section title="Risk appetite">
            <p>
              A residual score is compared against two thresholds to produce a within, tolerated, or outside
              appetite result. The defaults are:
            </p>
            <dl className="mt-3 flex flex-wrap gap-6">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-text-muted">Tolerated from</dt>
                <dd className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {DEFAULT_APPETITE_THRESHOLDS.toleratedFrom}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-text-muted">Outside from</dt>
                <dd className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {DEFAULT_APPETITE_THRESHOLDS.outsideFrom}
                </dd>
              </div>
            </dl>
            <p>
              A workspace can override both thresholds; every assessment records which thresholds it was judged
              against.
            </p>
            <p>
              At assessment level, the appetite result is judged against the single worst residual risk on the
              register (the maximum), not the average across every risk. A mean is also computed and shown for
              context, but it never decides the verdict: one severe risk puts the whole assessment outside
              appetite even if every other risk on the register is comfortably within it.
            </p>
            <p>
              The residual rating shown alongside a score (low, medium, high, critical) comes from a separate
              band table used across the lab, not from these two appetite thresholds, and the two do not align:
              the bands sit at {PARTNER_RISK_THRESHOLDS[1].min}, {PARTNER_RISK_THRESHOLDS[2].min} and{" "}
              {PARTNER_RISK_THRESHOLDS[3].min}, while appetite sits at {DEFAULT_APPETITE_THRESHOLDS.toleratedFrom}{" "}
              and {DEFAULT_APPETITE_THRESHOLDS.outsideFrom}. A residual score of 45, for example, rates
              &quot;medium&quot; on the band table while already being &quot;tolerated&quot; rather than
              &quot;within&quot; on the appetite result; a score of 65 rates &quot;high&quot; while being
              &quot;outside&quot; appetite. Treat the band as a general severity label and the appetite result as
              the actual governance verdict; the bands are:
            </p>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PARTNER_RISK_THRESHOLDS.map((t) => (
                <div key={t.rating} className="glass-card rounded-lg px-3 py-2.5">
                  <dt className="text-[11px] uppercase tracking-wider text-text-muted">{t.label}</dt>
                  <dd className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    {t.min}{Number.isFinite(t.max) ? `-${t.max}` : "+"}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Operational load">
            <p>
              For a control with an expected monthly volume and an expected alert rate, operational load is
              worked forward through a fixed chain: volume and alert rate give alerts per month; alerts per
              month and handling minutes give analyst hours per month; analyst hours convert to headcount using
              a {HOURS_PER_FTE_MONTH}-hour full-time-equivalent month; and analyst hours multiplied by an hourly
              cost give a monthly cost. The default hourly cost, when none is supplied, is £{DEFAULT_HOURLY_COST_GBP}, an
              indicative UK compliance-analyst rate.
            </p>
            <p>
              An assessment-level total sums the already-rounded per-control figures (each control&apos;s
              alerts, hours, headcount and cost are rounded to 2 decimal places before the sum), not the raw
              unrounded values, so the displayed total can differ from summing exact per-control figures
              yourself by a fraction of a cent or a minute.
            </p>
          </Section>

          <Section title="Control testing">
            <p>
              Testing a live control records a sample size split into passed, failed and partial results, plus
              any findings raised. The pass rate counts a partial sample as half a pass. That rate, combined with
              finding severity, decides both the test result and the effectiveness rating written back onto the
              control:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>No samples recorded at all: not assessed.</li>
              <li>
                Any high-severity finding, or a pass rate below {Math.round(TEST_EFFECTIVENESS_THRESHOLDS.failBelow * 100)}%:
                fail, rated weak. A high-severity finding always forces a fail, regardless of how good the raw
                pass rate looks.
              </li>
              <li>
                Pass rate at or above {Math.round(TEST_EFFECTIVENESS_THRESHOLDS.strongAtOrAbove * 100)}% with no
                medium or high-severity findings: pass, rated strong.
              </li>
              <li>Otherwise: pass with findings, rated adequate.</li>
            </ul>
            <p>
              The next test due date is derived by scanning the library control&apos;s free-text review cadence
              for every recognised cadence word ({CADENCE_WORDS_BY_INTERVAL.join(", ")}, and their variants) and
              using the shortest interval found, the conservative choice when a control&apos;s stated cadence
              mixes more and less frequent language. Cadence text with no recognised word defaults to{" "}
              {DEFAULT_CADENCE_MONTHS} months.
            </p>
          </Section>

          <Section title="Cited to authoritative frameworks">
            <p>
              Typologies, controls and KYC requirements map to primary sources. Every citation can be opened in
              place to read and copy the reference; the lab does not navigate you off-site. The standards used:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {FRAMEWORK_SOURCES.map((f) => (
                <SourceBadge key={f.org} source={f.org as SourceOrg} reference={f.title} url={f.url} title={f.title} />
              ))}
            </div>
          </Section>

          <Section title="A bounded role for AI">
            <p>
              Every score, match, weight, residual-risk figure, appetite result, operational-load number and
              test rating above is produced by the deterministic modules described on this page. AI is used only
              to write plain-English narrative summaries that accompany a result, for example the &quot;Risk
              Intelligence&quot; summary or a firm-research draft. It restates and explains a deterministic
              output; it never introduces a new fact or citation, and it never sets or changes a score, a rating,
              an appetite result or a test outcome. AI output is labelled as AI-assisted and is not legal advice;
              treat it as a starting point and verify against the cited sources. AI narratives can be slow,
              occasionally wrong in phrasing, or unavailable, none of which affects the numbers, because the
              numbers do not depend on AI at all.
            </p>
          </Section>

          <Section title="How a decision is defensible">
            <p>
              A workspace decision needs to be reconstructable later, not just correct today. Every live control
              is versioned: an edit bumps its version number and writes a snapshot to an append-only
              object_versions table, so you can see exactly what a control said at the time a decision referenced
              it, not just what it says now. Approvals and rejections are signed by a named workspace person, not
              an anonymous login, and can carry conditions with their own owner and due date. Every mutation also
              writes an audit_log entry recording what changed, when, and by which actor (a named person or the
              workspace itself). Together, this is the trail an assessment, a control change, or an incident can
              be defended against later: which control version was relied on, who approved it, under what
              conditions, and what evidence and actions followed.
            </p>
          </Section>

          <Section title="Real enforcement data">
            <p>
              The evidence and benchmark views draw on {totalEnforcementCases} real FCA enforcement cases from
              the public fines dataset (regactions.com / fcafines), each linked to its final notice. Where a case
              is annotated, the lab also shows the controls that would have caught the failure and lets you turn
              that lesson directly into a control change, an incident, a product risk assessment, or a follow-up
              action in your workspace. This data was last refreshed on {enforcementBenchmarks.generatedAt}.
            </p>
          </Section>

          <Section title="Limits">
            <p>
              The lab is a design and education aid, not legal advice and not a substitute for your firm&apos;s
              own risk assessment. Coverage is broad but not exhaustive, regulation changes, and you should
              always verify against the cited primary source and your own policies before relying on an output.
              The scoring is deliberately simple and transparent rather than a black-box model; that is a design
              choice, not an oversight, because a number you cannot explain is not one you can defend.
            </p>
          </Section>
        </section>
      </main>
      </ToolFrame>
  );
}
