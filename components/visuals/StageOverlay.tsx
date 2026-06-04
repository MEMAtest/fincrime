"use client";

import type { ReactNode } from "react";

/**
 * Glass cards overlaid on the dark `.stage-panel` 3D backdrops. The panel is
 * always dark, so these use fixed light text regardless of page theme.
 * Positioning is supplied by the parent via `className` (absolute placement).
 */
export function StageCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`absolute z-10 bg-slate-900/85 backdrop-blur-md border border-emerald-500/25 rounded-xl shadow-lg shadow-emerald-500/10 ${className}`}
    >
      {children}
    </div>
  );
}

/** A compact metric chip (label + value + optional sub). */
export function StageMetric({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <StageCard className={`px-3.5 py-2.5 ${className}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 whitespace-nowrap">
        {label}
      </div>
      <div className="text-lg font-bold text-white leading-tight">{value}</div>
      {sub ? <div className="text-[10px] text-emerald-400 mt-0.5">{sub}</div> : null}
    </StageCard>
  );
}

/** A small titled list card (e.g. "Top typologies", "Frameworks"). */
export function StageList({
  title,
  items,
  className = "",
}: {
  title: string;
  items: { label: string; dotClass?: string }[];
  className?: string;
}) {
  return (
    <StageCard className={`px-3.5 py-3 min-w-[150px] ${className}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-xs text-slate-200">
            <span
              className={`h-1.5 w-1.5 rounded-full ${it.dotClass ?? "bg-emerald-400"}`}
            />
            {it.label}
          </li>
        ))}
      </ul>
    </StageCard>
  );
}
