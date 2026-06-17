"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Shield,
  Users,
  Scale,
  AlertTriangle,
  Landmark,
  Building2,
  Globe2,
  Gavel,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { SourceOrg } from "@/data/typologies/types";

type BadgeStyle = { icon: typeof BookOpen; color: string; bg: string };

// Explicit styling for known orgs; any org not listed falls back to DEFAULT_STYLE
// so adding a new SourceOrg never breaks the build.
const sourceConfig: Partial<Record<SourceOrg, BadgeStyle>> = {
  FATF: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  Wolfsberg: { icon: Users, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  FCA: { icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  JMLSG: { icon: Scale, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  OFSI: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  MLR: { icon: Gavel, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  FinCEN: { icon: Landmark, color: "text-sky-700", bg: "bg-sky-50 border-sky-200" },
  EU: { icon: Globe2, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  BaFin: { icon: Building2, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  ACPR: { icon: Building2, color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  AMF: { icon: Building2, color: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
  MAS: { icon: Landmark, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  HKMA: { icon: Landmark, color: "text-fuchsia-700", bg: "bg-fuchsia-50 border-fuchsia-200" },
  SFC: { icon: Building2, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
};

const DEFAULT_STYLE: BadgeStyle = { icon: Landmark, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" };

// Full regulator / standard-setter names shown in the in-site reference modal.
const ORG_NAME: Partial<Record<SourceOrg, string>> = {
  FATF: "Financial Action Task Force",
  Wolfsberg: "The Wolfsberg Group",
  FCA: "Financial Conduct Authority (UK)",
  JMLSG: "Joint Money Laundering Steering Group (UK)",
  OFSI: "Office of Financial Sanctions Implementation, HM Treasury (UK)",
  MLR: "Money Laundering Regulations 2017 (UK)",
  FinCEN: "Financial Crimes Enforcement Network, US Treasury",
  EU: "European Union AML framework",
  BaFin: "Bundesanstalt fur Finanzdienstleistungsaufsicht (Germany)",
  ACPR: "Autorite de controle prudentiel et de resolution (France)",
  AMF: "Autorite des marches financiers (France)",
  MAS: "Monetary Authority of Singapore",
  HKMA: "Hong Kong Monetary Authority",
  SFC: "Securities and Futures Commission (Hong Kong)",
};

interface SourceBadgeProps {
  source: SourceOrg;
  reference?: string;
  url?: string;
  /** "What it covers" — the provision title; shown in the modal. */
  title?: string;
}

export default function SourceBadge({ source, reference, url, title }: SourceBadgeProps) {
  const config = sourceConfig[source] ?? DEFAULT_STYLE;
  const Icon = config.icon;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openModal = () => {
    setCopied(false);
    setOpen(true);
  };

  const copyReference = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const badgeClass = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color} cursor-pointer hover:shadow-md transition-shadow`;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`${ORG_NAME[source] ?? source} reference`}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${config.bg} ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">{ORG_NAME[source] ?? source}</div>
            {reference && <div className="text-xs text-slate-500 mt-0.5">{reference}</div>}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {title && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Provision</div>
              <div className="mt-1 text-sm text-slate-700">{title}</div>
            </div>
          )}
          {url && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Official source reference</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
                  {url}
                </code>
                <button
                  onClick={copyReference}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400">
            Reference summary for guidance. Verify the exact wording against the cited source before relying on it.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal();
          }
        }}
        className={badgeClass}
        aria-haspopup="dialog"
        aria-label={`${source}${reference ? ` ${reference}` : ""} reference details`}
        title={reference}
      >
        <Icon className="h-3 w-3" />
        <span>{source}</span>
        {reference && <span className="opacity-70 font-normal">{reference}</span>}
      </span>
      {open && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
