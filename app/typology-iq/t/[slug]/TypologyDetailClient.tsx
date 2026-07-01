"use client";

import Link from "next/link";
import { ClipboardCheck, Scale, Layers, Link2 } from "lucide-react";
import NextSteps from "@/components/shared/NextSteps";
import TypologyDetail from "@/components/typologies/TypologyDetail";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { allTypologies } from "@/data/typologies";
import type { Typology } from "@/data/typologies/types";

export default function TypologyDetailClient({ typology }: { typology: Typology }) {
  const cfg = THEME_CONFIG[typology.riskTheme];
  const related = allTypologies
    .filter((t) => t.riskTheme === typology.riskTheme && t.slug !== typology.slug)
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <Link href="/typology-iq/list" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors">
          <Layers className="h-4 w-4" /> All typologies
        </Link>
      </div>

      <TypologyDetail typology={typology} />

      {related.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" /> Related typologies ({cfg.label})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {related.map((t) => (
              <Link key={t.slug} href={`/typology-iq/t/${t.slug}`} className="glass-card rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition-colors">
                <div className="shrink-0"><RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{t.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <NextSteps
        items={[
          { title: "Run this in TypologyIQ", body: "Score your firm against this and related typologies and build the controls.", href: `/typology-iq?riskThemes=${typology.riskTheme}`, icon: Scale },
          { title: "Browse the catalogue", body: "All financial crime typologies, filterable by risk theme.", href: "/typology-iq/list", icon: Layers },
          { title: "See the controls", body: "Detection rules, workflows and governance grouped by risk theme.", href: "/controls", icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}
