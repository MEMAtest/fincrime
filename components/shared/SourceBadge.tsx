"use client";

import { useState } from "react";
import { BookOpen, Shield, Users, Scale, AlertTriangle, Landmark, Building2, Globe2, Gavel } from "lucide-react";
import ReferenceModal from "./ReferenceModal";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { SourceOrg } from "@/data/typologies/types";

type BadgeStyle = {
  icon: typeof BookOpen;
  lightColor: string; lightBg: string;
  darkColor: string;  darkBg: string;
};

const sourceConfig: Partial<Record<SourceOrg, BadgeStyle>> = {
  FATF:      { icon: BookOpen,   lightColor: "text-blue-700",    lightBg: "bg-blue-50 border-blue-200",       darkColor: "text-blue-400",    darkBg: "bg-blue-500/12 border-blue-500/30" },
  Wolfsberg: { icon: Users,      lightColor: "text-purple-700",  lightBg: "bg-purple-50 border-purple-200",   darkColor: "text-purple-400",  darkBg: "bg-purple-500/12 border-purple-500/30" },
  FCA:       { icon: Shield,     lightColor: "text-emerald-700", lightBg: "bg-emerald-50 border-emerald-200", darkColor: "text-emerald-400", darkBg: "bg-emerald-500/12 border-emerald-500/30" },
  JMLSG:     { icon: Scale,      lightColor: "text-amber-700",   lightBg: "bg-amber-50 border-amber-200",     darkColor: "text-amber-400",   darkBg: "bg-amber-500/12 border-amber-500/30" },
  OFSI:      { icon: AlertTriangle, lightColor: "text-red-700",  lightBg: "bg-red-50 border-red-200",         darkColor: "text-red-400",     darkBg: "bg-red-500/12 border-red-500/30" },
  MLR:       { icon: Gavel,      lightColor: "text-emerald-800", lightBg: "bg-emerald-50 border-emerald-200", darkColor: "text-emerald-400", darkBg: "bg-emerald-500/12 border-emerald-500/30" },
  FinCEN:    { icon: Landmark,   lightColor: "text-sky-700",     lightBg: "bg-sky-50 border-sky-200",         darkColor: "text-sky-400",     darkBg: "bg-sky-500/12 border-sky-500/30" },
  EU:        { icon: Globe2,     lightColor: "text-indigo-700",  lightBg: "bg-indigo-50 border-indigo-200",   darkColor: "text-indigo-400",  darkBg: "bg-indigo-500/12 border-indigo-500/30" },
  BaFin:     { icon: Building2,  lightColor: "text-rose-700",    lightBg: "bg-rose-50 border-rose-200",       darkColor: "text-rose-400",    darkBg: "bg-rose-500/12 border-rose-500/30" },
  ACPR:      { icon: Building2,  lightColor: "text-cyan-700",    lightBg: "bg-cyan-50 border-cyan-200",       darkColor: "text-cyan-400",    darkBg: "bg-cyan-500/12 border-cyan-500/30" },
  AMF:       { icon: Building2,  lightColor: "text-teal-700",    lightBg: "bg-teal-50 border-teal-200",       darkColor: "text-teal-400",    darkBg: "bg-teal-500/12 border-teal-500/30" },
  MAS:       { icon: Landmark,   lightColor: "text-orange-700",  lightBg: "bg-orange-50 border-orange-200",   darkColor: "text-orange-400",  darkBg: "bg-orange-500/12 border-orange-500/30" },
  HKMA:      { icon: Landmark,   lightColor: "text-fuchsia-700", lightBg: "bg-fuchsia-50 border-fuchsia-200", darkColor: "text-fuchsia-400", darkBg: "bg-fuchsia-500/12 border-fuchsia-500/30" },
  SFC:       { icon: Building2,  lightColor: "text-violet-700",  lightBg: "bg-violet-50 border-violet-200",   darkColor: "text-violet-400",  darkBg: "bg-violet-500/12 border-violet-500/30" },
};

const DEFAULT_STYLE: BadgeStyle = {
  icon: Landmark,
  lightColor: "text-slate-700", lightBg: "bg-slate-50 border-slate-200",
  darkColor: "text-muted",      darkBg: "bg-surface border-line-2",
};

const ORG_NAME: Partial<Record<SourceOrg, string>> = {
  FATF:      "Financial Action Task Force",
  Wolfsberg: "The Wolfsberg Group",
  FCA:       "Financial Conduct Authority (UK)",
  JMLSG:     "Joint Money Laundering Steering Group (UK)",
  OFSI:      "Office of Financial Sanctions Implementation, HM Treasury (UK)",
  MLR:       "Money Laundering Regulations 2017 (UK)",
  FinCEN:    "Financial Crimes Enforcement Network, US Treasury",
  EU:        "European Union AML framework",
  BaFin:     "Bundesanstalt fur Finanzdienstleistungsaufsicht (Germany)",
  ACPR:      "Autorite de controle prudentiel et de resolution (France)",
  AMF:       "Autorite des marches financiers (France)",
  MAS:       "Monetary Authority of Singapore",
  HKMA:      "Hong Kong Monetary Authority",
  SFC:       "Securities and Futures Commission (Hong Kong)",
};

interface SourceBadgeProps {
  source: SourceOrg;
  reference?: string;
  url?: string;
  title?: string;
}

export default function SourceBadge({ source, reference, url, title }: SourceBadgeProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const config = sourceConfig[source] ?? DEFAULT_STYLE;
  const Icon = config.icon;
  const [open, setOpen] = useState(false);

  const color = isDark ? config.darkColor : config.lightColor;
  const bg    = isDark ? config.darkBg    : config.lightBg;

  const badgeClass = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bg} ${color} cursor-pointer hover:shadow-md transition-shadow`;
  const iconClass  = `${bg} ${color}`;

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
        iconClass={iconClass}
        provision={title}
        url={url}
      />
    </>
  );
}
