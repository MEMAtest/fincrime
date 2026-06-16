"use client";

import { motion } from "framer-motion";
import type { RiskTheme } from "@/data/typologies/types";

interface RiskThemeIconProps {
  riskTheme: RiskTheme;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

const SIZES = { sm: 32, md: 48, lg: 64 };

const THEME_CONFIG: Record<
  RiskTheme,
  { glow: string; primary: string; secondary: string; label: string }
> = {
  fraud: {
    glow: "#8b5cf6",
    primary: "#a78bfa",
    secondary: "#7c3aed",
    label: "Fraud",
  },
  money_laundering: {
    glow: "#06b6d4",
    primary: "#22d3ee",
    secondary: "#0891b2",
    label: "Money Laundering",
  },
  sanctions_evasion: {
    glow: "#f59e0b",
    primary: "#fbbf24",
    secondary: "#d97706",
    label: "Sanctions Evasion",
  },
  terrorist_financing: {
    glow: "#ef4444",
    primary: "#f87171",
    secondary: "#dc2626",
    label: "Terrorist Financing",
  },
  proliferation_financing: {
    glow: "#10b981",
    primary: "#34d399",
    secondary: "#059669",
    label: "Proliferation Financing",
  },
  tax_evasion: {
    glow: "#f97316",
    primary: "#fb923c",
    secondary: "#ea580c",
    label: "Tax Evasion",
  },
  bribery_corruption: {
    glow: "#f43f5e",
    primary: "#fb7185",
    secondary: "#e11d48",
    label: "Bribery & Corruption",
  },
};

/* ── individual icon paths ────────────────────────── */

function FraudIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["fraud"] }) {
  const c = s / 2;
  const r = s * 0.36;
  return (
    <>
      {/* shield body */}
      <path
        d={`M${c} ${s * 0.12} L${s * 0.82} ${s * 0.28} L${s * 0.82} ${s * 0.52} C${s * 0.82} ${s * 0.72} ${c} ${s * 0.92} ${c} ${s * 0.92} C${c} ${s * 0.92} ${s * 0.18} ${s * 0.72} ${s * 0.18} ${s * 0.52} L${s * 0.18} ${s * 0.28} Z`}
        fill={`${cfg.primary}18`}
        stroke={cfg.primary}
        strokeWidth={s * 0.03}
        strokeLinejoin="round"
      />
      {/* glass highlight */}
      <ellipse
        cx={c - r * 0.15}
        cy={c - r * 0.1}
        rx={r * 0.45}
        ry={r * 0.25}
        fill="white"
        opacity={0.1}
      />
      {/* crack line */}
      <path
        d={`M${c} ${s * 0.32} L${c + s * 0.06} ${s * 0.46} L${c - s * 0.04} ${s * 0.56} L${c + s * 0.03} ${s * 0.68}`}
        fill="none"
        stroke={cfg.secondary}
        strokeWidth={s * 0.035}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* warning triangle */}
      <path
        d={`M${c} ${s * 0.38} L${c + s * 0.1} ${s * 0.56} L${c - s * 0.1} ${s * 0.56} Z`}
        fill="none"
        stroke={cfg.primary}
        strokeWidth={s * 0.025}
        strokeLinejoin="round"
        opacity={0.6}
      />
    </>
  );
}

function MoneyLaunderingIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["money_laundering"] }) {
  const c = s / 2;
  const r = s * 0.32;
  return (
    <>
      {/* outer ring */}
      <circle cx={c} cy={c} r={r} fill={`${cfg.primary}10`} stroke={cfg.primary} strokeWidth={s * 0.025} opacity={0.5} />
      {/* flow arrows - circular path */}
      <path
        d={`M${c} ${c - r * 0.7} A${r * 0.7} ${r * 0.7} 0 1 1 ${c - r * 0.05} ${c - r * 0.7}`}
        fill="none"
        stroke={cfg.primary}
        strokeWidth={s * 0.03}
        strokeLinecap="round"
        strokeDasharray={`${s * 0.08} ${s * 0.05}`}
      />
      {/* inner wave */}
      <path
        d={`M${c - r * 0.6} ${c + r * 0.15} Q${c - r * 0.3} ${c - r * 0.2} ${c} ${c + r * 0.1} Q${c + r * 0.3} ${c + r * 0.4} ${c + r * 0.6} ${c + r * 0.1}`}
        fill="none"
        stroke={cfg.secondary}
        strokeWidth={s * 0.025}
        strokeLinecap="round"
      />
      {/* second wave */}
      <path
        d={`M${c - r * 0.5} ${c - r * 0.15} Q${c - r * 0.2} ${c - r * 0.45} ${c + r * 0.1} ${c - r * 0.2} Q${c + r * 0.35} ${c} ${c + r * 0.55} ${c - r * 0.2}`}
        fill="none"
        stroke={cfg.primary}
        strokeWidth={s * 0.02}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* glass highlight */}
      <ellipse cx={c - r * 0.25} cy={c - r * 0.35} rx={r * 0.3} ry={r * 0.15} fill="white" opacity={0.08} />
    </>
  );
}

function SanctionsEvasionIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["sanctions_evasion"] }) {
  const c = s / 2;
  return (
    <>
      {/* barrier rectangle */}
      <rect
        x={s * 0.2}
        y={s * 0.3}
        width={s * 0.6}
        height={s * 0.4}
        rx={s * 0.04}
        fill={`${cfg.primary}12`}
        stroke={cfg.primary}
        strokeWidth={s * 0.025}
      />
      {/* horizontal bars */}
      <line x1={s * 0.28} y1={s * 0.42} x2={s * 0.72} y2={s * 0.42} stroke={cfg.secondary} strokeWidth={s * 0.03} strokeLinecap="round" />
      <line x1={s * 0.28} y1={s * 0.52} x2={s * 0.72} y2={s * 0.52} stroke={cfg.primary} strokeWidth={s * 0.025} strokeLinecap="round" opacity={0.7} />
      <line x1={s * 0.28} y1={s * 0.62} x2={s * 0.72} y2={s * 0.62} stroke={cfg.secondary} strokeWidth={s * 0.03} strokeLinecap="round" />
      {/* block X */}
      <circle cx={c} cy={c} r={s * 0.14} fill={`${cfg.secondary}30`} stroke={cfg.secondary} strokeWidth={s * 0.02} />
      <line x1={c - s * 0.07} y1={c - s * 0.07} x2={c + s * 0.07} y2={c + s * 0.07} stroke={cfg.primary} strokeWidth={s * 0.03} strokeLinecap="round" />
      <line x1={c + s * 0.07} y1={c - s * 0.07} x2={c - s * 0.07} y2={c + s * 0.07} stroke={cfg.primary} strokeWidth={s * 0.03} strokeLinecap="round" />
      {/* glass highlight */}
      <ellipse cx={c - s * 0.12} cy={s * 0.35} rx={s * 0.15} ry={s * 0.05} fill="white" opacity={0.08} />
    </>
  );
}

function TerroristFinancingIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["terrorist_financing"] }) {
  const c = s / 2;
  return (
    <>
      {/* beacon base */}
      <rect x={c - s * 0.06} y={s * 0.55} width={s * 0.12} height={s * 0.22} rx={s * 0.02} fill={cfg.secondary} opacity={0.8} />
      {/* beacon top */}
      <circle cx={c} cy={s * 0.42} r={s * 0.08} fill={cfg.primary} />
      <circle cx={c} cy={s * 0.42} r={s * 0.05} fill="white" opacity={0.3} />
      {/* pulse rings */}
      <circle cx={c} cy={s * 0.42} r={s * 0.16} fill="none" stroke={cfg.primary} strokeWidth={s * 0.015} opacity={0.5} />
      <circle cx={c} cy={s * 0.42} r={s * 0.24} fill="none" stroke={cfg.primary} strokeWidth={s * 0.012} opacity={0.3} />
      <circle cx={c} cy={s * 0.42} r={s * 0.33} fill="none" stroke={cfg.primary} strokeWidth={s * 0.008} opacity={0.15} />
      {/* glass highlight */}
      <ellipse cx={c - s * 0.03} cy={s * 0.39} rx={s * 0.04} ry={s * 0.02} fill="white" opacity={0.25} />
    </>
  );
}

function ProliferationFinancingIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["proliferation_financing"] }) {
  const c = s / 2;
  const r = s * 0.12;
  return (
    <>
      {/* central node */}
      <circle cx={c} cy={c} r={r} fill={`${cfg.primary}25`} stroke={cfg.primary} strokeWidth={s * 0.025} />
      <circle cx={c} cy={c} r={r * 0.4} fill={cfg.primary} opacity={0.6} />
      {/* network spokes + outer nodes */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const ox = c + Math.cos(rad) * s * 0.3;
        const oy = c + Math.sin(rad) * s * 0.3;
        return (
          <g key={angle}>
            <line x1={c} y1={c} x2={ox} y2={oy} stroke={cfg.primary} strokeWidth={s * 0.015} opacity={0.4} />
            <circle cx={ox} cy={oy} r={s * 0.04} fill={`${cfg.secondary}40`} stroke={cfg.secondary} strokeWidth={s * 0.015} />
          </g>
        );
      })}
      {/* radiation rings */}
      <circle cx={c} cy={c} r={s * 0.2} fill="none" stroke={cfg.primary} strokeWidth={s * 0.008} opacity={0.2} strokeDasharray={`${s * 0.03} ${s * 0.03}`} />
      {/* glass highlight */}
      <ellipse cx={c - r * 0.3} cy={c - r * 0.3} rx={r * 0.5} ry={r * 0.25} fill="white" opacity={0.12} />
    </>
  );
}

function TaxEvasionIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["tax_evasion"] }) {
  const c = s / 2;
  return (
    <>
      {/* back layer */}
      <rect x={s * 0.3} y={s * 0.18} width={s * 0.44} height={s * 0.56} rx={s * 0.03} fill={`${cfg.secondary}20`} stroke={cfg.secondary} strokeWidth={s * 0.015} opacity={0.5} />
      {/* middle layer */}
      <rect x={s * 0.26} y={s * 0.24} width={s * 0.44} height={s * 0.56} rx={s * 0.03} fill={`${cfg.primary}15`} stroke={cfg.primary} strokeWidth={s * 0.02} opacity={0.7} />
      {/* front document */}
      <rect x={s * 0.22} y={s * 0.3} width={s * 0.44} height={s * 0.56} rx={s * 0.03} fill={`${cfg.primary}10`} stroke={cfg.primary} strokeWidth={s * 0.025} />
      {/* text lines */}
      <line x1={s * 0.3} y1={s * 0.42} x2={s * 0.56} y2={s * 0.42} stroke={cfg.primary} strokeWidth={s * 0.02} strokeLinecap="round" opacity={0.6} />
      <line x1={s * 0.3} y1={s * 0.5} x2={s * 0.5} y2={s * 0.5} stroke={cfg.secondary} strokeWidth={s * 0.018} strokeLinecap="round" opacity={0.5} />
      <line x1={s * 0.3} y1={s * 0.58} x2={s * 0.54} y2={s * 0.58} stroke={cfg.primary} strokeWidth={s * 0.02} strokeLinecap="round" opacity={0.6} />
      {/* hidden eye */}
      <path
        d={`M${s * 0.36} ${s * 0.7} Q${s * 0.44} ${s * 0.64} ${s * 0.52} ${s * 0.7} Q${s * 0.44} ${s * 0.76} ${s * 0.36} ${s * 0.7}`}
        fill="none"
        stroke={cfg.secondary}
        strokeWidth={s * 0.02}
        strokeLinecap="round"
      />
      <circle cx={s * 0.44} cy={s * 0.7} r={s * 0.025} fill={cfg.secondary} />
      {/* strike-through */}
      <line x1={s * 0.34} y1={s * 0.74} x2={s * 0.54} y2={s * 0.66} stroke={cfg.primary} strokeWidth={s * 0.018} strokeLinecap="round" opacity={0.8} />
      {/* glass highlight */}
      <ellipse cx={s * 0.35} cy={s * 0.34} rx={s * 0.1} ry={s * 0.03} fill="white" opacity={0.08} />
    </>
  );
}

function BriberyCorruptionIcon({ s, cfg }: { s: number; cfg: (typeof THEME_CONFIG)["bribery_corruption"] }) {
  const c = s / 2;
  return (
    <>
      {/* shadow behind handshake */}
      <ellipse cx={c} cy={s * 0.72} rx={s * 0.28} ry={s * 0.06} fill={cfg.secondary} opacity={0.15} />
      {/* left hand */}
      <path
        d={`M${s * 0.18} ${s * 0.48} L${s * 0.38} ${s * 0.48} Q${s * 0.44} ${s * 0.48} ${s * 0.48} ${s * 0.44} L${s * 0.52} ${s * 0.4}`}
        fill="none"
        stroke={cfg.primary}
        strokeWidth={s * 0.03}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* right hand */}
      <path
        d={`M${s * 0.82} ${s * 0.48} L${s * 0.62} ${s * 0.48} Q${s * 0.56} ${s * 0.48} ${s * 0.52} ${s * 0.44} L${s * 0.48} ${s * 0.4}`}
        fill="none"
        stroke={cfg.secondary}
        strokeWidth={s * 0.03}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* clasped hands middle */}
      <rect x={s * 0.38} y={s * 0.38} width={s * 0.24} height={s * 0.14} rx={s * 0.04} fill={`${cfg.primary}18`} stroke={cfg.primary} strokeWidth={s * 0.02} />
      {/* coin / money drop */}
      <circle cx={c} cy={s * 0.62} r={s * 0.06} fill={`${cfg.secondary}35`} stroke={cfg.secondary} strokeWidth={s * 0.018} />
      <text x={c} y={s * 0.645} textAnchor="middle" fill={cfg.secondary} fontSize={s * 0.07} fontWeight="bold">$</text>
      {/* left arm */}
      <line x1={s * 0.08} y1={s * 0.36} x2={s * 0.18} y2={s * 0.48} stroke={cfg.primary} strokeWidth={s * 0.03} strokeLinecap="round" opacity={0.7} />
      {/* right arm */}
      <line x1={s * 0.92} y1={s * 0.36} x2={s * 0.82} y2={s * 0.48} stroke={cfg.secondary} strokeWidth={s * 0.03} strokeLinecap="round" opacity={0.7} />
      {/* glass highlight */}
      <ellipse cx={c - s * 0.05} cy={s * 0.4} rx={s * 0.08} ry={s * 0.025} fill="white" opacity={0.1} />
    </>
  );
}

/* ── icon lookup ──────────────────────────────────── */

const ICON_COMPONENTS: Record<
  RiskTheme,
  (props: { s: number; cfg: (typeof THEME_CONFIG)[RiskTheme] }) => React.JSX.Element
> = {
  fraud: FraudIcon,
  money_laundering: MoneyLaunderingIcon,
  sanctions_evasion: SanctionsEvasionIcon,
  terrorist_financing: TerroristFinancingIcon,
  proliferation_financing: ProliferationFinancingIcon,
  tax_evasion: TaxEvasionIcon,
  bribery_corruption: BriberyCorruptionIcon,
};

/* ── main component ───────────────────────────────── */

export default function RiskThemeIcon({
  riskTheme,
  size = "md",
  animated = true,
}: RiskThemeIconProps) {
  const s = SIZES[size];
  const cfg = THEME_CONFIG[riskTheme];
  const IconComponent = ICON_COMPONENTS[riskTheme];
  const filterId = `glass-${riskTheme}-${size}`;
  const glowId = `glow-${riskTheme}-${size}`;

  const wrapper = (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={cfg.label}
      role="img"
    >
      <defs>
        {/* glassmorphic blur filter */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={s * 0.02} />
        </filter>
        {/* glow filter */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={s * 0.06} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* radial gradient bg */}
        <radialGradient id={`bg-${riskTheme}-${size}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor={cfg.glow} stopOpacity={0.12} />
          <stop offset="100%" stopColor={cfg.glow} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* background glow circle */}
      <circle cx={s / 2} cy={s / 2} r={s * 0.45} fill={`url(#bg-${riskTheme}-${size})`} />

      {/* glassmorphic backdrop */}
      <rect
        x={s * 0.08}
        y={s * 0.08}
        width={s * 0.84}
        height={s * 0.84}
        rx={s * 0.18}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={s * 0.015}
        filter={`url(#${filterId})`}
      />

      {/* icon content */}
      <g filter={`url(#${glowId})`}>
        <IconComponent s={s} cfg={cfg} />
      </g>
    </svg>
  );

  if (!animated) return wrapper;

  return (
    <motion.div
      className="inline-flex"
      animate={{
        y: [0, -2, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      whileHover={{
        scale: 1.1,
        rotate: [0, -3, 3, 0],
        transition: { duration: 0.5 },
      }}
    >
      {wrapper}
    </motion.div>
  );
}

export { THEME_CONFIG };
