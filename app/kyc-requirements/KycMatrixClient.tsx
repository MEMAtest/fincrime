"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Building2, Globe2, ShieldCheck, ChevronDown, ChevronRight, Search, RotateCcw,
  CheckCircle2, HelpCircle, MinusCircle, AlertTriangle, FileText, ClipboardList, BookOpen, FileCheck2,
  Share2, Check, ListChecks, ChevronsDownUp, ChevronsUpDown, Gavel, Layers,
} from "lucide-react";
import { track } from "@vercel/analytics";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import SourceBadge from "@/components/shared/SourceBadge";
import GlossaryTerm from "@/components/shared/GlossaryTerm";
import GlossaryText from "@/components/shared/GlossaryText";
import MultiSelect from "@/components/shared/MultiSelect";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { buildMergedRequirements, mergedStatus, type MergedRequirement } from "@/data/kyc/merge";
import { parseListParam } from "@/lib/list-params";
import type { EntityType, Jurisdiction, RiskLevel, CddCategoryKey, RequirementStatus } from "@/data/kyc/types";
import {
  ENTITY_ORDER, JURISDICTION_ORDER, ENTITY_LABEL, JURISDICTION_LABEL,
  CATEGORY_TITLE, CATEGORY_ORDER,
} from "@/data/kyc/types";
import { JURISDICTION_SUMMARY } from "@/data/kyc/summaries";
import ToolPageHeader from "@/components/shared/ToolPageHeader";

const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: "low", label: "Lower risk (SDD)" },
  { value: "medium", label: "Standard CDD (Medium)" },
  { value: "high", label: "Higher risk (EDD)" },
];

type FilterKey = "required" | "conditional" | "not_applicable" | "edd";

const STATUS_PILL: Record<string, string> = {
  required: "bg-accent/12 text-accent",
  conditional: "bg-amber-500/12 text-amber-500",
  not_applicable: "bg-white/10 text-text-muted",
  edd: "bg-risk-high/12 text-risk-high",
};

export default function KycMatrixClient({
  entity,
  jurisdiction,
  risk,
}: {
  entity: string;
  jurisdiction: string;
  risk: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const ents = useMemo(() => parseListParam(entity, { allow: ENTITY_ORDER, fallback: ["corporate"] }) as EntityType[], [entity]);
  const jurs = useMemo(() => parseListParam(jurisdiction, { allow: JURISDICTION_ORDER, fallback: ["uk"] }) as Jurisdiction[], [jurisdiction]);
  const rks = useMemo(() => parseListParam(risk, { allow: ["low", "medium", "high"], fallback: ["medium"] }) as RiskLevel[], [risk]);

  const setDim = (dim: "entity" | "jurisdiction" | "risk", values: string[]) => {
    const params = new URLSearchParams();
    params.set("entity", (dim === "entity" ? values : ents).join(","));
    params.set("jurisdiction", (dim === "jurisdiction" ? values : jurs).join(","));
    params.set("risk", (dim === "risk" ? values : rks).join(","));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const merged = useMemo(() => buildMergedRequirements(ents, jurs), [ents, jurs]);
  const reqs = merged.requirements;
  const multiScenario = merged.scenarios.length > 1;
  const multiJur = jurs.length > 1;

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [copied, setCopied] = useState(false);
  // Open only the first category by default so the page reads as a short,
  // scannable list of sections; the user opens one at a time (progressive
  // disclosure) instead of scrolling a fully-expanded wall.
  const [openCats, setOpenCats] = useState<Set<CddCategoryKey>>(() => new Set(CATEGORY_ORDER.slice(0, 1)));
  const [openReqs, setOpenReqs] = useState<Set<string>>(() => new Set(reqs[0] ? [reqs[0].key] : []));

  // Working checklist (collected/done), keyed by the sorted multi-selection so each
  // scenario set has its own progress. Requirement keys are risk-independent.
  const checklistKey = `kyc-checklist:${[...ents].sort().join(",")}|${[...jurs].sort().join(",")}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    let next = new Set<string>();
    try {
      const raw = localStorage.getItem(checklistKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) next = new Set(parsed.filter((x) => typeof x === "string"));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the per-selection checklist from localStorage
    setDone(next);
  }, [checklistKey]);
  const toggleDone = (key: string) =>
    setDone((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key); else n.add(key);
      try { localStorage.setItem(checklistKey, JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  const resetChecklist = () => {
    setDone(new Set());
    try { localStorage.removeItem(checklistKey); } catch { /* ignore */ }
  };
  const collected = reqs.filter((r) => done.has(r.key)).length;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const toggleCat = (c: CddCategoryKey) =>
    setOpenCats((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  // Profile-summary tiles jump to their detail: open the category, then scroll to it.
  const openCategory = (c: CddCategoryKey) => {
    track("kyc_profile_tile", { category: c });
    setOpenCats((p) => new Set(p).add(c));
    requestAnimationFrame(() =>
      document.getElementById(`kyc-cat-${c}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };
  const toggleReq = (key: string) =>
    setOpenReqs((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleFilter = (k: FilterKey) =>
    setFilters((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const allExpanded = reqs.length > 0 && reqs.every((r) => openReqs.has(r.key));
  const toggleExpandAll = () => {
    if (allExpanded) { setOpenReqs(new Set()); }
    else { setOpenCats(new Set(CATEGORY_ORDER)); setOpenReqs(new Set(reqs.map((r) => r.key))); }
  };

  const stOf = (r: MergedRequirement): RequirementStatus => mergedStatus(r, rks);
  const bucketOf = (r: MergedRequirement): FilterKey => (r.eddTrigger ? "edd" : (stOf(r) as FilterKey));

  // Summary counts: EDD triggers counted separately from required/conditional/not-applicable.
  const nonEdd = reqs.filter((r) => !r.eddTrigger);
  const counts = {
    required: nonEdd.filter((r) => stOf(r) === "required").length,
    conditional: nonEdd.filter((r) => stOf(r) === "conditional").length,
    not_applicable: nonEdd.filter((r) => stOf(r) === "not_applicable").length,
    edd: reqs.length - nonEdd.length,
    total: reqs.length,
  };
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  // Lowercased search haystack per requirement, recomputed only when the superset changes.
  const haystacks = useMemo(
    () =>
      new Map(
        reqs.map((r) => [
          r.key,
          [
            r.title, r.whatItMeans, r.ruleSummary ?? "",
            ...r.whatToCollect, ...r.evidence,
            ...r.documentGuidance.flatMap((jd) => jd.guidance.flatMap((g) => [g.label, ...g.accepted])),
            ...r.legalBasis.flatMap((b) => [b.org, b.reference, b.title]),
            ...r.appliesTo.flatMap((a) => [ENTITY_LABEL[a.entity], JURISDICTION_LABEL[a.jurisdiction]]),
            CATEGORY_TITLE[r.category],
          ].join(" ").toLowerCase(),
        ])
      ),
    [reqs]
  );

  const matches = (r: MergedRequirement) => {
    const s = search.trim().toLowerCase();
    const textOk = !s || (haystacks.get(r.key) ?? "").includes(s);
    const statusOk = filters.size === 0 || filters.has(bucketOf(r));
    return textOk && statusOk;
  };

  const groups = CATEGORY_ORDER.map((cat) => ({ cat, all: reqs.filter((r) => r.category === cat) })).filter((g) => g.all.length > 0);

  const statBar: { key: FilterKey; label: string; value: number; icon: typeof CheckCircle2; color: string }[] = [
    { key: "required", label: "Required", value: counts.required, icon: CheckCircle2, color: "text-accent" },
    { key: "conditional", label: "Conditional", value: counts.conditional, icon: HelpCircle, color: "text-amber-500" },
    { key: "not_applicable", label: "Not applicable", value: counts.not_applicable, icon: MinusCircle, color: "text-text-muted" },
    { key: "edd", label: "EDD triggers", value: counts.edd, icon: AlertTriangle, color: "text-risk-high" },
  ];

  const filterPills: { value: FilterKey; label: string }[] = [
    { value: "required", label: "Required" },
    { value: "conditional", label: "Conditional" },
    { value: "not_applicable", label: "Not applicable" },
    { value: "edd", label: "EDD triggers" },
  ];

  const statusBadge = (r: MergedRequirement) => {
    if (r.eddTrigger) return { key: "edd", label: "EDD trigger" };
    const st = stOf(r);
    return { key: st, label: st === "required" ? "Required" : st === "conditional" ? "Conditional" : "Not applicable" };
  };

  const tagLabel = (entityType: EntityType, j: Jurisdiction) => `${ENTITY_LABEL[entityType]} · ${JURISDICTION_LABEL[j]}`;

  return (
    <ToolFrame>
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ToolPageHeader
            eyebrow="02 · KYC / CDD MATRIX"
            title="KYC / CDD Requirements"
            titleAccent="Matrix"
            subtitle="A working reference and checklist. Pick one or more entity types, jurisdictions and risk levels to see a combined, de-duplicated view of what to collect, what the rules say, and tick off what you have. Every requirement is mapped to its primary-source regulatory reference."
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={share}>
                  {copied ? <Check className="h-4 w-4 text-accent" /> : <Share2 className="h-4 w-4" />}
                  {copied ? "Copied" : "Share"}
                </Button>
                <PDFExportButton
                  module="kyc_requirements"
                  assessmentData={{ entities: ents, jurisdictions: jurs, risks: rks, completed: reqs.filter((r) => done.has(r.key)).map((r) => r.key) }}
                  formats={["pdf", "docx"]}
                />
              </div>
            }
          />

          {/* Selector bar (relative z-20 so the open dropdowns paint above the
              glass-card summaries below, which each form their own stacking context) */}
          <div className="relative z-20 glass-card rounded-2xl p-4 sm:p-5 mt-5 grid sm:grid-cols-3 gap-4 items-end">
            <MultiSelect label="Entity / Customer Type" icon={Building2} selected={ents}
              onChange={(v) => setDim("entity", v)} options={ENTITY_ORDER.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))} />
            <MultiSelect label="Jurisdiction" icon={Globe2} selected={jurs}
              onChange={(v) => setDim("jurisdiction", v)} options={JURISDICTION_ORDER.map((j) => ({ value: j, label: JURISDICTION_LABEL[j] }))} />
            <MultiSelect label="CDD Level / Risk Context" icon={ShieldCheck} selected={rks}
              onChange={(v) => setDim("risk", v)} options={RISK_OPTIONS} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-muted">
              {merged.scenarios.length} scenario{merged.scenarios.length === 1 ? "" : "s"} combined
              {merged.anyFallback ? " · FATF baseline used where a cell is not authored" : ""}
            </p>
            <button onClick={() => router.replace(`${pathname}?entity=corporate&jurisdiction=uk&risk=medium`, { scroll: false })}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reset selection
            </button>
          </div>

          {/* Mini regulatory summaries (one per selected jurisdiction) */}
          <div className={`mt-5 grid gap-3 ${jurs.length > 1 ? "md:grid-cols-2" : ""}`}>
            {jurs.map((j) => {
              const summary = JURISDICTION_SUMMARY[j];
              return (
                <div key={j} className="glass-card rounded-2xl p-4">
                  {multiJur && <p className="text-xs font-semibold text-accent mb-2">{JURISDICTION_LABEL[j]}</p>}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-accent" /> Source</p>
                      <p className="text-sm text-foreground font-medium mt-1">{summary.primaryLaw}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5 text-accent" /> Regulator</p>
                      <p className="text-sm text-foreground font-medium mt-1">{summary.regulator}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-accent" /> Covers</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {summary.covers.map((c, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected scenarios */}
          {multiScenario && (
            <div className="glass-card rounded-2xl p-4 mt-4">
              <p className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1.5 mb-2"><Layers className="h-3.5 w-3.5 text-accent" /> Scenarios combined</p>
              <div className="flex flex-wrap gap-1.5">
                {merged.scenarios.map((s) => (
                  <span key={`${s.entity}-${s.jurisdiction}`} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-surface-border text-foreground">
                    {tagLabel(s.entity, s.jurisdiction)}{s.fallback ? " (FATF)" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Profile summary: "for this profile, you typically need X" (above the detail) */}
          {groups.length > 0 && (() => {
            const highSelected = rks.includes("high");
            const cddTier = highSelected
              ? "Enhanced due diligence (EDD)"
              : rks.length === 1 && rks[0] === "low"
                ? "Simplified due diligence (SDD)"
                : "Standard CDD";
            const headline = merged.scenarios.length === 1
              ? `${ENTITY_LABEL[merged.scenarios[0].entity]} · ${JURISDICTION_LABEL[merged.scenarios[0].jurisdiction]} · ${cddTier}`
              : `${merged.scenarios.length} scenarios combined · ${cddTier}`;
            return (
              <div className="glass-card rounded-2xl p-4 sm:p-5 mt-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">For this profile</span>
                  <h2 className="text-sm sm:text-base font-semibold text-foreground">{headline}</h2>
                  <span className="text-xs text-text-muted">you typically need:</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                  {groups.map(({ cat, all }) => {
                    const catNonEdd = all.filter((r) => !r.eddTrigger);
                    const requiredReqs = catNonEdd.filter((r) => stOf(r) === "required");
                    const topTitles = requiredReqs.slice(0, 3).map((r) => r.title);
                    const eddCount = all.filter((r) => r.eddTrigger).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => openCategory(cat)}
                        className="glass-card rounded-xl p-3 text-left card-hover cursor-pointer flex flex-col"
                        aria-label={`${CATEGORY_TITLE[cat]}: ${requiredReqs.length} required. Open details.`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground leading-snug">{CATEGORY_TITLE[cat]}</p>
                          <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">{requiredReqs.length}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">required</p>
                        <ul className="mt-2 space-y-1 flex-1">
                          {topTitles.map((t) => (
                            <li key={t} className="text-[11px] text-text-muted leading-snug flex gap-1">
                              <Check className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                              <span className="line-clamp-1">{t}</span>
                            </li>
                          ))}
                          {requiredReqs.length === 0 && (
                            <li className="text-[11px] text-text-muted/70">None at this risk level</li>
                          )}
                          {requiredReqs.length > 3 && (
                            <li className="text-[10px] text-text-muted/70">+{requiredReqs.length - 3} more</li>
                          )}
                        </ul>
                        {highSelected && eddCount > 0 && (
                          <span className="mt-2 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-risk-high/10 text-risk-high w-fit">
                            +{eddCount} EDD
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Summary stat bar */}
          <div className="glass-card rounded-2xl p-4 mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="pr-6 border-r border-surface-border">
              <div className="text-2xl font-bold leading-none">{counts.total}</div>
              <div className="text-xs text-text-muted mt-1">Total requirements</div>
            </div>
            {statBar.map((s) => (
              <button key={s.key} onClick={() => toggleFilter(s.key)} aria-pressed={filters.has(s.key)}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors ${filters.has(s.key) ? "bg-white/10" : "hover:bg-white/5"}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div className="text-left">
                  <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                  <span className="text-xs text-text-muted ml-2">{s.label} · {pct(s.value)}%</span>
                </div>
              </button>
            ))}
          </div>

          {/* Checklist progress */}
          <div className="glass-card rounded-xl p-3 mt-3 flex items-center gap-4">
            <ListChecks className="h-5 w-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-foreground">Onboarding checklist</span>
                <span className="text-text-muted">Collected <span className="font-semibold text-accent">{collected}</span> / {reqs.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${reqs.length ? Math.round((collected / reqs.length) * 100) : 0}%` }} />
              </div>
            </div>
            <span className="text-[11px] text-text-muted hidden sm:block">Tracked in this browser</span>
            <button onClick={resetChecklist} disabled={collected === 0}
              className="text-xs text-text-muted hover:text-foreground disabled:opacity-40 inline-flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>

          {/* Key terms (inline glossary) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 text-xs text-text-muted">
            <span className="font-medium text-foreground">Key terms:</span>
            <GlossaryTerm term="beneficial owner" />
            <GlossaryTerm term="CDD" />
            <GlossaryTerm term="EDD" />
            <GlossaryTerm term="SDD" />
            <GlossaryTerm term="PEP" />
          </div>

          {/* Provisions breadcrumb (union across scenarios) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-text-muted">
            <span className="font-medium text-foreground">Provisions:</span>
            {merged.provisions.map((s, i) => (
              <span key={`${s.org}-${s.reference}-${i}`} className="flex items-center gap-2">
                {i > 0 && <span className="opacity-40">›</span>}
                <span>{s.org} {s.reference}</span>
              </span>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requirements, documents, sources..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-surface-border text-sm focus:outline-none focus:border-accent" />
            </div>
            {filterPills.map((f) => (
              <button key={f.value} onClick={() => toggleFilter(f.value)} aria-pressed={filters.has(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filters.has(f.value) ? "bg-accent text-white border-accent" : "bg-white/5 text-text-muted border-surface-border hover:bg-white/10"
                }`}>
                {f.label}
              </button>
            ))}
            <button onClick={toggleExpandAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-white/5 text-text-muted hover:bg-white/10 inline-flex items-center gap-1.5">
              {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {/* Category accordions */}
          <div className="space-y-4 mt-6">
            {groups.map(({ cat, all }, ci) => {
              const visible = all.filter(matches);
              if (visible.length === 0) return null;
              // Force-open any category that has matches while a search/filter is
              // active, so results are never hidden inside a collapsed section.
              const isOpen = openCats.has(cat) || !!search.trim() || filters.size > 0;
              const catNonEdd = all.filter((r) => !r.eddTrigger);
              const req = catNonEdd.filter((r) => stOf(r) === "required").length;
              const cond = catNonEdd.filter((r) => stOf(r) === "conditional").length;
              const na = catNonEdd.filter((r) => stOf(r) === "not_applicable").length;
              return (
                <div key={cat} id={`kyc-cat-${cat}`} className="glass-card rounded-2xl overflow-hidden scroll-mt-20">
                  <button onClick={() => toggleCat(cat)} aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-bold">{ci + 1}</span>
                      <span className="text-base font-semibold text-foreground">{CATEGORY_TITLE[cat]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-accent">{req} Required</span>
                      <span className="text-xs text-amber-500">{cond} Conditional</span>
                      <span className="text-xs text-text-muted">{na} N/A</span>
                      {isOpen ? <ChevronDown className="h-5 w-5 text-text-muted" /> : <ChevronRight className="h-5 w-5 text-text-muted" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3">
                      <p className="text-xs text-text-muted -mt-1 mb-1">
                        Tick the box on each requirement as you collect the evidence. Click a requirement to see exactly what to collect, what the rule says, and the source.
                      </p>
                      {visible.map((r, ri) => {
                        const badge = statusBadge(r);
                        const open = openReqs.has(r.key);
                        const isDone = done.has(r.key);
                        const partial = multiScenario && r.appliesTo.length < merged.scenarios.length;
                        return (
                          <div key={r.key} className={`rounded-xl border overflow-hidden ${isDone ? "border-accent/40 bg-accent/5" : "border-surface-border"}`}>
                            <div className="flex items-stretch">
                              <label className="flex items-center px-3 cursor-pointer border-r border-surface-border" title="Mark collected">
                                <input type="checkbox" checked={isDone} onChange={() => toggleDone(r.key)}
                                  aria-label={`Mark "${r.title}" collected`}
                                  className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent cursor-pointer" />
                              </label>
                              <button onClick={() => toggleReq(r.key)} aria-expanded={open}
                                className="flex-1 flex items-start justify-between gap-4 px-4 py-3 text-left hover:bg-surface-hover transition-colors">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-xs text-text-muted font-mono">{ci + 1}.{ri + 1}</span>
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[badge.key]}`}>{badge.label}</span>
                                    <span className={`text-sm font-semibold ${isDone ? "text-text-muted line-through" : "text-foreground"}`}>{r.title}</span>
                                    {partial && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-surface-border text-text-muted">
                                        {r.appliesTo.length}/{merged.scenarios.length} scenarios
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted line-clamp-2">{r.whatItMeans}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[11px] text-text-muted hidden sm:flex items-center gap-1">
                                    EDD: {r.eddTrigger ? <span className="text-risk-high font-medium">Yes</span> : <span>No</span>}
                                  </span>
                                  {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
                                </div>
                              </button>
                            </div>

                            {open && (
                              <div className="px-4 pb-4 border-t border-surface-border pt-4 space-y-4">
                                {multiScenario && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mr-1">Applies to:</span>
                                    {r.appliesTo.map((a) => (
                                      <span key={`${a.entity}-${a.jurisdiction}`} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                        {tagLabel(a.entity, a.jurisdiction)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {r.ruleSummary && (
                                  <p className="text-xs text-foreground bg-accent/5 border border-accent/15 rounded-lg px-3 py-2">
                                    <span className="font-semibold">What the rule requires:</span> {r.ruleSummary}
                                  </p>
                                )}
                                <div className="grid md:grid-cols-4 gap-4">
                                  <Column icon={FileText} title="What this means"><p className="text-xs text-text-muted"><GlossaryText>{r.whatItMeans}</GlossaryText></p></Column>
                                  <Column icon={ClipboardList} title="What to collect">
                                    <ul className="space-y-1">
                                      {r.whatToCollect.map((w, i) => (
                                        <li key={i} className="text-xs text-text-muted flex gap-1.5">
                                          <CheckCircle2 className="h-3 w-3 text-accent mt-0.5 shrink-0" /><span>{w}</span>
                                        </li>
                                      ))}
                                    </ul>
                                    {r.documentGuidance.map((jd) => (
                                      <div key={jd.jurisdiction} className="mt-2">
                                        {multiJur && <p className="text-[11px] font-semibold text-accent mb-1">{JURISDICTION_LABEL[jd.jurisdiction]}</p>}
                                        {jd.guidance.map((dg) => (
                                          <div key={`${dg.label}|${dg.source.reference}`} className="mt-1.5 rounded-lg bg-white/5 border border-surface-border p-2">
                                            <p className="text-[11px] font-semibold text-foreground">{dg.label}</p>
                                            <p className="text-xs text-text-muted mt-0.5">{dg.accepted.join(" · ")}</p>
                                            <span className="mt-1 inline-flex"><SourceBadge source={dg.source.org} reference={dg.source.reference} url={dg.source.url} title={dg.source.title} /></span>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </Column>
                                  <Column icon={BookOpen} title="Legal basis & guidance">
                                    <div className="flex flex-col items-start gap-2">
                                      {r.legalBasis.map((s) => (
                                        <div key={`${s.org}|${s.reference}`}>
                                          <SourceBadge source={s.org} reference={s.reference} url={s.url} title={s.title} />
                                          <p className="text-[11px] text-text-muted mt-0.5">{s.title}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </Column>
                                  <Column icon={FileCheck2} title="Evidence examples">
                                    <ul className="space-y-1">
                                      {r.evidence.map((e, i) => (
                                        <li key={i} className="text-xs text-text-muted">{e}</li>
                                      ))}
                                    </ul>
                                  </Column>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-xs text-text-muted border-t border-surface-border pt-4">
            This matrix is for guidance only and is not legal advice; use it alongside your organisation&apos;s policies and
            procedures and verify against the cited primary source. Incoming changes (e.g. EU AMLR from 2027) are tagged where relevant.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/control-builder"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg glass-card text-sm font-medium text-foreground hover:text-accent hover:border-accent/40 transition-colors"
            >
              <Layers className="h-4 w-4 text-accent" />
              Build CDD controls
            </a>
            <a
              href="/controls-maturity"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg glass-card text-sm font-medium text-foreground hover:text-accent hover:border-accent/40 transition-colors"
            >
              <Gavel className="h-4 w-4 text-accent" />
              Assess your CDD maturity
            </a>
          </div>
        </section>
      </main>
      </ToolFrame>
  );
}

function Column({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5 text-accent" />{title}
      </p>
      {children}
    </div>
  );
}
