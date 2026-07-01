"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell, { type Crumb, type SidebarId } from "./AppShell";
import Footer from "./Footer";

/**
 * The app-shell wrapper for the tool routes: renders the left sidebar + top bar
 * and derives which nav item is active from the current path, so individual tool
 * pages just wrap their content in <ToolFrame> instead of a marketing header.
 * Marketing/landing pages (home, /start) keep the lighter <Header> instead.
 */
const ROUTE_MAP: { prefix: string; id?: SidebarId; top?: string }[] = [
  { prefix: "/firm-profiles", id: "firm-profiles", top: "Firm Profiles" },
  { prefix: "/firm-research", id: "enhancement", top: "AI Assistant" },
  { prefix: "/typology-iq", id: "targeting", top: "Targeting" },
  { prefix: "/kyc-requirements", id: "kyc-center" },
  { prefix: "/controls-maturity", id: "assessments" },
  { prefix: "/screening-control-designer", id: "assessments" },
  { prefix: "/enforcement", top: "Content Hub" },
  { prefix: "/controls", top: "Content Hub" },
  { prefix: "/glossary", top: "Content Hub" },
  { prefix: "/methodology", id: "help" },
  { prefix: "/partner-control-map" },
];

export default function ToolFrame({ children, breadcrumb }: { children: ReactNode; breadcrumb?: Crumb[] }) {
  const pathname = usePathname() ?? "";
  const match = ROUTE_MAP.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) ?? ROUTE_MAP.find((r) => pathname.startsWith(r.prefix));

  return (
    <AppShell activeId={match?.id} activeTopNav={match?.top} breadcrumb={breadcrumb}>
      {children}
      <Footer />
    </AppShell>
  );
}
