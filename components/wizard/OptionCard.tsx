"use client";

import { Check, type LucideIcon } from "lucide-react";

interface OptionCardProps {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  selected: boolean;
  /** When true, render a checkbox indicator (multi-select) instead of a radio. */
  multi?: boolean;
  onSelect: (value: string) => void;
}

export default function OptionCard({
  value,
  label,
  description,
  icon: Icon,
  selected,
  multi = false,
  onSelect,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={multi ? selected : undefined}
      onClick={() => onSelect(value)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
        selected
          ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              selected ? "bg-accent/20 text-accent" : "bg-white/5 text-text-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              selected ? "text-accent" : "text-foreground"
            }`}
          >
            {label}
          </p>
          {description && (
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div
          className={`ml-auto w-5 h-5 border-2 flex items-center justify-center shrink-0 mt-0.5 ${
            multi ? "rounded-md" : "rounded-full"
          } ${selected ? "border-accent bg-accent" : "border-white/20"}`}
        >
          {selected && (multi ? <Check className="h-3 w-3 text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />)}
        </div>
      </div>
    </button>
  );
}
