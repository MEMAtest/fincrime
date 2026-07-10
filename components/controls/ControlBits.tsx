"use client";

import type { ControlRating, ControlStatus, ControlPriority } from "@/data/controls/types";

/**
 * Whether an override field holds a real, user-set value. Used by the History /
 * "Recent changes" views so an empty string, 0 ("not assessed") or an empty
 * array is not mistaken for an edit.
 */
export function isOverrideSet(v: unknown): boolean {
  return v !== undefined && v !== "" && v !== 0 && !(Array.isArray(v) && v.length === 0);
}

export const RATING_ORDER: ControlRating[] = ["not_assessed", "weak", "adequate", "strong"];

export const RATING_META: Record<ControlRating, { label: string; badge: string; dot: string }> = {
  strong: { label: "Strong", badge: "text-accent bg-accent/10 border border-accent/20", dot: "bg-accent" },
  adequate: { label: "Adequate", badge: "text-amber-600 bg-amber-50 border border-amber-200", dot: "bg-amber-500" },
  weak: { label: "Weak", badge: "text-red-600 bg-red-50 border border-red-200", dot: "bg-red-500" },
  not_assessed: { label: "Not assessed", badge: "text-slate-500 bg-slate-50 border border-slate-200", dot: "bg-slate-300" },
};

export function RatingBadge({ rating }: { rating: ControlRating }) {
  const m = RATING_META[rating];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.badge}`}>{m.label}</span>;
}

export function RatingDot({ rating }: { rating: ControlRating }) {
  return <span className={`h-2 w-2 rounded-full shrink-0 ${RATING_META[rating].dot}`} />;
}

/** A styled native select for a control rating (accessible, keyboard-friendly). */
export function RatingSelect({
  value,
  onChange,
  className = "",
}: {
  value: ControlRating;
  onChange: (r: ControlRating) => void;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <span className={`pointer-events-none absolute left-2 h-2 w-2 rounded-full ${RATING_META[value].dot}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ControlRating)}
        aria-label="Rating"
        className="appearance-none pl-6 pr-7 py-1.5 rounded-lg border border-surface-border bg-white/5 text-xs font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer"
      >
        {RATING_ORDER.slice().reverse().map((r) => (
          <option key={r} value={r}>{RATING_META[r].label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

/* ── Status ────────────────────────────────────────────── */

export const STATUS_ORDER: ControlStatus[] = ["not_started", "in_progress", "needs_review", "gaps", "implemented"];

export const STATUS_META: Record<ControlStatus, { label: string; badge: string; dot: string }> = {
  implemented: { label: "Implemented", badge: "text-accent bg-accent/10 border border-accent/20", dot: "bg-accent" },
  in_progress: { label: "In Progress", badge: "text-amber-600 bg-amber-50 border border-amber-200", dot: "bg-amber-500" },
  needs_review: { label: "Needs Review", badge: "text-violet-600 bg-violet-50 border border-violet-200", dot: "bg-violet-500" },
  gaps: { label: "Gaps", badge: "text-red-600 bg-red-50 border border-red-200", dot: "bg-red-500" },
  not_started: { label: "Not Started", badge: "text-slate-500 bg-slate-50 border border-slate-200", dot: "bg-slate-300" },
};

export function StatusBadge({ status }: { status: ControlStatus }) {
  const m = STATUS_META[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.badge}`}>{m.label}</span>;
}

/* ── Priority ──────────────────────────────────────────── */

export const PRIORITY_ORDER: ControlPriority[] = ["high", "medium", "low"];

export const PRIORITY_META: Record<ControlPriority, { label: string; badge: string }> = {
  high: { label: "High", badge: "text-rose-600 bg-rose-50 border border-rose-200" },
  medium: { label: "Medium", badge: "text-amber-600 bg-amber-50 border border-amber-200" },
  low: { label: "Low", badge: "text-slate-500 bg-slate-50 border border-slate-200" },
};

export function PriorityBadge({ priority }: { priority: ControlPriority }) {
  const m = PRIORITY_META[priority];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.badge}`}>{m.label}</span>;
}

/* ── Styled native selects ─────────────────────────────── */

function chevron() {
  return <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>;
}

export function StatusSelect({ value, onChange, className = "" }: { value: ControlStatus; onChange: (s: ControlStatus) => void; className?: string }) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <span className={`pointer-events-none absolute left-2 h-2 w-2 rounded-full ${STATUS_META[value].dot}`} />
      <select value={value} onChange={(e) => onChange(e.target.value as ControlStatus)} aria-label="Status" className="appearance-none pl-6 pr-7 py-1.5 rounded-lg border border-surface-border bg-white/5 text-xs font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer">
        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </select>
      {chevron()}
    </div>
  );
}

export function PrioritySelect({ value, onChange, className = "" }: { value: ControlPriority; onChange: (p: ControlPriority) => void; className?: string }) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value as ControlPriority)} aria-label="Priority" className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-surface-border bg-white/5 text-xs font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer">
        {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
      </select>
      {chevron()}
    </div>
  );
}

/** A small 5-segment maturity bar (level 0 = not assessed). */
export function MaturityBar({ level }: { level: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={`Maturity level ${level || "not assessed"} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= level ? "bg-accent" : "bg-white/10"}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </span>
  );
}
