"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import type { RiskTheme, FirmType, ProductType, CustomerType } from "@/data/typologies/types";

interface TypologySummary {
  id: number;
  slug: string;
  title: string;
  riskTheme: RiskTheme;
  description: string;
  applicableFirmTypes: FirmType[];
  applicableProducts: ProductType[];
  applicableCustomerTypes: CustomerType[];
}

const ALL_RISK_THEMES: RiskTheme[] = [
  "fraud",
  "money_laundering",
  "sanctions_evasion",
  "terrorist_financing",
  "proliferation_financing",
  "tax_evasion",
  "bribery_corruption",
];

const RISK_THEME_LABELS: Record<RiskTheme, string> = {
  fraud: "Fraud",
  money_laundering: "Money Laundering",
  sanctions_evasion: "Sanctions Evasion",
  terrorist_financing: "Terrorist Financing",
  proliferation_financing: "Proliferation Financing",
  tax_evasion: "Tax Evasion",
  bribery_corruption: "Bribery & Corruption",
};

const PILL_LABELS: Record<string, string> = {
  emi: "EMI",
  pi: "PI",
  bank: "Bank",
  msb: "MSB",
  crypto: "Crypto",
  neobank: "Neobank",
  wealth_manager: "Wealth Mgr",
  insurance: "Insurance",
  cross_border_payments: "Cross-Border",
  domestic_payments: "Domestic",
  e_money_accounts: "E-Money",
  remittance: "Remittance",
  trade_finance: "Trade Finance",
  fx_transfers: "FX",
  card_issuing: "Cards",
  marketplace_payouts: "Marketplace",
  crypto_exchange: "Crypto Exchange",
  lending: "Lending",
  individuals: "Individuals",
  smes: "SMEs",
  corporates: "Corporates",
  high_net_worth: "HNW",
  politically_exposed: "PEPs",
  non_profit: "Non-Profit",
  agents_intermediaries: "Agents",
};

export default function TypologyListPage() {
  const [typologies, setTypologies] = useState<TypologySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState<RiskTheme | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/typology/list")
      .then((r) => r.json())
      .then((data) => {
        setTypologies(data.typologies);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return typologies.filter((t) => {
      if (activeTheme && t.riskTheme !== activeTheme) return false;
      if (!q) return true;
      const haystack = [
        t.title,
        t.description,
        RISK_THEME_LABELS[t.riskTheme],
        ...t.applicableFirmTypes.map((v) => PILL_LABELS[v] ?? v),
        ...t.applicableProducts.map((v) => PILL_LABELS[v] ?? v),
        ...t.applicableCustomerTypes.map((v) => PILL_LABELS[v] ?? v),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [typologies, activeTheme, query]);

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-3">
            Typology Catalogue
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto">
            Browse all {typologies.length} financial crime typologies. Search or
            filter by risk theme, then open a typology for its red flags,
            detection logic, investigation workflow and cited sources.
          </p>
        </div>

        {/* search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, firm type, product or customer (e.g. neobank, mule, PEP)"
              aria-label="Search typologies"
              className="w-full pl-10 pr-4 py-2.5 rounded-full glass-card text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        {/* risk theme filter tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <button
            onClick={() => setActiveTheme(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              activeTheme === null
                ? "bg-accent text-white shadow-md shadow-accent/20"
                : "glass-card text-text-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          {ALL_RISK_THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => setActiveTheme(activeTheme === theme ? null : theme)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                activeTheme === theme
                  ? "shadow-md text-white"
                  : "glass-card text-text-muted hover:text-foreground"
              }`}
              style={
                activeTheme === theme
                  ? { backgroundColor: THEME_CONFIG[theme].glow, boxShadow: `0 4px 20px ${THEME_CONFIG[theme].glow}30` }
                  : undefined
              }
            >
              <RiskThemeIcon riskTheme={theme} size="sm" animated={false} />
              {RISK_THEME_LABELS[theme]}
            </button>
          ))}
        </div>

        {/* loading state */}
        {loading && (
          <div className="text-center py-20 text-text-muted">Loading typologies...</div>
        )}

        {/* grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTheme ?? "all"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
              >
                <Link
                  href={`/typology-iq/t/${t.slug}`}
                  className="block glass-card rounded-xl p-5 card-hover h-full"
                >
                  {/* header row */}
                  <div className="flex items-start gap-3 mb-3">
                    <RiskThemeIcon riskTheme={t.riskTheme} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground leading-tight mb-1">
                        {t.title}
                      </h3>
                      <span
                        className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${THEME_CONFIG[t.riskTheme].glow}20`,
                          color: THEME_CONFIG[t.riskTheme].primary,
                        }}
                      >
                        {RISK_THEME_LABELS[t.riskTheme]}
                      </span>
                    </div>
                  </div>

                  {/* description */}
                  <p className="text-xs text-text-muted leading-relaxed mb-4 line-clamp-3">
                    {t.description}
                  </p>

                  {/* pills */}
                  <div className="space-y-2">
                    <PillRow label="Firms" items={t.applicableFirmTypes} />
                    <PillRow label="Products" items={t.applicableProducts} />
                    <PillRow label="Customers" items={t.applicableCustomerTypes} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            No typologies found for this filter.
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function PillRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] text-text-muted font-medium w-16 shrink-0">
        {label}
      </span>
      {items.slice(0, 4).map((v) => (
        <span
          key={v}
          className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-muted"
        >
          {PILL_LABELS[v] ?? v}
        </span>
      ))}
      {items.length > 4 && (
        <span className="text-[10px] text-text-muted">+{items.length - 4}</span>
      )}
    </div>
  );
}
