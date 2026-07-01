"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Check, Search, Layers } from "lucide-react";
import DetailModal from "@/components/ui/DetailModal";
import { allControls, CONTROL_CATEGORY_ORDER, CONTROL_CATEGORY_LABEL } from "@/data/controls";
import type { ControlCategory } from "@/data/controls/types";

export default function AddControlsModal({
  open,
  onClose,
  selected,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onAdd: (slug: string) => void;
  onRemove: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ControlCategory | null>(null);

  // The modal stays mounted while closed, so reset its search/category each time
  // it opens rather than reopening onto the previous (stale) filter.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setQuery(""); setCat(null); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allControls.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (!q) return true;
      return (c.name + " " + c.plainSummary + " " + CONTROL_CATEGORY_LABEL[c.category]).toLowerCase().includes(q);
    });
  }, [query, cat]);

  const byCat = useMemo(() => {
    const m = new Map<ControlCategory, typeof allControls>();
    for (const c of filtered) {
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return m;
  }, [filtered]);

  return (
    <DetailModal open={open} onClose={onClose} title="Add controls" subtitle={`${selected.length} in your register, ${allControls.length} in the catalogue`} icon={Layers} size="xl">
      {/* Search + category filter */}
      <div className="sticky top-0 -mt-1 pt-1 pb-3 bg-background z-10 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search controls..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCat(null)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${cat === null ? "bg-accent text-white" : "glass-card text-text-muted hover:text-foreground"}`}>All</button>
          {CONTROL_CATEGORY_ORDER.map((k) => (
            <button key={k} onClick={() => setCat(cat === k ? null : k)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${cat === k ? "bg-accent text-white" : "glass-card text-text-muted hover:text-foreground"}`}>{CONTROL_CATEGORY_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {CONTROL_CATEGORY_ORDER.filter((k) => byCat.has(k)).map((k) => (
          <div key={k}>
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">{CONTROL_CATEGORY_LABEL[k]}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {byCat.get(k)!.map((c) => {
                const on = selected.includes(c.slug);
                return (
                  <button key={c.slug} onClick={() => (on ? onRemove(c.slug) : onAdd(c.slug))} className={`text-left rounded-lg border p-2.5 transition-colors flex items-start gap-2 ${on ? "border-accent bg-accent/[0.06]" : "border-surface-border bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                    <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${on ? "border-accent bg-accent text-white" : "border-surface-border"}`}>{on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-text-muted" />}</span>
                    <span className="min-w-0"><span className="block text-sm font-medium text-foreground leading-tight">{c.name}</span><span className="block text-xs text-text-muted line-clamp-2 mt-0.5">{c.plainSummary}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-text-muted py-10">No controls match your search.</p>}
      </div>
    </DetailModal>
  );
}
