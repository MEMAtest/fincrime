"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Home, ClipboardCheck, Crosshair, Blocks, Sparkles, Building2, ShieldCheck, UserCheck,
  Scale, Network, FileText, Settings, HelpCircle, PanelLeftClose,
  PanelLeftOpen, ChevronDown, ChevronRight, Menu, X,
} from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import WorkflowBar from "@/components/workflow/WorkflowBar";
import SearchTrigger from "@/components/search/SearchTrigger";
import { FIRM_TYPE_ORDER } from "@/data/firm-profiles";
import { FIRM_TYPE_LABEL } from "@/data/typologies/labels";
import type { FirmType } from "@/data/typologies/types";

export type FirmContext = FirmType | "all";

export interface Crumb {
  label: string;
  href?: string;
  onClick?: () => void;
}

// Canonical tool names, ordered by the four-stage journey (Profile, Risks,
// Build, Govern). One name per destination so the marketing pages, the sidebar
// and every deep link agree.
export type SidebarId =
  | "home" | "firm-research" | "firm-profiles" | "typology-iq" | "enforcement"
  | "control-builder" | "controls-library" | "partner-map" | "kyc" | "maturity"
  | "reports" | "settings" | "help";

interface SidebarItem {
  id: SidebarId;
  label: string;
  icon: typeof Home;
  href?: string;
  soon?: boolean;    // not yet built: shown, non-navigating
}

const PRIMARY: SidebarItem[] = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  { id: "firm-research", label: "AI Research", icon: Sparkles, href: "/firm-research" },
  { id: "firm-profiles", label: "Firm Profiles", icon: Building2, href: "/firm-profiles" },
  { id: "typology-iq", label: "TypologyIQ", icon: Crosshair, href: "/typology-iq" },
  { id: "enforcement", label: "Enforcement", icon: Scale, href: "/enforcement" },
  { id: "control-builder", label: "Control Builder", icon: Blocks, href: "/control-builder" },
  { id: "controls-library", label: "Controls Library", icon: ShieldCheck, href: "/controls" },
  { id: "partner-map", label: "Partner Map", icon: Network, href: "/partner-control-map" },
  { id: "kyc", label: "KYC Matrix", icon: UserCheck, href: "/kyc-requirements" },
  { id: "maturity", label: "Controls Maturity", icon: ClipboardCheck, href: "/controls-maturity" },
];

const SECONDARY: SidebarItem[] = [
  { id: "reports", label: "Reports", icon: FileText, soon: true },
  { id: "settings", label: "Settings", icon: Settings, soon: true },
];

export default function AppShell({
  breadcrumb,
  activeId,
  firm,
  children,
}: {
  breadcrumb?: Crumb[];
  activeId?: SidebarId;
  firm?: { value: FirmContext; onChange: (v: FirmContext) => void };
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const renderItem = (item: SidebarItem) => {
    const isActive = item.id === activeId;
    const base = `group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive ? "bg-accent/12 text-accent font-medium" : "text-text-muted hover:bg-surface-hover hover:text-foreground"
    } ${collapsed ? "justify-center px-0" : ""}`;
    const inner = (
      <>
        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-accent" : ""}`} />
        {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
        {!collapsed && item.soon && <span className="text-[9px] uppercase tracking-wide text-text-muted/70 border border-surface-border rounded px-1 py-0.5">Soon</span>}
      </>
    );
    if (item.href) {
      return <Link key={item.id} href={item.href} className={base} title={collapsed ? item.label : undefined}>{inner}</Link>;
    }
    // Not `disabled` (a disabled button swallows the click, so it would never
    // bubble up to close the mobile drawer); use aria-disabled + a no-op click.
    return <button key={item.id} type="button" aria-disabled className={`${base} cursor-default opacity-70`} title={collapsed ? `${item.label} (coming soon)` : undefined}>{inner}</button>;
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-surface-border bg-surface/60 backdrop-blur-sm transition-[width] duration-200 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {PRIMARY.map(renderItem)}
          <div className="my-3 border-t border-surface-border" />
          {SECONDARY.map(renderItem)}
        </div>
        <div className="p-3 space-y-1 border-t border-surface-border">
          <Link href="/methodology" className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors ${collapsed ? "justify-center px-0" : ""}`} title={collapsed ? "Help" : undefined}>
            <HelpCircle className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span>Help</span>}
          </Link>
          <button onClick={() => setCollapsed((c) => !c)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors ${collapsed ? "justify-center px-0" : ""}`} title="Collapse sidebar">
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" /> : <><PanelLeftClose className="h-[18px] w-[18px] shrink-0" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] bg-surface border-r border-surface-border flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-surface-border">
              <span className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-[9px] bg-accent/12 text-accent grid place-items-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
                </span>
                <b className="text-sm text-foreground">FinCrime Control Lab</b>
              </span>
              <button onClick={() => setMobileNav(false)} aria-label="Close menu" className="h-8 w-8 rounded-lg grid place-items-center text-text-muted hover:bg-surface-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1" onClick={() => setMobileNav(false)}>
              {PRIMARY.map(renderItem)}
              <div className="my-3 border-t border-surface-border" />
              {SECONDARY.map(renderItem)}
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar: logo + (optional) firm switcher + theme. The sidebar is the
            single nav system, so the top bar stays minimal and never overflows. */}
        <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <button onClick={() => setMobileNav(true)} className="lg:hidden h-9 w-9 -ml-1 rounded-lg grid place-items-center text-text-muted hover:bg-surface-hover shrink-0" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="FinCrime Control Lab">
              <span className="h-9 w-9 rounded-[10px] bg-accent/12 text-accent grid place-items-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                  <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <span className="hidden sm:flex flex-col leading-none min-w-0">
                <b className="text-sm text-foreground truncate">FinCrime Control Lab</b>
                <span className="hidden lg:block text-[11px] text-text-muted mt-0.5 truncate">Regulatory confidence. Built in.</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <SearchTrigger />
              {firm && <FirmSwitcher value={firm.value} onChange={firm.onChange} />}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="px-4 sm:px-6 py-2.5 border-b border-surface-border flex items-center gap-1.5 text-sm">
            {breadcrumb.map((c, i) => {
              const last = i === breadcrumb.length - 1;
              const cls = last ? "text-foreground font-medium" : "text-text-muted hover:text-foreground transition-colors";
              return (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />}
                  {c.href ? <Link href={c.href} className={cls}>{c.label}</Link>
                    : c.onClick ? <button onClick={c.onClick} className={cls}>{c.label}</button>
                    : <span className={cls}>{c.label}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* The four-stage journey spine (self-hides on non-workflow routes) */}
        <WorkflowBar />

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

function FirmSwitcher({ value, onChange }: { value: FirmContext; onChange: (v: FirmContext) => void }) {
  return (
    <div className="relative inline-flex items-center" title="Firm context: reloads the register for this business model">
      <Building2 className="pointer-events-none absolute left-2.5 h-4 w-4 text-white/90" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FirmContext)}
        aria-label="Firm context"
        className="appearance-none pl-8 pr-8 py-2 rounded-lg bg-accent text-white text-sm font-semibold focus:outline-none cursor-pointer hover:bg-accent-hover transition-colors max-w-[9.5rem] sm:max-w-none truncate"
      >
        <option value="all" className="text-foreground">Full catalogue</option>
        {FIRM_TYPE_ORDER.map((ft) => (
          <option key={ft} value={ft} className="text-foreground">{FIRM_TYPE_LABEL[ft]}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-white/90" />
    </div>
  );
}
