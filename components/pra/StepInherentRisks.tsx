"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CreditCard, Plus, Users, AlertTriangle, X, Check } from "lucide-react";
import MultiSelect from "@/components/shared/MultiSelect";
import RiskRatingBadge from "@/components/shared/RiskRatingBadge";
import { scoreTypologies, type TypologyAnswers } from "@/data/scoring/typology-scoring";
import { getRiskRating } from "@/data/scoring/risk-matrix";
import { allTypologies } from "@/data/typologies";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";
import type { AssessmentRiskDTO, ProductDTO } from "./types";

const MATCHES_SHOWN = 20;

const FIRM_OPTIONS = (Object.keys(FIRM_TYPE_LABEL) as FirmType[]).map((v) => ({ value: v, label: FIRM_TYPE_LABEL[v] }));
const PRODUCT_OPTIONS = (Object.keys(PRODUCT_LABEL) as ProductType[]).map((v) => ({ value: v, label: PRODUCT_LABEL[v] }));
const CUSTOMER_OPTIONS = (Object.keys(CUSTOMER_LABEL) as CustomerType[]).map((v) => ({ value: v, label: CUSTOMER_LABEL[v] }));
const RISK_THEME_OPTIONS = (Object.keys(RISK_THEME_LABEL) as RiskTheme[]).map((v) => ({ value: v, label: RISK_THEME_LABEL[v] }));

interface ScoringProfile {
  firmTypes: FirmType[];
  products: ProductType[];
  customerTypes: CustomerType[];
  riskThemes: RiskTheme[];
}

/** Unions the applicability of a set of typology slugs, to seed the scoring profile. */
function seedFromSlugs(slugs: string[]): Pick<ScoringProfile, "firmTypes" | "products" | "riskThemes"> {
  const firmTypes = new Set<FirmType>();
  const products = new Set<ProductType>();
  const riskThemes = new Set<RiskTheme>();
  for (const slug of slugs) {
    const typology = allTypologies.find((t) => t.slug === slug);
    if (!typology) continue;
    typology.applicableFirmTypes.forEach((f) => firmTypes.add(f));
    typology.applicableProducts.forEach((p) => products.add(p));
    riskThemes.add(typology.riskTheme);
  }
  return { firmTypes: [...firmTypes], products: [...products], riskThemes: [...riskThemes] };
}

export interface CreateRiskInput {
  typologySlug: string | null;
  title: string;
  inherentScore: number | null;
  inherentRationale: string | null;
}

export interface UpdateRiskInput {
  title?: string;
  inherentScore?: number | null;
  inherentRationale?: string | null;
  // Residual fields: written by Step 6 (StepResidualRisk), which computes the
  // score from attached controls and lets the user edit only the rationale.
  residualScore?: number | null;
  residualRationale?: string | null;
}

interface StepInherentRisksProps {
  product: ProductDTO;
  risks: AssessmentRiskDTO[];
  preselectedTypologySlugs: string[];
  /** Called once the deep-link preselection has been applied (or deliberately skipped), so the journey can drop ?typologies= from the URL and a reload cannot re-run it. */
  onPreselectApplied?: () => void;
  onCreateRisk: (input: CreateRiskInput) => Promise<void>;
  onUpdateRisk: (id: string, input: UpdateRiskInput) => Promise<void>;
  onDeleteRisk: (id: string) => Promise<void>;
}

/** Step 3: score typologies against a refined profile, tick candidates into the risk register, or add manual risks. */
export default function StepInherentRisks({
  product,
  risks,
  preselectedTypologySlugs,
  onPreselectApplied,
  onCreateRisk,
  onUpdateRisk,
  onDeleteRisk,
}: StepInherentRisksProps) {
  // Lazy-initialised once, from anything already known: the product's customer
  // types, any typologies already saved as risks, and the ?typologies= deep link.
  const [profile, setProfile] = useState<ScoringProfile>(() => {
    const existingSlugs = risks.map((r) => r.typology_slug).filter((s): s is string => !!s);
    const seedSlugs = [...new Set([...preselectedTypologySlugs, ...existingSlugs])];
    const seed = seedFromSlugs(seedSlugs);
    return {
      firmTypes: seed.firmTypes,
      products: seed.products,
      customerTypes: (product.customers as CustomerType[]) ?? [],
      riskThemes: seed.riskThemes,
    };
  });

  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualScore, setManualScore] = useState("50");
  const [manualRationale, setManualRationale] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const matches = useMemo(() => {
    const answers: TypologyAnswers = profile;
    return scoreTypologies(answers).filter((m) => m.score > 0);
  }, [profile]);

  const selectedSlugs = useMemo(
    () => new Set(risks.map((r) => r.typology_slug).filter((s): s is string => !!s)),
    [risks]
  );

  // The ?typologies= deep link (e.g. from an enforcement case) promises the
  // carried-over typologies arrive "pre-selected". Seeding the profile filters
  // (above) only surfaces them as candidates; it never actually ticks
  // anything, so this effect turns any preselected slug that isn't already on
  // the register into a real, saved risk the moment the step mounts - the
  // user then sees it ticked and can edit or remove it like any other risk.
  // Guarded three ways, because a ref alone is not enough. The ref stops a
  // second run within one mount (and React Strict Mode's deliberate
  // mount/cleanup/remount in dev), but it resets on a real remount, and the
  // journey URL keeps ?typologies= on reload - so a ref-only guard would
  // silently resurrect risks the user had deliberately deleted. Hence:
  //   1. the ref, for the within-mount case,
  //   2. only auto-create when the register is still EMPTY, so a curated
  //      register is never added to behind the user's back, and
  //   3. strip the query param once applied, so a reload cannot re-run it.
  // Deliberately does NOT abort the in-flight loop from the effect cleanup:
  // Strict Mode's cleanup would kill the loop after its first await, so only
  // the first of several preselected slugs would ever be created.
  const autoTickRan = useRef(false);
  useEffect(() => {
    if (autoTickRan.current) return;
    autoTickRan.current = true;
    if (!preselectedTypologySlugs.length) return;
    // A non-empty register means the user has already been here and curated
    // it. Adding to it now would be indistinguishable from re-adding what
    // they removed.
    if (risks.length > 0) {
      onPreselectApplied?.();
      return;
    }

    (async () => {
      for (const slug of preselectedTypologySlugs) {
        const typology = allTypologies.find((t) => t.slug === slug);
        if (!typology) continue;
        const match = matches.find((m) => m.typology.slug === slug);
        await onCreateRisk({
          typologySlug: slug,
          title: typology.title,
          inherentScore: match?.score ?? null,
          inherentRationale: "Pre-selected from a linked enforcement case's typologies.",
        });
      }
      onPreselectApplied?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTypology = async (slug: string, title: string, score: number) => {
    setPendingSlug(slug);
    try {
      if (selectedSlugs.has(slug)) {
        const risk = risks.find((r) => r.typology_slug === slug);
        if (risk) await onDeleteRisk(risk.id);
      } else {
        await onCreateRisk({ typologySlug: slug, title, inherentScore: score, inherentRationale: null });
      }
    } finally {
      setPendingSlug(null);
    }
  };

  const submitManual = async () => {
    const title = manualTitle.trim();
    if (!title) return;
    const parsedScore = Number(manualScore);
    const inherentScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, Math.round(parsedScore))) : null;
    await onCreateRisk({
      typologySlug: null,
      title,
      inherentScore,
      inherentRationale: manualRationale.trim() || null,
    });
    setManualTitle("");
    setManualScore("50");
    setManualRationale("");
    setManualOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Inherent risks</h2>
        <p className="text-sm text-text-muted">
          Refine the profile below to score financial crime typologies against this product, then tick which
          become risks on the register. Scoring is deterministic (firm type 30, product 25, customer 20, risk
          theme 25) and runs entirely in your browser.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <MultiSelect
          label="Firm types"
          icon={Building2}
          options={FIRM_OPTIONS}
          selected={profile.firmTypes}
          requireOne={false}
          onChange={(next) => setProfile((p) => ({ ...p, firmTypes: next as FirmType[] }))}
        />
        <MultiSelect
          label="Products"
          icon={CreditCard}
          options={PRODUCT_OPTIONS}
          selected={profile.products}
          requireOne={false}
          onChange={(next) => setProfile((p) => ({ ...p, products: next as ProductType[] }))}
        />
        <MultiSelect
          label="Customer types"
          icon={Users}
          options={CUSTOMER_OPTIONS}
          selected={profile.customerTypes}
          requireOne={false}
          onChange={(next) => setProfile((p) => ({ ...p, customerTypes: next as CustomerType[] }))}
        />
        <MultiSelect
          label="Risk themes"
          icon={AlertTriangle}
          options={RISK_THEME_OPTIONS}
          selected={profile.riskThemes}
          requireOne={false}
          onChange={(next) => setProfile((p) => ({ ...p, riskThemes: next as RiskTheme[] }))}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {matches.length > 0
            ? `${matches.length} typolog${matches.length === 1 ? "y" : "ies"} match this profile`
            : "No typologies match yet"}
        </h3>
        {matches.length === 0 && (
          <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
            Select at least one firm type, product, customer type or risk theme above to surface matching
            typologies.
          </div>
        )}
        {matches.length > MATCHES_SHOWN && (
          <p className="text-xs text-text-muted mb-3">
            Showing the top {MATCHES_SHOWN} of {matches.length} matches. Narrow the profile above to see others.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {matches.slice(0, MATCHES_SHOWN).map((m) => {
            const selected = selectedSlugs.has(m.typology.slug);
            const rating = getRiskRating(m.score).rating;
            const busy = pendingSlug === m.typology.slug;
            return (
              <button
                key={m.typology.slug}
                type="button"
                disabled={busy}
                onClick={() => toggleTypology(m.typology.slug, m.typology.title, m.score)}
                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-60 ${
                  selected ? "border-accent bg-accent/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${selected ? "text-accent" : "text-foreground"}`}>
                    {m.typology.title}
                  </p>
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      selected ? "border-accent bg-accent" : "border-white/20"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <div className="mt-2">
                  <RiskRatingBadge level={rating} score={m.score} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Risk register ({risks.length})</h3>
          <button
            type="button"
            onClick={() => setManualOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add manual risk
          </button>
        </div>

        {manualOpen && (
          <div className="glass-card rounded-xl p-4 mb-3 space-y-3">
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Risk title"
              className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-muted shrink-0">Inherent score (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={manualScore}
                onChange={(e) => setManualScore(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
            </div>
            <textarea
              value={manualRationale}
              onChange={(e) => setManualRationale(e.target.value)}
              rows={2}
              placeholder="Rationale (optional)"
              className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitManual}
                disabled={!manualTitle.trim()}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                Add risk
              </button>
            </div>
          </div>
        )}

        {risks.length === 0 && !manualOpen && (
          <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
            No risks on the register yet. Tick a matched typology above, or add a manual risk.
          </div>
        )}

        <div className="space-y-2">
          {/* Keyed on id only: keying on updated_at remounts the row after every
              blur-save and discards whatever the user is typing in the next field. */}
          {risks.map((risk) => (
            <RiskRow key={risk.id} risk={risk} onUpdate={onUpdateRisk} onDelete={onDeleteRisk} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskRow({
  risk,
  onUpdate,
  onDelete,
}: {
  risk: AssessmentRiskDTO;
  onUpdate: (id: string, input: UpdateRiskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const rating = risk.inherent_score !== null ? getRiskRating(risk.inherent_score).rating : null;
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{risk.title}</p>
          {risk.typology_slug && <p className="text-xs text-text-muted mt-0.5">Typology: {risk.typology_slug}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rating && <RiskRatingBadge level={rating} score={risk.inherent_score ?? undefined} />}
          <button
            type="button"
            onClick={() => onDelete(risk.id)}
            aria-label="Remove risk"
            className="text-text-muted hover:text-red-500 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid sm:grid-cols-[100px_1fr] gap-3 items-start">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-text-muted">Score</label>
          <input
            type="number"
            min={0}
            max={100}
            defaultValue={risk.inherent_score ?? ""}
            onBlur={(e) => {
              const parsed = e.target.value === "" ? null : Number(e.target.value);
              if (parsed !== risk.inherent_score) {
                onUpdate(risk.id, { inherentScore: Number.isFinite(parsed) ? parsed : null });
              }
            }}
            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-text-muted">Rationale</label>
          <textarea
            defaultValue={risk.inherent_rationale ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (risk.inherent_rationale ?? "")) {
                onUpdate(risk.id, { inherentRationale: e.target.value || null });
              }
            }}
            rows={1}
            placeholder="Why this score?"
            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
