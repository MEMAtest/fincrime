"use client";

import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import FinCrimeLogo from "@/components/brand/FinCrimeLogo";

export default function Header() {
  return (
    <header className="app-header backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center">
            <FinCrimeLogo variant="full" size="md" animated />
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex items-center gap-5">
              <Link
                href="/firm-research"
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                Firm Research
              </Link>
              <Link
                href="/typology-iq"
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                TypologyIQ
              </Link>
              <Link
                href="/partner-control-map"
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                PartnerControlMap
              </Link>
              <Link
                href="/controls"
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                Controls
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
