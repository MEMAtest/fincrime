"use client";

import { useState, useRef } from "react";
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
  onActiveChange,
}: {
  tabs: ResultTab[];
  initialId?: string;
  /** Called when the active tab changes — use for URL sync on pages that already have useSearchParams. */
  onActiveChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activateTab = (id: string) => {
    setActive(id);
    onActiveChange?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    activateTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const panelId = `result-panel-${current?.id}`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Result views"
        className="flex flex-wrap gap-1 border-b border-surface-border mb-8"
      >
        {tabs.map((t, i) => {
          const isActive = t.id === active;
          const Icon = t.icon;
          const tabId = `result-tab-${t.id}`;
          return (
            <button
              key={t.id}
              id={tabId}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              aria-selected={isActive}
              aria-controls={isActive ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activateTab(t.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "text-accent" : "text-text-muted hover:text-foreground"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {t.label}
              {isActive ? (
                <motion.span
                  layoutId="result-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`result-tab-${current?.id}`}
      >
        {current?.content}
      </div>
    </div>
  );
}
