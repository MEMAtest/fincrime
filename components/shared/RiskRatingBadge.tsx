import { AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";

type RiskLevel = "low" | "medium" | "high" | "critical";

const riskConfig: Record<RiskLevel, { icon: typeof CheckCircle; label: string; color: string; bg: string }> = {
  low: {
    icon: CheckCircle,
    label: "Low Risk",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  medium: {
    icon: AlertTriangle,
    label: "Medium Risk",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  high: {
    icon: AlertCircle,
    label: "High Risk",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  critical: {
    icon: XCircle,
    label: "Critical Risk",
    color: "text-red-800",
    bg: "bg-red-100 border-red-300",
  },
};

interface RiskRatingBadgeProps {
  level: RiskLevel;
  score?: number;
  className?: string;
}

export default function RiskRatingBadge({ level, score, className = "" }: RiskRatingBadgeProps) {
  const config = riskConfig[level];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${config.bg} ${config.color} ${className}`}
    >
      <Icon className="h-4 w-4" />
      {config.label}
      {score !== undefined && <span className="ml-1 font-mono">({score})</span>}
    </span>
  );
}
