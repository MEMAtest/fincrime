"use client";

import { useId } from "react";

type FinCrimeLogoProps = {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
};

const SIZES = { sm: 28, md: 36, lg: 48 };

function ShieldIcon({ s, animated, uid }: { s: number; animated: boolean; uid: string }) {
  const c = s / 2;
  // Node positions — pentagonal layout
  const nodes = [
    { x: c, y: s * 0.28 },            // top
    { x: s * 0.72, y: s * 0.4 },      // top-right
    { x: s * 0.66, y: s * 0.65 },     // bottom-right
    { x: s * 0.34, y: s * 0.65 },     // bottom-left
    { x: s * 0.28, y: s * 0.4 },      // top-left
  ];

  // Connection lines between nodes
  const connections: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 2], [1, 3],
    [2, 3], [2, 4],
    [3, 4], [1, 4],
  ];

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FinCrime Control Lab"
      role="img"
    >
      <defs>
        {/* Shield gradient — emerald → deep teal-navy */}
        <linearGradient id={`shield-fill-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0a2a3a" />
        </linearGradient>
        {/* Metallic bevel stroke */}
        <linearGradient id={`shield-stroke-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D6E2E8" />
          <stop offset="100%" stopColor="#C0C8D0" />
        </linearGradient>
        {/* Drop shadow */}
        <filter id={`logo-shadow-${uid}`} x="-15%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy={s * 0.02} stdDeviation={s * 0.03} floodColor="#081D2A" floodOpacity="0.35" />
        </filter>
        {/* Core glow */}
        <radialGradient id={`core-glow-${uid}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#20D5C2" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#20D5C2" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Shield body */}
      <path
        d={`M${c} ${s * 0.08} L${s * 0.85} ${s * 0.25} L${s * 0.85} ${s * 0.52} C${s * 0.85} ${s * 0.74} ${c} ${s * 0.94} ${c} ${s * 0.94} C${c} ${s * 0.94} ${s * 0.15} ${s * 0.74} ${s * 0.15} ${s * 0.52} L${s * 0.15} ${s * 0.25} Z`}
        fill={`url(#shield-fill-${uid})`}
        stroke={`url(#shield-stroke-${uid})`}
        strokeWidth={s * 0.025}
        strokeLinejoin="round"
        filter={`url(#logo-shadow-${uid})`}
      />

      {/* Glass highlight ellipse */}
      <ellipse
        cx={c - s * 0.1}
        cy={s * 0.28}
        rx={s * 0.2}
        ry={s * 0.1}
        fill="white"
        opacity={0.12}
      />

      {/* Connection lines */}
      {connections.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#D6E2E8"
          strokeWidth={s * 0.012}
          opacity={0.4}
        />
      ))}

      {/* Radial glow behind core */}
      <circle cx={c} cy={c} r={s * 0.15} fill={`url(#core-glow-${uid})`} />

      {/* Central scanning core — 3 concentric circles */}
      <circle cx={c} cy={c} r={s * 0.12} fill="none" stroke="#20D5C2" strokeWidth={s * 0.008} opacity={0.2} />
      <circle cx={c} cy={c} r={s * 0.08} fill="none" stroke="#20D5C2" strokeWidth={s * 0.01} opacity={0.4} />
      <circle
        cx={c}
        cy={c}
        r={s * 0.04}
        fill="#20D5C2"
        className={animated ? "logo-pulse" : undefined}
      />

      {/* Network nodes */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={s * 0.03}
          fill="#D6E2E8"
          stroke="#C0C8D0"
          strokeWidth={s * 0.008}
        />
      ))}
    </svg>
  );
}

export default function FinCrimeLogo({
  variant = "full",
  size = "md",
  animated = false,
  className = "",
}: FinCrimeLogoProps) {
  const s = SIZES[size];
  const uid = useId();

  if (variant === "icon") {
    return (
      <span className={`inline-flex ${className}`}>
        <ShieldIcon s={s} animated={animated} uid={uid} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ShieldIcon s={s} animated={animated} uid={uid} />
      <span className="flex flex-col">
        <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
          FinCrime Control Lab
        </span>
        <span className="text-[10px] text-text-muted tracking-wide uppercase leading-tight">
          by MEMA Consultants
        </span>
      </span>
    </span>
  );
}
