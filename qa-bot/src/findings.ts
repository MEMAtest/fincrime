import type { Category, Finding, FindingSource, Occurrence, Severity } from "./types.js";
import { SEVERITIES } from "./types.js";
import { globToRegExp, hash } from "./util.js";

export interface NewFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  description: string;
  recommendation?: string;
  source: FindingSource;
  /** Dedupe key; defaults to the title. Same ruleId + key merges into one finding. */
  key?: string;
  occurrence?: Occurrence;
  files?: string[];
  steps?: string[];
  tags?: string[];
}

const MAX_OCCURRENCES = 50;

export const severityRank = (s: Severity) => SEVERITIES.indexOf(s);

/** Collects findings, merging repeats of the same issue across pages and viewports. */
export class FindingSink {
  private byId = new Map<string, Finding>();
  private occurrenceCounts = new Map<string, number>();
  private ignore: RegExp[];
  private ignoreTitles: string[];

  constructor(ignore: string[] = []) {
    this.ignore = ignore.filter((i) => /^[\w:*.-]+$/.test(i)).map(globToRegExp);
    this.ignoreTitles = ignore.map((i) => i.toLowerCase());
  }

  add(f: NewFinding): Finding | undefined {
    if (this.isIgnored(f.ruleId, f.title)) return undefined;
    const id = hash(`${f.ruleId}|${normalizeKey(f.key ?? f.title)}`, 12);
    let existing = this.byId.get(id);
    if (!existing) {
      existing = {
        id,
        ruleId: f.ruleId,
        title: f.title,
        severity: f.severity,
        category: f.category,
        description: f.description,
        recommendation: f.recommendation,
        source: f.source,
        occurrences: [],
        files: f.files?.length ? [...new Set(f.files)] : undefined,
        steps: f.steps,
        tags: f.tags,
      };
      this.byId.set(id, existing);
      this.occurrenceCounts.set(id, 0);
    } else {
      if (severityRank(f.severity) < severityRank(existing.severity)) existing.severity = f.severity;
      if (f.files?.length) existing.files = [...new Set([...(existing.files ?? []), ...f.files])].slice(0, 8);
    }
    if (f.occurrence) {
      const o = f.occurrence;
      const dup = existing.occurrences.some(
        (e) => e.url === o.url && e.viewport === o.viewport && e.selector === o.selector && e.detail === o.detail,
      );
      if (!dup) {
        this.occurrenceCounts.set(id, (this.occurrenceCounts.get(id) ?? 0) + 1);
        if (existing.occurrences.length < MAX_OCCURRENCES) existing.occurrences.push(o);
      }
    }
    return existing;
  }

  isIgnored(ruleId: string, title: string): boolean {
    if (this.ignore.some((r) => r.test(ruleId))) return true;
    const t = title.toLowerCase();
    return this.ignoreTitles.some((i) => i.length > 3 && t.includes(i));
  }

  occurrenceCount(id: string): number {
    return this.occurrenceCounts.get(id) ?? 0;
  }

  all(): Finding[] {
    return [...this.byId.values()].sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        this.occurrenceCount(b.id) - this.occurrenceCount(a.id) ||
        a.title.localeCompare(b.title),
    );
  }

  get(id: string): Finding | undefined {
    return this.byId.get(id);
  }
}

/** Normalise volatile parts (numbers, hashes, query strings) so repeats dedupe. */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\/[^\s)'"]+/g, (u) => u.replace(/[?#].*$/, ""))
    .replace(/\b[0-9a-f]{8,}\b/g, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

const PENALTY: Record<Severity, number> = { critical: 40, high: 15, medium: 5, low: 1, info: 0 };

function penalty(f: Finding, count: number): number {
  return PENALTY[f.severity] * (1 + Math.log10(Math.max(1, count)));
}

export function computeScores(findings: Finding[], counts: (id: string) => number, testedCategories: Category[]) {
  const byCategory: Partial<Record<Category, number>> = {};
  let total = 0;
  for (const c of testedCategories) byCategory[c] = 0;
  for (const f of findings) {
    if (f.aiNote?.startsWith("Likely false positive")) continue;
    const p = penalty(f, counts(f.id));
    total += p;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + p;
  }
  const toScore = (p: number) => Math.round(100 * Math.exp(-p / 100));
  const scored: Partial<Record<Category, number>> = {};
  for (const [c, p] of Object.entries(byCategory)) scored[c as Category] = toScore(p ?? 0);
  // Overall uses a gentler curve than per-category scores so large apps still spread across the range.
  return { overall: toScore(total / 4), byCategory: scored };
}

export function verdictFor(findings: Finding[]): "pass" | "warn" | "fail" {
  const live = findings.filter((f) => !f.aiNote?.startsWith("Likely false positive"));
  if (live.some((f) => f.severity === "critical") || live.filter((f) => f.severity === "high").length >= 3) return "fail";
  if (live.some((f) => f.severity === "high" || f.severity === "medium")) return "warn";
  return "pass";
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) out[f.severity]++;
  return out;
}

export function meetsThreshold(sev: Severity, threshold: Severity | "none"): boolean {
  if (threshold === "none") return false;
  return severityRank(sev) <= severityRank(threshold);
}
