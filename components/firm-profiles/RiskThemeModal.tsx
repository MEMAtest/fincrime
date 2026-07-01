"use client";

import Link from "next/link";
import { Wrench, ArrowUpRight } from "lucide-react";
import DetailModal from "@/components/ui/DetailModal";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL } from "@/data/typologies/labels";
import type { RiskTheme, Typology } from "@/data/typologies/types";

/**
 * The risk-theme drill-in on a firm profile: what the theme is, why it is rated
 * as it is for this firm, the firm's typologies under it (each opens the typology
 * modal), and a build-controls CTA. Opening a typology closes this modal first so
 * only one modal is ever open (no nesting).
 */
export default function RiskThemeModal({
  theme,
  levelLabel,
  rationale,
  typologies,
  buildHref,
  onOpenTypology,
  onClose,
}: {
  theme: RiskTheme | null;
  levelLabel?: string;
  rationale?: string;
  typologies: Typology[];
  buildHref: string;
  onOpenTypology: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal
      open={!!theme}
      onClose={onClose}
      title={theme ? RISK_THEME_LABEL[theme] : ""}
      subtitle={levelLabel ? `${levelLabel} inherent risk for this firm` : "Inherent risk"}
      size="lg"
    >
      {theme && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <RiskThemeIcon riskTheme={theme} size="md" animated={false} />
            {rationale && <p className="text-sm text-text-muted leading-relaxed">{rationale}</p>}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
              Typologies under this risk ({typologies.length})
            </p>
            <div className="space-y-2">
              {typologies.map((t) => (
                <button key={t.slug} onClick={() => onOpenTypology(t.slug)} className="w-full text-left glass-card rounded-xl p-3 card-hover flex items-start gap-3">
                  <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-medium text-foreground leading-tight">
                      <span className="truncate">{t.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    </span>
                    <span className="block text-xs text-text-muted line-clamp-2 mt-0.5">{t.description}</span>
                  </span>
                </button>
              ))}
              {typologies.length === 0 && <p className="text-sm text-text-muted">No typologies under this risk for this firm type.</p>}
            </div>
          </div>

          <Link href={buildHref} onClick={onClose} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors" style={{ backgroundColor: THEME_CONFIG[theme].glow }}>
            <Wrench className="h-4 w-4" /> Build controls for this risk
          </Link>
        </div>
      )}
    </DetailModal>
  );
}
