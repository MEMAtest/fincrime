"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, ArrowRight, AlertCircle, Building2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import AiDisclosure from "@/components/shared/AiDisclosure";
import type { RiskTheme, FirmType, ProductType, CustomerType } from "@/data/typologies/types";

interface FirmResearchResult {
  summary: string;
  riskThemes: RiskTheme[];
  suggestedFirmType: FirmType | null;
  suggestedProduct: ProductType | null;
  suggestedCustomerType: CustomerType | null;
  rationale: string;
  topTypologies: { slug: string; title: string; riskTheme: RiskTheme }[];
  source: "ai" | "fallback";
}

export default function FirmResearchPage() {
  const [firmName, setFirmName] = useState("");
  const [description, setDescription] = useState("");
  const [geographies, setGeographies] = useState("");
  const [products, setProducts] = useState("");
  const [customers, setCustomers] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FirmResearchResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!firmName.trim() && !description.trim()) {
      setError("Please enter at least a firm name or a short description.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/firm-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmName, description, geographies, products, customers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Research failed");
      }
      const data = (await res.json()) as FirmResearchResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const wizardLink = (() => {
    if (!result) return null;
    const params = new URLSearchParams();
    if (result.suggestedFirmType) params.set("firmType", result.suggestedFirmType);
    if (result.suggestedProduct) params.set("product", result.suggestedProduct);
    if (result.suggestedCustomerType) params.set("customerType", result.suggestedCustomerType);
    if (result.riskThemes.length > 0) params.set("riskThemes", result.riskThemes.join(","));
    return `/typology-iq?${params.toString()}`;
  })();

  return (
    <>
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-medium text-accent">Firm Risk Profiler</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Research a firm: get likely risks
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto">
            Enter a firm name or a few details about the business model and we&apos;ll suggest the
            financial crime risk themes most likely to apply, then route you into the TypologyIQ
            wizard with those answers pre-filled.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div>
            <label htmlFor="firmName" className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Firm Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                id="firmName"
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="e.g. Acme Payments Ltd"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-card-border bg-white/[0.02] text-foreground placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              What does the firm do? <span className="text-text-muted normal-case">(sector, business model)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. UK-authorised EMI providing cross-border payments and prepaid cards, mainly to SMEs trading internationally."
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-white/[0.02] text-foreground placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm leading-relaxed"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="geographies" className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                Geographies
              </label>
              <input
                id="geographies"
                type="text"
                value={geographies}
                onChange={(e) => setGeographies(e.target.value)}
                placeholder="UK, EU, MENA"
                className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-white/[0.02] text-foreground placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
              />
            </div>
            <div>
              <label htmlFor="products" className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                Products
              </label>
              <input
                id="products"
                type="text"
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                placeholder="cards, FX, accounts"
                className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-white/[0.02] text-foreground placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
              />
            </div>
            <div>
              <label htmlFor="customers" className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                Customers
              </label>
              <input
                id="customers"
                type="text"
                value={customers}
                onChange={(e) => setCustomers(e.target.value)}
                placeholder="SMEs, corporates"
                className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-white/[0.02] text-foreground placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs text-text-muted">
              We do not store firm names submitted here. AI suggestions are not legal advice.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analysing
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Suggest risks
                </>
              )}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-10 space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Risk Summary</h2>
                {result.source === "fallback" ? (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-text-muted">
                    Rules-based
                  </span>
                ) : (
                  <span className="ml-auto">
                    <AiDisclosure />
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{result.summary}</p>
              {result.rationale && (
                <p className="text-xs text-text-muted/80 leading-relaxed mt-3 italic">
                  {result.rationale}
                </p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Suggested Risk Themes
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.riskThemes.map((theme) => {
                  const cfg = THEME_CONFIG[theme];
                  return (
                    <div
                      key={theme}
                      className="flex items-center gap-3 glass-card rounded-xl p-4"
                      style={{ borderColor: `${cfg.primary}30` }}
                    >
                      <RiskThemeIcon riskTheme={theme} size="sm" animated={false} />
                      <span className="text-sm font-medium text-foreground">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {result.topTypologies.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  Likely Relevant Typologies
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {result.topTypologies.map((t) => {
                    const cfg = THEME_CONFIG[t.riskTheme];
                    return (
                      <div key={t.slug} className="glass-card rounded-xl p-4 flex items-start gap-3">
                        <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">
                            {t.title}
                          </p>
                          <span
                            className="inline-block mt-1 text-[10px] uppercase tracking-wider font-medium"
                            style={{ color: cfg.primary }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {wizardLink && (
              <div className="flex justify-end">
                <Link
                  href={wizardLink}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
                >
                  Continue in TypologyIQ wizard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
