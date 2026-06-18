import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface NextStepItem {
  title: string;
  body: string;
  href: string;
  icon?: LucideIcon;
}

/**
 * Reusable "where to go next" card row of INTERNAL links (so the no-link-out
 * rule holds automatically). Used on results pages to carry the user's context
 * into the next tool.
 */
export default function NextSteps({ items, heading = "Next steps" }: { items: NextStepItem[]; heading?: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-10">
      <h3 className="text-sm font-semibold text-foreground mb-3">{heading}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="glass-card rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition-colors group"
            >
              {Icon && (
                <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1">
                  {it.title}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xs text-text-muted mt-0.5">{it.body}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
