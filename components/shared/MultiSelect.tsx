"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";

interface MultiSelectProps {
  label: string;
  icon: LucideIcon;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Keep at least one option selected (default true). */
  requireOne?: boolean;
}

export default function MultiSelect({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
  requireOne = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    const has = selected.includes(value);
    if (has && requireOne && selected.length === 1) return; // keep at least one
    onChange(has ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const summary =
    selected.length === 0
      ? "None"
      : selected.length === 1
      ? labelFor(selected[0])
      : `${selected.length} selected`;

  return (
    <div className="block" ref={ref}>
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center gap-2 rounded-lg bg-white/5 border border-surface-border px-3 py-2 text-left focus:outline-none focus:border-accent"
        >
          <Icon className="h-4 w-4 text-accent shrink-0" />
          <span className="flex-1 truncate text-sm text-foreground">{summary}</span>
          <ChevronDown className={`h-4 w-4 text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div
            role="listbox"
            aria-multiselectable
            className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-surface-border bg-background shadow-xl"
          >
            {options.map((o) => {
              const checked = selected.includes(o.value);
              const lockLast = checked && requireOne && selected.length === 1;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
                    checked ? "text-foreground" : "text-text-muted"
                  } ${lockLast ? "cursor-not-allowed" : "cursor-pointer"}`}
                  title={lockLast ? "Keep at least one selected" : undefined}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-accent bg-accent" : "border-surface-border"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
