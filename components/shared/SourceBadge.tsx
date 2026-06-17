"use client";

import { useState } from "react";
import { BookOpen, Shield, Users, Scale, AlertTriangle, Landmark, Building2, Globe2, Gavel } from "lucide-react";
import ReferenceModal from "./ReferenceModal";
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

  const badgeClass = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color} cursor-pointer hover:shadow-md transition-shadow`;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
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
      <ReferenceModal
        open={open}
        onClose={() => setOpen(false)}
        heading={ORG_NAME[source] ?? source}
        subheading={reference}
        icon={config.icon}
        iconClass={`${config.bg} ${config.color}`}
        provision={title}
        url={url}
      />
    </>
  );
}
