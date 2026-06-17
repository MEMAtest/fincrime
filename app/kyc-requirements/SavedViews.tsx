"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Plus, X, ChevronDown, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_LABEL } from "@/data/kyc/types";

const KEY = "kyc-saved-views";
const RISK_SHORT: Record<RiskLevel, string> = { low: "Lower", medium: "Medium", high: "Higher" };

interface View {
  entity: EntityType;
  jurisdiction: Jurisdiction;
  risk: RiskLevel;
  label: string;
}

const viewId = (v: { entity: string; jurisdiction: string; risk: string }) => `${v.entity}|${v.jurisdiction}|${v.risk}`;

export default function SavedViews({
  entity,
  jurisdiction,
  risk,
}: {
  entity: EntityType;
  jurisdiction: Jurisdiction;
  risk: RiskLevel;
}) {
  const router = useRouter();
  const [views, setViews] = useState<View[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved views from localStorage (external store) on mount
      if (raw) setViews(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persist = (next: View[]) => {
    setViews(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const current: View = {
    entity,
    jurisdiction,
    risk,
    label: `${ENTITY_LABEL[entity]} · ${JURISDICTION_LABEL[jurisdiction]} · ${RISK_SHORT[risk]}`,
  };
  const isSaved = views.some((v) => viewId(v) === viewId(current));

  const saveCurrent = () => { if (!isSaved) persist([current, ...views].slice(0, 20)); };
  const remove = (v: View) => persist(views.filter((x) => viewId(x) !== viewId(v)));
  const load = (v: View) => {
    setOpen(false);
    router.replace(`/kyc-requirements?entity=${v.entity}&jurisdiction=${v.jurisdiction}&risk=${v.risk}`, { scroll: false });
  };

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <Bookmark className="h-4 w-4" />
        Saved views{views.length ? ` (${views.length})` : ""}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-72 rounded-lg border border-surface-border bg-background shadow-lg overflow-hidden">
            <button
              onClick={saveCurrent}
              disabled={isSaved}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-surface-hover disabled:opacity-50 disabled:cursor-default border-b border-surface-border"
            >
              {isSaved ? <Check className="h-4 w-4 text-emerald-500" /> : <Plus className="h-4 w-4 text-accent" />}
              {isSaved ? "Current view is saved" : "Save current view"}
            </button>
            {views.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-muted">No saved views yet.</p>
            ) : (
              <ul className="max-h-64 overflow-auto">
                {views.map((v) => (
                  <li key={viewId(v)} className="flex items-center gap-1 px-1">
                    <button onClick={() => load(v)} className="flex-1 px-2 py-2 text-xs text-left text-foreground hover:bg-surface-hover rounded">
                      {v.label}
                    </button>
                    <button onClick={() => remove(v)} aria-label="Remove" className="p-1.5 text-text-muted hover:text-risk-high">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="px-3 py-2 text-[11px] text-text-muted border-t border-surface-border">
              Saved in this browser only (no account needed).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
