"use client";

import ReferenceLink from "@/components/shared/ReferenceLink";
import type { InsightCitation } from "@/data/insights";

interface Props {
  citations: InsightCitation[];
}

export default function ArticleCitations({ citations }: Props) {
  return (
    <div className="mt-10 pt-8 border-t border-[var(--line)]">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Sources</h2>
      <ol className="space-y-2">
        {citations.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm text-text-muted">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-semibold">
              {c.org[0]}
            </span>
            <span>
              <span className="font-medium text-foreground">{c.org}</span>
              {" · "}
              <ReferenceLink
                url={c.url}
                label={c.reference}
                heading={c.title}
                className="underline underline-offset-2 decoration-accent/40 hover:decoration-accent transition-colors text-accent"
                showIcon
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
