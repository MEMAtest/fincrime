"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, SlidersHorizontal, Plus, ChevronDown, FileText as FileIcon, LayoutGrid, Table as TableIcon,
  ShieldCheck, CheckCircle2, Clock3, AlertTriangle, Eye, Flag, Bookmark, Info,
} from "lucide-react";
import PDFExportButton from "@/components/shared/PDFExportButton";
import ControlDetailPanel from "./ControlDetailPanel";
import { isReferenceModalOpen } from "@/lib/modal-registry";
import { StatusBadge, PriorityBadge, STATUS_META } from "@/components/controls/ControlBits";
import { CONTROL_CATEGORY_ORDER, CONTROL_CATEGORY_LABEL, defaultPriority, evidenceCount } from "@/data/controls";
import type { Control, ControlOverride, ControlStatus, ControlPriority, ControlCategory } from "@/data/controls/types";

type StatusTab = "all" | "in_progress" | "gaps" | "needs_review" | "implemented";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All Controls" },
  { id: "in_progress", label: "In Progress" },
  { id: "gaps", label: "Gaps" },
  { id: "needs_review", label: "Needs Review" },
  { id: "implemented", label: "Completed" },
];

const eStatus = (o: ControlOverride | undefined): ControlStatus => o?.status ?? "not_started";
const ePriority = (c: Control, o: ControlOverride | undefined): ControlPriority => o?.priority ?? defaultPriority(c);

export default function RegisterTable({
  controls,
  overrides,
  setOverride,
  tested,
  onToggleTest,
  activeSlug,
  setActiveSlug,
  onEdit,
  onAdd,
  contextLabel,
}: {
  controls: Control[];
  overrides: Record<string, ControlOverride>;
  setOverride: (slug: string, patch: Partial<ControlOverride>) => void;
  tested: Record<string, number[]>;
  onToggleTest: (slug: string, idx: number) => void;
  activeSlug: string | null;
  setActiveSlug: (slug: string | null) => void;
  onEdit: (slug: string) => void;
  onAdd: () => void;
  contextLabel?: string;
}) {
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<ControlCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ControlStatus | "all">("all");
  const [prioFilter, setPrioFilter] = useState<ControlPriority | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const kpis = useMemo(() => {
    let implemented = 0, inProgress = 0, gaps = 0, needsReview = 0, high = 0;
    const cats = new Set<ControlCategory>();
    for (const c of controls) {
      const s = eStatus(overrides[c.slug]);
      if (s === "implemented") implemented++;
      else if (s === "in_progress") inProgress++;
      else if (s === "gaps") gaps++;
      else if (s === "needs_review") needsReview++;
      if (ePriority(c, overrides[c.slug]) === "high") high++;
      cats.add(c.category);
    }
    return { total: controls.length, implemented, inProgress, gaps, needsReview, high, catCount: cats.size };
  }, [controls, overrides]);

  const tabCounts = useMemo(() => {
    const counts = { all: controls.length, in_progress: 0, gaps: 0, needs_review: 0, implemented: 0 } as Record<StatusTab, number>;
    for (const c of controls) {
      const s = eStatus(overrides[c.slug]);
      if (s === "in_progress") counts.in_progress++;
      else if (s === "gaps") counts.gaps++;
      else if (s === "needs_review") counts.needs_review++;
      else if (s === "implemented") counts.implemented++;
    }
    return counts;
  }, [controls, overrides]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const c of controls) { const o = overrides[c.slug]?.owner?.trim(); if (o) set.add(o); }
    return [...set].sort();
  }, [controls, overrides]);

  // If the selected owner no longer exists (firm switch / owner cleared), fall
  // back to "all" so a stale filter can't silently empty the table with no
  // matching dropdown option to explain it.
  const effectiveOwnerFilter =
    ownerFilter !== "all" && ownerFilter !== "__unassigned__" && !owners.includes(ownerFilter) ? "all" : ownerFilter;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return controls.filter((c) => {
      const o = overrides[c.slug];
      const s = eStatus(o);
      if (tab !== "all" && s !== tab) return false;
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (catFilter !== "all" && c.category !== catFilter) return false;
      if (prioFilter !== "all" && ePriority(c, o) !== prioFilter) return false;
      if (effectiveOwnerFilter !== "all") {
        const owner = o?.owner?.trim() ?? "";
        if (effectiveOwnerFilter === "__unassigned__" ? owner !== "" : owner !== effectiveOwnerFilter) return false;
      }
      if (q && !(c.name + " " + c.plainSummary + " " + CONTROL_CATEGORY_LABEL[c.category]).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [controls, overrides, tab, statusFilter, catFilter, prioFilter, effectiveOwnerFilter, search]);

  // Reset pagination when the underlying register changes (firm switch, add,
  // remove) so a stale page number can't resurface after the list regrows.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [controls]);

  // The detail drawer is a modal layer: lock body scroll and close on Escape
  // (deferring to a nested reference modal if one is open above it).
  useEffect(() => {
    if (!activeSlug) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isReferenceModalOpen()) setActiveSlug(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [activeSlug, setActiveSlug]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const clearAll = () => { setCatFilter("all"); setStatusFilter("all"); setPrioFilter("all"); setOwnerFilter("all"); setSearch(""); setTab("all"); setPage(1); };
  const anyFilter = catFilter !== "all" || statusFilter !== "all" || prioFilter !== "all" || effectiveOwnerFilter !== "all" || search !== "" || tab !== "all";

  const active = activeSlug ? controls.find((c) => c.slug === activeSlug) : undefined;
  const exportData = { controlSlugs: controls.map((c) => c.slug), overrides, context: contextLabel };

  const onFilterChange = () => setPage(1);

  return (
    <div className="px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0 mt-0.5"><ShieldCheck className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground leading-tight">Control Register</h1>
            <p className="text-sm text-text-muted mt-0.5">Maintain a defensible control framework aligned to your regulatory obligations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); onFilterChange(); }} placeholder="Search controls by name or keyword..." className="w-64 pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" />
          </div>
          <PDFExportButton module="control_register" assessmentData={exportData} formats={["pdf"]} />
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors">
            <Plus className="h-4 w-4" /> Add control
          </button>
        </div>
      </div>

      {/* Active scope (from an enforcement case / typology / firm context) */}
      {contextLabel && (
        <div className="mb-4 flex items-start gap-2 text-xs text-text-muted glass-card rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
          <span>{contextLabel}</span>
        </div>
      )}

      {/* Mobile search (the header search is desktop-only) */}
      <div className="relative sm:hidden mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); onFilterChange(); }} placeholder="Search controls..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Kpi icon={ShieldCheck} tint="text-accent" bg="bg-accent/10" label="Total Controls" value={kpis.total} sub={`Across ${kpis.catCount} categories`} />
        <Kpi icon={CheckCircle2} tint="text-emerald-500" bg="bg-emerald-500/10" label="Implemented" value={kpis.implemented} sub={pct(kpis.implemented, kpis.total)} />
        <Kpi icon={Clock3} tint="text-amber-500" bg="bg-amber-500/10" label="In Progress" value={kpis.inProgress} sub={pct(kpis.inProgress, kpis.total)} />
        <Kpi icon={AlertTriangle} tint="text-red-500" bg="bg-red-500/10" label="Gaps" value={kpis.gaps} sub={pct(kpis.gaps, kpis.total)} />
        <Kpi icon={Eye} tint="text-violet-500" bg="bg-violet-500/10" label="Needs Review" value={kpis.needsReview} sub={pct(kpis.needsReview, kpis.total)} />
        <Kpi icon={Flag} tint="text-rose-500" bg="bg-rose-500/10" label="High Priority" value={kpis.high} sub={pct(kpis.high, kpis.total)} />
      </div>

      <div className="block">
        {/* Table */}
        <div className="min-w-0 glass-card rounded-2xl overflow-hidden">
          {/* Status tabs */}
          <div className="flex items-center gap-1 px-3 border-b border-surface-border overflow-x-auto">
            {STATUS_TABS.map((t) => {
              const isActive = tab === t.id;
              const count = tabCounts[t.id];
              return (
                <button key={t.id} onClick={() => { setTab(t.id); onFilterChange(); }} aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${isActive ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-foreground"}`}>
                  {t.label}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full tabular-nums ${isActive ? "bg-accent/12 text-accent" : "bg-white/5 text-text-muted"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border flex-wrap">
            <Select value={catFilter} onChange={(v) => { setCatFilter(v as ControlCategory | "all"); onFilterChange(); }} label="Category" options={[["all", "Category"], ...CONTROL_CATEGORY_ORDER.map((c) => [c, CONTROL_CATEGORY_LABEL[c]] as [string, string])]} />
            <Select value={statusFilter} onChange={(v) => { setStatusFilter(v as ControlStatus | "all"); onFilterChange(); }} label="Status" options={[["all", "Status"], ...(["not_started", "in_progress", "needs_review", "gaps", "implemented"] as ControlStatus[]).map((s) => [s, STATUS_META[s].label] as [string, string])]} />
            <Select value={prioFilter} onChange={(v) => { setPrioFilter(v as ControlPriority | "all"); onFilterChange(); }} label="Priority" options={[["all", "Priority"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
            <Select value={effectiveOwnerFilter} onChange={(v) => { setOwnerFilter(v); onFilterChange(); }} label="Owner" options={[["all", "Owner"], ["__unassigned__", "Unassigned"], ...owners.map((o) => [o, o] as [string, string])]} />
            {anyFilter && <button onClick={clearAll} className="text-sm text-accent hover:underline ml-1">Clear all</button>}
            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-border text-xs text-text-muted/70"><Bookmark className="h-3.5 w-3.5" /> Saved views <span className="text-[9px] uppercase tracking-wide border border-surface-border rounded px-1">Soon</span></span>
              <div className="inline-flex rounded-lg border border-surface-border overflow-hidden">
                <button onClick={() => setViewMode("table")} aria-pressed={viewMode === "table"} className={`p-1.5 ${viewMode === "table" ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-surface-hover"}`} title="Table view"><TableIcon className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"} className={`p-1.5 ${viewMode === "cards" ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-surface-hover"}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Rows */}
          {pageRows.length === 0 ? (
            <div className="p-12 text-center">
              <SlidersHorizontal className="h-7 w-7 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">No controls match these filters.{anyFilter && <> <button onClick={clearAll} className="text-accent hover:underline">Clear all</button></>}</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-surface-border">
                    <Th>Control</Th><Th>Category</Th><Th>Status</Th><Th>Priority</Th><Th>Owner</Th><Th>Last Review</Th><Th>Evidence</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => {
                    const o = overrides[c.slug];
                    const isActive = c.slug === activeSlug;
                    return (
                      <tr key={c.slug} onClick={() => setActiveSlug(c.slug)}
                        className={`border-b border-surface-border/60 last:border-0 cursor-pointer transition-colors ${isActive ? "bg-accent/[0.06]" : "hover:bg-surface-hover"}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground leading-tight">{c.name}</div>
                          <div className="text-xs text-text-muted line-clamp-1 max-w-md">{c.plainSummary}</div>
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">{CONTROL_CATEGORY_LABEL[c.category]}</td>
                        <td className="px-4 py-3"><StatusBadge status={eStatus(o)} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={ePriority(c, o)} /></td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">{o?.owner?.trim() || <span className="text-text-muted/60">Unassigned</span>}</td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">{o?.lastReview?.trim() || <span className="text-text-muted/60">Not set</span>}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-text-muted"><FileIcon className="h-3.5 w-3.5" />{evidenceCount(c)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 p-4">
              {pageRows.map((c) => {
                const o = overrides[c.slug];
                const isActive = c.slug === activeSlug;
                return (
                  <button key={c.slug} onClick={() => setActiveSlug(c.slug)} className={`text-left rounded-xl border p-4 transition-colors ${isActive ? "border-accent bg-accent/[0.06]" : "border-surface-border hover:bg-surface-hover"}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-foreground leading-tight">{c.name}</span>
                      <StatusBadge status={eStatus(o)} />
                    </div>
                    <p className="text-xs text-text-muted line-clamp-2 mb-2">{c.plainSummary}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <PriorityBadge priority={ePriority(c, o)} />
                      <span>{CONTROL_CATEGORY_LABEL[c.category]}</span>
                      <span className="ml-auto inline-flex items-center gap-1"><FileIcon className="h-3.5 w-3.5" />{evidenceCount(c)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-surface-border flex-wrap">
            <p className="text-xs text-text-muted">
              {filtered.length === 0 ? "No controls" : `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} controls`}
            </p>
            <div className="flex items-center gap-3">
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} aria-current={p === safePage ? "page" : undefined}
                      className={`h-8 min-w-8 px-2 rounded-lg text-sm tabular-nums transition-colors ${p === safePage ? "bg-accent text-white" : "text-text-muted hover:bg-surface-hover"}`}>{p}</button>
                  ))}
                </div>
              )}
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-white/5 text-xs text-foreground focus:outline-none focus:border-accent cursor-pointer">
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Detail panel: right slide-over drawer with dimming backdrop (never blocks the table) */}
        {active && (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setActiveSlug(null)} />
            <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-background border-l border-surface-border shadow-2xl overflow-hidden">
              <ControlDetailPanel
                control={active}
                override={overrides[active.slug] ?? {}}
                setOverride={(patch) => setOverride(active.slug, patch)}
                tested={tested[active.slug] ?? []}
                onToggleTest={(idx) => onToggleTest(active.slug, idx)}
                onEdit={() => onEdit(active.slug)}
                onClose={() => setActiveSlug(null)}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function pct(n: number, total: number) {
  if (!total) return "0% of total";
  return `${Math.round((n / total) * 100)}% of total`;
}

function Kpi({ icon: Icon, tint, bg, label, value, sub }: { icon: typeof ShieldCheck; tint: string; bg: string; label: string; value: number; sub: string }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-8 w-8 rounded-lg grid place-items-center ${bg} ${tint}`}><Icon className="h-4 w-4" /></span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-text-muted mt-1">{sub}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-surface-border bg-white/5 text-xs font-medium text-foreground focus:outline-none focus:border-accent cursor-pointer">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-muted" />
    </div>
  );
}
