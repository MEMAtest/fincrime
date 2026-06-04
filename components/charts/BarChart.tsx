"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/**
 * Horizontal animated bar chart (bespoke SVG). Brand-emerald by default.
 * Values are real; pass a formatter for currency etc.
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
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs text-text-muted truncate" title={d.label}>
              {d.label}
            </div>
            <div className="flex-1 h-6 rounded-md bg-surface overflow-hidden">
              <motion.div
                className="h-full rounded-md"
                style={{
                  background: `linear-gradient(90deg, ${d.color ?? barColor}, ${d.color ?? "#14b8a6"})`,
                }}
                initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
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
