"use client";

import Link from "next/link";
import { Shield, Search, GitBranch, ArrowRight, BookOpen, Users } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <Shield className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-accent">
                  Free FinCrime Design Tools
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                Design financial crime controls{" "}
                <span className="gradient-text">with confidence</span>
              </h1>
              <p className="mt-6 text-lg text-text-muted max-w-2xl mx-auto">
                Map AML typologies to detection controls, or define partner
                control ownership — powered by FATF, Wolfsberg, and FCA
                frameworks.
              </p>
            </div>
          </div>
        </section>

        {/* Module Cards */}
        <section className="pb-20 sm:pb-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-6">
              {/* TypologyIQ */}
              <Link href="/typology-iq" className="group">
                <div className="glass-card rounded-2xl p-8 h-full transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Search className="h-5 w-5 text-accent" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                      TypologyIQ
                    </h2>
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed mb-6">
                    Select your firm type, product, and risk profile to receive a
                    tailored control framework — including detection logic, data
                    requirements, investigation workflows, and governance
                    checklists.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      10 typologies
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      FATF sourced
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      6-card output
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-accent text-sm font-medium group-hover:gap-3 transition-all">
                    <span>Start assessment</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>

              {/* PartnerControlMap */}
              <Link href="/partner-control-map" className="group">
                <div className="glass-card rounded-2xl p-8 h-full transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <GitBranch className="h-5 w-5 text-accent" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                      PartnerControlMap
                    </h2>
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed mb-6">
                    Define partner payment flows to generate a RACI matrix,
                    identify control gaps, map data dependencies, and produce
                    pre-launch conditions and governance packs.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      5 flow types
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      Wolfsberg aligned
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                      5-card output
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-accent text-sm font-medium group-hover:gap-3 transition-all">
                    <span>Start assessment</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </div>

            {/* Source badges */}
            <div className="mt-16 text-center">
              <p className="text-xs text-text-muted mb-4 uppercase tracking-wider">
                Built on authoritative frameworks
              </p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-text-muted">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">FATF Recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Wolfsberg Standards</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">FCA Guidance</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
