import { BookOpen, Shield, Users, Scale, AlertTriangle, ExternalLink, Landmark, Building2, Globe2, Gavel } from "lucide-react";
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

interface SourceBadgeProps {
  source: SourceOrg;
  reference?: string;
  url?: string;
}

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function SourceBadge({ source, reference, url }: SourceBadgeProps) {
  const config = sourceConfig[source] ?? DEFAULT_STYLE;
  const Icon = config.icon;

  const className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}${url ? " hover:shadow-md cursor-pointer transition-shadow" : ""}`;

  const titleText = url
    ? `${reference ? reference + " · " : ""}Opens ${hostFor(url)} in a new tab`
    : reference;

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={titleText}
        aria-label={`${source}${reference ? ` ${reference}` : ""} · opens ${hostFor(url)} in a new tab`}
      >
        <Icon className="h-3 w-3" />
        <span>{source}</span>
        {reference && <span className="opacity-70 font-normal">{reference}</span>}
        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
      </a>
    );
  }

  return (
    <span className={className} title={titleText}>
      <Icon className="h-3 w-3" />
      <span>{source}</span>
      {reference && <span className="opacity-70 font-normal">{reference}</span>}
    </span>
  );
}
