import { BookOpen, Shield, Users, Scale } from "lucide-react";

type SourceType = "FATF" | "Wolfsberg" | "FCA" | "JMLSG";

const sourceConfig: Record<SourceType, { icon: typeof BookOpen; color: string; bg: string }> = {
  FATF: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  Wolfsberg: { icon: Users, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  FCA: { icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  JMLSG: { icon: Scale, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
};

interface SourceBadgeProps {
  source: SourceType;
  reference?: string;
}

export default function SourceBadge({ source, reference }: SourceBadgeProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}
      title={reference}
    >
      <Icon className="h-3 w-3" />
      {source}
    </span>
  );
}
