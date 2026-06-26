import Link from "next/link";
import { Wrench, ShieldCheck, ScanSearch } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL } from "@/data/controls";
import type { Control } from "@/data/controls/types";

const typeVariant = (t: Control["controlType"]) =>
  t === "preventive" ? ("info" as const) : t === "detective" ? ("warning" as const) : ("default" as const);

const TYPE_ICON = {
  preventive: ShieldCheck,
  detective: ScanSearch,
  corrective: Wrench,
} as const;

/**
 * Read-only preview of a Control, used on enforcement case pages and anywhere a
 * control needs to be shown compactly. The editable version lives in the Control
 * Builder.
 */
export default function ControlSummaryCard({
  control,
  buildHref,
}: {
  control: Control;
  buildHref?: string;
}) {
  const TypeIcon = TYPE_ICON[control.controlType];
  return (
    <div className="glass-card rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h4 className="text-sm font-semibold text-foreground leading-tight">{control.name}</h4>
        <Badge variant={typeVariant(control.controlType)} className="gap-1 shrink-0">
          <TypeIcon className="h-3 w-3" /> {CONTROL_TYPE_LABEL[control.controlType]}
        </Badge>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
        {CONTROL_CATEGORY_LABEL[control.category]}
      </p>
      <p className="text-sm text-text-muted leading-relaxed flex-1">{control.plainSummary}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-text-muted shrink-0">Starting threshold:</dt>
          <dd className="text-foreground">{control.defaultThreshold}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-muted shrink-0">First-line owner:</dt>
          <dd className="text-foreground">{control.firstLineOwner}</dd>
        </div>
      </dl>
      {buildHref && (
        <Link
          href={buildHref}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline self-start"
        >
          <Wrench className="h-3.5 w-3.5" /> Design this control
        </Link>
      )}
    </div>
  );
}
