"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "./CommandPaletteProvider";

/**
 * The search launcher. Rendered in both the marketing Header and the AppShell top
 * bar. `compact` renders an icon-only button (mobile / tight bars); the full form
 * shows a search-box affordance with the Cmd-K hint.
 */
export default function SearchTrigger({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { open } = useCommandPalette();

  if (compact) {
    return (
      <button
        onClick={open}
        aria-label="Search"
        className={`inline-flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer ${className}`}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={open}
      aria-label="Search"
      className={`inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface/60 px-3 py-1.5 text-sm text-text-muted hover:text-foreground hover:border-accent/40 transition-colors cursor-pointer ${className}`}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">Search</span>
      <kbd className="hidden md:inline px-1.5 py-0.5 rounded border border-surface-border bg-background/60 font-mono text-[10px] text-text-muted">
        ⌘K
      </kbd>
    </button>
  );
}
