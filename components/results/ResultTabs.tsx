"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface ResultTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: React.ReactNode;
}

export default function ResultTabs({
  tabs,
  initialId,
}: {
  tabs: ResultTab[];
  initialId?: string;
}) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Result views"
        className="flex flex-wrap gap-1 border-b border-surface-border mb-8"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-emerald-500"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {t.label}
              {isActive ? (
                <motion.span
                  layoutId="result-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
