"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, CornerDownLeft, Layers, Target, Scale, BookOpen, Building2, IdCard, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { track } from "@vercel/analytics";
import {
  buildSearchIndex, scoreItem, GROUP_ORDER,
  type SearchItem, type SearchGroup,
} from "./searchIndex";

const GROUP_ICON: Record<SearchGroup, LucideIcon> = {
  Typologies: Target,
  Controls: Layers,
  Enforcement: Scale,
  Glossary: BookOpen,
  "Firm profiles": Building2,
  KYC: IdCard,
  "Go to": ArrowRight,
};

const RECENT_KEY = "fincrime-search-recent";
const MAX_PER_GROUP = 5;
const MAX_RECENT = 6;

export default function CommandPalette({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (item: SearchItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildSearchIndex(), []);
  const recent = useMemo<SearchItem[]>(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      return ids
        .map((id) => index.find((i) => i.id === id))
        .filter(Boolean)
        .slice(0, MAX_RECENT) as SearchItem[];
    } catch {
      return [];
    }
  }, [index]);

  const { groups, flat } = useMemo(() => {
    const raw = query.trim().toLowerCase();
    const tokens = raw.split(/\s+/).filter(Boolean);
    let picked: SearchItem[];
    if (!tokens.length) {
      // Empty query: recents, then all tools, then a few typologies to explore.
      const tools = index.filter((i) => i.group === "Go to");
      const suggested = index.filter((i) => i.group === "Typologies").slice(0, 4);
      const seen = new Set<string>();
      picked = [...recent, ...tools, ...suggested].filter((i) =>
        seen.has(i.id) ? false : (seen.add(i.id), true)
      );
    } else {
      picked = index
        .map((i) => ({ i, s: scoreItem(i, tokens, raw) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.i);
    }
    const byGroup = new Map<SearchGroup, SearchItem[]>();
    for (const item of picked) {
      const arr = byGroup.get(item.group) ?? [];
      if (arr.length < MAX_PER_GROUP) {
        arr.push(item);
        byGroup.set(item.group, arr);
      }
    }
    const groupsOut: { group: SearchGroup; items: SearchItem[] }[] = [];
    const flatOut: SearchItem[] = [];
    for (const g of GROUP_ORDER) {
      const arr = byGroup.get(g);
      if (arr && arr.length) {
        groupsOut.push({ group: g, items: arr });
        flatOut.push(...arr);
      }
    }
    return { groups: groupsOut, flat: flatOut };
  }, [query, index, recent]);

  // Reset the highlight to the top row whenever the query changes. Done during
  // render (the sanctioned "derive from previous render" pattern) rather than in
  // an effect, so it doesn't cascade an extra render.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActiveIdx(0);
  }

  // Log zero-result queries once the input settles (no setState here).
  useEffect(() => {
    const raw = query.trim();
    if (raw.length >= 2 && flat.length === 0) {
      const t = setTimeout(() => track("search_zero_results", { query: raw.slice(0, 60) }), 500);
      return () => clearTimeout(t);
    }
  }, [query, flat.length]);

  useEffect(() => {
    track("search_open");
    inputRef.current?.focus();
    const prevActive = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      prevActive?.focus?.();
    };
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const commit = (item: SearchItem | undefined) => {
    if (!item) return;
    try {
      const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      const next = [item.id, ...ids.filter((x) => x !== item.id)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    track("search_select", { group: item.group });
    onSelect(item);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(flat[activeIdx]);
    }
  };

  if (typeof document === "undefined") return null;

  const kbd = "px-1.5 py-0.5 rounded border border-surface-border bg-surface/60 font-mono text-[10px]";

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh] bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="flex flex-col w-full sm:max-w-xl bg-background sm:rounded-2xl border border-surface-border shadow-2xl h-full sm:h-auto sm:max-h-[70vh] overflow-hidden"
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-surface-border shrink-0">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[activeIdx] ? `cmdk-${flat[activeIdx].id}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search typologies, controls, cases, terms..."
            aria-label="Search"
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} id="cmdk-list" role="listbox" aria-label="Search results" className="overflow-y-auto flex-1 py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              No results for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {group}
                </p>
                {items.map((item) => {
                  const idx = flat.indexOf(item);
                  const Icon = GROUP_ICON[item.group];
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      id={`cmdk-${item.id}`}
                      data-idx={idx}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => setActiveIdx(idx)}
                      onClick={() => commit(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors ${
                        active ? "bg-accent/10" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-text-muted"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground truncate">{item.title}</span>
                        <span className="block text-xs text-text-muted truncate">{item.subtitle}</span>
                      </span>
                      {active && <CornerDownLeft className="h-3.5 w-3.5 text-text-muted shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints (desktop only) */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-surface-border text-[11px] text-text-muted shrink-0">
          <span className="inline-flex items-center gap-1"><kbd className={kbd}>↑</kbd><kbd className={kbd}>↓</kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><kbd className={kbd}>↵</kbd> open</span>
          <span className="inline-flex items-center gap-1"><kbd className={kbd}>esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
