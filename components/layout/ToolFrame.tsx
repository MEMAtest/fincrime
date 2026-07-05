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
const ROUTE_MAP: { prefix: string; id?: SidebarId }[] = [
  { prefix: "/firm-profiles", id: "firm-profiles" },
  { prefix: "/firm-research", id: "firm-research" },
  { prefix: "/typology-iq", id: "typology-iq" },
  { prefix: "/kyc-requirements", id: "kyc" },
  { prefix: "/controls-maturity", id: "maturity" },
  { prefix: "/screening-control-designer" },
  { prefix: "/enforcement", id: "enforcement" },
  { prefix: "/controls", id: "controls-library" },
  { prefix: "/glossary" },
  { prefix: "/methodology", id: "help" },
  { prefix: "/partner-control-map", id: "partner-map" },
];

export default function ToolFrame({ children, breadcrumb }: { children: ReactNode; breadcrumb?: Crumb[] }) {
  const pathname = usePathname() ?? "";
  const match = ROUTE_MAP.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) ?? ROUTE_MAP.find((r) => pathname.startsWith(r.prefix));

  return (
    <AppShell activeId={match?.id} breadcrumb={breadcrumb}>
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
