"use client";

import Link from "next/link";
import { ArrowRight, Landmark, UserCheck, Activity, ShieldOff, FileText, GraduationCap } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { allMaturityFrameworks } from "@/data/maturity";
import { CONTROL_AREA_LABEL } from "@/data/maturity/types";
import type { ControlArea } from "@/data/maturity/types";

const AREA_ICON: Record<ControlArea, typeof Landmark> = {
  governance: Landmark,
  cdd_kyc: UserCheck,
  transaction_monitoring: Activity,
  screening: ShieldOff,
  reporting: FileText,
  training: GraduationCap,
};

export default function MaturityListPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Controls maturity <span className="gradient-text">frameworks</span>
              </h1>
              <p className="mt-4 text-text-muted">
                Six financial-crime control areas, each with a five-level maturity model and a remediation path.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {allMaturityFrameworks.map((f) => {
                const Icon = AREA_ICON[f.area];
                return (
                  <div key={f.slug} className="tile p-6 flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground mb-1">{CONTROL_AREA_LABEL[f.area]}</h2>
                    <p className="text-sm text-text-muted leading-relaxed flex-1">{f.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 text-center">
              <Link href="/controls-maturity" className="btn-brand inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold">
                Assess your maturity <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
