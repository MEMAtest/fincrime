"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ShieldOff, Crown, Newspaper, UserSearch, ArrowLeftRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import { allScreeningControls } from "@/data/screening";
import { SCREENING_CATEGORY_LABEL } from "@/data/screening/types";
import type { ScreeningCategory } from "@/data/screening/types";

const CATEGORY_ICON: Record<ScreeningCategory, typeof ShieldOff> = {
  sanctions: ShieldOff,
  pep: Crown,
  adverse_media: Newspaper,
  name_screening: UserSearch,
  transaction_screening: ArrowLeftRight,
};

const CATEGORIES: (ScreeningCategory | "all")[] = [
  "all", "sanctions", "pep", "adverse_media", "name_screening", "transaction_screening",
];

export default function ScreeningListPage() {
  const [filter, setFilter] = useState<ScreeningCategory | "all">("all");
  const controls = useMemo(
    () => (filter === "all" ? allScreeningControls : allScreeningControls.filter((c) => c.category === filter)),
    [filter]
  );

  return (
    <ToolFrame>
      <main className="flex-1">
        <section className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Screening control <span className="gradient-text">library</span>
              </h1>
              <p className="mt-4 text-text-muted">
                Browse the screening control specifications, or run the designer to tailor one to your firm.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  aria-pressed={filter === c}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === c ? "bg-accent text-white" : "bg-white/5 text-text-muted hover:text-foreground"
                  }`}
                >
                  {c === "all" ? "All" : SCREENING_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {controls.map((c) => {
                const Icon = CATEGORY_ICON[c.category];
                return (
                  <div key={c.slug} className="tile p-6 flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/20 to-accent-bright/20 border border-accent/30 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground mb-1">{c.title}</h2>
                    <span className="text-[10px] uppercase tracking-wider text-accent mb-2">
                      {SCREENING_CATEGORY_LABEL[c.category]}
                    </span>
                    <p className="text-sm text-text-muted leading-relaxed flex-1">{c.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/screening-control-designer"
                className="btn-brand inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
              >
                Design a screening control <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      </ToolFrame>
  );
}
