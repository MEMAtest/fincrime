"use client";

import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import FinCrimeLogo from "@/components/brand/FinCrimeLogo";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="max-w-6xl mx-auto">
        <div className="nav-pill flex items-center justify-between h-14 pl-4 pr-2.5">
          <Link href="/" className="flex items-center">
            <FinCrimeLogo variant="full" size="md" animated />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="hidden md:flex items-center gap-5">
              <Link
                href="/firm-research"
                className="text-sm text-text-muted hover:text-emerald-400 transition-colors"
              >
                Firm Research
              </Link>
              <Link
                href="/typology-iq"
                className="text-sm text-text-muted hover:text-emerald-400 transition-colors"
              >
                TypologyIQ
              </Link>
              <Link
                href="/partner-control-map"
                className="text-sm text-text-muted hover:text-emerald-400 transition-colors"
              >
                PartnerControlMap
              </Link>
              <Link
                href="/controls"
                className="text-sm text-text-muted hover:text-emerald-400 transition-colors"
              >
                Controls
              </Link>
            </nav>
            <Link
              href="/firm-research"
              className="btn-brand hidden sm:inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold"
            >
              Start free
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
