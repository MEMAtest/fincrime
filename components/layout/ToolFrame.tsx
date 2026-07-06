"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell, { type Crumb, type SidebarId } from "./AppShell";

/**
 * The app-shell wrapper for the tool routes: renders the left sidebar + top bar
 * and derives which nav item is active from the current path, so individual tool
 * pages just wrap their content in <ToolFrame> instead of a marketing header.
 * Marketing/landing pages (home, /start) keep the lighter <Header> instead.
 */
// Longest-prefix first so /controls-maturity doesn't match the /controls entry.
const ROUTE_MAP: { prefix: string; id?: SidebarId; label: string }[] = [
  { prefix: "/firm-profiles", id: "firm-profiles", label: "Firm Profiles" },
  { prefix: "/firm-research", id: "firm-research", label: "AI Research" },
  { prefix: "/typology-iq", id: "typology-iq", label: "TypologyIQ" },
  { prefix: "/kyc-requirements", id: "kyc", label: "KYC Matrix" },
  { prefix: "/controls-maturity", id: "maturity", label: "Controls Maturity" },
  { prefix: "/screening-control-designer", label: "Screening Designer" },
  { prefix: "/enforcement", id: "enforcement", label: "Enforcement" },
  { prefix: "/controls", id: "controls-library", label: "Controls Library" },
  { prefix: "/glossary", label: "Glossary" },
  { prefix: "/methodology", id: "help", label: "Methodology" },
  { prefix: "/partner-control-map", id: "partner-map", label: "Partner Map" },
];

// A leaf label for known deep routes, so e.g. TypologyIQ results reads
// "Home › TypologyIQ › Results" rather than stopping at the tool name.
const LEAF: { suffix: string; label: string }[] = [
  { suffix: "/results", label: "Results" },
  { suffix: "/list", label: "Catalogue" },
];

export default function ToolFrame({ children, breadcrumb }: { children: ReactNode; breadcrumb?: Crumb[] }) {
  const pathname = usePathname() ?? "";
  const match = ROUTE_MAP.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) ?? ROUTE_MAP.find((r) => pathname.startsWith(r.prefix));

  // Default breadcrumb (Home › Tool › [leaf]) when a page doesn't supply its own,
  // so every tool route shows where it sits. The current page is unlinked.
  const leaf = match ? LEAF.find((l) => pathname.endsWith(l.suffix)) : undefined;
  const autoCrumb: Crumb[] | undefined = match
    ? [
        { label: "Home", href: "/" },
        leaf ? { label: match.label, href: match.prefix } : { label: match.label },
        ...(leaf ? [{ label: leaf.label }] : []),
      ]
    : undefined;

  return (
    <AppShell activeId={match?.id} breadcrumb={breadcrumb ?? autoCrumb}>
      {children}
      {/* Slim footer for the app shell (the full marketing footer stays on home/start) */}
      <footer className="mt-auto border-t border-surface-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>© 2026 MEMA Consultants · FinCrime Control Lab</span>
        <span className="flex items-center gap-3">
          <Link href="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
          <Link href="/glossary" className="hover:text-foreground transition-colors">Glossary</Link>
          <Link href="/enforcement" className="hover:text-foreground transition-colors">Enforcement</Link>
        </span>
      </footer>
    </AppShell>
  );
}
