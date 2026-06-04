"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/** Animated SVG donut with centre total + legend. */
export default function DonutChart({
  data,
  centerLabel,
  size = 168,
  thickness = 22,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const reduce = useReducedMotion();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const segments = data.map((d, i) => {
    const prior = data.slice(0, i).reduce((s, x) => s + x.value, 0);
    const frac = d.value / total;
    return { ...d, dash: frac * circ, offset: (prior / total) * circ };
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Distribution">
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-border)" strokeWidth={thickness} />
          {segments.map((s, i) => (
            <motion.circle
              key={s.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset}
              initial={reduce ? { opacity: 1 } : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            />
          ))}
        </g>
        {centerLabel ? (
          <text
            x={c}
            y={c}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-foreground">{d.label}</span>
            <span className="text-text-muted">· {d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
