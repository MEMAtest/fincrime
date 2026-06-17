"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Building2, Globe2, ShieldCheck, ChevronDown, ChevronRight, Search, RotateCcw,
  CheckCircle2, HelpCircle, MinusCircle, AlertTriangle, FileText, ClipboardList, BookOpen, FileCheck2,
  Share2, Check,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SourceBadge from "@/components/shared/SourceBadge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { getCddProfile, buildRequirements } from "@/data/kyc";
import type { EntityType, Jurisdiction, RiskLevel, CddRequirement, CddCategoryKey } from "@/data/kyc/types";
import {
  ENTITY_ORDER, JURISDICTION_ORDER, ENTITY_LABEL, JURISDICTION_LABEL, JURISDICTION_REGULATOR,
  CATEGORY_TITLE, CATEGORY_ORDER, statusFor,
} from "@/data/kyc/types";

const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: "low", label: "Lower risk (SDD)" },
  { value: "medium", label: "Standard CDD (Medium)" },
  { value: "high", label: "Higher risk (EDD)" },
];

type StatusFilter = "all" | "required" | "conditional" | "not_applicable" | "edd";

const STATUS_PILL: Record<string, string> = {
  required: "bg-emerald-500/12 text-emerald-500",
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

  const ent: EntityType = (ENTITY_ORDER as string[]).includes(entity) ? (entity as EntityType) : "corporate";
  const jur: Jurisdiction = (JURISDICTION_ORDER as string[]).includes(jurisdiction) ? (jurisdiction as Jurisdiction) : "uk";
  const rk: RiskLevel = (["low", "medium", "high"] as string[]).includes(risk) ? (risk as RiskLevel) : "medium";

  const navigate = (next: { ent?: EntityType; jur?: Jurisdiction; rk?: RiskLevel }) => {
    const params = new URLSearchParams();
    params.set("entity", next.ent ?? ent);
    params.set("jurisdiction", next.jur ?? jur);
    params.set("risk", next.rk ?? rk);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const lookup = getCddProfile(ent, jur)!;
  const { profile, fallback } = lookup;
  const reqs = useMemo(() => buildRequirements(profile), [profile]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  const [openCats, setOpenCats] = useState<Set<CddCategoryKey>>(new Set(CATEGORY_ORDER));
  const [openReqs, setOpenReqs] = useState<Set<string>>(() => {
    const first = buildRequirements(profile)[0];
    return new Set(first ? [first.id] : []);
  });

  const toggleCat = (c: CddCategoryKey) =>
    setOpenCats((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const toggleReq = (id: string) =>
    setOpenReqs((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Summary counts: EDD triggers counted separately from required/conditional/not-applicable.
  const nonEdd = reqs.filter((r) => !r.eddTrigger);
  const counts = {
    required: nonEdd.filter((r) => statusFor(r, rk) === "required").length,
    conditional: nonEdd.filter((r) => statusFor(r, rk) === "conditional").length,
    not_applicable: nonEdd.filter((r) => statusFor(r, rk) === "not_applicable").length,
    edd: reqs.length - nonEdd.length,
    total: reqs.length,
  };
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  const matches = (r: CddRequirement) => {
    const s = search.trim().toLowerCase();
    const textOk = !s || r.title.toLowerCase().includes(s) || r.whatToCollect.some((w) => w.toLowerCase().includes(s));
    let statusOk = true;
    if (statusFilter === "edd") statusOk = r.eddTrigger;
    else if (statusFilter !== "all") statusOk = !r.eddTrigger && statusFor(r, rk) === statusFilter;
    return textOk && statusOk;
  };

  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    all: reqs.filter((r) => r.category === cat),
  })).filter((g) => g.all.length > 0);

  const statBar = [
    { key: "required", label: "Required", value: counts.required, icon: CheckCircle2, color: "text-emerald-500" },
    { key: "conditional", label: "Conditional", value: counts.conditional, icon: HelpCircle, color: "text-amber-500" },
    { key: "not_applicable", label: "Not applicable", value: counts.not_applicable, icon: MinusCircle, color: "text-text-muted" },
    { key: "edd", label: "EDD triggers", value: counts.edd, icon: AlertTriangle, color: "text-risk-high" },
  ];

  const filterPills: { value: StatusFilter; label: string }[] = [
    { value: "required", label: "Required only" },
    { value: "conditional", label: "Conditional" },
    { value: "not_applicable", label: "Not applicable" },
    { value: "edd", label: "EDD triggers" },
  ];

  const statusBadge = (r: CddRequirement) => {
    if (r.eddTrigger) return { key: "edd", label: "EDD trigger" };
    const st = statusFor(r, rk);
    return { key: st, label: st === "required" ? "Required" : st === "conditional" ? "Conditional" : "Not applicable" };
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                KYC / CDD Requirements <span className="gradient-text">Matrix</span>
              </h1>
              <p className="mt-1 text-sm text-text-muted max-w-2xl">
                Build a tailored view of applicable KYC and CDD requirements based on entity type, jurisdiction and risk context.
                Every requirement is mapped to its primary-source regulatory reference.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={share}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                {copied ? "Copied" : "Share"}
              </Button>
              <PDFExportButton module="kyc_requirements" assessmentData={{ entity: ent, jurisdiction: jur, risk: rk }} formats={["pdf", "docx"]} />
            </div>
          </div>

          {/* Selector bar */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 mt-5 grid sm:grid-cols-3 gap-4 items-end">
            <Selector label="Entity / Customer Type" icon={Building2} value={ent} onChange={(v) => navigate({ ent: v as EntityType })}
              options={ENTITY_ORDER.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))} />
            <Selector label="Jurisdiction" icon={Globe2} value={jur} onChange={(v) => navigate({ jur: v as Jurisdiction })}
              options={JURISDICTION_ORDER.map((j) => ({ value: j, label: JURISDICTION_LABEL[j] }))} />
            <Selector label="CDD Level / Risk Context" icon={ShieldCheck} value={rk} onChange={(v) => navigate({ rk: v as RiskLevel })}
              options={RISK_OPTIONS} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-muted">
              {JURISDICTION_REGULATOR[jur]}{fallback ? " · FATF baseline shown" : ""}
            </p>
            <button onClick={() => navigate({ ent: "corporate", jur: "uk", rk: "medium" })}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>

          {/* Summary stat bar */}
          <div className="glass-card rounded-2xl p-4 mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="pr-6 border-r border-surface-border">
              <div className="text-2xl font-bold leading-none">{counts.total}</div>
              <div className="text-xs text-text-muted mt-1">Total requirements</div>
            </div>
            {statBar.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                  <span className="text-xs text-text-muted ml-2">{s.label} · {pct(s.value)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Source breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-text-muted">
            <span className="font-medium text-foreground">Source:</span>
            {profile.regulatoryBasis.map((s, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="opacity-40">›</span>}
                <span>{s.org} {s.reference}</span>
              </span>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requirements..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-surface-border text-sm focus:outline-none focus:border-accent" />
            </div>
            {filterPills.map((f) => (
              <button key={f.value} onClick={() => setStatusFilter((cur) => (cur === f.value ? "all" : f.value))}
                aria-pressed={statusFilter === f.value}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === f.value ? "bg-accent text-white border-accent" : "bg-white/5 text-text-muted border-surface-border hover:bg-white/10"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Category progress cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {groups.map(({ cat, all }) => {
              const catNonEdd = all.filter((r) => !r.eddTrigger);
              const req = catNonEdd.filter((r) => statusFor(r, rk) === "required").length;
              const p = catNonEdd.length ? Math.round((req / catNonEdd.length) * 100) : 0;
              return (
                <div key={cat} className="glass-card rounded-xl p-3">
                  <p className="text-xs font-semibold text-foreground leading-snug min-h-[2.5rem]">{CATEGORY_TITLE[cat]}</p>
                  <p className="text-[11px] text-text-muted mt-1">{req} required · {all.length} total</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category accordions */}
          <div className="space-y-4 mt-6">
            {groups.map(({ cat, all }, ci) => {
              const visible = all.filter(matches);
              if (visible.length === 0) return null;
              const isOpen = openCats.has(cat);
              const catNonEdd = all.filter((r) => !r.eddTrigger);
              const req = catNonEdd.filter((r) => statusFor(r, rk) === "required").length;
              const cond = catNonEdd.filter((r) => statusFor(r, rk) === "conditional").length;
              const na = catNonEdd.filter((r) => statusFor(r, rk) === "not_applicable").length;
              return (
                <div key={cat} className="glass-card rounded-2xl overflow-hidden">
                  <button onClick={() => toggleCat(cat)} aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/15 text-accent text-xs font-bold">{ci + 1}</span>
                      <span className="text-base font-semibold text-foreground">{CATEGORY_TITLE[cat]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-500">{req} Required</span>
                      <span className="text-xs text-amber-500">{cond} Conditional</span>
                      <span className="text-xs text-text-muted">{na} N/A</span>
                      {isOpen ? <ChevronDown className="h-5 w-5 text-text-muted" /> : <ChevronRight className="h-5 w-5 text-text-muted" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3">
                      {visible.map((r, ri) => {
                        const badge = statusBadge(r);
                        const open = openReqs.has(r.id);
                        return (
                          <div key={r.id} className="rounded-xl border border-surface-border overflow-hidden">
                            <button onClick={() => toggleReq(r.id)} aria-expanded={open}
                              className="w-full flex items-start justify-between gap-4 px-4 py-3 text-left hover:bg-surface-hover transition-colors">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs text-text-muted font-mono">{ci + 1}.{ri + 1}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[badge.key]}`}>{badge.label}</span>
                                  <span className="text-sm font-semibold text-foreground">{r.title}</span>
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

                            {open && (
                              <div className="px-4 pb-4 grid md:grid-cols-4 gap-4 border-t border-surface-border pt-4">
                                <Column icon={FileText} title="What this means"><p className="text-xs text-text-muted">{r.whatItMeans}</p></Column>
                                <Column icon={ClipboardList} title="What to collect">
                                  <ul className="space-y-1">
                                    {r.whatToCollect.map((w, i) => (
                                      <li key={i} className="text-xs text-text-muted flex gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-accent mt-0.5 shrink-0" /><span>{w}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </Column>
                                <Column icon={BookOpen} title="Legal basis & guidance">
                                  <div className="flex flex-col items-start gap-1.5">
                                    {r.legalBasis.map((s, i) => (
                                      <SourceBadge key={i} source={s.org} reference={s.reference} url={s.url} />
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
        </section>
      </main>
      <Footer />
    </>
  );
}

function Selector({
  label, icon: Icon, value, onChange, options,
}: {
  label: string; icon: typeof Building2; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-white/5 border border-surface-border px-3 py-2 focus-within:border-accent">
        <Icon className="h-4 w-4 text-accent shrink-0" />
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground focus:outline-none cursor-pointer">
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-background text-foreground">{o.label}</option>
          ))}
        </select>
      </div>
    </label>
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
