import { BookOpen, Shield, Users, Scale, AlertTriangle, ExternalLink } from "lucide-react";

type SourceType = "FATF" | "Wolfsberg" | "FCA" | "JMLSG" | "OFSI";

const sourceConfig: Record<SourceType, { icon: typeof BookOpen; color: string; bg: string }> = {
  FATF: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  Wolfsberg: { icon: Users, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  FCA: { icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  JMLSG: { icon: Scale, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  OFSI: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

interface SourceBadgeProps {
  source: SourceType;
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
  const config = sourceConfig[source];
  const Icon = config.icon;

  const className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}${url ? " hover:shadow-md cursor-pointer transition-shadow" : ""}`;

  const titleText = url
    ? `${reference ? reference + " — " : ""}Opens ${hostFor(url)} in a new tab`
    : reference;

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={titleText}
        aria-label={`${source}${reference ? ` ${reference}` : ""} — opens ${hostFor(url)} in a new tab`}
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
