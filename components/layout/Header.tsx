"use client";

import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function Header() {
  return (
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
          <Link href="/firm-research">AI in Research</Link>
          <Link href="/typology-iq">TypologyIQ</Link>
          <Link href="/partner-control-map">PartnerControlMap</Link>
          <Link href="/controls">Controls</Link>
          <Link href="/kyc-requirements">KYC Matrix</Link>
        </div>

        <div className="nav-cta">
          <Link className="btn btn-primary btn-sm" href="/firm-research">
            Start free
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}
