export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/**
 * Horizontal bar chart (bespoke, no chart lib). Bars render at their final width
 * directly so the data is always visible, including on full-page capture, print
 * and PDF (a previous framer-motion whileInView reveal left the bars empty when
 * the intersection observer did not fire). A CSS width transition gives a subtle
 * grow only when values actually change.
 */
export default function BarChart({
  data,
  format = (n) => String(n),
}: {
  data: BarDatum[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {/* hairline baseline */}
      <div className="relative">
        {data.map((d) => {
          const pct = Math.max(2, (d.value / max) * 100);
          return (
            <div key={d.label} className="flex items-center gap-3 mb-2.5 last:mb-0">
              <div className="w-32 shrink-0 text-xs text-text-muted truncate" title={d.label}>
                {d.label}
              </div>
              <div className="flex-1 relative h-5 rounded bg-surface overflow-hidden">
                <div
                  className="h-full rounded transition-[width] duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: d.color
                      ? d.color
                      : "linear-gradient(90deg, var(--accent), var(--accent-bright))",
                  }}
                />
              </div>
              <div className="w-14 shrink-0 text-right text-xs font-semibold text-foreground tabular-nums">
                {format(d.value)}
              </div>
            </div>
          );
        })}
        {/* hairline baseline rule */}
        <div className="absolute left-[140px] right-[68px] bottom-0 h-px bg-[var(--line-2)]" />
      </div>
    </div>
  );
}
