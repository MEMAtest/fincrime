"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import WorkflowBar from "@/components/workflow/WorkflowBar";
import SearchTrigger from "@/components/search/SearchTrigger";

const NAV_MODULES: { href: string; label: string }[] = [
  { href: "/firm-research", label: "AI in Research" },
  { href: "/typology-iq", label: "TypologyIQ" },
  { href: "/control-builder", label: "Control Builder" },
  { href: "/enforcement", label: "Enforcement" },
  { href: "/firm-profiles", label: "Firm Profiles" },
  { href: "/controls", label: "Controls" },
  { href: "/kyc-requirements", label: "KYC Matrix" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="nav-shell">
      <nav className="nav">
        <Link className="brand" href="/" aria-label="FinCrime Control Lab">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <span className="brand-text">
            <b>FinCrime Control Lab</b>
            <span>Financial crime, controlled.</span>
          </span>
        </Link>

        <div className="nav-links">
          {NAV_MODULES.map((m) => {
            const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
            return (
              <Link key={m.href} href={m.href} aria-current={active ? "page" : undefined}>
                {m.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-cta">
          <SearchTrigger compact className="sm:hidden" />
          <SearchTrigger className="hidden sm:inline-flex" />
          <Link className="btn btn-primary btn-sm hidden lg:inline-flex" href="/start">
            Start free
          </Link>
          <ThemeToggle />
          <button
            className="lg:hidden p-2 -mr-1 text-text-muted hover:text-foreground transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--line)] bg-[var(--bg-0)] px-4 pb-4 pt-2">
          {NAV_MODULES.map((m) => {
            const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
            return (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center py-3 text-sm border-b border-[var(--line)]/50 last:border-0 transition-colors ${
                  active ? "text-accent font-medium" : "text-foreground hover:text-accent"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
          <Link
            href="/start"
            onClick={() => setMobileOpen(false)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Start free
          </Link>
        </div>
      )}
      </div>
      <Suspense fallback={null}>
        <WorkflowBar />
      </Suspense>
    </>
  );
}
