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
  barColor = "#10b981",
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  barColor?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = Math.max(2, (d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs text-text-muted truncate" title={d.label}>
              {d.label}
            </div>
            <div className="flex-1 h-6 rounded-md bg-surface overflow-hidden">
              <div
                className="h-full rounded-md transition-[width] duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${d.color ?? barColor}, ${d.color ?? "#14b8a6"})`,
                }}
              />
            </div>
            <div className="w-16 shrink-0 text-right text-xs font-semibold text-foreground tabular-nums">
              {format(d.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
