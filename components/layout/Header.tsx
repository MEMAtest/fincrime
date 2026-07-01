"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme/ThemeToggle";
import WorkflowBar from "@/components/workflow/WorkflowBar";

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
          <Link className="btn btn-primary btn-sm" href="/start">
            Start free
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      </div>
      <WorkflowBar />
    </>
  );
}
