import { allTypologies } from "@/data/typologies";
import { allControls, CONTROL_CATEGORY_LABEL } from "@/data/controls";
import { enforcementCases } from "@/data/enforcement/cases";
import { caseSlug } from "@/lib/enforcement/case-slug";
import { GLOSSARY } from "@/data/glossary";
import { FIRM_PROFILES, FIRM_TYPE_ORDER } from "@/data/firm-profiles";
import { ENTITY_ORDER, ENTITY_LABEL } from "@/data/kyc/types";
import { FIRM_TYPE_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";

export type SearchAction =
  | { kind: "control"; slug: string }
  | { kind: "typology"; slug: string }
  | { kind: "navigate"; href: string };

export type SearchGroup =
  | "Typologies"
  | "Controls"
  | "Enforcement"
  | "Glossary"
  | "Firm profiles"
  | "KYC"
  | "Go to";

/** Display order of groups in the palette. */
export const GROUP_ORDER: SearchGroup[] = [
  "Typologies",
  "Controls",
  "Enforcement",
  "Glossary",
  "Firm profiles",
  "KYC",
  "Go to",
];

export interface SearchItem {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  /** Lowercased haystack used for matching (title + subtitle + aliases/description). */
  keywords: string;
  action: SearchAction;
}

/** The tools / sections a user can jump to (superset of the sidebar). */
const TOOLS: { title: string; subtitle: string; href: string; kw?: string }[] = [
  { title: "Home", subtitle: "Overview and all tools", href: "/", kw: "start dashboard" },
  { title: "AI Firm Research", subtitle: "Draft a firm risk profile with AI", href: "/firm-research", kw: "ai research firm profile suggest risks" },
  { title: "Firm Profiles", subtitle: "Business models and inherent risk", href: "/firm-profiles", kw: "emi pi bank msb crypto business model" },
  { title: "TypologyIQ", subtitle: "Match typologies to controls", href: "/typology-iq", kw: "wizard typology match assessment" },
  { title: "Typology Catalogue", subtitle: "Browse every typology", href: "/typology-iq/list", kw: "catalogue list all typologies" },
  { title: "Enforcement", subtitle: "FCA fines and the lessons from them", href: "/enforcement", kw: "fines cases penalties fca lessons" },
  { title: "Control Builder", subtitle: "Assemble and export a control register", href: "/control-builder", kw: "register export controls" },
  { title: "Controls Library", subtitle: "The full catalogue of controls", href: "/controls", kw: "library catalogue controls" },
  { title: "Partner Control Map", subtitle: "Ownership and RACI across a payment flow", href: "/partner-control-map", kw: "raci ownership partner flow gap" },
  { title: "KYC Matrix", subtitle: "Requirements by entity type and jurisdiction", href: "/kyc-requirements", kw: "cdd kyc onboarding due diligence matrix" },
  { title: "Screening Control Designer", subtitle: "Design a sanctions or PEP screening control", href: "/screening-control-designer", kw: "sanctions pep screening watchlist fuzzy" },
  { title: "Controls Maturity", subtitle: "Assess how mature your controls are", href: "/controls-maturity", kw: "maturity assessment scoring" },
  { title: "Glossary", subtitle: "Financial crime terms, defined and cited", href: "/glossary", kw: "definitions terms glossary" },
  { title: "Methodology", subtitle: "How the lab scores and cites", href: "/methodology", kw: "methodology sources scoring how it works" },
];

/**
 * Build the full search index from the data modules, so the coverage counts
 * (typologies, controls, cases, glossary, firm profiles, KYC entities) can never
 * drift from the source of truth. Called lazily on first palette open.
 */
export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];

  for (const t of allTypologies) {
    items.push({
      id: `typology:${t.slug}`,
      group: "Typologies",
      title: t.title,
      subtitle: RISK_THEME_LABEL[t.riskTheme] ?? t.riskTheme,
      keywords: `${t.title} ${t.description} ${RISK_THEME_LABEL[t.riskTheme] ?? ""}`.toLowerCase(),
      action: { kind: "typology", slug: t.slug },
    });
  }

  for (const c of allControls) {
    items.push({
      id: `control:${c.slug}`,
      group: "Controls",
      title: c.name,
      subtitle: CONTROL_CATEGORY_LABEL[c.category] ?? c.category,
      keywords: `${c.name} ${c.plainSummary} ${CONTROL_CATEGORY_LABEL[c.category] ?? ""}`.toLowerCase(),
      action: { kind: "control", slug: c.slug },
    });
  }

  for (const e of enforcementCases) {
    items.push({
      id: `case:${caseSlug(e.firm, e.year)}`,
      group: "Enforcement",
      title: e.firm,
      subtitle: `${e.regulator} ${e.year} · ${e.fine}`,
      keywords: `${e.firm} ${e.summary} ${e.year} ${e.breachType}`.toLowerCase(),
      action: { kind: "navigate", href: `/enforcement/${caseSlug(e.firm, e.year)}` },
    });
  }

  for (const g of GLOSSARY) {
    items.push({
      id: `glossary:${g.slug}`,
      group: "Glossary",
      title: g.term,
      subtitle: g.short,
      keywords: `${g.term} ${(g.aliases ?? []).join(" ")} ${g.short}`.toLowerCase(),
      action: { kind: "navigate", href: `/glossary#${g.slug}` },
    });
  }

  for (const ft of FIRM_TYPE_ORDER) {
    const p = FIRM_PROFILES[ft];
    items.push({
      id: `firm:${ft}`,
      group: "Firm profiles",
      title: FIRM_TYPE_LABEL[ft] ?? ft,
      subtitle: p.tagline,
      keywords: `${FIRM_TYPE_LABEL[ft] ?? ft} ${p.tagline} ${p.description}`.toLowerCase(),
      action: { kind: "navigate", href: `/firm-profiles?type=${ft}` },
    });
  }

  for (const ent of ENTITY_ORDER) {
    items.push({
      id: `kyc:${ent}`,
      group: "KYC",
      title: ENTITY_LABEL[ent] ?? ent,
      subtitle: "KYC requirements",
      keywords: `${ENTITY_LABEL[ent] ?? ent} kyc cdd onboarding requirements`.toLowerCase(),
      action: { kind: "navigate", href: `/kyc-requirements?entity=${ent}` },
    });
  }

  for (const tool of TOOLS) {
    items.push({
      id: `tool:${tool.href}`,
      group: "Go to",
      title: tool.title,
      subtitle: tool.subtitle,
      keywords: `${tool.title} ${tool.subtitle} ${tool.kw ?? ""}`.toLowerCase(),
      action: { kind: "navigate", href: tool.href },
    });
  }

  return items;
}

/**
 * Rank an item against a query. Higher is better; 0 means no match.
 * Every whitespace-separated token must appear somewhere (title or keywords).
 */
export function scoreItem(item: SearchItem, tokens: string[], raw: string): number {
  const title = item.title.toLowerCase();
  for (const tok of tokens) {
    if (!title.includes(tok) && !item.keywords.includes(tok)) return 0;
  }
  let score = 0;
  if (title === raw) score += 1000;
  if (title.startsWith(raw)) score += 400;
  if (title.includes(raw)) score += 200;
  if (item.subtitle.toLowerCase().includes(raw)) score += 60;
  // Reward token-level title hits so "rapid funds" ranks the funds typology high.
  for (const tok of tokens) {
    if (title.startsWith(tok)) score += 40;
    else if (title.includes(tok)) score += 20;
    else score += 5; // keyword-only hit
  }
  return score;
}
